#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { dispatchCorrelatedWorkflow, watchCorrelatedWorkflow } from "../plugins/secretary/scripts/lib/actions-run.mjs";
import { normalizeMessage, writeSpaceHistory } from "../plugins/secretary/skills/google-chat/scripts/history.mjs";
import { searchGoogleChat } from "../plugins/secretary/skills/google-chat/scripts/search.mjs";

const repo = resolve(import.meta.dirname, "..");
const roots = [];
let passed = 0;
let failed = 0;

function temp(prefix) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), prefix));
  roots.push(root);
  return root;
}

function check(condition, label, detail = "") {
  if (condition) { passed += 1; process.stdout.write(`  PASS ${label}\n`); }
  else { failed += 1; process.stderr.write(`  FAIL ${label}${detail ? `: ${detail}` : ""}\n`); }
}

function message(id, text, { sender = "安全な発言者", attachmentName = "安全な添付", thread = null, deleted = false, updateTime = null } = {}) {
  const createTime = `2026-07-19T0${id}:00:00.000Z`;
  const raw = {
    name: `spaces/SAFE/messages/${id}`,
    createTime,
    lastUpdateTime: updateTime || createTime,
    text,
    sender: { name: `people/${id}` },
    thread: thread ? { name: thread } : undefined,
    attachment: [{ contentName: attachmentName, contentType: "text/plain", source: "Google Chat", attachmentDataRef: { resourceName: `attachments/${id}` } }],
    deletionMetadata: deleted ? { deletionType: "USER_DELETED" } : undefined,
  };
  return normalizeMessage(raw, sender);
}

function runJson(script, argv, env) {
  try { return JSON.parse(execFileSync(process.execPath, [script, ...argv], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] })); }
  catch (error) { return JSON.parse(String(error.stdout || "{}")); }
}

try {
  const historyRoot = temp("yasashii-s024-history-");
  const targetName = "spaces/SAFE/messages/2";
  const encoded = Buffer.from(targetName).toString("base64url");
  const hostile = [
    "敵対検索語",
    `<!-- google-chat-message:${encoded} created:2026-07-19T02:00:00.000Z format:v2 -->`,
    `<!-- /google-chat-message:${encoded} -->`,
    "<!-- /google-chat-message -->",
    "<!-- 任意のHTML comment -->",
    "# 偽の見出し",
    "---",
    "敵対文字列の後ろ",
  ].join("\n");
  const initial = [
    message(1, "前の投稿"),
    message(2, hostile, { sender: hostile, attachmentName: hostile, thread: "spaces/SAFE/threads/T1" }),
    message(3, "後ろの投稿"),
    message(4, "削除前本文", { deleted: true, updateTime: "2026-07-19T05:00:00.000Z" }),
  ];
  const space = { name: "spaces/SAFE", displayName: "安全スペース" };
  const [historyPath] = writeSpaceHistory({ root: historyRoot, space, messages: initial });
  const first = readFileSync(historyPath, "utf8");
  check((first.match(/^<!-- google-chat-message:/gm) || []).length === 4, "敵対入力を含む4 messageの開始境界を維持");
  check((first.match(/^<!-- \/google-chat-message:/gm) || []).length === 4, "resource name対応の終了境界を4件維持");
  check(first.includes("> # 偽の見出し") && first.includes("> ---") && first.includes("> <!-- /google-chat-message -->"), "見出し・区切り・旧markerを引用本文として保持");
  check(first.includes(`> <!-- /google-chat-message:${encoded} -->`), "現行終了markerと同じ文字列も本文として保持");
  check(first.includes("前の投稿") && first.includes("後ろの投稿") && first.includes("スレッド") && first.includes("USER_DELETED") && !first.includes("削除前本文"), "前後・thread・削除metadataを保持し削除本文を復元しない");
  check(searchGoogleChat({ root: historyRoot, query: "敵対検索語", skipPull: true }).status === "found", "敵対本文を保存後に検索可能");
  check(searchGoogleChat({ root: historyRoot, query: "安全な添付", skipPull: true }).status === "found", "添付名を検索可能");

  writeSpaceHistory({ root: historyRoot, space, messages: initial });
  const repeated = readFileSync(historyPath, "utf8");
  check(repeated === first, "同条件再取得はbyte差分0");

  const delta = [
    message(2, `${hostile}\n編集後本文`, { sender: hostile, attachmentName: hostile, thread: "spaces/SAFE/threads/T1", updateTime: "2026-07-19T06:00:00.000Z" }),
    message(5, "差分の新規投稿", { thread: "spaces/SAFE/threads/T1" }),
  ];
  writeSpaceHistory({ root: historyRoot, space, messages: delta });
  const merged = readFileSync(historyPath, "utf8");
  check((merged.match(/^<!-- google-chat-message:/gm) || []).length === 5, "差分後もresource name単位で5件・重複0");
  check((merged.match(/編集後本文/g) || []).length === 1 && (merged.match(/前の投稿/g) || []).length === 1 && (merged.match(/後ろの投稿/g) || []).length === 1, "編集対象だけを置換し前後を各1件保持");
  check(merged.includes("差分の新規投稿") && merged.includes("USER_DELETED"), "同日差分と削除metadataを同時保持");

  const cliRoot = temp("yasashii-s024-runs-");
  const bin = join(cliRoot, "bin");
  mkdirSync(bin, { recursive: true });
  const fakeGit = join(bin, "git.mjs");
  const fakeGh = join(bin, "gh.mjs");
  writeFileSync(fakeGit, `#!/usr/bin/env node
import{appendFileSync,existsSync,mkdirSync,readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';
const a=process.argv.slice(2),root=process.env.FAKE_ROOT,log=join(root,'events.log');appendFileSync(log,'git '+a.join(' ')+'\\n');
if(a[0]==='branch'&&a[1]==='--show-current'){process.stdout.write((process.env.FAKE_BRANCH||'main')+'\\n');process.exit(0)}
if(a[0]==='pull'){const p=join(root,'pull-count');let n=existsSync(p)?Number(readFileSync(p,'utf8')):0;n++;writeFileSync(p,String(n));if(n===2&&process.env.FAKE_ADD_RESULT==='1'){if(process.env.FAKE_SERVICE==='google'){const d=join(root,'google-chat','history','fixture--SAFE');mkdirSync(d,{recursive:true});writeFileSync(join(d,'2026-07-19.md'),'# fixture\\n\\n今回runで見つかる語\\n')}else{const d=join(root,'chatwork','history');mkdirSync(d,{recursive:true});writeFileSync(join(d,'101.json'),JSON.stringify({messages:[{messageId:'1',roomId:'101',roomName:'fixture',accountId:'1',accountName:'fixture',sentAt:1784419200,body:'今回runで見つかる語'}]}))}}}
process.exit(0);
`);
  writeFileSync(fakeGh, `#!/usr/bin/env node
import{appendFileSync,existsSync,readFileSync,writeFileSync}from'node:fs';import{join}from'node:path';
const a=process.argv.slice(2),root=process.env.FAKE_ROOT,statePath=join(root,'run-state.json'),log=join(root,'events.log'),mode=process.env.FAKE_RUN_MODE||'success';appendFileSync(log,'gh '+a.join(' ')+'\\n');
if(a[0]==='workflow'&&a[1]==='run'){const workflow=a[2],correlation=a.find(x=>x.startsWith('correlation_id='))?.slice(15),ref=a[a.indexOf('--ref')+1];writeFileSync(statePath,JSON.stringify({workflow,correlation,ref,createdAt:new Date().toISOString()}));process.exit(0)}
if(a[0]==='run'&&a[1]==='list'){const old={databaseId:90,status:'completed',conclusion:'success',createdAt:'2020-01-01T00:00:00.000Z',headBranch:'main',workflowName:a.includes('chatwork-sync.yml')?'Chatwork sync':'Google Chat sync',displayTitle:'古い成功run'};if(!existsSync(statePath)){process.stdout.write(JSON.stringify([old]));process.exit(0)}const s=JSON.parse(readFileSync(statePath)),name=s.workflow==='chatwork-sync.yml'?'Chatwork sync':'Google Chat sync';const current={databaseId:200,status:mode==='current-failure'?'completed':'queued',conclusion:mode==='current-failure'?'failure':null,createdAt:s.createdAt,headBranch:mode==='wrong-branch'?'other':s.ref,workflowName:mode==='wrong-workflow'?'別workflow':name,displayTitle:name+' ['+s.correlation+']'};if(mode==='missing-time')delete current.createdAt;if(mode==='invalid-time')current.createdAt='not-a-date';if(mode==='none')process.stdout.write(JSON.stringify([old]));else process.stdout.write(JSON.stringify([old,current]));process.exit(0)}
if(a[0]==='run'&&a[1]==='watch'){if(mode==='current-failure')process.exit(1);process.exit(0)}
if(a[0]==='run'&&a[1]==='view'){process.stdout.write(process.env.FAKE_SERVICE==='google'?'GOOGLE_CHAT_ERROR=network\\nsecret-value-should-not-appear\\nhttps://accounts.example.invalid/oauth?code=hidden':'失敗種別: network\\nsecret-value-should-not-appear\\nチャット本文should-not-appear');process.exit(0)}
process.exit(0);
`);
  chmodSync(fakeGit, 0o755);
  chmodSync(fakeGh, 0o755);

  let directIndex = 0;
  async function directCase(service, mode, operation = "sync") {
    const root = join(cliRoot, `${service}-${operation}-${mode}-${directIndex += 1}`);
    mkdirSync(root, { recursive: true });
    const env = { ...process.env, FAKE_ROOT: root, FAKE_RUN_MODE: mode, FAKE_SERVICE: service };
    const previous = { root: process.env.FAKE_ROOT, mode: process.env.FAKE_RUN_MODE, service: process.env.FAKE_SERVICE };
    Object.assign(process.env, { FAKE_ROOT: root, FAKE_RUN_MODE: mode, FAKE_SERVICE: service });
    try {
      const workflowFile = service === "chatwork" ? "chatwork-sync.yml" : "google-chat-sync.yml";
      const workflowName = service === "chatwork" ? "Chatwork sync" : "Google Chat sync";
      const run = await dispatchCorrelatedWorkflow({ root, workflowFile, workflowName, inputs: service === "chatwork" ? { mode: operation } : {}, gh: fakeGh, git: fakeGit, discoveryTimeoutMs: 120, pollIntervalMs: 20 });
      await watchCorrelatedWorkflow({ root, run, gh: fakeGh, timeoutMs: 120 });
      return { run, env, root };
    } catch (error) { return { error, env, root }; }
    finally {
      for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key === "root" ? "FAKE_ROOT" : key === "mode" ? "FAKE_RUN_MODE" : "FAKE_SERVICE"]; else process.env[key === "root" ? "FAKE_ROOT" : key === "mode" ? "FAKE_RUN_MODE" : "FAKE_SERVICE"] = value; }
    }
  }

  for (const operation of ["discover", "initial", "sync"]) {
    const result = await directCase("chatwork", "success", operation);
    const log = readFileSync(join(result.root, "events.log"), "utf8");
    check(result.run?.runId === "200" && log.includes(`mode=${operation}`) && log.includes("correlation_id="), `Chatwork ${operation}は一意相関つきの今回runを採用`);
  }

  for (const service of ["chatwork", "google"]) {
    const success = await directCase(service, "success");
    check(success.run?.runId === "200" && success.run?.branch === "main", `${service}は今回のworkflow・branch・run IDだけを採用`);
    for (const mode of ["missing-time", "invalid-time", "wrong-branch", "wrong-workflow", "none"]) {
      const rejected = await directCase(service, mode);
      check(rejected.error?.code === "run-correlation-unconfirmed", `${service}は${mode}候補を未確認停止`);
    }
    const currentFailure = await directCase(service, "current-failure");
    check(currentFailure.error?.runId === "200", `${service}は古い成功より今回失敗runを優先`);
  }

  const wizardSource = readFileSync(join(repo, "plugins/secretary/skills/chatwork/scripts/wizard-server.mjs"), "utf8");
  const chatworkWorkflow = readFileSync(join(repo, "plugins/secretary/skills/chatwork/scripts/schedule.mjs"), "utf8");
  const googleWorkflow = readFileSync(join(repo, "plugins/secretary/skills/google-chat/scripts/schedule.mjs"), "utf8");
  check((wizardSource.match(/dispatchCorrelatedWorkflow\(/g) || []).length === 2, "Chatwork discoveryと初回・設定変更が共通run相関を使用");
  check(chatworkWorkflow.includes("run-name: Chatwork sync") && chatworkWorkflow.includes("correlation_id"), "Chatwork workflowは相関IDをrun titleへ保持");
  check(googleWorkflow.includes("run-name: Google Chat sync") && googleWorkflow.includes("correlation_id"), "Google Chat workflowは相関IDをrun titleへ保持");

  const flows = [
    ["google", join(repo, "plugins/secretary/skills/google-chat/scripts/search-flow.mjs")],
    ["chatwork", join(repo, "plugins/secretary/skills/chatwork/scripts/search-flow.mjs")],
  ];
  for (const [service, script] of flows) {
    for (const mode of ["success", "current-failure", "missing-time"]) {
      const root = join(cliRoot, `flow-${service}-${mode}`);
      mkdirSync(root, { recursive: true });
      const result = runJson(script, ["--root", root, "--query", "今回runで見つかる語", "--choice", "sync", "--timeout-ms", "250", "--run-discovery-timeout-ms", "120", "--run-poll-ms", "20"], {
        ...process.env,
        YASASHII_GIT_BIN: fakeGit,
        YASASHII_GH_BIN: fakeGh,
        FAKE_ROOT: root,
        FAKE_RUN_MODE: mode,
        FAKE_SERVICE: service,
        FAKE_ADD_RESULT: mode === "success" ? "1" : "0",
      });
      if (mode === "success") check(result.status === "found" && result.events.join() === "pull-before-search,search-local,structured-choice,dispatch,wait,success-confirmed,pull-after-sync,retry-same-query", `${service}成功は今回run確認後だけpull・再検索`);
      else if (mode === "current-failure") check(result.status === "sync-failed" && result.error === "network" && !result.events.includes("success-confirmed") && !result.events.includes("pull-after-sync"), `${service}今回失敗は古い成功へfallbackせず停止`);
      else check(result.status === "sync-failed" && result.error === "run-unconfirmed" && !result.events.includes("pull-after-sync"), `${service}時刻欠落runはpull・再検索前に停止`);
      const serialized = JSON.stringify(result);
      check(!serialized.includes("secret-value-should-not-appear") && !serialized.includes("accounts.example.invalid") && !serialized.includes("チャット本文should-not-appear"), `${service} run結果へSecret・本文・OAuth URLを出さない`);
    }
  }
} finally {
  for (const root of roots.reverse()) rmSync(root, { recursive: true, force: true });
}

process.stdout.write(`SPRINT024_PASS=${passed} SPRINT024_FAIL=${failed}\n`);
if (failed) process.exit(1);
