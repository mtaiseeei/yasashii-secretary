#!/usr/bin/env node

import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
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
const git = process.env.YASASHII_GIT_BIN || "git";
const gh = process.env.YASASHII_GH_BIN || "gh";
const searchScript = resolve(dirname(fileURLToPath(import.meta.url)), "search.mjs");
const events = [];

function output(value) {
  process.stdout.write(`${JSON.stringify({ ...value, events }, null, 2)}\n`);
}

function classify(error) {
  const text = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
  if (error?.killed || error?.code === "ETIMEDOUT" || /timed out|timeout/.test(text)) return { code: "timeout", message: "GitHub Actionsの完了待ちが時間切れになりました。workflowの状態を確認してから再実行してください。" };
  if (/resource not accessible|permission|forbidden|403/.test(text)) return { code: "github-permission", message: "GitHub Actionsを実行する権限を確認できません。repoのActions権限を確認してください。" };
  if (/non-fast-forward|not possible to fast-forward|divergent|conflict/.test(text)) return { code: "git-conflict", message: "remoteとlocalの変更が競合したため停止しました。前回の履歴はそのまま検索できます。" };
  if (/失敗種別:\s*auth|api token/.test(text)) return { code: "auth", message: "Chatworkの認証に失敗しました。Repository Secretを確認してください。前回の履歴はそのまま検索できます。" };
  if (/失敗種別:\s*rate-limit|利用上限/.test(text)) return { code: "rate-limit", message: "Chatwork APIの利用上限に達しました。時間を置いて再実行してください。前回の履歴は保持しています。" };
  if (/失敗種別:\s*network|接続できません/.test(text)) return { code: "network", message: "Chatworkへ接続できませんでした。ネットワークを確認してください。前回の履歴は保持しています。" };
  if (/失敗種別:.*(?:server|api|unknown)|一部または全部のroom/.test(text)) return { code: "partial-room", message: "一部または全部のroomを取得できませんでした。前回の履歴と取得位置は保持しています。" };
  return { code: "workflow-failure", message: "GitHub Actionsが成功しませんでした。前回の履歴はそのまま検索できます。" };
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
    output({ status: "room-review-needed", message: "同期は開始していません。/chatwork のwizardで対象roomを確認してください。" });
    process.exit(0);
  }
  if (choice !== "sync") throw Object.assign(new Error("選択肢を確認できません。"), { code: "choice-invalid" });

  events.push("dispatch");
  await run(gh, ["workflow", "run", "chatwork-sync.yml", "-f", "mode=sync"]);
  events.push("wait");
  const listed = await run(gh, ["run", "list", "--workflow", "chatwork-sync.yml", "--event", "workflow_dispatch", "--limit", "1", "--json", "databaseId,status,conclusion"]);
  const runs = JSON.parse(listed.stdout || "[]");
  if (!runs[0]?.databaseId) throw new Error("workflow run not found");
  try {
    await run(gh, ["run", "watch", String(runs[0].databaseId), "--exit-status"], timeout);
  } catch (watchError) {
    if (!watchError.killed && watchError.code !== "ETIMEDOUT") {
      try {
        const logs = await run(gh, ["run", "view", String(runs[0].databaseId), "--log-failed"]);
        watchError.stderr = `${watchError.stderr || ""}\n${logs.stdout || ""}\n${logs.stderr || ""}`;
      } catch { /* 権限や通信失敗は元errorで分類する */ }
    }
    throw watchError;
  }
  events.push("success-confirmed");
  await pull("pull-after-sync");
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
  output({ status: "sync-failed", error: detail.code, message: detail.message });
  process.exitCode = 4;
}
