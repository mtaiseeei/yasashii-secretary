#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { INTERVALS, renderWorkflow } from "./schedule.mjs";

const exec = promisify(execFile);

function writeAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, content, { mode: 0o600 });
  renameSync(temporary, path);
}

function readOptional(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

async function run(binary, args, root, timeout = 30_000) {
  return exec(binary, args, { cwd: root, timeout, maxBuffer: 1024 * 1024 });
}

function classify(error) {
  const output = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
  if (/non-fast-forward|rejected|fetch first/.test(output)) return { code: "git-conflict", message: "remoteに別の変更があるためpushを止めました。git pullで取り込んでから設定をやり直してください。" };
  if (/resource not accessible|permission|forbidden|403/.test(output)) return { code: "github-permission", message: "GitHubの書込権限を確認できません。repoのActions権限を確認してください。" };
  return { code: "git", message: "設定をrepoへ反映できませんでした。変更前の状態へ戻しました。" };
}

export async function applyChatworkConfig({ root, selectedRoomIds, interval, automaticPushConsent }) {
  root = resolve(root);
  const selected = [...new Set((selectedRoomIds || []).map(String))];
  if (selected.length === 0) throw Object.assign(new Error("roomを1つ以上選んでください。"), { code: "room-required" });
  if (selected.some((id) => !/^\d+$/.test(id))) throw Object.assign(new Error("Room IDの形式が不正です。"), { code: "room-invalid" });
  if (!INTERVALS[interval]) throw Object.assign(new Error("同期間隔を選び直してください。"), { code: "interval-invalid" });
  const scheduleEnabled = interval !== "manual";
  if (scheduleEnabled && automaticPushConsent !== true) {
    throw Object.assign(new Error("対象room、頻度、保存内容、自動commit・pushへの同意が必要です。"), { code: "consent-required" });
  }

  const git = process.env.YASASHII_GIT_BIN || "git";
  const gh = process.env.YASASHII_GH_BIN || "gh";
  if (process.env.YASASHII_CHATWORK_TEST_PRIVATE !== "1") {
    try {
      const viewed = JSON.parse((await run(gh, ["repo", "view", "--json", "visibility"], root)).stdout || "{}");
      if (String(viewed.visibility).toUpperCase() !== "PRIVATE") throw new Error("public");
    } catch {
      throw Object.assign(new Error("private GitHub repoを確認できないため、設定を変更していません。"), { code: "private-required" });
    }
  }
  if (process.env.YASASHII_CHATWORK_TEST_SECRET !== "1") {
    try {
      const listed = await run(gh, ["secret", "list", "--json", "name"], root);
      const names = JSON.parse(listed.stdout || "[]").map((item) => item.name);
      if (!names.includes("CHATWORK_API_TOKEN")) throw new Error("missing");
    } catch {
      throw Object.assign(new Error("Repository Secret CHATWORK_API_TOKENを確認できないため、設定を変更していません。"), { code: "secret-missing" });
    }
  }

  const configPath = join(root, "chatwork", "config.json");
  const workflowPath = join(root, ".github", "workflows", "chatwork-sync.yml");
  const relativePaths = ["chatwork/config.json", ".github/workflows/chatwork-sync.yml"];
  const snapshots = new Map([[configPath, readOptional(configPath)], [workflowPath, readOptional(workflowPath)]]);
  let oldHead = null;
  let newHead = null;
  try {
    if (process.env.YASASHII_CHATWORK_SKIP_GIT !== "1") {
      const status = await run(git, ["status", "--porcelain", "--", ...relativePaths], root);
      if (status.stdout.trim()) throw Object.assign(new Error("Chatwork設定に未commitの変更があります。先に内容を確認してください。"), { code: "dirty-config" });
      oldHead = (await run(git, ["rev-parse", "HEAD"], root)).stdout.trim();
    }
    const config = {
      version: 1,
      selectedRoomIds: selected,
      interval,
      scheduleEnabled,
      automaticPushConsent: scheduleEnabled && automaticPushConsent === true,
    };
    writeAtomic(configPath, `${JSON.stringify(config, null, 2)}\n`);
    writeAtomic(workflowPath, renderWorkflow(interval, scheduleEnabled));
    if (process.env.YASASHII_CHATWORK_SKIP_GIT === "1") return { status: "saved", config };
    await run(git, ["add", "--", ...relativePaths], root);
    await run(git, ["commit", "-m", "Chatworkのroomと同期間隔を変更"], root);
    newHead = (await run(git, ["rev-parse", "HEAD"], root)).stdout.trim();
    await run(git, ["push"], root, 60_000);
    return { status: "pushed", config, commit: newHead };
  } catch (error) {
    if (newHead && oldHead) {
      try { await run(git, ["update-ref", "HEAD", oldHead, newHead], root); } catch { /* 次のrestoreで整合を試す */ }
    }
    for (const [path, content] of snapshots) {
      if (content === null) rmSync(path, { force: true });
      else writeAtomic(path, content);
    }
    if (oldHead && process.env.YASASHII_CHATWORK_SKIP_GIT !== "1") {
      try { await run(git, ["restore", "--source", oldHead, "--staged", "--worktree", "--", ...relativePaths], root); } catch { /* 元内容は上で復元済み */ }
    }
    if (error.code === "dirty-config") throw error;
    const detail = classify(error);
    throw Object.assign(new Error(detail.message), { code: detail.code });
  }
}

async function main() {
  const args = new Map();
  for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
  const selectedRoomIds = (args.get("--rooms") || "").split(",").filter(Boolean);
  const result = await applyChatworkConfig({
    root: args.get("--root") || process.cwd(),
    selectedRoomIds,
    interval: args.get("--interval") || "1h",
    automaticPushConsent: args.get("--consent") === "yes",
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "failed", code: error.code || "unknown", message: error.message })}\n`);
    process.exit(3);
  });
}
