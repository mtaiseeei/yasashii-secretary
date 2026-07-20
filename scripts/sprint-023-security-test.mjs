#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixture = join(repo, "scripts", "fixtures", "google-chat-wizard", "google-chat.json");
const tempBase = realpathSync(tmpdir());
const children = new Set();
let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) { passed += 1; process.stdout.write(`  PASS ${name}\n`); }
  else { failed += 1; process.stdout.write(`  FAIL ${name}\n`); }
}

function workspace(name) {
  const root = mkdtempSync(join(tempBase, `yasashii-s023-${name}-`));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.name", "fixture"], { cwd: root });
  execFileSync("git", ["config", "user.email", "fixture@example.invalid"], { cwd: root });
  writeFileSync(join(root, "README.md"), "local fixture\n");
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  return root;
}

function productSnapshot(root) {
  const roots = ["chatwork", "google-chat", ".github"];
  const output = [];
  for (const relative of roots) {
    const path = join(root, relative);
    try {
      for (const name of readdirSync(path, { recursive: true }).map(String).sort()) {
        let content = "";
        try { content = readFileSync(join(path, name), "utf8"); } catch { /* directory */ }
        output.push(`${relative}/${name}\0${content}`);
      }
    } catch { /* absent */ }
  }
  return output.join("\n");
}

async function start(kind, extraEnv = {}) {
  const root = workspace(`${kind}-${Date.now()}`);
  if (kind === "chatwork") {
    mkdirSync(join(root, "chatwork"), { recursive: true });
    writeFileSync(join(root, "chatwork", "rooms.json"), `${JSON.stringify({ status: "ready", rooms: [{ roomId: "101", name: "fixture room" }] }, null, 2)}\n`);
  }
  const script = kind === "google"
    ? join(repo, "plugins", "secretary", "skills", "google-chat", "scripts", "wizard-server.mjs")
    : join(repo, "plugins", "secretary", "skills", "chatwork", "scripts", "wizard-server.mjs");
  const env = kind === "google" ? {
    YASASHII_GOOGLE_CHAT_SYNTHETIC: "1",
    YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1",
    YASASHII_GOOGLE_CHAT_TEST_SECRETS: "1",
    YASASHII_GOOGLE_CHAT_SKIP_GIT: "1",
    YASASHII_GOOGLE_CHAT_FIXTURE: fixture,
    YASASHII_GOOGLE_CHAT_TEST_OBSERVABILITY: "1",
  } : {
    NODE_ENV: "test",
    YASASHII_CHATWORK_TEST_PRIVATE: "1",
    YASASHII_CHATWORK_SKIP_DISPATCH: "1",
  };
  const child = spawn(process.execPath, [script, "--root", root, "--port", "0"], { env: { ...process.env, ...env, ...extraEnv } });
  children.add(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  for (let attempt = 0; attempt < 100 && !/http:\/\/127\.0\.0\.1:\d+\//.test(stdout); attempt += 1) await new Promise((wait) => setTimeout(wait, 30));
  const base = stdout.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
  if (!base) throw new Error(`${kind} wizard did not start: ${stderr}`);
  const bootstrap = await fetch(`${base}api/bootstrap`);
  const cookie = bootstrap.headers.get("set-cookie")?.split(";", 1)[0] || "";
  return { kind, root, child, base, origin: new URL(base).origin, cookie, bootstrap: await bootstrap.json() };
}

function stop(server) {
  server.child.kill("SIGTERM");
  children.delete(server.child);
}

async function request(server, path, { method = "GET", body, contentType = "application/json", origin = server.origin, cookie = server.cookie, redirect = "manual" } = {}) {
  const headers = {};
  if (contentType !== null) headers["content-type"] = contentType;
  if (origin !== null) headers.origin = origin;
  if (cookie !== null) headers.cookie = cookie;
  const response = await fetch(`${server.base}${path}`, { method, headers, body, redirect });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML callback */ }
  return { response, text, json };
}

async function post(server, path, value = {}) {
  return request(server, path, { method: "POST", body: JSON.stringify(value) });
}

async function rejectedMatrix(server, paths) {
  const before = productSnapshot(server.root);
  let rejected = 0;
  for (const path of paths) {
    const cases = [
      { method: "POST", body: "{}", origin: "https://example.invalid" },
      { method: "POST", body: "{}", origin: null },
      { method: "POST", body: "{}", cookie: null },
      { method: "POST", body: "{}", cookie: "wrong_session=value" },
      { method: "POST", body: "{}", contentType: "text/plain" },
      { method: "POST", body: "x=1", contentType: "application/x-www-form-urlencoded" },
      { method: "POST", body: "{", contentType: "application/json" },
      { method: "PUT", body: "{}" },
    ];
    for (const options of cases) {
      const result = await request(server, path, options);
      if (result.response.status >= 400 && result.response.status < 500) rejected += 1;
    }
    const get = await request(server, path, { method: "GET", contentType: null, origin: null });
    if (get.response.status >= 400 && get.response.status < 500) rejected += 1;
  }
  return { rejected, expected: paths.length * 9, unchanged: before === productSnapshot(server.root) };
}

try {
  const googleGate = await start("google");
  const googlePaths = ["api/oauth/client", "api/oauth/synthetic", "api/oauth/authorize", "api/spaces", "api/initial-sync", "api/settings", "api/cancel"];
  const googleMatrix = await rejectedMatrix(googleGate, googlePaths);
  const googleStatus = await request(googleGate, "api/oauth/status", { contentType: null, origin: null });
  check("Google Chat全状態変更endpointはOrigin/session/Content-Type/method異常を拒否", googleMatrix.rejected === googleMatrix.expected);
  check("Google Chat拒否matrixは設定・Secret・OAuth・履歴・Git副作用0", googleMatrix.unchanged && googleStatus.json.status === "unconfigured" && googleStatus.json.testMetrics.tokenExchanges === 0 && Object.values(googleStatus.json.testMetrics.secretRegistrations).every((count) => count === 0));

  const chatworkGate = await start("chatwork");
  const chatworkMatrix = await rejectedMatrix(chatworkGate, ["api/discover", "api/confirm"]);
  check("Chatwork全状態変更endpointはOrigin/session/Content-Type/method異常を拒否", chatworkMatrix.rejected === chatworkMatrix.expected);
  check("Chatwork拒否matrixは設定・履歴・Git副作用0", chatworkMatrix.unchanged);
  const discovery = await post(chatworkGate, "api/discover", {});
  check("Chatwork同一origin・同一session・JSON POSTは成功", discovery.response.ok && discovery.json.rooms.status === "ready");
  check("両wizardは127.0.0.1だけへbindし公開URLを生成しない", googleGate.base.startsWith("http://127.0.0.1:") && chatworkGate.base.startsWith("http://127.0.0.1:") && !googleGate.base.includes("0.0.0.0") && !chatworkGate.base.includes("0.0.0.0"));
  stop(googleGate);
  stop(chatworkGate);

  const callbackState = randomBytes(24).toString("base64url");
  const callbackServer = await start("google", { YASASHII_GOOGLE_CHAT_TEST_CALLBACK_STATE: callbackState });
  const clientId = `runtime-${Date.now()}-${process.pid}`;
  const clientSecret = randomBytes(24).toString("base64url");
  const clientJson = JSON.stringify({ installed: { client_id: clientId, client_secret: clientSecret, auth_uri: "https://accounts.google.com/o/oauth2/v2/auth", token_uri: "https://oauth2.googleapis.com/token", redirect_uris: ["http://localhost"] } });
  const clientReady = await post(callbackServer, "api/oauth/client", { clientJson });
  const pending = await post(callbackServer, "api/oauth/authorize", {});
  check("正当なOAuth開始はclient-readyからauthorization-pendingへ進む", clientReady.json.status === "client-ready" && pending.json.status === "authorization-pending");
  const callbackPath = `oauth/callback?state=${encodeURIComponent(callbackState)}&code=${encodeURIComponent(randomBytes(18).toString("base64url"))}`;
  const parallel = await Promise.all([request(callbackServer, callbackPath, { contentType: null, origin: null, cookie: null }), request(callbackServer, callbackPath, { contentType: null, origin: null, cookie: null })]);
  const afterParallel = await request(callbackServer, "api/oauth/status", { contentType: null, origin: null });
  check("OAuth callback並行再送は1件だけ処理", parallel.filter((item) => item.response.status === 200).length === 1 && parallel.filter((item) => item.response.status === 409).length === 1);
  check("token交換と3 Secret登録は並行再送でも各1回", afterParallel.json.testMetrics.tokenExchanges === 1 && Object.values(afterParallel.json.testMetrics.secretRegistrations).every((count) => count === 1));
  const sequential = await request(callbackServer, callbackPath, { contentType: null, origin: null, cookie: null });
  const afterSequential = await request(callbackServer, "api/oauth/status", { contentType: null, origin: null });
  check("OAuth callback順次再送は副作用0で拒否", sequential.response.status === 409 && afterSequential.json.testMetrics.tokenExchanges === 1 && Object.values(afterSequential.json.testMetrics.secretRegistrations).every((count) => count === 1));
  const spaces = await post(callbackServer, "api/spaces", {});
  const syncBody = { selectedSpaceNames: ["spaces/space-a"], interval: "manual", saveConsent: true, commitPushConsent: true, automaticPushConsent: false };
  const parallelSync = await Promise.all([post(callbackServer, "api/initial-sync", syncBody), post(callbackServer, "api/initial-sync", syncBody)]);
  const afterSync = await request(callbackServer, "api/oauth/status", { contentType: null, origin: null });
  check("初回取得の並行再送は1回だけ実行", spaces.response.ok && parallelSync.filter((item) => item.response.status < 300).length === 1 && parallelSync.filter((item) => item.response.status === 409).length === 1 && afterSync.json.testMetrics.initialSyncs === 1);
  const completedCallback = await request(callbackServer, callbackPath, { contentType: null, origin: null, cookie: null });
  const completedMetrics = await request(callbackServer, "api/oauth/status", { contentType: null, origin: null });
  check("完了後callbackは状態を戻さず副作用0", completedCallback.response.status === 409 && completedMetrics.json.status === "completed" && completedMetrics.json.testMetrics.tokenExchanges === 1 && completedMetrics.json.testMetrics.initialSyncs === 1);
  const callbackOutput = [clientReady.text, pending.text, ...parallel.map((item) => item.text), sequential.text, spaces.text, ...parallelSync.map((item) => item.text), completedCallback.text].join("\n");
  check("OAuth実値・session確認値・callback URLはAPI本文とHTMLへ非露出", !callbackOutput.includes(clientId) && !callbackOutput.includes(clientSecret) && !callbackOutput.includes(callbackState) && !callbackOutput.includes("/oauth/callback?") && !/memory-(?:access|refresh)/.test(callbackOutput));
  stop(callbackServer);

  for (const [name, env, expected] of [
    ["revoke失敗", { YASASHII_GOOGLE_CHAT_GRANT_REVOKE_FAILURE: "1" }, { secrets: true, grant: false }],
    ["Secret削除失敗", { YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE: "1" }, { secrets: false, grant: true }],
    ["revokeとSecret削除失敗", { YASASHII_GOOGLE_CHAT_GRANT_REVOKE_FAILURE: "1", YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE: "1" }, { secrets: false, grant: false }],
  ]) {
    const server = await start("google", env);
    await post(server, "api/oauth/synthetic", { mode: "success" });
    const cleanup = await post(server, "api/cancel", {});
    check(`${name}を成功表示せずcleanup-requiredにする`, cleanup.json.oauth.status === "cleanup-required" && cleanup.json.cleanup.secretsDeleted === expected.secrets && cleanup.json.cleanup.grantRevoked === expected.grant && cleanup.json.cleanup.retryable === true);
    stop(server);
  }

  const firstFailure = await start("google", { YASASHII_GOOGLE_CHAT_SECRET_FAILURE_AT: "1" });
  const failedFirst = await post(firstFailure, "api/oauth/synthetic", { mode: "success" });
  check("Secret 1件目登録失敗は作成済み対象0でgrantを後始末", failedFirst.response.status === 400 && failedFirst.json.status === "failed" && failedFirst.json.cleanup.remainingSecretNames.length === 0 && failedFirst.json.cleanup.grantRevoked === true);
  stop(firstFailure);

  const partialFailure = await start("google", { YASASHII_GOOGLE_CHAT_SECRET_FAILURE_AT: "2", YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE_NAMES: "GOOGLE_OAUTH_CLIENT_ID" });
  const failedSecond = await post(partialFailure, "api/oauth/synthetic", { mode: "success" });
  const partialText = failedSecond.text;
  check("Secret 2件目登録失敗は作成済みだけcleanupし残存名を表示", failedSecond.response.status === 400 && failedSecond.json.status === "cleanup-required" && failedSecond.json.cleanup.remainingSecretNames.join() === "GOOGLE_OAUTH_CLIENT_ID" && failedSecond.json.cleanup.grantRevoked === true);
  check("部分登録cleanupはSecret値を表示しない", !partialText.includes("memory-") && !partialText.includes("runtime-") && !partialText.includes(clientSecret));
  const retry = await post(partialFailure, "api/cancel", {});
  const appSource = readFileSync(join(repo, "plugins", "secretary", "skills", "google-chat", "assets", "wizard", "app.js"), "utf8");
  check("cleanup-requiredは再実行可能な次の操作を示す", retry.json.oauth.status === "cleanup-required" && retry.json.cleanup.retryable === true && appSource.includes("後始末をもう一度試す"));
  stop(partialFailure);

  const serverSources = [
    readFileSync(join(repo, "plugins", "secretary", "skills", "google-chat", "scripts", "wizard-server.mjs"), "utf8"),
    readFileSync(join(repo, "plugins", "secretary", "skills", "chatwork", "scripts", "wizard-server.mjs"), "utf8"),
  ].join("\n");
  check("server sourceは固定loopback bindで外部interface指定を受け付けない", (serverSources.match(/const host = "127\.0\.0\.1"/g) || []).length === 2 && !serverSources.includes("0.0.0.0"));
} finally {
  for (const child of children) child.kill("SIGTERM");
}

process.stdout.write(`SPRINT023_PASS=${passed} SPRINT023_FAIL=${failed}\n`);
process.exit(failed ? 1 : 0);
