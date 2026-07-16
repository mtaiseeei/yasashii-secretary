#!/usr/bin/env node

import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { applyChatworkConfig } from "./config-transaction.mjs";

const exec = promisify(execFile);
const INTERVALS = new Set(["30m", "1h", "3h", "6h", "12h", "manual"]);
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const root = resolve(args.get("--root") || process.cwd());
const port = Number(args.get("--port") || 8765);
const host = "127.0.0.1";
const assets = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "wizard");
let dispatch = { status: "idle", operation: null, config: null, message: "" };

function verifyPrivateRepo() {
  if (process.env.NODE_ENV === "test" && process.env.YASASHII_CHATWORK_TEST_PRIVATE === "1") return;
  const git = process.env.YASASHII_GIT_BIN || "git";
  const gh = process.env.YASASHII_GH_BIN || "gh";
  try {
    const gitRoot = execFileSync(git, ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (resolve(gitRoot) !== root) throw new Error("not-root");
    const remote = JSON.parse(execFileSync(gh, ["repo", "view", "--json", "visibility"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    if (String(remote.visibility).toUpperCase() !== "PRIVATE") throw new Error("not-private");
  } catch {
    process.stderr.write("private GitHub repoを確認できないためwizardを起動しません。repo rootとremoteを確認してください。\n");
    process.exit(3);
  }
}

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

function writeJson(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  if (Buffer.isBuffer(body) || typeof body === "string") {
    response.end(body);
    return;
  }
  if (body !== null && Object.getPrototypeOf(body) === Object.prototype) {
    response.end(JSON.stringify(body));
    return;
  }
  throw new TypeError("response body must be a Buffer, string, or plain JSON object");
}

async function bodyJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 64 * 1024) throw new Error("too-large");
  }
  return JSON.parse(body || "{}");
}

async function runSync(mode, config) {
  const operation = mode === "initial" ? "initial" : "configuration-change";
  if (process.env.YASASHII_CHATWORK_SKIP_DISPATCH === "1") {
    dispatch = operation === "initial"
      ? { status: "fixture", operation, config, message: "合成fixtureの初回取得結果を表示しています。" }
      : { status: "fixture", operation, config, message: "設定変更を反映しました。保存済み履歴はそのまま残しています。" };
    return;
  }
  const gh = process.env.YASASHII_GH_BIN || "gh";
  dispatch = {
    status: "dispatching",
    operation,
    config,
    message: operation === "initial" ? "初回取得workflowを開始しています。" : "設定変更後の同期workflowを開始しています。",
  };
  try {
    await exec(gh, ["workflow", "run", "chatwork-sync.yml", "-f", `mode=${mode}`], { cwd: root, timeout: 30_000 });
    dispatch = { status: "waiting", operation, config, message: "GitHub Actionsの完了を待っています。" };
    await new Promise((resolveWait) => setTimeout(resolveWait, 2500));
    const listed = await exec(gh, ["run", "list", "--workflow", "chatwork-sync.yml", "--limit", "1", "--json", "databaseId"], { cwd: root, timeout: 30_000 });
    const runs = JSON.parse(listed.stdout || "[]");
    if (!runs[0]?.databaseId) throw new Error("run-not-found");
    await exec(gh, ["run", "watch", String(runs[0].databaseId), "--exit-status"], { cwd: root, timeout: 5 * 60_000 });
    await exec(process.env.YASASHII_GIT_BIN || "git", ["pull", "--ff-only"], { cwd: root, timeout: 60_000 });
    dispatch = {
      status: "success",
      operation,
      config,
      message: operation === "initial" ? "初回取得が完了し、repoへ反映しました。" : "設定変更後の同期が完了し、repoへ反映しました。",
    };
  } catch {
    dispatch = {
      status: "failed",
      operation,
      config,
      message: operation === "initial"
        ? "初回取得を完了できませんでした。GitHub Actionsの結果を確認して再実行してください。"
        : "設定は変更しましたが、同期を完了できませんでした。GitHub Actionsの結果を確認して再実行してください。",
    };
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}`);
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const rooms = readJson(join(root, "chatwork", "rooms.json"), { status: "not-discovered", rooms: [] });
    const config = readJson(join(root, "chatwork", "config.json"), { selectedRoomIds: [], interval: "1h", scheduleEnabled: false });
    return send(response, 200, { rooms, config });
  }
  if (request.method === "GET" && url.pathname === "/api/status") {
    const sync = readJson(join(root, "chatwork", "state", "sync.json"), null);
    return send(response, 200, { dispatch, sync });
  }
  if (request.method === "POST" && url.pathname === "/api/confirm") {
    try {
      const input = await bodyJson(request);
      const discovered = readJson(join(root, "chatwork", "rooms.json"), { rooms: [] });
      const allowed = new Set((discovered.rooms || []).map((room) => String(room.roomId)));
      const selectedRoomIds = [...new Set((input.selectedRoomIds || []).map(String))];
      if (selectedRoomIds.length === 0) return send(response, 400, { error: "roomを1つ以上選んでください。" });
      if (selectedRoomIds.some((id) => !/^\d+$/.test(id) || !allowed.has(id))) return send(response, 400, { error: "room一覧にないRoom IDは保存できません。" });
      if (!INTERVALS.has(input.interval)) return send(response, 400, { error: "同期間隔を選び直してください。" });
      const previous = readJson(join(root, "chatwork", "config.json"), { selectedRoomIds: [] });
      const applied = await applyChatworkConfig({ root, selectedRoomIds, interval: input.interval, automaticPushConsent: input.automaticPushConsent === true });
      const mode = (previous.selectedRoomIds || []).length === 0 ? "initial" : "sync";
      const operation = mode === "initial" ? "initial" : "configuration-change";
      dispatch = { status: "queued", operation, config: applied.config, message: "設定とworkflowを同じcommitへ反映し、取得を準備しています。" };
      void runSync(mode, applied.config);
      return send(response, 202, { status: "accepted", config: applied.config });
    } catch (error) {
      return send(response, 400, { error: error.message || "設定を読み取れませんでした。入力内容を確認してください。", code: error.code || "invalid" });
    }
  }
  if (request.method !== "GET") return send(response, 405, { error: "Method not allowed" });
  const names = new Map([["/", "index.html"], ["/app.js", "app.js"], ["/style.css", "style.css"]]);
  const name = names.get(url.pathname);
  if (!name) return send(response, 404, "Not found", "text/plain; charset=utf-8");
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
  return send(response, 200, readFileSync(join(assets, name)), types[extname(name)]);
});

verifyPrivateRepo();
server.listen(port, host, () => {
  const address = server.address();
  process.stdout.write(`Chatwork設定wizard: http://${host}:${address.port}/\n`);
});
