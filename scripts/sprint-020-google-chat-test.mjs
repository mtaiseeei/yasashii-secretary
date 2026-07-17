#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { applyGoogleChatConfig } from "../plugins/yasashii-secretary/skills/google-chat/scripts/config-transaction.mjs";
import { continuousGoogleChatSync } from "../plugins/yasashii-secretary/skills/google-chat/scripts/continuous-sync.mjs";
import { exchangeRefreshToken } from "../plugins/yasashii-secretary/skills/google-chat/scripts/refresh-token.mjs";
import { GOOGLE_CHAT_INTERVALS, googleChatScheduleFor, renderGoogleChatWorkflow } from "../plugins/yasashii-secretary/skills/google-chat/scripts/schedule.mjs";

let passed = 0;
let failed = 0;
const temporary = [];

function check(condition, label) {
  if (condition) { passed += 1; process.stdout.write(`  PASS ${label}\n`); }
  else { failed += 1; process.stderr.write(`  FAIL ${label}\n`); }
}

function temp(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(path);
  return path;
}

function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function run(binary, argv, options = {}) { return execFileSync(binary, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }); }

function message(id, createTime, text, extra = {}) {
  return { name: `spaces/AAA/messages/${id}`, createTime, lastUpdateTime: extra.lastUpdateTime || createTime, text, sender: { name: "people/1001" }, thread: extra.thread ? { name: extra.thread } : undefined, deletionMetadata: extra.deleted ? { deletionType: "USER_DELETED" } : undefined };
}

function fixtureClient({ spaces, messages, failures = new Set() }) {
  return {
    async getSpace(name) {
      if (failures.has(name)) throw Object.assign(new Error("network fixture"), { code: "network" });
      const found = spaces.find((space) => space.name === name);
      if (!found) throw Object.assign(new Error("not found"), { code: "space-not-found" });
      return found;
    },
    async listAllMessages(name, { after = "" } = {}) {
      const source = messages[name] || [];
      return source.filter((item) => !after || item.createTime > after);
    },
    async displayName() { return "テスト担当"; },
  };
}

const envBefore = { ...process.env };
process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE = "1";
process.env.YASASHII_GOOGLE_CHAT_TEST_SECRETS = "1";

try {
  const expectedCrons = { "1h": "23 * * * *", "3h": "23 */3 * * *", "6h": "23 */6 * * *", "12h": "23 */12 * * *", manual: null };
  for (const [interval, cron] of Object.entries(expectedCrons)) {
    const enabled = interval !== "manual";
    const workflow = renderGoogleChatWorkflow(interval, enabled);
    check(googleChatScheduleFor(interval, enabled) === cron, `${interval}のscheduleは毎時0分を避ける`);
    check((cron === null) === !workflow.includes("  schedule:"), `${interval}の表示とworkflow scheduleが一致`);
  }
  check(GOOGLE_CHAT_INTERVALS["3h"].runs === 240, "3時間は30日換算240回の推奨値");
  check(renderGoogleChatWorkflow("3h", true).includes("google-chat/scripts/continuous-sync.mjs"), "workflowはprivate workspaceへ生成する取得runtimeを実行");
  check(renderGoogleChatWorkflow("3h", true).includes("if [ -d google-chat/history ]; then"), "履歴0件でもworkflowの状態保存を失敗させない");

  const noConsent = temp("yasashii-gchat-no-consent-");
  let rejected = false;
  try {
    await applyGoogleChatConfig({ root: noConsent, selectedSpaces: [{ name: "spaces/AAA", displayName: "営業", spaceType: "SPACE" }], interval: "3h", automaticPushConsent: false, commitPushConsent: false });
  } catch (error) { rejected = error.code === "consent-required"; }
  check(rejected && !existsSync(join(noConsent, "google-chat")), "明示同意前は設定・workflow・commit・push 0件");

  const local = temp("yasashii-gchat-local-");
  const remote = temp("yasashii-gchat-remote-");
  run("git", ["init", "--bare", remote]);
  run("git", ["init", "-b", "main"], { cwd: local });
  run("git", ["config", "user.name", "Fixture"], { cwd: local });
  run("git", ["config", "user.email", "fixture@example.invalid"], { cwd: local });
  writeFileSync(join(local, "README.md"), "fixture\n");
  run("git", ["add", "README.md"], { cwd: local });
  run("git", ["commit", "-m", "初期化"], { cwd: local });
  run("git", ["remote", "add", "origin", remote], { cwd: local });
  run("git", ["push", "-u", "origin", "main"], { cwd: local });
  const configured = await applyGoogleChatConfig({
    root: local,
    selectedSpaces: [{ name: "spaces/AAA", displayName: "営業", spaceType: "SPACE" }],
    availableSpaces: [{ name: "spaces/AAA", displayName: "営業", spaceType: "SPACE" }, { name: "spaces/BBB", displayName: "企画", spaceType: "SPACE" }],
    interval: "3h", automaticPushConsent: true, commitPushConsent: true,
  });
  check(configured.status === "pushed" && json(join(local, "google-chat", "config.json")).interval === "3h", "同意後だけ3時間設定をlocal bare remoteへcommit・push");
  check(existsSync(join(local, ".github", "workflows", "google-chat-sync.yml")) && existsSync(join(local, "google-chat", "scripts", "continuous-sync.mjs")), "workflowとruntimeは利用者workspaceへだけ生成");
  check(run("git", ["rev-list", "--count", "main"], { cwd: remote }).trim() === "2", "生成資産はremoteの2件目commitとして保存");

  process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT = "1";
  const zeroAutomatic = temp("yasashii-gchat-zero-automatic-");
  writeFileSync(join(zeroAutomatic, "before.txt"), "変更前のまま\n");
  let zeroAutomaticError;
  try {
    await applyGoogleChatConfig({
      root: zeroAutomatic,
      selectedSpaces: [],
      availableSpaces: [{ name: "spaces/AAA", displayName: "営業", spaceType: "SPACE" }],
      interval: "3h",
      automaticPushConsent: true,
      commitPushConsent: true,
    });
  } catch (error) { zeroAutomaticError = error; }
  check(zeroAutomaticError?.code === "space-required" && !existsSync(join(zeroAutomatic, "google-chat")) && readFileSync(join(zeroAutomatic, "before.txt"), "utf8") === "変更前のまま\n", "対象0件の自動取得を拒否し確定前0変更");

  const manual = temp("yasashii-gchat-manual-");
  const retainedHistory = join(manual, "google-chat", "history", "営業--AAA", "2026-07-18.md");
  mkdirSync(dirname(retainedHistory), { recursive: true });
  writeFileSync(retainedHistory, "# 取得済み履歴\n\nこの履歴は残す\n");
  const manualResult = await applyGoogleChatConfig({
    root: manual,
    selectedSpaces: [],
    availableSpaces: [{ name: "spaces/AAA", displayName: "営業", spaceType: "SPACE" }],
    interval: "manual",
    automaticPushConsent: true,
    commitPushConsent: true,
  });
  const manualConfig = json(join(manual, "google-chat", "config.json"));
  const manualWorkflow = readFileSync(join(manual, ".github", "workflows", "google-chat-sync.yml"), "utf8");
  check(manualResult.status === "saved" && manualConfig.selectedSpaceNames.length === 0 && manualConfig.selectedSpaces.length === 0, "対象0件と手動のみを安全に保存");
  check(manualConfig.scheduleEnabled === false && manualConfig.automaticPushConsent === false && !manualWorkflow.includes("  schedule:"), "対象0件の手動のみは同意値を残さずworkflow schedule 0件");
  check(readFileSync(retainedHistory, "utf8").includes("この履歴は残す"), "対象0件へ変更しても既存履歴を保持");
  delete process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT;

  const syncRoot = temp("yasashii-gchat-sync-");
  mkdirSync(join(syncRoot, "google-chat"), { recursive: true });
  writeFileSync(join(syncRoot, "google-chat", "config.json"), `${JSON.stringify({ version: 2, selectedSpaceNames: ["spaces/AAA", "spaces/BBB"], interval: "3h", scheduleEnabled: true, automaticPushConsent: true }, null, 2)}\n`);
  const spaces = [{ name: "spaces/AAA", displayName: "営業", spaceType: "SPACE" }, { name: "spaces/BBB", displayName: "企画", spaceType: "SPACE" }];
  const emptyRoot = temp("yasashii-gchat-empty-");
  mkdirSync(join(emptyRoot, "google-chat"), { recursive: true });
  writeFileSync(join(emptyRoot, "google-chat", "config.json"), `${JSON.stringify({ version: 2, selectedSpaceNames: ["spaces/AAA"], interval: "3h", scheduleEnabled: true, automaticPushConsent: true }, null, 2)}\n`);
  const empty = await continuousGoogleChatSync({ root: emptyRoot, trigger: "schedule", client: fixtureClient({ spaces: [spaces[0]], messages: { "spaces/AAA": [] } }), now: "2026-07-17T00:30:00.000Z" });
  check(empty.status === "success" && empty.results[0].fetched === 0 && !existsSync(join(emptyRoot, "google-chat", "history")), "0件取得でも成功状態を保存し履歴directoryを要求しない");
  const firstMessages = {
    "spaces/AAA": [message("old", "2026-07-15T00:00:00.000Z", "古い本文"), message("recent", "2026-07-17T01:00:00.000Z", "最初の本文", { thread: "spaces/AAA/threads/T1" })],
    "spaces/BBB": [message("b1", "2026-07-17T02:00:00.000Z", "企画本文")],
  };
  const first = await continuousGoogleChatSync({ root: syncRoot, trigger: "schedule", client: fixtureClient({ spaces, messages: firstMessages }), now: "2026-07-17T03:00:00.000Z" });
  check(first.status === "success" && Object.keys(first.cursors).length === 2, "spaceごとに成功とcursorを保存");
  const aaaHistory = join(syncRoot, "google-chat", "history", "営業--AAA", "2026-07-17.md");
  check(readFileSync(aaaHistory, "utf8").includes("スレッド"), "thread返信を履歴へ保持");

  const secondMessages = {
    "spaces/AAA": [message("recent", "2026-07-17T01:00:00.000Z", "編集後", { lastUpdateTime: "2026-07-17T04:00:00.000Z", thread: "spaces/AAA/threads/T1" }), message("deleted", "2026-07-17T03:30:00.000Z", "消える本文", { deleted: true }), message("new", "2026-07-17T04:00:00.000Z", "新規本文")],
    "spaces/BBB": firstMessages["spaces/BBB"],
  };
  const second = await continuousGoogleChatSync({ root: syncRoot, trigger: "schedule", client: fixtureClient({ spaces, messages: secondMessages }), now: "2026-07-17T05:00:00.000Z" });
  const secondHistory = readFileSync(aaaHistory, "utf8");
  check(second.status === "success" && secondHistory.includes("編集後") && secondHistory.includes("削除済みメッセージ") && secondHistory.includes("新規本文"), "取得範囲内の新規・編集・削除をmessage resource単位で統合");
  const oldHistory = readFileSync(join(syncRoot, "google-chat", "history", "営業--AAA", "2026-07-15.md"), "utf8");
  check(oldHistory.includes("古い本文"), "差分範囲外の古い編集・削除は既存履歴を消さない");
  check((secondHistory.match(/google-chat-message:/g) || []).length === 3, "同日再実行で重複・既存投稿消失0件");

  const beforeB = second.cursors["spaces/BBB"];
  let partialError;
  try {
    await continuousGoogleChatSync({ root: syncRoot, trigger: "schedule", client: fixtureClient({ spaces, messages: { ...secondMessages, "spaces/AAA": [...secondMessages["spaces/AAA"], message("new2", "2026-07-17T06:00:00.000Z", "部分成功")] }, failures: new Set(["spaces/BBB"]) }), now: "2026-07-17T06:10:00.000Z" });
  } catch (error) { partialError = error; }
  const partialState = json(join(syncRoot, "google-chat", "state", "sync.json"));
  check(partialError?.code === "partial-space" && partialState.status === "partial", "1space失敗を全成功と報告しない");
  check(partialState.cursors["spaces/AAA"].lastSuccessAt === "2026-07-17T06:10:00.000Z" && partialState.cursors["spaces/BBB"].lastSuccessAt === beforeB.lastSuccessAt, "部分失敗時は成功spaceだけcursorを進める");
  const recovered = await continuousGoogleChatSync({ root: syncRoot, trigger: "schedule", client: fixtureClient({ spaces, messages: secondMessages }), now: "2026-07-17T07:00:00.000Z" });
  check(recovered.status === "success" && recovered.results.every((item) => item.status === "success"), "再実行で失敗spaceを安全に回復");

  const bHistoryPath = join(syncRoot, "google-chat", "history", "企画--BBB", "2026-07-17.md");
  writeFileSync(join(syncRoot, "google-chat", "config.json"), `${JSON.stringify({ version: 2, selectedSpaceNames: ["spaces/AAA"], interval: "3h", scheduleEnabled: true, automaticPushConsent: true }, null, 2)}\n`);
  await continuousGoogleChatSync({ root: syncRoot, trigger: "schedule", client: fixtureClient({ spaces, messages: secondMessages }), now: "2026-07-17T08:00:00.000Z" });
  check(existsSync(bHistoryPath), "選択解除したspaceの既存履歴を削除しない");

  writeFileSync(join(syncRoot, "google-chat", "config.json"), `${JSON.stringify({ version: 2, selectedSpaceNames: ["spaces/DM"], interval: "3h", scheduleEnabled: true, automaticPushConsent: true }, null, 2)}\n`);
  let dmError;
  try { await continuousGoogleChatSync({ root: syncRoot, trigger: "schedule", client: fixtureClient({ spaces: [{ name: "spaces/DM", displayName: "DM", spaceType: "DIRECT_MESSAGE" }], messages: { "spaces/DM": [message("dm", "2026-07-17T09:00:00.000Z", "DM本文")] } }), now: "2026-07-17T09:10:00.000Z" }); }
  catch (error) { dmError = error; }
  check(dmError && !existsSync(join(syncRoot, "google-chat", "history", "DM--DM")), "設定改ざんでも実行時SPACE再検証でDM取得0件");

  const refreshCases = [
    [400, { error: "invalid_grant" }, "reauthorization-needed"],
    [400, { error: "invalid_scope" }, "scope-insufficient"],
    [403, { error: "admin_policy_enforced" }, "admin-blocked"],
    [400, { error: "org_internal" }, "audience-mismatch"],
    [429, { error: "temporarily_unavailable" }, "rate-limit"],
  ];
  for (const [status, body, code] of refreshCases) {
    let actual;
    try { await exchangeRefreshToken({ clientId: "fixture-id", clientSecret: "fixture-secret", refreshToken: "fixture-refresh", fetchImpl: async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }) }); }
    catch (error) { actual = error.code; }
    check(actual === code, `refresh token失敗を${code}へ分類`);
  }

  const flowRoot = temp("yasashii-gchat-flow-");
  mkdirSync(join(flowRoot, "bin"), { recursive: true });
  mkdirSync(join(flowRoot, "google-chat", "history", "営業--AAA"), { recursive: true });
  const fakeGit = join(flowRoot, "bin", "git");
  const fakeGh = join(flowRoot, "bin", "gh");
  writeFileSync(fakeGit, "#!/bin/sh\nexit 0\n");
  writeFileSync(fakeGh, `#!/bin/sh
if [ "$1 $2" = "workflow run" ]; then
  count_file="$FAKE_GH_ROOT/dispatch-count"
  count=0
  [ -f "$count_file" ] && count=$(cat "$count_file")
  count=$((count + 1))
  printf '%s' "$count" > "$count_file"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$FAKE_GH_ROOT/created-at"
  exit 0
fi
if [ "$1 $2" = "run list" ]; then
  count=0
  [ -f "$FAKE_GH_ROOT/dispatch-count" ] && count=$(cat "$FAKE_GH_ROOT/dispatch-count")
  if [ "$count" -eq 0 ]; then
    echo '[]'
  else
    created_at=$(cat "$FAKE_GH_ROOT/created-at")
    printf '[{"databaseId":%s,"status":"queued","conclusion":null,"createdAt":"%s"}]\n' "$((40 + count))" "$created_at"
  fi
  exit 0
fi
if [ "$1 $2" = "run watch" ]; then
  if [ "$FAKE_GH_MODE" = "success" ]; then
    mkdir -p "$FAKE_GH_ROOT/google-chat/history/営業--AAA"
    printf '# 営業 - 2026-07-17\n\n承認後に見つかった言葉\n' > "$FAKE_GH_ROOT/google-chat/history/営業--AAA/2026-07-17.md"
    exit 0
  fi
  if [ "$FAKE_GH_MODE" = "timeout" ]; then sleep 1; exit 1; fi
  exit 1
fi
if [ "$1 $2" = "run view" ]; then
  case "$FAKE_GH_MODE" in
    reauth) echo 'GOOGLE_CHAT_ERROR=reauthorization-needed' ;;
    admin) echo 'GOOGLE_CHAT_ERROR=admin-blocked' ;;
    scope) echo 'GOOGLE_CHAT_ERROR=scope-insufficient' ;;
    audience) echo 'GOOGLE_CHAT_ERROR=audience-mismatch' ;;
    api) echo 'GOOGLE_CHAT_ERROR=api-disabled' ;;
    permission) echo 'GOOGLE_CHAT_ERROR=permission-denied' ;;
    rate) echo 'GOOGLE_CHAT_ERROR=rate-limit' ;;
    network) echo 'GOOGLE_CHAT_ERROR=network' ;;
  esac
  exit 0
fi
exit 0
`);
  chmodSync(fakeGit, 0o755); chmodSync(fakeGh, 0o755);
  const searchFlow = resolve(dirname(fileURLToPath(import.meta.url)), "..", "plugins", "yasashii-secretary", "skills", "google-chat", "scripts", "search-flow.mjs");
  const flow = (choice, mode, query = "見つからない", timeoutMs = "1000") => spawnSync(process.execPath, [searchFlow, "--root", flowRoot, "--query", query, "--choice", choice, "--timeout-ms", timeoutMs], { encoding: "utf8", env: { ...process.env, YASASHII_GIT_BIN: fakeGit, YASASHII_GH_BIN: fakeGh, FAKE_GH_ROOT: flowRoot, FAKE_GH_MODE: mode } });
  const declined = JSON.parse(flow("decline", "success").stdout);
  check(declined.status === "sync-declined" && declined.events.join(",") === "pull-before-search,search-local,structured-choice", "not found拒否はdispatch・commit・push 0件");
  const approved = JSON.parse(flow("sync", "success", "承認後に見つかった言葉").stdout);
  check(approved.status === "found" && approved.events.join(",") === "pull-before-search,search-local,structured-choice,dispatch,wait,success-confirmed,pull-after-sync,retry-same-query", "承認時だけdispatch→wait→success→pull→同条件再検索");
  const timeoutResult = JSON.parse(flow("sync", "timeout", "別の語", "20").stdout);
  check(timeoutResult.status === "sync-failed" && timeoutResult.error === "timeout" && !timeoutResult.events.includes("pull-after-sync"), "timeoutを黙殺せず成功前pullを行わない");
  for (const [mode, status, error] of [["reauth", "reauthorization-needed", "token-invalid"], ["admin", "admin-action-needed", "admin-blocked"], ["scope", "reauthorization-needed", "scope-insufficient"], ["audience", "admin-action-needed", "audience-mismatch"], ["api", "admin-action-needed", "api-disabled"], ["permission", "sync-failed", "permission-denied"], ["rate", "sync-failed", "rate-limit"], ["network", "sync-failed", "network"]]) {
    const result = JSON.parse(flow("sync", mode, `分類-${mode}`).stdout);
    check(result.status === status && result.error === error && !result.events.includes("pull-after-sync"), `${mode}を区別し無限再試行しない`);
  }
} finally {
  for (const path of temporary.reverse()) rmSync(path, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key];
  Object.assign(process.env, envBefore);
}

process.stdout.write(`SPRINT020_PASS=${passed} SPRINT020_FAIL=${failed}\n`);
if (failed) process.exit(1);
