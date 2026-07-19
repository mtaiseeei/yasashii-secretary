#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { commitOwnedChanges, pushOwnedCommit, restoreOwnedCommit } from "../../../scripts/lib/safe-git.mjs";
import { removeSafe, workingRoot, writeFileAtomicSafe } from "../../../scripts/lib/safe-fs.mjs";
import { runExternal } from "../../../scripts/lib/external-ops.mjs";
import { INTERVALS, renderWorkflow } from "./schedule.mjs";

function writeAtomic(root, path, content) {
  writeFileAtomicSafe(root, path, content, { mode: 0o600 });
}

function readOptional(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

async function run(binary, args, root, timeout = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000)) {
  return runExternal(binary, args, { cwd: root, timeoutMs: timeout, maxBuffer: 1024 * 1024, label: binary });
}

function classify(error) {
  const output = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
  if (/non-fast-forward|rejected|fetch first/.test(output)) return { code: "git-conflict", message: "remoteに別の変更があるためpushを止めました。git pullで取り込んでから設定をやり直してください。" };
  if (/resource not accessible|permission|forbidden|403/.test(output)) return { code: "github-permission", message: "GitHubの書込権限を確認できません。repoのActions権限を確認してください。" };
  return { code: "git", message: "設定をrepoへ反映できませんでした。変更前の状態へ戻しました。" };
}

export async function applyChatworkConfig({ root, selectedRoomIds, interval, automaticPushConsent }) {
  root = workingRoot(root);
  const selected = [...new Set((selectedRoomIds || []).map(String))];
  if (selected.length === 0) throw Object.assign(new Error("ルームを1つ以上選んでください。"), { code: "room-required" });
  if (selected.some((id) => !/^\d+$/.test(id))) throw Object.assign(new Error("ルームIDの形式が不正です。"), { code: "room-invalid" });
  if (!INTERVALS[interval]) throw Object.assign(new Error("自動取得の間隔を選び直してください。"), { code: "interval-invalid" });
  const scheduleEnabled = interval !== "manual";
  if (scheduleEnabled && automaticPushConsent !== true) {
    throw Object.assign(new Error("対象ルーム、自動取得の間隔、保存内容、自動commit・pushへの同意が必要です。"), { code: "consent-required" });
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
      throw Object.assign(new Error("GitHub上の安全な保管場所（Repository Secret）に CHATWORK_API_TOKEN を確認できないため、設定を変更していません。"), { code: "secret-missing" });
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
    writeAtomic(root, configPath, `${JSON.stringify(config, null, 2)}\n`);
    writeAtomic(root, workflowPath, renderWorkflow(interval, scheduleEnabled));
    if (process.env.YASASHII_CHATWORK_SKIP_GIT === "1") return { status: "saved", config };
    const committed = commitOwnedChanges({ root, ownedPaths: relativePaths, message: "Chatworkのルームと自動取得の間隔を変更" });
    if (committed.status !== "committed") throw Object.assign(new Error("Chatwork設定にcommitする変更がありません。"), { code: "no-change" });
    newHead = committed.newHead;
    pushOwnedCommit({ root, oldHead: committed.oldHead, newHead });
    return { status: "pushed", config, commit: newHead };
  } catch (error) {
    if (newHead && oldHead) {
      try { restoreOwnedCommit({ root, oldHead, newHead, ownedPaths: relativePaths }); } catch { /* snapshot復元を続ける */ }
    }
    for (const [path, content] of snapshots) {
      if (content === null) removeSafe(root, path);
      else writeAtomic(root, path, content);
    }
    if (["dirty-config", "secret-detected", "inspection-failed", "candidate-changed", "commit-scope", "git-conflict", "push-base-changed", "push-failed", "filesystem-boundary", "symlink-boundary", "working-root-unsafe", "target-changed", "timeout"].includes(error.code)) throw error;
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
    interval: args.get("--interval") || "3h",
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
