#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { GOOGLE_CHAT_SECRET_NAMES } from "./oauth-session.mjs";
import { GOOGLE_CHAT_INTERVALS, renderGoogleChatWorkflow } from "./schedule.mjs";

const exec = promisify(execFile);
const moduleRoot = dirname(fileURLToPath(import.meta.url));
const runtimeFiles = ["client.mjs", "history.mjs", "refresh-token.mjs", "continuous-sync.mjs"];

function readOptional(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, path);
}

async function run(binary, argv, root, timeout = 30_000) {
  return exec(binary, argv, { cwd: root, timeout, maxBuffer: 2 * 1024 * 1024 });
}

function classify(error) {
  const source = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
  if (/non-fast-forward|rejected|fetch first|divergent/.test(source)) return { code: "git-conflict", message: "remoteに別の変更があるためpushを止め、変更前へ戻しました。git pull後に設定をやり直してください。" };
  if (/resource not accessible|permission|forbidden|403/.test(source)) return { code: "github-permission", message: "GitHubの書込権限を確認できないため、変更前へ戻しました。" };
  return { code: "git", message: "設定をリポジトリへ反映できなかったため、変更前へ戻しました。" };
}

function normalizedSpaces(spaces) {
  const seen = new Set();
  return (spaces || []).map((space) => ({ name: String(space.name || ""), displayName: String(space.displayName || space.name || ""), spaceType: String(space.spaceType || "") })).filter((space) => {
    if (!/^spaces\/[^/]+$/.test(space.name) || space.spaceType !== "SPACE" || seen.has(space.name)) return false;
    seen.add(space.name);
    return true;
  });
}

export async function applyGoogleChatConfig({ root, selectedSpaces, availableSpaces = selectedSpaces, interval, automaticPushConsent, commitPushConsent }) {
  root = resolve(root);
  const requestedNames = new Set((selectedSpaces || []).map((space) => String(space?.name || "")));
  const selected = normalizedSpaces(selectedSpaces);
  const available = normalizedSpaces(availableSpaces);
  if (selected.length === 0) throw Object.assign(new Error("通常スペースを1件以上選んでください。"), { code: "space-required" });
  if (selected.length !== requestedNames.size) throw Object.assign(new Error("通常スペース以外または形式が不正な対象は設定できません。"), { code: "space-not-allowed" });
  const availableNames = new Set(available.map((space) => space.name));
  if (selected.some((space) => !availableNames.has(space.name))) throw Object.assign(new Error("候補にないスペースは設定できません。"), { code: "space-not-allowed" });
  if (!GOOGLE_CHAT_INTERVALS[interval]) throw Object.assign(new Error("自動取得の間隔を選び直してください。"), { code: "interval-invalid" });
  if (commitPushConsent !== true) throw Object.assign(new Error("設定ファイルと自動取得処理のcommit・pushへの明示同意が必要です。"), { code: "consent-required" });
  const scheduleEnabled = interval !== "manual";
  if (scheduleEnabled && automaticPushConsent !== true) throw Object.assign(new Error("定期取得と自動commit・pushへの明示同意が必要です。"), { code: "consent-required" });

  const git = process.env.YASASHII_GIT_BIN || "git";
  const gh = process.env.YASASHII_GH_BIN || "gh";
  if (process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE !== "1") {
    try {
      const detail = JSON.parse((await run(gh, ["repo", "view", "--json", "visibility"], root)).stdout || "{}");
      if (String(detail.visibility).toUpperCase() !== "PRIVATE") throw new Error("public");
    } catch {
      throw Object.assign(new Error("非公開のGitHubリポジトリを確認できないため、設定を変更していません。"), { code: "private-required" });
    }
  }
  if (process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS !== "1") {
    try {
      const list = JSON.parse((await run(gh, ["secret", "list", "--json", "name"], root)).stdout || "[]");
      const names = new Set(list.map((item) => item.name));
      if (GOOGLE_CHAT_SECRET_NAMES.some((name) => !names.has(name))) throw new Error("missing");
    } catch {
      throw Object.assign(new Error("Google Chat用のRepository Secret 3件を確認できないため、設定を変更していません。"), { code: "secret-missing" });
    }
  }

  const entries = [
    [join(root, "google-chat", "config.json"), "google-chat/config.json"],
    [join(root, "google-chat", "spaces.json"), "google-chat/spaces.json"],
    [join(root, ".github", "workflows", "google-chat-sync.yml"), ".github/workflows/google-chat-sync.yml"],
    ...runtimeFiles.map((name) => [join(root, "google-chat", "scripts", name), `google-chat/scripts/${name}`]),
  ];
  const snapshots = new Map(entries.map(([path]) => [path, readOptional(path)]));
  let oldHead = null;
  let newHead = null;
  try {
    if (process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT !== "1") {
      const status = await run(git, ["status", "--porcelain", "--", ...entries.map(([, relative]) => relative)], root);
      if (status.stdout.trim()) throw Object.assign(new Error("Google Chat設定に未commitの変更があります。先に内容を確認してください。"), { code: "dirty-config" });
      oldHead = (await run(git, ["rev-parse", "HEAD"], root)).stdout.trim();
    }
    const config = {
      version: 2,
      selectedSpaceNames: selected.map((space) => space.name),
      selectedSpaces: selected,
      interval,
      scheduleEnabled,
      automaticPushConsent: scheduleEnabled && automaticPushConsent === true,
    };
    writeAtomic(entries[0][0], `${JSON.stringify(config, null, 2)}\n`);
    writeAtomic(entries[1][0], `${JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), spaces: available }, null, 2)}\n`);
    writeAtomic(entries[2][0], renderGoogleChatWorkflow(interval, scheduleEnabled));
    for (const name of runtimeFiles) writeAtomic(join(root, "google-chat", "scripts", name), readFileSync(join(moduleRoot, name), "utf8"));
    if (process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT === "1") return { status: "saved", config, workflow: { schedule: scheduleEnabled, interval } };
    await run(git, ["add", "--", ...entries.map(([, relative]) => relative)], root);
    await run(git, ["commit", "-m", "Google Chatのスペースと自動取得の間隔を変更"], root);
    newHead = (await run(git, ["rev-parse", "HEAD"], root)).stdout.trim();
    await run(git, ["push"], root, 60_000);
    return { status: "pushed", config, workflow: { schedule: scheduleEnabled, interval }, commit: newHead };
  } catch (error) {
    if (newHead && oldHead) {
      try { await run(git, ["update-ref", "HEAD", oldHead, newHead], root); } catch { /* ファイル復元を続ける */ }
    }
    for (const [path, content] of snapshots) {
      if (content === null) rmSync(path, { force: true });
      else writeAtomic(path, content);
    }
    if (oldHead && process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT !== "1") {
      try { await run(git, ["restore", "--source", oldHead, "--staged", "--worktree", "--", ...entries.map(([, relative]) => relative)], root); } catch { /* snapshotで内容は復元済み */ }
    }
    if (error.code === "dirty-config") throw error;
    const detail = classify(error);
    throw Object.assign(new Error(detail.message), { code: detail.code });
  }
}

async function main() {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  const selectedSpaces = JSON.parse(args.get("--spaces-json") || "[]");
  const result = await applyGoogleChatConfig({ root: args.get("--root") || process.cwd(), selectedSpaces, interval: args.get("--interval") || "3h", automaticPushConsent: args.get("--automatic-consent") === "yes", commitPushConsent: args.get("--commit-consent") === "yes" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => { process.stderr.write(`${JSON.stringify({ status: "failed", code: error.code || "unknown", message: error.message })}\n`); process.exit(3); });
}
