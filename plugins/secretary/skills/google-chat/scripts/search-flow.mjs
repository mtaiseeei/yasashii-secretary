#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatchCorrelatedWorkflow, watchCorrelatedWorkflow } from "../../../scripts/lib/actions-run.mjs";
import { runExternal } from "../../../scripts/lib/external-ops.mjs";
import { ingestGit } from "../../../scripts/lib/git-ingest.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  if (!process.argv[index]?.startsWith("--") || process.argv[index + 1] === undefined) {
    process.stderr.write("検索条件は --query などの名前つきで指定してください。\n");
    process.exit(2);
  }
  args.set(process.argv[index], process.argv[index + 1]);
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
  if (error?.stage === "git-ingest") return { status: "sync-failed", code: error.code, stage: error.stage, message: `GitHub上の取得後、この端末への取り込みだけ失敗しました。${error.message}` };
  if (error?.code === "branch-unconfirmed") return { status: "sync-failed", code: error.code, stage: "dispatch", message: "対象branchを確認できないため、GitHub Actionsは開始していません。" };
  if (error?.stage === "dispatch") return { status: "sync-failed", code: error.code, stage: error.stage, message: "GitHub Actionsを開始できませんでした。Actionsは未開始または開始未確認です。" };
  if (error?.stage === "run-correlation") return { status: "sync-failed", code: error.code, stage: error.stage, message: "今回開始したGitHub Actionsのrunを確認できませんでした。古い成功runは使っていません。" };
  const reasons = {
    "google-reauthorization-needed": ["reauthorization-needed", "token-invalid", "Google認証の同意が取り消されたか、refresh tokenが失効しています。"],
    "google-scope-insufficient": ["reauthorization-needed", "scope-insufficient", "必要なread-only scopeが不足しています。"],
    "google-admin-blocked": ["admin-action-needed", "admin-blocked", "Google Workspace管理者のAPI access controlsを確認してください。"],
    "google-audience-mismatch": ["admin-action-needed", "audience-mismatch", "OAuth Audienceと利用者の組織が一致していません。"],
    "google-api-disabled": ["admin-action-needed", "api-disabled", "Google CloudでGoogle Chat APIが有効か確認してください。"],
    "google-permission-denied": ["sync-failed", "permission-denied", "Google Chat APIへのアクセスが拒否されました。"],
    "rate-limit": ["sync-failed", "rate-limit", "Google Chat APIの利用上限に達しました。"],
    "service-network": ["sync-failed", "network", "Google Chatへ接続できませんでした。"],
  };
  if (reasons[error?.reason]) {
    const [status, code, message] = reasons[error.reason];
    return { status, code, stage: "actions-run", message };
  }
  if (error?.code === "workflow-conclusion-failure") return { status: "sync-failed", code: error.code, stage: "actions-run", message: "今回のGitHub Actionsが失敗しました。" };
  if (error?.code?.endsWith("-timeout") || error?.code?.endsWith("-auth") || error?.code?.endsWith("-transport") || error?.code?.endsWith("-killed")) return { status: "sync-failed", code: error.code, stage: error.stage, message: "GitHub CLIの確認に失敗し、workflowの成否は断定していません。" };
  return { status: "sync-failed", code: "workflow-failure", message: "自動取得処理（GitHub Actions）が成功しませんでした。前回の履歴は保持しています。" };
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
  const argv = [searchScript, "--root", root, "--query", query, "--skip-pull", "yes"];
  for (const name of ["--space", "--sender", "--from", "--to"]) if (args.has(name)) argv.push(name, args.get(name));
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
    output({ status: "needs-choice", message: "現在の保存済み履歴には見つかりません。取得して再検索するか選んでください。", choices: [
      { value: "sync", label: "取得して再検索（推奨）" },
      { value: "decline", label: "取得しない" },
      { value: "review", label: "対象スペースを見直す" },
    ] });
    process.exit(0);
  }
  if (choice === "decline") {
    output({ status: "sync-declined", message: "取得せず、現在の保存済み履歴だけを確認しました。Google Chatに存在しないとは断定できません。" });
    process.exit(0);
  }
  if (choice === "review") {
    output({ status: "space-review-needed", message: "取得は開始していません。/google-chat のwizardで対象スペースを確認してください。" });
    process.exit(0);
  }
  if (choice !== "sync") throw Object.assign(new Error("選択肢を確認できません。"), { code: "choice-invalid" });

  events.push("dispatch");
  const dispatchedRun = await dispatchCorrelatedWorkflow({
    root,
    workflowFile: "google-chat-sync.yml",
    workflowName: "Google Chat sync",
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
  if (retried.status === "found") output(retried);
  else output({ status: "still-not-found", query, message: "取得は成功しましたが、保存済み履歴には見つかりませんでした。Google Chatに存在しないとは断定できません。", possibleReasons: ["未選択スペース", "組織の保持設定", "API取得範囲", "キーワードの差", "メッセージの編集・削除"] });
} catch (error) {
  if (error.code === "choice-invalid") output({ status: "sync-failed", error: error.code, message: error.message });
  else {
    const detail = classify(error);
    output({ status: detail.status, error: detail.code, stage: detail.stage, message: detail.message });
  }
  process.exitCode = 4;
}
