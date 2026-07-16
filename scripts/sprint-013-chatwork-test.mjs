#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repo = resolve(import.meta.dirname, "..");
const template = join(repo, "plugins", "yasashii-secretary", "workspace-templates");
const syncScript = join(template, "chatwork", "scripts", "chatwork-sync.mjs");
const searchScript = join(repo, "plugins", "yasashii-secretary", "skills", "chatwork", "scripts", "search.mjs");
const wizardScript = join(repo, "plugins", "yasashii-secretary", "skills", "chatwork", "scripts", "wizard-server.mjs");
const work = mkdtempSync(join(tmpdir(), "yasashii-s013-"));
const tokenMarker = ["runtime", "chatwork", String(process.pid), String(Date.now())].join("-");
let failures = 0;

function check(label, condition) {
  if (condition) process.stdout.write(`PASS ${label}\n`);
  else { failures += 1; process.stdout.write(`FAIL ${label}\n`); }
}

function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function fixture(name) { const root = join(work, name); mkdirSync(root); cpSync(template, root, { recursive: true }); return root; }
function message(id, body = `本文${id}`) { return { message_id: String(id), account: { account_id: 7, name: "合成人物" }, body, send_time: 1784160000 + Number(id), update_time: 1784160000 + Number(id) }; }

let mode = "normal";
const requests = [];
const api = createServer((request, response) => {
  requests.push(request.url);
  if (request.headers["x-chatworktoken"] !== tokenMarker) { response.writeHead(401); response.end("{}"); return; }
  if (mode === "auth") { response.writeHead(401); response.end("{}"); return; }
  if (mode === "rate") { response.writeHead(429); response.end("{}"); return; }
  response.setHeader("content-type", "application/json");
  if (request.url === "/rooms") { response.end(JSON.stringify([{ room_id: 101, name: "空room" }, { room_id: 102, name: "営業" }, { room_id: 103, name: "開発" }, { room_id: 104, name: "失敗room" }])); return; }
  if (request.url?.startsWith("/rooms/101/messages")) { response.end("[]"); return; }
  if (request.url?.startsWith("/rooms/102/messages")) { response.end(JSON.stringify(mode === "empty-after" ? [] : [message(1, "見積書の確認をお願いします")])); return; }
  if (request.url?.startsWith("/rooms/103/messages")) { response.end(JSON.stringify(Array.from({ length: 100 }, (_, index) => message(index + 1000)))); return; }
  if (request.url?.startsWith("/rooms/104/messages")) { response.writeHead(500); response.end("{}"); return; }
  response.writeHead(404); response.end("{}");
});
await new Promise((resolveListen) => api.listen(0, "127.0.0.1", resolveListen));
const base = `http://127.0.0.1:${api.address().port}`;
const environment = { ...process.env, CHATWORK_API_TOKEN: tokenMarker, CHATWORK_API_BASE_URL: base, CC_SECRETARY_NOW: "2026-07-16T12:00:00Z" };

async function runSync(root, command, allowFailure = false) {
  try { return await exec(process.execPath, [syncScript, command, root], { env: environment }); }
  catch (error) { if (allowFailure) return { stdout: error.stdout || "", stderr: error.stderr || "", failed: true }; throw error; }
}

const main = fixture("main");
let result = await runSync(main, "discover");
check("room discoveryは複数roomを名前とIDで保存", json(join(main, "chatwork", "rooms.json")).rooms.length === 4);
check("room discoveryログにTokenが無い", !`${result.stdout}${result.stderr}`.includes(tokenMarker));

writeFileSync(join(main, "chatwork", "config.json"), `${JSON.stringify({ version: 1, selectedRoomIds: ["101", "102", "103"], interval: "1h", scheduleEnabled: false }, null, 2)}\n`);
requests.length = 0;
result = await runSync(main, "initial");
const state = json(join(main, "chatwork", "state", "sync.json"));
check("初回0／1／100件を正常処理", state.status === "success" && state.results.map((item) => item.fetched).join(",") === "0,1,100");
check("未選択roomの取得は0件", !requests.some((url) => url?.includes("/104/")));
check("100件を超えて取得済みと見せない", json(join(main, "chatwork", "history", "103.json")).apiWindow.returned === 100);
await runSync(main, "initial");
check("message ID再取得で重複しない", json(join(main, "chatwork", "history", "102.json")).messages.length === 1);
mode = "empty-after";
await runSync(main, "initial");
check("API応答欠落だけで既存履歴を削除しない", json(join(main, "chatwork", "history", "102.json")).messages.length === 1);
mode = "normal";

writeFileSync(join(main, "chatwork", "config.json"), `${JSON.stringify({ version: 1, selectedRoomIds: ["102", "104"], interval: "1h", scheduleEnabled: false }, null, 2)}\n`);
result = await runSync(main, "initial", true);
const partial = json(join(main, "chatwork", "state", "sync.json"));
check("room部分失敗を全成功にしない", result.failed && partial.status === "partial" && partial.results[1].status === "failed");
check("部分失敗エラーにTokenや本文が無い", !`${result.stdout}${result.stderr}${JSON.stringify(partial)}`.includes(tokenMarker) && !String(partial.results[1].message).includes("本文"));

for (const [failureMode, expected] of [["auth", "auth"], ["rate", "rate-limit"]]) {
  const errorRoot = fixture(failureMode);
  mode = failureMode;
  const failed = await runSync(errorRoot, "discover", true);
  check(`${failureMode}失敗を区別`, failed.failed && json(join(errorRoot, "chatwork", "state", "discovery.json")).error === expected);
  check(`${failureMode}失敗でroom一覧を空上書きしない`, json(join(errorRoot, "chatwork", "rooms.json")).status === "not-discovered");
}
mode = "normal";
const networkRoot = fixture("network");
const network = await exec(process.execPath, [syncScript, "discover", networkRoot], { env: { ...environment, CHATWORK_API_BASE_URL: "http://127.0.0.1:1" } }).catch((error) => error);
check("network失敗を区別", json(join(networkRoot, "chatwork", "state", "discovery.json")).error === "network");
check("全取得ログ・状態・履歴にTokenが無い", !readFileSync(join(main, "chatwork", "state", "sync.json"), "utf8").includes(tokenMarker) && !JSON.stringify(network).includes(tokenMarker));

const found = await exec(process.execPath, [searchScript, "--root", main, "--query", "見積書"]);
const foundResult = JSON.parse(found.stdout);
check("基本検索foundはroom・日付・該当箇所を返す", foundResult.status === "found" && foundResult.matches[0].roomName === "営業" && foundResult.matches[0].date && foundResult.matches[0].excerpt.includes("見積書"));
const missing = await exec(process.execPath, [searchScript, "--root", main, "--query", "存在しない語"]);
check("基本検索not foundは保存済み範囲に限定", JSON.parse(missing.stdout).status === "not-found-locally" && !missing.stdout.includes("Chatworkに存在しません"));

const wizardRoot = fixture("wizard");
writeFileSync(join(wizardRoot, "chatwork", "rooms.json"), `${JSON.stringify({ version: 1, status: "ready", rooms: [{ roomId: "101", name: "空room" }, { roomId: "102", name: "営業" }] }, null, 2)}\n`);
writeFileSync(join(wizardRoot, "chatwork", "state", "sync.json"), `${JSON.stringify({ version: 1, status: "success", results: [{ roomId: "101", roomName: "空room", status: "success", fetched: 0 }] }, null, 2)}\n`);
const wizard = execFile(process.execPath, [wizardScript, "--root", wizardRoot, "--port", "0"], { env: { ...process.env, NODE_ENV: "test", YASASHII_CHATWORK_SKIP_DISPATCH: "1", YASASHII_CHATWORK_TEST_PRIVATE: "1" } });
let output = "";
wizard.stdout.on("data", (chunk) => { output += chunk; });
for (let attempt = 0; attempt < 50 && !output.includes("http://"); attempt += 1) await new Promise((wait) => setTimeout(wait, 50));
const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
check("wizardはloopbackだけで起動", Boolean(url));
const wizardHtml = await (await fetch(url)).text();
check("wizard DOMにTokenが無い", !wizardHtml.includes(tokenMarker));
const before = readFileSync(join(wizardRoot, "chatwork", "config.json"), "utf8");
await fetch(`${url}api/bootstrap`);
check("閲覧・キャンセル相当は設定副作用0", readFileSync(join(wizardRoot, "chatwork", "config.json"), "utf8") === before);
const invalid = await fetch(`${url}api/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: ["999"], interval: "1h" }) });
check("未発見roomを確定できない", invalid.status === 400 && readFileSync(join(wizardRoot, "chatwork", "config.json"), "utf8") === before);
const confirmed = await fetch(`${url}api/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedRoomIds: ["101"], interval: "3h" }) });
const confirmedConfig = json(join(wizardRoot, "chatwork", "config.json"));
check("確定後だけroomと頻度を保存", confirmed.status === 202 && confirmedConfig.selectedRoomIds.join() === "101" && confirmedConfig.interval === "3h");
check("Sprint 013ではscheduleを有効化しない", confirmedConfig.scheduleEnabled === false);
wizard.kill("SIGTERM");

api.close();
rmSync(work, { recursive: true, force: true });
process.stdout.write(`PASS=${29 - failures} FAIL=${failures}\n`);
process.exit(failures === 0 ? 0 : 1);
