#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyChatworkConfig } from "./config-transaction.mjs";
import { dispatchCorrelatedWorkflow, watchCorrelatedWorkflow } from "../../../scripts/lib/actions-run.mjs";
import { workingRoot, writeFileAtomicSafe } from "../../../scripts/lib/safe-fs.mjs";
import { runExternal, runExternalSync } from "../../../scripts/lib/external-ops.mjs";
import { createWizardSessionGuard } from "../../../scripts/lib/wizard-session.mjs";

const INTERVALS = new Set(["30m", "1h", "3h", "6h", "12h", "manual"]);
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const root = workingRoot(args.get("--root") || process.cwd());
const port = Number(args.get("--port") || 8765);
const host = "127.0.0.1";
const assets = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "wizard");
let dispatch = { status: "idle", operation: null, config: null, message: "" };
let discovery = { status: "idle", message: "" };
let discoveryConfirmed = false;

function origin() {
  const address = server.address();
  return `http://${host}:${address.port}`;
}

const sessionGuard = createWizardSessionGuard({ origin, cookieName: "yasashii_chatwork_session" });
const mutationPaths = new Set(["/api/discover", "/api/confirm"]);

function githubRepository() {
  const git = process.env.YASASHII_GIT_BIN || "git";
  let remote;
  try {
    remote = runExternalSync(git, ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
      timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
      label: "git remote確認",
    }).stdout.trim();
  } catch {
    return null;
  }
  const normalized = remote.replace(/\.git$/i, "");
  const matched = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i)
    || normalized.match(/^git@github\.com:([^/]+)\/([^/]+)$/i)
    || normalized.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+)$/i);
  if (!matched) return null;
  const [, owner, repository] = matched;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) return null;
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(repository) || repository === "." || repository === "..") return null;
  return {
    owner,
    repository,
    secretUrl: `https://github.com/${owner}/${repository}/settings/secrets/actions/new`,
  };
}

function verifyPrivateRepo() {
  if (process.env.NODE_ENV === "test" && process.env.YASASHII_CHATWORK_TEST_PRIVATE === "1") return;
  const git = process.env.YASASHII_GIT_BIN || "git";
  const gh = process.env.YASASHII_GH_BIN || "gh";
  try {
    const timeoutMs = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000);
    const gitRoot = runExternalSync(git, ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", timeoutMs, label: "git root確認" }).stdout.trim();
    if (resolve(gitRoot) !== root) throw new Error("not-root");
    const remote = JSON.parse(runExternalSync(gh, ["repo", "view", "--json", "visibility"], { cwd: root, encoding: "utf8", timeoutMs, label: "GitHub repo確認" }).stdout);
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
  writeFileAtomicSafe(root, path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "set-cookie": sessionGuard.cookieHeader(),
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
  try { return JSON.parse(body || "{}"); }
  catch { throw Object.assign(new Error("設定内容のJSONを読み取れませんでした。"), { code: "invalid-json" }); }
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
    message: operation === "initial" ? "初回取得の自動取得処理（GitHub Actions）を開始しています。" : "設定変更後の自動取得処理（GitHub Actions）を開始しています。",
  };
  try {
    const run = await dispatchCorrelatedWorkflow({
      root,
      workflowFile: "chatwork-sync.yml",
      workflowName: "Chatwork sync",
      inputs: { mode },
      gh,
      discoveryTimeoutMs: Number(process.env.YASASHII_RUN_DISCOVERY_TIMEOUT_MS || 5_000),
      pollIntervalMs: Number(process.env.YASASHII_RUN_POLL_MS || 250),
    });
    const runSummary = { id: run.runId, workflow: run.workflowFile, branch: run.branch, createdAt: run.createdAt };
    dispatch = { status: "waiting", operation, config, run: runSummary, message: "今回開始した自動取得処理（GitHub Actions）の完了を待っています。" };
    await watchCorrelatedWorkflow({ root, run, gh, timeoutMs: 5 * 60_000 });
    await runExternal(process.env.YASASHII_GIT_BIN || "git", ["pull", "--ff-only"], { cwd: root, timeoutMs: 60_000, label: "git pull" });
    dispatch = {
      status: "success",
      operation,
      config,
      run: runSummary,
      message: operation === "initial" ? "初回取得が完了し、リポジトリへ反映しました。" : "設定変更後の同期が完了し、リポジトリへ反映しました。",
    };
  } catch (error) {
    const unconfirmed = ["run-correlation-unconfirmed", "branch-unconfirmed", "run-list-invalid"].includes(error?.code);
    dispatch = {
      status: "failed",
      operation,
      config,
      run: error?.correlatedRun ? { id: error.correlatedRun.runId, workflow: error.correlatedRun.workflowFile, branch: error.correlatedRun.branch, createdAt: error.correlatedRun.createdAt } : null,
      message: unconfirmed
        ? "今回開始した自動取得処理（GitHub Actions）を確認できませんでした。古い成功結果は使わず停止しました。Actions画面で今回の実行を確認してから再実行してください。"
        : operation === "initial"
          ? "今回の初回取得が失敗しました。古い成功結果へ切り替えず停止しました。Actions画面で今回の実行を確認してから再実行してください。"
          : "設定は変更しましたが、今回の同期が失敗しました。古い成功結果へ切り替えず停止しました。Actions画面で今回の実行を確認してから再実行してください。",
    };
  }
}

async function discoverRooms() {
  if (discovery.status === "running") throw Object.assign(new Error("ルーム一覧を取得しています。完了までお待ちください。"), { code: "discovery-running" });
  discovery = { status: "running", message: "自動取得処理（GitHub Actions）で参加中のルーム一覧を取得しています。" };
  if (process.env.YASASHII_CHATWORK_SKIP_DISPATCH === "1") {
    const rooms = readJson(join(root, "chatwork", "rooms.json"), { status: "not-discovered", rooms: [] });
    discovery = { status: rooms.status === "ready" ? "success" : "failed", message: rooms.status === "ready" ? "ルーム一覧を取得しました。" : "ルーム一覧を確認できませんでした。" };
    discoveryConfirmed = rooms.status === "ready";
    return rooms;
  }
  const gh = process.env.YASASHII_GH_BIN || "gh";
  try {
    const run = await dispatchCorrelatedWorkflow({
      root,
      workflowFile: "chatwork-sync.yml",
      workflowName: "Chatwork sync",
      inputs: { mode: "discover" },
      gh,
      discoveryTimeoutMs: Number(process.env.YASASHII_RUN_DISCOVERY_TIMEOUT_MS || 5_000),
      pollIntervalMs: Number(process.env.YASASHII_RUN_POLL_MS || 250),
    });
    discovery = { status: "running", run: { id: run.runId, workflow: run.workflowFile, branch: run.branch, createdAt: run.createdAt }, message: "今回開始した自動取得処理（GitHub Actions）で参加中のルーム一覧を取得しています。" };
    await watchCorrelatedWorkflow({ root, run, gh, timeoutMs: 5 * 60_000 });
    await runExternal(process.env.YASASHII_GIT_BIN || "git", ["pull", "--ff-only"], { cwd: root, timeoutMs: 60_000, label: "git pull" });
    const rooms = readJson(join(root, "chatwork", "rooms.json"), { status: "not-discovered", rooms: [] });
    if (rooms.status !== "ready") throw new Error("rooms-not-ready");
    discovery = { status: "success", run: { id: run.runId, workflow: run.workflowFile, branch: run.branch, createdAt: run.createdAt }, message: "ルーム一覧を取得しました。" };
    discoveryConfirmed = true;
    return rooms;
  } catch (error) {
    const unconfirmed = ["run-correlation-unconfirmed", "branch-unconfirmed", "run-list-invalid"].includes(error?.code);
    discovery = {
      status: "failed",
      run: error?.correlatedRun ? { id: error.correlatedRun.runId, workflow: error.correlatedRun.workflowFile, branch: error.correlatedRun.branch, createdAt: error.correlatedRun.createdAt } : null,
      message: unconfirmed
        ? "今回開始したルーム一覧取得を確認できませんでした。古い成功結果は使わず停止しました。Actions画面で今回の実行を確認してから再実行してください。"
        : "今回のルーム一覧取得が失敗しました。古い成功結果へ切り替えず停止しました。Actions画面の今回runとAPI Tokenの登録を確認してください。",
    };
    throw Object.assign(new Error(discovery.message), { code: unconfirmed ? "run-unconfirmed" : "discovery-failed" });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", origin());
  if (mutationPaths.has(url.pathname)) {
    const rejected = sessionGuard.validateMutation(request);
    if (rejected) return send(response, rejected.status, { error: rejected.message, code: rejected.code });
  }
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const rooms = readJson(join(root, "chatwork", "rooms.json"), { status: "not-discovered", rooms: [] });
    const config = readJson(join(root, "chatwork", "config.json"), { selectedRoomIds: [], interval: "3h", scheduleEnabled: false });
    return send(response, 200, { rooms, config, repository: githubRepository(), discovery });
  }
  if (request.method === "POST" && url.pathname === "/api/discover") {
    try {
      await bodyJson(request);
      const rooms = await discoverRooms();
      return send(response, 200, { rooms, discovery });
    } catch (error) {
      return send(response, error.code === "invalid-json" ? 400 : error.code === "discovery-running" ? 409 : 502, { error: error.message, code: error.code || "discovery-failed", discovery });
    }
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
      if (selectedRoomIds.length === 0) return send(response, 400, { error: "ルームを1つ以上選んでください。" });
      if (selectedRoomIds.some((id) => !/^\d+$/.test(id) || !allowed.has(id))) return send(response, 400, { error: "ルーム一覧にないルームIDは保存できません。" });
      if (!INTERVALS.has(input.interval)) return send(response, 400, { error: "自動取得の間隔を選び直してください。" });
      const previous = readJson(join(root, "chatwork", "config.json"), { selectedRoomIds: [] });
      if ((previous.selectedRoomIds || []).length === 0 && !discoveryConfirmed) {
        return send(response, 400, { error: "API Tokenの登録確認後に、ルーム一覧を取得してください。", code: "connection-incomplete" });
      }
      const applied = await applyChatworkConfig({ root, selectedRoomIds, interval: input.interval, automaticPushConsent: input.automaticPushConsent === true });
      const mode = (previous.selectedRoomIds || []).length === 0 ? "initial" : "sync";
      const operation = mode === "initial" ? "initial" : "configuration-change";
      dispatch = { status: "queued", operation, config: applied.config, message: "設定と自動取得処理（GitHub Actions）を同じcommitへ反映し、取得を準備しています。" };
      void runSync(mode, applied.config);
      return send(response, 202, { status: "accepted", config: applied.config });
    } catch (error) {
      return send(response, 400, { error: error.message || "設定を読み取れませんでした。入力内容を確認してください。", code: error.code || "invalid" });
    }
  }
  if (request.method !== "GET") return send(response, 405, { error: "Method not allowed" });
  const names = new Map([["/", "index.html"], ["/app.js", "app.js"], ["/common.js", "common.js"], ["/result-model.js", "result-model.js"], ["/style.css", "style.css"]]);
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
