#!/usr/bin/env node

import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
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
const runDiscoveryTimeout = Math.max(250, Math.min(timeout, Number(args.get("--run-discovery-timeout-ms") || 5_000)));
const runPollInterval = Math.max(50, Number(args.get("--run-poll-ms") || 250));
const git = process.env.YASASHII_GIT_BIN || "git";
const gh = process.env.YASASHII_GH_BIN || "gh";
const searchScript = resolve(dirname(fileURLToPath(import.meta.url)), "search.mjs");
const events = [];

function output(value) {
  process.stdout.write(`${JSON.stringify({ ...value, events }, null, 2)}\n`);
}

function classify(error) {
  const source = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
  if (error?.killed || error?.code === "ETIMEDOUT" || error?.code === "run-discovery-timeout" || /timed out|timeout/.test(source)) return { status: "sync-failed", code: "timeout", message: "自動取得処理（GitHub Actions）の完了待ちが時間切れになりました。状態を確認してから再実行してください。" };
  if (/google_chat_error=(?:reauthorization-needed|reauth-required)/.test(source)) return { status: "reauthorization-needed", code: "token-invalid", message: "Google認証の同意が取り消されたか、refresh tokenが失効しています。既存履歴を残したまま再認証してください。" };
  if (/google_chat_error=scope-insufficient/.test(source)) return { status: "reauthorization-needed", code: "scope-insufficient", message: "必要なread-only scopeが不足しています。既存履歴を残したまま再認証してください。" };
  if (/google_chat_error=(?:admin-blocked|admin-or-scope-blocked)/.test(source)) return { status: "admin-action-needed", code: "admin-blocked", message: "Google Workspace管理者のAPI access controlsを確認してください。取得の再試行は行いません。" };
  if (/google_chat_error=audience-mismatch/.test(source)) return { status: "admin-action-needed", code: "audience-mismatch", message: "OAuth Audienceと利用者のGoogle Workspace組織が一致していません。管理者へ確認してください。" };
  if (/google_chat_error=api-disabled/.test(source)) return { status: "admin-action-needed", code: "api-disabled", message: "Google CloudでGoogle Chat APIが有効か確認してください。" };
  if (/google_chat_error=permission-denied/.test(source)) return { status: "sync-failed", code: "permission-denied", message: "Google Chat APIへのアクセスが拒否されましたが、原因を特定できませんでした。APIの有効化、必要scope、管理者設定を順に確認してください。" };
  if (/google_chat_error=rate-limit/.test(source)) return { status: "sync-failed", code: "rate-limit", message: "Google Chat APIの利用上限に達しました。時間を置いてから再実行してください。" };
  if (/google_chat_error=network/.test(source)) return { status: "sync-failed", code: "network", message: "Google Chatへ接続できませんでした。前回の履歴は保持しています。" };
  if (/resource not accessible|permission|forbidden|403/.test(source)) return { status: "sync-failed", code: "github-permission", message: "GitHub Actionsを実行する権限を確認してください。" };
  if (/non-fast-forward|not possible to fast-forward|divergent|conflict/.test(source)) return { status: "sync-failed", code: "git-conflict", message: "remoteとlocalの変更が競合したため停止しました。前回の履歴は保持しています。" };
  return { status: "sync-failed", code: "workflow-failure", message: "自動取得処理（GitHub Actions）が成功しませんでした。前回の履歴は保持しています。" };
}

async function run(binary, argv, runTimeout = 60_000) {
  return exec(binary, argv, { cwd: root, timeout: runTimeout, maxBuffer: 2 * 1024 * 1024 });
}

async function pull(stage) {
  events.push(stage);
  await run(git, ["pull", "--ff-only"]);
}

async function search(stage) {
  events.push(stage);
  const argv = [searchScript, "--root", root, "--query", query, "--skip-pull", "yes"];
  for (const name of ["--space", "--sender", "--from", "--to"]) if (args.has(name)) argv.push(name, args.get(name));
  return JSON.parse((await run(process.execPath, argv)).stdout);
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function listWorkflowRuns() {
  const listed = await run(gh, ["run", "list", "--workflow", "google-chat-sync.yml", "--event", "workflow_dispatch", "--limit", "50", "--json", "databaseId,status,conclusion,createdAt"]);
  const parsed = JSON.parse(listed.stdout || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

function wasCreatedAfterDispatch(runItem, dispatchStartedAt) {
  const createdAt = Date.parse(runItem?.createdAt || "");
  return Number.isFinite(createdAt) && createdAt >= dispatchStartedAt;
}

async function waitForDispatchedRun(baselineIds, dispatchStartedAt) {
  const deadline = Date.now() + runDiscoveryTimeout;
  do {
    const candidates = (await listWorkflowRuns()).filter((runItem) => runItem?.databaseId && !baselineIds.has(String(runItem.databaseId)) && wasCreatedAfterDispatch(runItem, dispatchStartedAt));
    candidates.sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || "") || 0;
      const rightTime = Date.parse(right.createdAt || "") || 0;
      return leftTime - rightTime || Number(left.databaseId) - Number(right.databaseId);
    });
    if (candidates[0]) return candidates[0];
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await wait(Math.min(runPollInterval, remaining));
  } while (Date.now() <= deadline);
  throw Object.assign(new Error("workflow dispatch後に今回の実行を確認できませんでした。"), { code: "run-discovery-timeout" });
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

  const baselineIds = new Set((await listWorkflowRuns()).map((runItem) => String(runItem?.databaseId || "")).filter(Boolean));
  // GitHubのcreatedAtは秒精度で返るため、同じ秒の今回runを除外しないよう秒境界を使う。
  const dispatchStartedAt = Math.floor(Date.now() / 1000) * 1000;
  events.push("dispatch");
  await run(gh, ["workflow", "run", "google-chat-sync.yml"]);
  events.push("wait");
  const dispatchedRun = await waitForDispatchedRun(baselineIds, dispatchStartedAt);
  try {
    await run(gh, ["run", "watch", String(dispatchedRun.databaseId), "--exit-status"], timeout);
  } catch (watchError) {
    if (!watchError.killed && watchError.code !== "ETIMEDOUT") {
      try {
        const logs = await run(gh, ["run", "view", String(dispatchedRun.databaseId), "--log-failed"]);
        watchError.stderr = `${watchError.stderr || ""}\n${logs.stdout || ""}\n${logs.stderr || ""}`;
      } catch { /* 元の失敗を分類する */ }
    }
    throw watchError;
  }
  events.push("success-confirmed");
  await pull("pull-after-sync");
  const retried = await search("retry-same-query");
  if (retried.status === "found") output(retried);
  else output({ status: "still-not-found", query, message: "取得は成功しましたが、保存済み履歴には見つかりませんでした。Google Chatに存在しないとは断定できません。", possibleReasons: ["未選択スペース", "組織の保持設定", "API取得範囲", "キーワードの差", "メッセージの編集・削除"] });
} catch (error) {
  if (error.code === "choice-invalid") output({ status: "sync-failed", error: error.code, message: error.message });
  else {
    const detail = classify(error);
    output({ status: detail.status, error: detail.code, message: detail.message });
  }
  // dispatch直後のrun反映待ちは、今回runを確認できなかったという業務結果をJSONで返す。
  // 過去runは採用せず、呼び出し側がstatusを見て再試行可否を案内できるようにする。
  if (error.code !== "run-discovery-timeout") process.exitCode = 4;
}
