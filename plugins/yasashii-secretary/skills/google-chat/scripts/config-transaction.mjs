#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commitOwnedChanges, pushOwnedCommit, restoreOwnedCommit } from "../../../scripts/lib/safe-git.mjs";
import { removeSafe, workingRoot, writeFileAtomicSafe } from "../../../scripts/lib/safe-fs.mjs";
import { runExternal } from "../../../scripts/lib/external-ops.mjs";
import { GOOGLE_CHAT_SECRET_NAMES } from "./oauth-session.mjs";
import { GOOGLE_CHAT_INTERVALS, renderGoogleChatWorkflow } from "./schedule.mjs";

const moduleRoot = dirname(fileURLToPath(import.meta.url));
const runtimeFiles = ["client.mjs", "history.mjs", "refresh-token.mjs", "continuous-sync.mjs", "runtime-safety.mjs"];

function readOptional(path) {
  try { return readFileSync(path, "utf8"); } catch { return null; }
}

function writeAtomic(root, path, content) {
  writeFileAtomicSafe(root, path, content, { mode: 0o600 });
}

async function run(binary, argv, root, timeout = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000)) {
  return runExternal(binary, argv, { cwd: root, timeoutMs: timeout, maxBuffer: 2 * 1024 * 1024, label: binary });
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
  root = workingRoot(root);
  const requestedNames = new Set((selectedSpaces || []).map((space) => String(space?.name || "")));
  const selected = normalizedSpaces(selectedSpaces);
  const available = normalizedSpaces(availableSpaces);
  if (!GOOGLE_CHAT_INTERVALS[interval]) throw Object.assign(new Error("自動取得の間隔を選び直してください。"), { code: "interval-invalid" });
  if (selected.length === 0 && interval !== "manual") throw Object.assign(new Error("自動取得を使う場合は、通常スペースを1件以上選んでください。取得を停止する場合は「手動のみ」を選んでください。"), { code: "space-required" });
  if (selected.length !== requestedNames.size) throw Object.assign(new Error("通常スペース以外または形式が不正な対象は設定できません。"), { code: "space-not-allowed" });
  const availableNames = new Set(available.map((space) => space.name));
  if (selected.some((space) => !availableNames.has(space.name))) throw Object.assign(new Error("候補にないスペースは設定できません。"), { code: "space-not-allowed" });
  if (commitPushConsent !== true) throw Object.assign(new Error("設定ファイルと自動取得処理のcommit・pushへの明示同意が必要です。"), { code: "consent-required" });
  const scheduleEnabled = interval !== "manual";
  const stoppingAllSync = !scheduleEnabled && selected.length === 0;
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
  // 全対象を外して手動のみにする後始末は、今後APIを呼ばないためSecretを必要としない。
  // 1件でも対象が残る場合と自動取得では、従来どおり3 Secretを必須にする。
  if (!stoppingAllSync && process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS !== "1") {
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
    writeAtomic(root, entries[0][0], `${JSON.stringify(config, null, 2)}\n`);
    writeAtomic(root, entries[1][0], `${JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), spaces: available }, null, 2)}\n`);
    writeAtomic(root, entries[2][0], renderGoogleChatWorkflow(interval, scheduleEnabled));
    for (const name of runtimeFiles) writeAtomic(root, join(root, "google-chat", "scripts", name), readFileSync(join(moduleRoot, name), "utf8"));
    if (process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT === "1") return { status: "saved", config, workflow: { schedule: scheduleEnabled, interval } };
    const managedPaths = entries.map(([, relative]) => relative);
    const committed = commitOwnedChanges({ root, ownedPaths: managedPaths, message: "Google Chatのスペースと自動取得の間隔を変更" });
    if (committed.status !== "committed") throw Object.assign(new Error("Google Chat設定にcommitする変更がありません。"), { code: "no-change" });
    newHead = committed.newHead;
    pushOwnedCommit({ root, oldHead: committed.oldHead, newHead });
    return { status: "pushed", config, workflow: { schedule: scheduleEnabled, interval }, commit: newHead };
  } catch (error) {
    if (newHead && oldHead) {
      try { restoreOwnedCommit({ root, oldHead, newHead, ownedPaths: entries.map(([, relative]) => relative) }); } catch { /* snapshot復元を続ける */ }
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
  const selectedSpaces = JSON.parse(args.get("--spaces-json") || "[]");
  const result = await applyGoogleChatConfig({ root: args.get("--root") || process.cwd(), selectedSpaces, interval: args.get("--interval") || "3h", automaticPushConsent: args.get("--automatic-consent") === "yes", commitPushConsent: args.get("--commit-consent") === "yes" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => { process.stderr.write(`${JSON.stringify({ status: "failed", code: error.code || "unknown", message: error.message })}\n`); process.exit(3); });
}
