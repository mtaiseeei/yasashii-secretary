#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { applyChatworkConfig } from "../plugins/yasashii-secretary/skills/chatwork/scripts/config-transaction.mjs";
import { INTERVALS } from "../plugins/yasashii-secretary/skills/chatwork/scripts/schedule.mjs";

const exec = promisify(execFile);
const repo = resolve(import.meta.dirname, "..");
const plugin = join(repo, "plugins", "yasashii-secretary");
const template = join(plugin, "workspace-templates");
const syncScript = join(template, "chatwork", "scripts", "chatwork-sync.mjs");
const searchFlow = join(plugin, "skills", "chatwork", "scripts", "search-flow.mjs");
const wizardScript = join(plugin, "skills", "chatwork", "scripts", "wizard-server.mjs");
const work = mkdtempSync(join(tmpdir(), "yasashii-s014-"));
const tokenMarker = ["runtime", "s014", String(process.pid), String(Date.now())].join("-");
let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stdout.write(`FAIL ${label}\n`); }
}
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function fixture(name) { const root = join(work, name); mkdirSync(root); cpSync(template, root, { recursive: true }); return root; }
function message(id, body = `合成本体${id}`) { return { message_id: String(id), account: { account_id: 7, name: "合成人物" }, body, send_time: 1784160000 + Number(id), update_time: 1784160000 + Number(id) }; }
function files(root) {
  const output = [];
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, name.name);
    if (name.isDirectory()) output.push(...files(path)); else output.push(path);
  }
  return output;
}

process.env.YASASHII_CHATWORK_SKIP_GIT = "1";
process.env.YASASHII_CHATWORK_TEST_SECRET = "1";
process.env.YASASHII_CHATWORK_TEST_PRIVATE = "1";
for (const [interval, detail] of Object.entries(INTERVALS)) {
  const root = fixture(`schedule-${interval}`);
  const result = await applyChatworkConfig({ root, selectedRoomIds: ["101"], interval, automaticPushConsent: interval !== "manual" });
  const config = json(join(root, "chatwork", "config.json"));
  const workflow = readFileSync(join(root, ".github", "workflows", "chatwork-sync.yml"), "utf8");
  check(`${detail.label}はwizard保存値と一致`, result.config.interval === interval && config.interval === interval);
  check(`${detail.label}は実scheduleと一致`, detail.cron ? workflow.includes(`cron: '${detail.cron}'`) && config.scheduleEnabled : !workflow.includes("  schedule:") && !config.scheduleEnabled);
}

const consentRoot = fixture("consent-gate");
const consentBefore = readFileSync(join(consentRoot, "chatwork", "config.json"), "utf8");
const consentError = await applyChatworkConfig({ root: consentRoot, selectedRoomIds: ["101"], interval: "1h", automaticPushConsent: false }).catch((error) => error);
check("自動push同意前は設定・workflow変更0", consentError.code === "consent-required" && readFileSync(join(consentRoot, "chatwork", "config.json"), "utf8") === consentBefore);
const noRoomError = await applyChatworkConfig({ root: consentRoot, selectedRoomIds: [], interval: "manual", automaticPushConsent: false }).catch((error) => error);
check("room未選択は実行前に拒否", noRoomError.code === "room-required");

delete process.env.YASASHII_CHATWORK_SKIP_GIT;
const atomic = fixture("atomic");
await exec("git", ["init", "-q", "-b", "main"], { cwd: atomic });
await exec("git", ["config", "user.name", "regression"], { cwd: atomic });
await exec("git", ["config", "user.email", "regression@example.invalid"], { cwd: atomic });
await exec("git", ["add", "-A"], { cwd: atomic });
await exec("git", ["commit", "-q", "-m", "初期"], { cwd: atomic });
const bare = join(work, "atomic.git");
await exec("git", ["init", "-q", "--bare", bare]);
await exec("git", ["remote", "add", "origin", bare], { cwd: atomic });
await exec("git", ["push", "-q", "-u", "origin", "main"], { cwd: atomic });
const applied = await applyChatworkConfig({ root: atomic, selectedRoomIds: ["101", "102"], interval: "3h", automaticPushConsent: true });
const changed = await exec("git", ["show", "--name-only", "--format=", applied.commit], { cwd: atomic });
check("room・頻度・workflowを同じcommitでpush", changed.stdout.includes("chatwork/config.json") && changed.stdout.includes(".github/workflows/chatwork-sync.yml"));

const other = join(work, "other");
await exec("git", ["clone", "-q", bare, other]);
await exec("git", ["config", "user.name", "regression"], { cwd: other });
await exec("git", ["config", "user.email", "regression@example.invalid"], { cwd: other });
writeFileSync(join(other, "remote-change.txt"), "競合fixture\n");
await exec("git", ["add", "remote-change.txt"], { cwd: other });
await exec("git", ["commit", "-q", "-m", "remote変更"], { cwd: other });
await exec("git", ["push", "-q"], { cwd: other });
const beforeHead = (await exec("git", ["rev-parse", "HEAD"], { cwd: atomic })).stdout.trim();
const beforeConfig = readFileSync(join(atomic, "chatwork", "config.json"), "utf8");
const beforeWorkflow = readFileSync(join(atomic, ".github", "workflows", "chatwork-sync.yml"), "utf8");
const conflict = await applyChatworkConfig({ root: atomic, selectedRoomIds: ["102"], interval: "6h", automaticPushConsent: true }).catch((error) => error);
const afterHead = (await exec("git", ["rev-parse", "HEAD"], { cwd: atomic })).stdout.trim();
check("git競合はforce pushせず安全に失敗", conflict.code === "git-conflict" && afterHead === beforeHead);
check("git競合時はconfig・workflowを変更前へ戻す", readFileSync(join(atomic, "chatwork", "config.json"), "utf8") === beforeConfig && readFileSync(join(atomic, ".github", "workflows", "chatwork-sync.yml"), "utf8") === beforeWorkflow);

let apiMode = "normal";
const requests = [];
const api = createServer(async (request, response) => {
  requests.push(request.url);
  if (request.headers["x-chatworktoken"] !== tokenMarker) { response.writeHead(401); response.end("{}"); return; }
  if (apiMode === "auth") { response.writeHead(401); response.end("{}"); return; }
  if (apiMode === "rate") { response.writeHead(429); response.end("{}"); return; }
  if (apiMode === "timeout") { await new Promise((wait) => setTimeout(wait, 500)); response.end("[]"); return; }
  response.setHeader("content-type", "application/json");
  if (request.url === "/rooms") { response.end(JSON.stringify([{ room_id: 101, name: "営業" }, { room_id: 102, name: "開発" }])); return; }
  if (request.url?.startsWith("/rooms/101/messages")) { response.end(JSON.stringify([message(1, "見積書を確認") ])); return; }
  if (request.url?.startsWith("/rooms/102/messages")) {
    if (apiMode === "partial") { response.writeHead(500); response.end("{}"); return; }
    response.end(JSON.stringify([message(2, "開発予定") ])); return;
  }
  response.writeHead(404); response.end("{}");
});
await new Promise((done) => api.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${api.address().port}`;
const syncRoot = fixture("sync");
const syncEnv = { ...process.env, CHATWORK_API_TOKEN: tokenMarker, CHATWORK_API_BASE_URL: base, CC_SECRETARY_NOW: "2026-07-16T12:00:00Z", CHATWORK_TRIGGER: "schedule" };
writeFileSync(join(syncRoot, "chatwork", "rooms.json"), `${JSON.stringify({ version: 1, status: "ready", rooms: [{ roomId: "101", name: "営業" }, { roomId: "102", name: "開発" }] }, null, 2)}\n`);
writeFileSync(join(syncRoot, "chatwork", "config.json"), `${JSON.stringify({ version: 1, selectedRoomIds: ["101", "102"], interval: "1h", scheduleEnabled: true, automaticPushConsent: true }, null, 2)}\n`);
await exec(process.execPath, [syncScript, "sync", syncRoot], { env: syncEnv });
const successState = json(join(syncRoot, "chatwork", "state", "sync.json"));
check("scheduleは選択roomだけを同期し取得位置を記録", requests.some((value) => value?.includes("/101/")) && requests.some((value) => value?.includes("/102/")) && successState.status === "success" && successState.cursors["101"]);
await Promise.all([exec(process.execPath, [syncScript, "sync", syncRoot], { env: syncEnv }), exec(process.execPath, [syncScript, "sync", syncRoot], { env: syncEnv })]);
check("重複実行でもmessage ID重複0", json(join(syncRoot, "chatwork", "history", "101.json")).messages.length === 1 && json(join(syncRoot, "chatwork", "history", "102.json")).messages.length === 1);

const historyBeforePartial = readFileSync(join(syncRoot, "chatwork", "history", "101.json"), "utf8");
const lastSuccess = successState.lastSuccessAt;
const cursorsBefore = JSON.stringify(successState.cursors);
apiMode = "partial";
const partial = await exec(process.execPath, [syncScript, "sync", syncRoot], { env: { ...syncEnv, CC_SECRETARY_NOW: "2026-07-16T13:00:00Z" } }).catch((error) => error);
const partialState = json(join(syncRoot, "chatwork", "state", "sync.json"));
check("部分room失敗を区別", partial.code !== 0 && partialState.status === "partial" && partialState.results.some((item) => item.status === "failed"));
check("部分失敗は最終成功・取得位置・前履歴を保持", partialState.lastSuccessAt === lastSuccess && JSON.stringify(partialState.cursors) === cursorsBefore && readFileSync(join(syncRoot, "chatwork", "history", "101.json"), "utf8") === historyBeforePartial);

for (const [mode, expected] of [["auth", "auth"], ["rate", "rate-limit"], ["timeout", "timeout"]]) {
  apiMode = mode;
  const target = fixture(`failure-${mode}`);
  const failed = await exec(process.execPath, [syncScript, "discover", target], { env: { ...syncEnv, CHATWORK_API_TIMEOUT_MS: "50", CHATWORK_TRIGGER: "workflow_dispatch" } }).catch((error) => error);
  const observed = json(join(target, "chatwork", "state", "discovery.json")).error;
  if (observed !== expected) process.stderr.write(`${mode}分類: expected=${expected} actual=${observed}\n`);
  check(`${mode}失敗を区別`, failed.code !== 0 && observed === expected);
}
apiMode = "normal";

function makeSearchFixture(name, addOnSecondPull = false) {
  const root = join(work, name); mkdirSync(join(root, "chatwork", "history"), { recursive: true });
  const bin = join(root, "bin"); mkdirSync(bin);
  const gitBin = join(bin, "fake-git.mjs");
  const ghBin = join(bin, "fake-gh.mjs");
  writeFileSync(gitBin, `#!/usr/bin/env node\nimport{appendFileSync,readFileSync,writeFileSync,mkdirSync}from'node:fs';import{join}from'node:path';const a=process.argv.slice(2);appendFileSync(process.env.FAKE_LOG,'git '+a.join(' ')+'\\n');if(a[0]==='pull'){let n=0;try{n=Number(readFileSync(process.env.PULL_COUNT,'utf8'))}catch{}n++;writeFileSync(process.env.PULL_COUNT,String(n));if(n===2&&process.env.ADD_ON_SECOND==='1'){mkdirSync(join(process.env.SEARCH_ROOT,'chatwork','history'),{recursive:true});writeFileSync(join(process.env.SEARCH_ROOT,'chatwork','history','101.json'),JSON.stringify({messages:[{messageId:'900',roomId:'101',roomName:'営業',accountId:'7',accountName:'合成人物',sentAt:1784160900,body:'再検索で見つかる見積書'}]}));}}\n`);
  writeFileSync(ghBin, `#!/usr/bin/env node\nimport{appendFileSync}from'node:fs';const a=process.argv.slice(2);appendFileSync(process.env.FAKE_LOG,'gh '+a.join(' ')+'\\n');if(process.env.GH_MODE==='permission'&&a[0]==='workflow'){process.stderr.write('Resource not accessible by integration');process.exit(1)}if(a[0]==='run'&&a[1]==='list')process.stdout.write('[{"databaseId":77,"status":"queued","conclusion":null}]');if(a[0]==='run'&&a[1]==='watch'){if(['failure','auth','rate','network','partial'].includes(process.env.GH_MODE))process.exit(1);if(process.env.GH_MODE==='timeout')await new Promise(r=>setTimeout(r,1000));}if(a[0]==='run'&&a[1]==='view'){const logs={auth:'失敗種別: auth',rate:'失敗種別: rate-limit',network:'失敗種別: network',partial:'失敗種別: server'};process.stdout.write(logs[process.env.GH_MODE]||'workflow failed');}\n`);
  chmodSync(gitBin, 0o755); chmodSync(ghBin, 0o755);
  return { root, gitBin, ghBin, log: join(root, "events.log"), count: join(root, "pull-count"), addOnSecondPull };
}
async function runFlow(target, choice, ghMode = "success", timeoutMs = "500") {
  const argv = [searchFlow, "--root", target.root, "--query", "見積書", "--timeout-ms", timeoutMs];
  if (choice) argv.push("--choice", choice);
  const env = { ...process.env, YASASHII_GIT_BIN: target.gitBin, YASASHII_GH_BIN: target.ghBin, FAKE_LOG: target.log, PULL_COUNT: target.count, SEARCH_ROOT: target.root, ADD_ON_SECOND: target.addOnSecondPull ? "1" : "0", GH_MODE: ghMode };
  try { return JSON.parse((await exec(process.execPath, argv, { env })).stdout); }
  catch (error) { return JSON.parse(error.stdout); }
}
const ask = await runFlow(makeSearchFixture("search-ask"), null);
check("not foundでhost向け3択を返す", ask.status === "needs-choice" && ask.choices.map((item) => item.value).join() === "sync,decline,review");
const declinedTarget = makeSearchFixture("search-decline");
const declined = await runFlow(declinedTarget, "decline");
check("同期しないはdispatch・commit・push 0", declined.status === "sync-declined" && !readFileSync(declinedTarget.log, "utf8").includes("gh ") && !/commit|push/.test(readFileSync(declinedTarget.log, "utf8")));
const reviewTarget = makeSearchFixture("search-review");
const review = await runFlow(reviewTarget, "review");
check("room見直しは同期せずwizardへ戻す", review.status === "room-review-needed" && !readFileSync(reviewTarget.log, "utf8").includes("gh "));
const approvedTarget = makeSearchFixture("search-approved", true);
const approved = await runFlow(approvedTarget, "sync");
check("承認後だけdispatch→wait→success→pull→retry順", approved.status === "found" && approved.events.join() === "pull-before-search,search-local,structured-choice,dispatch,wait,success-confirmed,pull-after-sync,retry-same-query");
const still = await runFlow(makeSearchFixture("search-still"), "sync");
check("同期後not foundも存在しないと断定しない", still.status === "still-not-found" && still.possibleReasons.length === 5 && !still.message.includes("Chatworkに存在しません"));
for (const [mode, code] of [["permission", "github-permission"], ["failure", "workflow-failure"], ["timeout", "timeout"]]) {
  const target = makeSearchFixture(`search-${mode}`);
  const result = await runFlow(target, "sync", mode, "50");
  const log = readFileSync(target.log, "utf8");
  check(`manual sync ${mode}を区別し不要なpush 0`, result.status === "sync-failed" && result.error === code && !/commit|push/.test(log));
}
for (const [mode, code] of [["auth", "auth"], ["rate", "rate-limit"], ["network", "network"], ["partial", "partial-room"]]) {
  const target = makeSearchFixture(`search-${mode}`);
  const result = await runFlow(target, "sync", mode, "500");
  check(`manual sync ${mode}の原因を安全に区別`, result.status === "sync-failed" && result.error === code && !result.message.includes(tokenMarker));
}

const wizardRoot = fixture("wizard");
writeFileSync(join(wizardRoot, "chatwork", "rooms.json"), `${JSON.stringify({ version: 1, status: "ready", rooms: [{ roomId: "101", name: "営業" }, { roomId: "102", name: "開発" }] }, null, 2)}\n`);
const wizard = execFile(process.execPath, [wizardScript, "--root", wizardRoot, "--port", "0"], { env: { ...process.env, NODE_ENV: "test", YASASHII_CHATWORK_SKIP_DISPATCH: "1", YASASHII_CHATWORK_TEST_PRIVATE: "1", YASASHII_CHATWORK_SKIP_GIT: "1", YASASHII_CHATWORK_TEST_SECRET: "1" } });
let wizardOutput = ""; wizard.stdout.on("data", (chunk) => { wizardOutput += chunk; });
for (let index = 0; index < 60 && !wizardOutput.includes("http://"); index += 1) await new Promise((wait) => setTimeout(wait, 50));
const wizardUrl = wizardOutput.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
check("設定変更wizardはloopbackで起動", Boolean(wizardUrl));
const wizardBefore = readFileSync(join(wizardRoot, "chatwork", "config.json"), "utf8");
const noConsent = await fetch(`${wizardUrl}api/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: ["101"], interval: "1h", automaticPushConsent: false }) });
check("wizard同意前はconfig変更0", noConsent.status === 400 && readFileSync(join(wizardRoot, "chatwork", "config.json"), "utf8") === wizardBefore);
const accepted = await fetch(`${wizardUrl}api/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: ["101"], interval: "12h", automaticPushConsent: true }) });
check("wizard同意後はconfig・実schedule一致", accepted.status === 202 && json(join(wizardRoot, "chatwork", "config.json")).interval === "12h" && readFileSync(join(wizardRoot, ".github", "workflows", "chatwork-sync.yml"), "utf8").includes("17 */12 * * *"));
writeFileSync(join(wizardRoot, "chatwork", "history", "102.json"), `${JSON.stringify({ messages: [message(88)] })}\n`);
await fetch(`${wizardUrl}api/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: ["101"], interval: "manual", automaticPushConsent: false }) });
check("room解除は今後の取得だけ停止し既存履歴を保持", existsSync(join(wizardRoot, "chatwork", "history", "102.json")) && !readFileSync(join(wizardRoot, ".github", "workflows", "chatwork-sync.yml"), "utf8").includes("  schedule:"));
wizard.kill("SIGTERM");

const distributed = files(plugin).filter((path) => /skills\/chatwork|workspace-templates/.test(path)).map((path) => readFileSync(path, "utf8")).join("\n");
check("配布Chatwork導線は開発docs・絶対pathに依存しない", !/docs\/(spec|sprints|progress|feedback)|\/Users\//.test(distributed));
check("README・公開guideがprivate repoから手動再検索まで一続き", /private GitHub repo/.test(readFileSync(join(repo, "README.md"), "utf8")) && /Repository Secret/.test(distributed) && /最新100件/.test(distributed) && /同期して再検索/.test(distributed));
check("workflowはconcurrency有効・force pushなし", /cancel-in-progress: false/.test(distributed) && !/push\s+--force|push\s+-f/.test(distributed));
check("runtime生成tokenはログ・状態・履歴・配布fixtureへ漏洩0", !files(work).some((path) => readFileSync(path).includes(tokenMarker)) && !distributed.includes(tokenMarker));

api.close();
rmSync(work, { recursive: true, force: true });
process.stdout.write(`PASS=${pass} FAIL=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
