#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatchCorrelatedWorkflow, watchCorrelatedWorkflow } from "../../../scripts/lib/actions-run.mjs";
import { runExternal } from "../../../scripts/lib/external-ops.mjs";
import { ingestGit } from "../../../scripts/lib/git-ingest.mjs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i]?.startsWith("--") || process.argv[i + 1] === undefined) {
    process.stderr.write("検索条件は --query などの名前つきで指定してください。\n");
    process.exit(2);
  }
  args.set(process.argv[i], process.argv[i + 1]);
}

const root = resolve(args.get("--root") || process.cwd());
const query = (args.get("--query") || "").trim();
const choice = args.get("--choice") || "ask";
const timeout = Number(args.get("--timeout-ms") || 5 * 60_000);
const runDiscoveryTimeout = args.has("--run-discovery-timeout-ms") ? Number(args.get("--run-discovery-timeout-ms")) : undefined;
const runPollInterval = args.has("--run-poll-ms") ? Number(args.get("--run-poll-ms")) : undefined;
const runPollMax = args.has("--run-poll-max-ms") ? Number(args.get("--run-poll-max-ms")) : undefined;
const git = process.env.YASASHII_GIT_BIN || "git";
const gh = process.env.YASASHII_GH_BIN || "gh";
const searchScript = resolve(dirname(fileURLToPath(import.meta.url)), "search.mjs");
const events = [];

function output(value) {
  process.stdout.write(`${JSON.stringify({ ...value, events }, null, 2)}\n`);
}

function classify(error) {
  if (error?.stage === "git-ingest") return { code: error.code, stage: error.stage, message: `GitHub上の取得後、この端末への取り込みだけ失敗しました。${error.message}` };
  if (error?.code === "branch-unconfirmed") return { code: error.code, stage: "dispatch", message: "対象branchを確認できないため、GitHub Actionsは開始していません。" };
  if (error?.stage === "dispatch") return { code: error.code, stage: error.stage, message: "GitHub Actionsを開始できませんでした。Actionsは未開始または開始未確認です。" };
  if (error?.stage === "run-correlation") return { code: error.code, stage: error.stage, message: "今回開始したGitHub Actionsのrunを確認できませんでした。古い成功runは使っていません。" };
  if (error?.reason === "chatwork-auth") return { code: "auth", stage: "actions-run", message: "Chatworkの認証に失敗しました。Repository Secretを確認してください。" };
  if (error?.reason === "rate-limit") return { code: "rate-limit", stage: "actions-run", message: "Chatwork APIの利用上限に達しました。時間を置いて再実行してください。" };
  if (error?.reason === "service-network") return { code: "network", stage: "actions-run", message: "Chatworkへ接続できませんでした。前回の履歴は保持しています。" };
  if (error?.reason === "chatwork-partial") return { code: "partial-room", stage: "actions-run", message: "一部または全部のルームを取得できませんでした。前回の履歴は保持しています。" };
  if (error?.code === "workflow-conclusion-failure") return { code: error.code, stage: "actions-run", message: "今回のGitHub Actionsが失敗しました。Actionsの実行内容とAPI Tokenを確認してください。" };
  if (error?.code?.endsWith("-timeout")) return { code: error.code, stage: error.stage, message: "GitHub Actionsの確認が時間切れになり、結果は断定していません。" };
  if (error?.code?.endsWith("-auth") || error?.code?.endsWith("-transport") || error?.code?.endsWith("-killed")) return { code: error.code, stage: error.stage, message: "GitHub CLIの認証・通信・process状態を確認できませんでした。workflowの成否は断定していません。" };
  return { code: "workflow-failure", message: "自動取得処理（GitHub Actions）が成功しませんでした。前回の履歴はそのまま検索できます。" };
}

async function run(binary, argv, runTimeout = 60_000) {
  return runExternal(binary, argv, { cwd: root, timeoutMs: runTimeout, maxBuffer: 2 * 1024 * 1024, label: binary });
}

async function pull(stage, branch) {
  events.push(stage);
  return ingestGit({ root, branch, git });
}

async function search(stage) {
  events.push(stage);
  const argv = [searchScript, "--root", root, "--query", query];
  for (const name of ["--room", "--account", "--from", "--to"]) if (args.has(name)) argv.push(name, args.get(name));
  return JSON.parse((await run(process.execPath, argv)).stdout);
}

if (!query) {
  process.stderr.write("検索キーワードを --query で指定してください。\n");
  process.exit(2);
}

try {
  await pull("pull-before-search");
  const first = await search("search-local");
  if (first.status === "found") {
    output(first);
    process.exit(0);
  }
  events.push("structured-choice");
  if (choice === "ask") {
    output({
      status: "needs-choice",
      message: "現在の保存済み履歴には見つかりません。同期するか選んでください。",
      choices: [
        { value: "sync", label: "同期して再検索（推奨）" },
        { value: "decline", label: "同期しない" },
        { value: "review", label: "対象roomを見直す" },
      ],
    });
    process.exit(0);
  }
  if (choice === "decline") {
    output({ status: "sync-declined", message: "同期せず、現在の保存済み履歴だけを確認しました。Chatworkに存在しないとは断定できません。" });
    process.exit(0);
  }
  if (choice === "review") {
    output({ status: "room-review-needed", message: "同期は開始していません。/chatwork のwizardで対象ルームを確認してください。" });
    process.exit(0);
  }
  if (choice !== "sync") throw Object.assign(new Error("選択肢を確認できません。"), { code: "choice-invalid" });

  events.push("dispatch");
  const dispatchedRun = await dispatchCorrelatedWorkflow({
    root,
    workflowFile: "chatwork-sync.yml",
    workflowName: "Chatwork sync",
    inputs: { mode: "sync" },
    gh,
    git,
    discoveryTimeoutMs: runDiscoveryTimeout,
    pollIntervalMs: runPollInterval,
    pollMaxIntervalMs: runPollMax,
  });
  events.push("wait");
  await watchCorrelatedWorkflow({ root, run: dispatchedRun, gh, timeoutMs: timeout });
  events.push("success-confirmed");
  await pull("pull-after-sync", dispatchedRun.branch);
  const retried = await search("retry-same-query");
  if (retried.status === "found") {
    output(retried);
  } else {
    output({
      status: "still-not-found",
      query,
      message: "同期は成功しましたが、保存済み履歴には見つかりませんでした。Chatworkに存在しないとは断定できません。",
      possibleReasons: ["導入前の履歴", "最新100件より前", "未選択room", "キーワードの差", "メッセージの編集・削除"],
    });
  }
} catch (error) {
  const detail = error.code === "choice-invalid" ? { code: error.code, message: error.message } : classify(error);
  output({ status: "sync-failed", error: detail.code, stage: detail.stage, message: detail.message });
  process.exitCode = 4;
}
