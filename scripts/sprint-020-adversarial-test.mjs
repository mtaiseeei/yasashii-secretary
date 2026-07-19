#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createGoogleChatClient } from "../plugins/yasashii-secretary/skills/google-chat/scripts/client.mjs";
import { applyGoogleChatConfig } from "../plugins/yasashii-secretary/skills/google-chat/scripts/config-transaction.mjs";

const roots = [];
const testTmp = realpathSync(tmpdir());
let passed = 0;
let failed = 0;

function temp(prefix) {
  const root = mkdtempSync(join(testTmp, prefix));
  roots.push(root);
  return root;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", ...options });
}

function runOutput(command, args, options = {}) {
  try { return run(command, args, options); }
  catch (error) { return String(error.stdout || ""); }
}

function check(condition, label, detail = "") {
  process.stdout.write(`  ${condition ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}\n`);
  if (condition) passed += 1;
  else failed += 1;
}

async function classifyFixture(body) {
  const client = createGoogleChatClient({
    accessToken: "synthetic",
    fetchImpl: async () => new Response(JSON.stringify(body), { status: 403, headers: { "content-type": "application/json" } }),
  });
  try { await client.getSpace("spaces/AAA"); }
  catch (error) { return error.code; }
  return null;
}

function makeSearchFixture({ candidateMode }) {
  const root = temp(`yasashii-gchat-${candidateMode}-run-`);
  mkdirSync(join(root, "bin"), { recursive: true });
  mkdirSync(join(root, "google-chat", "history", "fixture--AAA"), { recursive: true });
  const fakeGit = join(root, "bin", "git");
  const fakeGh = join(root, "bin", "gh");
  const candidateByMode = {
    missing: `echo '[{"databaseId":7,"status":"completed","conclusion":"success","createdAt":"2020-01-01T00:00:00.000Z"},{"databaseId":8,"status":"queued","conclusion":null}]'`,
    invalid: `echo '[{"databaseId":7,"status":"completed","conclusion":"success","createdAt":"2020-01-01T00:00:00.000Z"},{"databaseId":8,"status":"queued","conclusion":null,"createdAt":"not-a-date"}]'`,
    before: `echo '[{"databaseId":7,"status":"completed","conclusion":"success","createdAt":"2020-01-01T00:00:00.000Z"},{"databaseId":8,"status":"queued","conclusion":null,"createdAt":"2020-01-01T00:00:00.000Z"}]'`,
    "delayed-valid": `created_at=$(cat "$FAKE_FLOW_ROOT/created-at")
    printf '[{"databaseId":7,"status":"completed","conclusion":"success","createdAt":"2020-01-01T00:00:00.000Z"},{"databaseId":8,"status":"queued","conclusion":null,"createdAt":"%s"}]\\n' "$created_at"`,
  };
  const candidateOutput = candidateByMode[candidateMode] || ":";
  writeFileSync(fakeGit, `#!/bin/sh
if [ "$1" = "pull" ]; then
  count=0
  [ -f "$FAKE_FLOW_ROOT/pull-count" ] && count=$(cat "$FAKE_FLOW_ROOT/pull-count")
  count=$((count + 1))
  printf '%s' "$count" > "$FAKE_FLOW_ROOT/pull-count"
  if [ "$count" -ge 2 ]; then printf '# fixture\n\n今回runで見つかった語\n' > "$FAKE_FLOW_ROOT/google-chat/history/fixture--AAA/2026-07-17.md"; fi
fi
exit 0
`);
  writeFileSync(fakeGh, `#!/bin/sh
if [ "$1 $2" = "workflow run" ]; then
  printf '1' > "$FAKE_FLOW_ROOT/dispatched"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$FAKE_FLOW_ROOT/created-at"
  exit 0
fi
if [ "$1 $2" = "run list" ]; then
  polls=0
  [ -f "$FAKE_FLOW_ROOT/list-count" ] && polls=$(cat "$FAKE_FLOW_ROOT/list-count")
  polls=$((polls + 1)); printf '%s' "$polls" > "$FAKE_FLOW_ROOT/list-count"
  if [ "${candidateMode}" != "none" ] && [ -f "$FAKE_FLOW_ROOT/dispatched" ] && [ "$polls" -ge 4 ]; then
    ${candidateOutput}
  else
    echo '[{"databaseId":7,"status":"completed","conclusion":"success","createdAt":"2020-01-01T00:00:00.000Z"}]'
  fi
  exit 0
fi
if [ "$1 $2" = "run watch" ] && [ "$3" = "8" ]; then exit 0; fi
exit 1
`);
  chmodSync(fakeGit, 0o755);
  chmodSync(fakeGh, 0o755);
  return { root, fakeGit, fakeGh };
}

try {
  const local = temp("yasashii-gchat-index-local-");
  const remote = temp("yasashii-gchat-index-remote-");
  run("git", ["init", "--bare", remote]);
  run("git", ["init", "-b", "main"], { cwd: local });
  run("git", ["config", "user.name", "Generator fixture"], { cwd: local });
  run("git", ["config", "user.email", "generator@example.invalid"], { cwd: local });
  writeFileSync(join(local, "README.md"), "fixture\n");
  run("git", ["add", "README.md"], { cwd: local });
  run("git", ["commit", "-m", "initial"], { cwd: local });
  run("git", ["remote", "add", "origin", remote], { cwd: local });
  run("git", ["push", "-u", "origin", "main"], { cwd: local });

  writeFileSync(join(local, "user-staged.md"), "staged outside Google Chat\n");
  run("git", ["add", "user-staged.md"], { cwd: local });
  writeFileSync(join(local, "README.md"), "fixture\nunstaged outside Google Chat\n");
  writeFileSync(join(local, "user-untracked.md"), "untracked outside Google Chat\n");

  const oldPrivate = process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE;
  const oldSecrets = process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS;
  process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE = "1";
  process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS = "1";
  await applyGoogleChatConfig({
    root: local,
    selectedSpaces: [{ name: "spaces/AAA", displayName: "fixture", spaceType: "SPACE" }],
    interval: "3h",
    automaticPushConsent: true,
    commitPushConsent: true,
  });
  if (oldPrivate === undefined) delete process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE;
  else process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE = oldPrivate;
  if (oldSecrets === undefined) delete process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS;
  else process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS = oldSecrets;

  const committed = run("git", ["show", "--pretty=", "--name-only", "HEAD"], { cwd: local }).trim().split("\n").filter(Boolean);
  const stagedAfter = run("git", ["diff", "--cached", "--name-only"], { cwd: local }).trim().split("\n").filter(Boolean);
  const statusAfter = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: local });
  check(!committed.includes("user-staged.md") && committed.every((path) => path.startsWith("google-chat/") || path === ".github/workflows/google-chat-sync.yml"), "同意したGoogle Chat pathだけをcommitする", committed.join(","));
  check(stagedAfter.length === 1 && stagedAfter[0] === "user-staged.md", "利用者の事前index状態をcommit後も保持する", stagedAfter.join(","));
  check(statusAfter.includes(" M README.md") && statusAfter.includes("?? user-untracked.md"), "対象外のunstaged／untracked fileを変更しない");
  const remoteCommit = run("git", ["show", "--pretty=", "--name-only", "main"], { cwd: remote });
  check(!remoteCommit.includes("user-staged.md"), "remote pushにも同意対象外fileを含めない");

  const retainedHistory = join(local, "google-chat", "history", "fixture--AAA", "2026-07-18.md");
  mkdirSync(join(local, "google-chat", "history", "fixture--AAA"), { recursive: true });
  writeFileSync(retainedHistory, "# 取得済み履歴\n\n削除しない本文\n");
  process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE = "1";
  delete process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS;
  const stopped = await applyGoogleChatConfig({
    root: local,
    selectedSpaces: [],
    availableSpaces: [{ name: "spaces/AAA", displayName: "fixture", spaceType: "SPACE" }],
    interval: "manual",
    automaticPushConsent: true,
    commitPushConsent: true,
  });
  if (oldPrivate === undefined) delete process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE;
  else process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE = oldPrivate;
  if (oldSecrets === undefined) delete process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS;
  else process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS = oldSecrets;
  const stoppedConfig = JSON.parse(readFileSync(join(local, "google-chat", "config.json"), "utf8"));
  const stoppedWorkflow = readFileSync(join(local, ".github", "workflows", "google-chat-sync.yml"), "utf8");
  const stagedAfterStop = run("git", ["diff", "--cached", "--name-only"], { cwd: local }).trim().split("\n").filter(Boolean);
  check(stopped.status === "pushed" && stoppedConfig.selectedSpaceNames.length === 0 && stoppedConfig.selectedSpaces.length === 0 && stoppedConfig.scheduleEnabled === false && stoppedConfig.automaticPushConsent === false, "Secret 0件でも0件＋手動のみをcommit・pushして停止状態を固定する");
  check(!stoppedWorkflow.includes("  schedule:") && readFileSync(retainedHistory, "utf8").includes("削除しない本文"), "停止後はworkflow schedule 0件で既存履歴を保持する");
  check(stagedAfterStop.length === 1 && stagedAfterStop[0] === "user-staged.md", "0件＋手動のみのcommit後も利用者の既存index状態を保持する", stagedAfterStop.join(","));

  const apiDisabled = await classifyFixture({ error: { status: "PERMISSION_DENIED", message: "Request is prohibited", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "SERVICE_DISABLED", domain: "googleapis.com", metadata: { service: "chat.googleapis.com" } }] } });
  const scopeInsufficient = await classifyFixture({ error: { status: "PERMISSION_DENIED", message: "Permission denied", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT", domain: "googleapis.com" }] } });
  const adminBlocked = await classifyFixture({ error: { status: "PERMISSION_DENIED", message: "Blocked by administrator policy", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "ADMIN_POLICY_ENFORCED", domain: "googleapis.com" }] } });
  const unknown = await classifyFixture({ error: { status: "PERMISSION_DENIED", message: "Permission denied", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "SOME_NEW_REASON", domain: "googleapis.com" }] } });
  check(apiDisabled === "api-disabled", "ErrorInfo SERVICE_DISABLEDをAPI無効へ分類", String(apiDisabled));
  check(scopeInsufficient === "scope-insufficient", "ErrorInfo scope不足を再認証へ分類", String(scopeInsufficient));
  check(adminBlocked === "admin-blocked", "ErrorInfo管理者policyを管理者blockへ分類", String(adminBlocked));
  check(unknown === "permission-denied", "未知の403をscope／管理者問題と断定しない", String(unknown));

  const searchFlow = resolve("plugins/yasashii-secretary/skills/google-chat/scripts/search-flow.mjs");
  const stale = makeSearchFixture({ candidateMode: "none" });
  const staleResult = JSON.parse(runOutput(process.execPath, [searchFlow, "--root", stale.root, "--query", "今回runで見つかった語", "--choice", "sync", "--timeout-ms", "500", "--run-discovery-timeout-ms", "300", "--run-poll-ms", "50"], {
    env: { ...process.env, YASASHII_GIT_BIN: stale.fakeGit, YASASHII_GH_BIN: stale.fakeGh, FAKE_FLOW_ROOT: stale.root },
  }));
  check(staleResult.status === "sync-failed" && staleResult.error === "timeout" && !staleResult.events.includes("pull-after-sync") && readFileSync(join(stale.root, "pull-count"), "utf8") === "1", "過去successだけならtimeoutしpull／再検索しない", staleResult.events.join(","));

  for (const [candidateMode, label] of [
    ["missing", "createdAt欠落"],
    ["invalid", "createdAt不正"],
    ["before", "dispatch前createdAt"],
  ]) {
    const rejected = makeSearchFixture({ candidateMode });
    const rejectedResult = JSON.parse(runOutput(process.execPath, [searchFlow, "--root", rejected.root, "--query", "今回runで見つかった語", "--choice", "sync", "--timeout-ms", "500", "--run-discovery-timeout-ms", "300", "--run-poll-ms", "50"], {
      env: { ...process.env, YASASHII_GIT_BIN: rejected.fakeGit, YASASHII_GH_BIN: rejected.fakeGh, FAKE_FLOW_ROOT: rejected.root },
    }));
    check(rejectedResult.status === "sync-failed" && rejectedResult.error === "timeout" && !rejectedResult.events.includes("success-confirmed") && !rejectedResult.events.includes("pull-after-sync") && readFileSync(join(rejected.root, "pull-count"), "utf8") === "1", `${label}の新規IDを候補外にして後続pull／再検索しない`, rejectedResult.events.join(","));
  }

  const delayed = makeSearchFixture({ candidateMode: "delayed-valid" });
  const delayedResult = JSON.parse(run(process.execPath, [searchFlow, "--root", delayed.root, "--query", "今回runで見つかった語", "--choice", "sync", "--timeout-ms", "1000", "--run-discovery-timeout-ms", "700", "--run-poll-ms", "50"], {
    env: { ...process.env, YASASHII_GIT_BIN: delayed.fakeGit, YASASHII_GH_BIN: delayed.fakeGh, FAKE_FLOW_ROOT: delayed.root },
  }));
  check(delayedResult.status === "found" && delayedResult.events.includes("success-confirmed") && delayedResult.events.includes("pull-after-sync"), "list反映遅延をpollし今回の新規run だけで後続処理する", delayedResult.events.join(","));
} finally {
  for (const root of roots.reverse()) rmSync(root, { recursive: true, force: true });
}

process.stdout.write(`SPRINT020_ADVERSARIAL_PASS=${passed} SPRINT020_ADVERSARIAL_FAIL=${failed}\n`);
process.exitCode = failed === 0 ? 0 : 1;
