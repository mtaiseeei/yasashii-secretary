#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createGoogleChatClient } from "./client.mjs";
import { normalizeMessage, writeSpaceHistory } from "./history.mjs";
import { exchangeRefreshToken } from "./refresh-token.mjs";
import { workingRoot, writeFileAtomicSafe } from "./runtime-safety.mjs";

function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

function writeJsonAtomic(root, path, value) {
  writeFileAtomicSafe(root, path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function overlapStart(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time - 24 * 60 * 60 * 1000).toISOString() : null;
}

function selectedNames(config) {
  return [...new Set((config?.selectedSpaceNames || []).map(String))];
}

export async function continuousGoogleChatSync({
  root,
  trigger = "manual",
  env = process.env,
  client: providedClient = null,
  now = env.CC_SECRETARY_NOW || new Date().toISOString(),
} = {}) {
  root = workingRoot(root || process.cwd());
  const configPath = join(root, "google-chat", "config.json");
  const statePath = join(root, "google-chat", "state", "sync.json");
  const config = readJson(configPath);
  if (!config) throw Object.assign(new Error("Google Chat設定を読み取れません。wizardで設定してください。"), { code: "config-missing" });
  if (trigger === "schedule" && (!config.scheduleEnabled || !config.automaticPushConsent)) {
    throw Object.assign(new Error("自動取得への同意が無効なため、schedule取得を開始しません。"), { code: "consent-required" });
  }
  const selected = selectedNames(config);
  if (selected.length === 0) throw Object.assign(new Error("取得する通常スペースが選ばれていません。"), { code: "space-required" });

  let accessToken = null;
  let client = providedClient;
  try {
    if (!client) {
      accessToken = await exchangeRefreshToken({
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT,
      });
      client = createGoogleChatClient({ accessToken });
    }
    const previous = readJson(statePath, { version: 2, status: "not-run", cursors: {}, results: [] });
    const cursors = { ...(previous.cursors || {}) };
    const results = [];
    for (const name of selected) {
      const oldCursor = cursors[name] || null;
      try {
        const verified = await client.getSpace(name);
        if (verified.spaceType !== "SPACE") throw Object.assign(new Error("DMまたはグループDMは取得できません。"), { code: "space-type-rejected" });
        const source = await client.listAllMessages(name, { after: oldCursor?.windowStart || "" });
        const normalized = [];
        for (const message of source) normalized.push(normalizeMessage(message, await client.displayName(message.sender?.name)));
        const files = writeSpaceHistory({ root, space: { name, displayName: verified.displayName || name }, messages: normalized });
        const newest = normalized.map((item) => item.createTime).sort().at(-1) || oldCursor?.newestCreateTime || null;
        cursors[name] = {
          newestCreateTime: newest,
          windowStart: newest ? overlapStart(newest) : (oldCursor?.windowStart || null),
          lastSuccessAt: now,
        };
        results.push({ name, status: "success", fetched: normalized.length, files: files.length, cursor: cursors[name] });
      } catch (error) {
        results.push({ name, status: "failed", code: error.code || "fetch-failed", message: error.message, cursor: oldCursor });
      }
    }
    const succeeded = results.filter((item) => item.status === "success").length;
    const status = succeeded === results.length ? "success" : succeeded === 0 ? "failed" : "partial";
    const state = {
      version: 2,
      status,
      attemptedAt: now,
      lastSuccessAt: status === "success" ? now : (previous.lastSuccessAt || null),
      cursors,
      results,
    };
    writeJsonAtomic(root, statePath, state);
    if (status !== "success") {
      const kinds = [...new Set(results.filter((item) => item.status === "failed").map((item) => item.code))];
      throw Object.assign(new Error(`一部または全部のスペースを取得できませんでした。失敗種別: ${kinds.join(",")}。成功したスペースの履歴と取得位置は保持しました。`), { code: status === "partial" ? "partial-space" : (kinds[0] || "sync-failed"), state });
    }
    return state;
  } finally {
    accessToken = null;
  }
}

async function main() {
  const root = workingRoot(process.argv[2] || process.cwd());
  try {
    const state = await continuousGoogleChatSync({ root, trigger: process.env.GOOGLE_CHAT_TRIGGER || "manual" });
    const fetched = state.results.reduce((sum, item) => sum + item.fetched, 0);
    process.stdout.write(`Google Chat取得: 成功${state.results.length}スペース／失敗0スペース／${fetched}件。\n`);
  } catch (error) {
    const statePath = join(root, "google-chat", "state", "sync.json");
    if (!error.state) {
      const previous = readJson(statePath, { version: 2, cursors: {}, results: [], lastSuccessAt: null });
      const reauth = ["reauthorization-needed", "reauth-required", "scope-insufficient"].includes(error.code);
      writeJsonAtomic(root, statePath, { ...previous, version: 2, status: reauth ? "reauthorization-needed" : "failed", attemptedAt: process.env.CC_SECRETARY_NOW || new Date().toISOString(), error: error.code || "sync-failed", message: error.message });
    }
    process.stderr.write(`GOOGLE_CHAT_ERROR=${error.code || "sync-failed"}\n${error.message}\n`);
    process.exitCode = 4;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
