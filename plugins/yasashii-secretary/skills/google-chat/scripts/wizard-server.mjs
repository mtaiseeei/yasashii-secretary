#!/usr/bin/env node

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { commitOwnedChanges, pushOwnedCommit } from "../../../scripts/lib/safe-git.mjs";
import { workingRoot, writeFileAtomicSafe } from "../../../scripts/lib/safe-fs.mjs";
import { fetchWithTimeout, runExternal, runExternalSync } from "../../../scripts/lib/external-ops.mjs";
import { createWizardSessionGuard } from "../../../scripts/lib/wizard-session.mjs";
import { createGoogleChatClient } from "./client.mjs";
import { applyGoogleChatConfig } from "./config-transaction.mjs";
import { initialGoogleChatSync } from "./sync.mjs";
import {
  GOOGLE_CHAT_SCOPES, GOOGLE_CHAT_SECRET_NAMES, authorizationRequest, createPkceState,
  exchangeAuthorizationCode, parseDesktopClientJson, publicOAuthState, validateCallback,
} from "./oauth-session.mjs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const root = workingRoot(args.get("--root") || process.cwd());
const port = Number(args.get("--port") || 8766);
const host = "127.0.0.1";
const assets = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "chatwork", "assets", "wizard");
const googleApp = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "wizard", "app.js");
const googleCleanup = resolve(dirname(fileURLToPath(import.meta.url)), "..", "assets", "wizard", "cleanup.mjs");
const synthetic = process.env.YASASHII_GOOGLE_CHAT_SYNTHETIC === "1";
const normalUiTest = synthetic && process.env.YASASHII_GOOGLE_CHAT_TEST_NORMAL_UI === "1";
let session = { status: "unconfigured", message: "OAuth client JSONを選んでください。", credentials: null, pkce: null, authorizationTarget: null, accessToken: null, refreshToken: null, oauthGrantActive: false, secretNames: [], cleanup: null };
let spaces = [];
let sync = null;
const testMetrics = { tokenExchanges: 0, secretRegistrations: Object.fromEntries(GOOGLE_CHAT_SECRET_NAMES.map((name) => [name, 0])), initialSyncs: 0 };

function nextPkceState() {
  const value = createPkceState();
  if (synthetic && process.env.YASASHII_GOOGLE_CHAT_TEST_CALLBACK_STATE) value.state = process.env.YASASHII_GOOGLE_CHAT_TEST_CALLBACK_STATE;
  return value;
}

function origin() {
  const address = server.address();
  return `http://${host}:${address.port}`;
}

const sessionGuard = createWizardSessionGuard({ origin, cookieName: "yasashii_google_chat_session" });
const mutationPaths = new Set(["/api/oauth/client", "/api/oauth/synthetic", "/api/oauth/authorize", "/api/spaces", "/api/initial-sync", "/api/settings", "/api/cancel"]);

function readJson(path, fallback = null) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return fallback; }
}

function configuredState() {
  const config = readJson(join(root, "google-chat", "config.json"));
  const cached = readJson(join(root, "google-chat", "spaces.json"), { spaces: config?.selectedSpaces || [] });
  const syncState = readJson(join(root, "google-chat", "state", "sync.json"));
  return { configured: Boolean(config), config, spaces: (cached?.spaces || []).filter((space) => space.spaceType === "SPACE"), sync: syncState };
}

function repository() {
  let remote;
  try { remote = runExternalSync(process.env.YASASHII_GIT_BIN || "git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8", timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000), label: "git remote確認" }).stdout.trim(); }
  catch { return null; }
  const matched = remote.replace(/\.git$/i, "").match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i)
    || remote.replace(/\.git$/i, "").match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (!matched || !/^[A-Za-z0-9-]+$/.test(matched[1]) || !/^[A-Za-z0-9._-]+$/.test(matched[2])) return null;
  return { owner: matched[1], name: matched[2] };
}

function verifyPrivateRepo() {
  if (synthetic && process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE === "1") return;
  try {
    const timeout = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000);
    const gitRoot = runExternalSync(process.env.YASASHII_GIT_BIN || "git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", timeoutMs: timeout, label: "git root確認" }).stdout.trim();
    const detail = JSON.parse(runExternalSync(process.env.YASASHII_GH_BIN || "gh", ["repo", "view", "--json", "visibility"], { cwd: root, encoding: "utf8", timeoutMs: timeout, label: "GitHub repo確認" }).stdout);
    if (resolve(gitRoot) !== root || String(detail.visibility).toUpperCase() !== "PRIVATE" || !repository()) throw new Error("private-required");
  } catch {
    process.stderr.write("private GitHub repoを確認できないためGoogle Chat設定wizardを起動しません。\n");
    process.exit(3);
  }
}

function runSecret(name, value) {
  testMetrics.secretRegistrations[name] += 1;
  if (synthetic) {
    const requested = String(process.env.YASASHII_GOOGLE_CHAT_SECRET_FAILURE_AT || "");
    const index = GOOGLE_CHAT_SECRET_NAMES.indexOf(name) + 1;
    if (process.env.YASASHII_GOOGLE_CHAT_SECRET_FAILURE === "1" || requested === String(index) || requested === name) {
      return Promise.reject(Object.assign(new Error("Repository Secretへ登録できませんでした。"), { code: "secret-registration-failed" }));
    }
    return Promise.resolve();
  }
  return runExternal(process.env.YASASHII_GH_BIN || "gh", ["secret", "set", name], {
    cwd: root,
    input: value,
    timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
    label: "Repository Secret登録",
  }).catch((error) => {
    if (error?.code === "timeout") throw error;
    throw Object.assign(new Error("Repository Secretへ登録できませんでした。"), { code: "secret-registration-failed" });
  });
}

function deleteRepositorySecrets(names = GOOGLE_CHAT_SECRET_NAMES) {
  const deletedNames = [];
  const remainingNames = [];
  const syntheticFailures = new Set(String(process.env.YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE_NAMES || "").split(",").map((name) => name.trim()).filter(Boolean));
  for (const name of names) {
    if (synthetic) {
      if (process.env.YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE === "1" || syntheticFailures.has(name)) remainingNames.push(name);
      else deletedNames.push(name);
      continue;
    }
    try {
      runExternalSync(process.env.YASASHII_GH_BIN || "gh", ["secret", "delete", name], { cwd: root, timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000), label: "Repository Secret削除" });
      deletedNames.push(name);
    } catch { remainingNames.push(name); }
  }
  return { attemptedNames: [...names], deletedNames, remainingNames };
}

async function registerSecrets() {
  const localPrivateTest = synthetic && process.env.YASASHII_GOOGLE_CHAT_TEST_PRIVATE === "1";
  if (!repository() && !localPrivateTest) throw Object.assign(new Error("現在のGitHubリポジトリを確認できません。"), { code: "repository-unknown" });
  const values = [session.credentials.clientId, session.credentials.clientSecret, session.refreshToken];
  for (let index = 0; index < GOOGLE_CHAT_SECRET_NAMES.length; index += 1) {
    const name = GOOGLE_CHAT_SECRET_NAMES[index];
    await runSecret(name, values[index]);
    if (!session.secretNames.includes(name)) session.secretNames.push(name);
  }
}

async function revokeAndDelete({ cleanStatus = "closed", cleanMessage = "接続情報を削除して終了しました。" } = {}) {
  const hadConnection = Boolean(session.accessToken || session.refreshToken || session.secretNames.length);
  const token = session.accessToken || session.refreshToken;
  const grantWasActive = session.oauthGrantActive === true;
  let grantRevoked = !grantWasActive;
  if (synthetic && grantWasActive && token) grantRevoked = process.env.YASASHII_GOOGLE_CHAT_GRANT_REVOKE_FAILURE !== "1";
  if (!synthetic) {
    if (grantWasActive && token) {
      const result = await fetchWithTimeout("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }, { timeoutMs: Number(process.env.YASASHII_HTTP_TIMEOUT_MS || 15_000), label: "Google OAuth取消", headersOnly: true }).catch(() => null);
      grantRevoked = Boolean(result?.ok);
    }
  }
  const secretCleanup = session.secretNames.length ? deleteRepositorySecrets(session.secretNames) : { attemptedNames: [], deletedNames: [], remainingNames: [] };
  const secretsDeleted = secretCleanup.remainingNames.length === 0;
  const cleaned = !hadConnection || (secretsDeleted && grantRevoked);
  const message = !hadConnection ? "変更せずに終了しました。"
    : cleaned ? cleanMessage
      : "接続情報の一部を自動で消せませんでした。残っている対象を確認し、後始末をもう一度お試しください。";
  session = {
    status: cleaned ? cleanStatus : "cleanup-required",
    message,
    credentials: null,
    pkce: null,
    authorizationTarget: null,
    accessToken: grantRevoked ? null : session.accessToken,
    refreshToken: grantRevoked ? null : session.refreshToken,
    oauthGrantActive: grantRevoked ? false : grantWasActive,
    secretNames: secretCleanup.remainingNames,
    cleanup: {
      hadConnection,
      secretsDeleted,
      grantRevoked,
      remainingSecretNames: secretCleanup.remainingNames,
      oauthGrantRemaining: !grantRevoked,
      manualCheckRequired: !cleaned,
      retryable: !cleaned,
    },
  };
  spaces = [];
  return session.cleanup;
}

function redirectUri() { return `${origin()}/oauth/callback`; }

function send(response, status, body, type = "application/json; charset=utf-8", extra = {}) {
  response.writeHead(status, {
    "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "set-cookie": sessionGuard.cookieHeader(),
    ...extra,
  });
  response.end(Buffer.isBuffer(body) || typeof body === "string" ? body : JSON.stringify(body));
}

async function bodyJson(request) {
  let body = "";
  for await (const chunk of request) { body += chunk; if (body.length > 1024 * 1024) throw new Error("too-large"); }
  try { return JSON.parse(body || "{}"); }
  catch { throw Object.assign(new Error("設定内容のJSONを読み取れませんでした。"), { code: "invalid-json" }); }
}

function fixture() {
  const path = process.env.YASASHII_GOOGLE_CHAT_FIXTURE;
  if (!path) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function fixtureClient(data) {
  return {
    async listSpaces() { return data.spaces || []; },
    async getSpace(name) { const found = (data.spaces || []).find((item) => item.name === name); if (!found) throw Object.assign(new Error("対象スペースを確認できません。"), { code: "space-not-found" }); return found; },
    async listAllMessages(name) { const pages = data.messagePages?.[name] || [[]]; if (pages.some((page) => page?.error)) throw Object.assign(new Error("スペースの取得に失敗しました。"), { code: pages.find((page) => page?.error).error }); return pages.flat(); },
    async displayName(senderName) { return data.people?.[senderName] || null; },
  };
}

function currentClient() {
  const data = fixture();
  if (synthetic && data) return fixtureClient(data);
  if (!session.accessToken) throw Object.assign(new Error("Google認証を完了してください。"), { code: "oauth-required" });
  return createGoogleChatClient({ accessToken: session.accessToken });
}

async function commitAndPush(paths) {
  if (process.env.YASASHII_GOOGLE_CHAT_SKIP_GIT === "1") return { status: "fixture" };
  const git = process.env.YASASHII_GIT_BIN || "git";
  const existingPaths = paths.filter((path) => existsSync(join(root, path)));
  const result = { status: "running", paths: existingPaths, committed: false, pushed: false };
  try {
    if (existingPaths.length === 0) throw new Error("保存対象がありません。");
    const committed = commitOwnedChanges({ root, ownedPaths: existingPaths, message: "Google Chatの選択スペース履歴を初回保存" });
    if (committed.status !== "committed") throw Object.assign(new Error("初回取得にcommitする変更がありません。"), { code: "no-change" });
    result.committed = true;
    pushOwnedCommit({ root, oldHead: committed.oldHead, newHead: committed.newHead });
    result.pushed = true;
    result.status = "pushed";
    return result;
  } catch {
    result.status = "failed";
    throw Object.assign(new Error("初回取得のファイルはこのPCへ保存しましたが、Gitのcommit・pushを完了できませんでした。Gitの状態と接続先を確認してください。"), { code: "git-save-failed", git: result });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", origin());
  try {
    if (mutationPaths.has(url.pathname) && !(url.pathname === "/api/oauth/authorize" && request.method === "GET")) {
      const rejected = sessionGuard.validateMutation(request);
      if (rejected) return send(response, rejected.status, { error: rejected.message, code: rejected.code });
    }
    if (url.pathname === "/oauth/callback" && request.method !== "GET") return send(response, 405, { error: "Method not allowed", code: "method-not-allowed" });
    if (request.method === "GET" && url.pathname === "/api/bootstrap") return send(response, 200, { service: "google-chat", oauth: publicOAuthState(session), cleanup: session.cleanup, intervals: ["1h", "3h", "6h", "12h", "manual"], defaultInterval: "3h", testing: synthetic && !normalUiTest, ...configuredState() });
    if (request.method === "POST" && url.pathname === "/api/oauth/client") {
      const input = await bodyJson(request);
      const credentials = parseDesktopClientJson(input.clientJson);
      session = { status: "client-ready", message: "Googleで認証できます。", credentials, pkce: null, authorizationTarget: null, accessToken: null, refreshToken: null, oauthGrantActive: false, secretNames: [], cleanup: null };
      return send(response, 200, publicOAuthState(session));
    }
    if (request.method === "POST" && url.pathname === "/api/oauth/synthetic") {
      if (!synthetic) return send(response, 404, { error: "Not found" });
      const input = await bodyJson(request);
      const failures = {
        denied: ["access-denied", "Google認証が拒否されました。"], "state-mismatch": ["state-mismatch", "認証状態を確認できません。"],
        "callback-mismatch": ["callback-mismatch", "callbackの受信先が一致しません。"], "admin-blocked": ["admin-blocked", "Google Workspace管理者により認証がブロックされています。"],
        "api-disabled": ["api-disabled", "Google Chat APIまたはPeople APIが無効です。"],
      };
      if (failures[input.mode]) {
        session = { status: "failed", errorCode: failures[input.mode][0], message: failures[input.mode][1], credentials: null, pkce: null, authorizationTarget: null, accessToken: null, refreshToken: null, oauthGrantActive: false, secretNames: [], cleanup: null };
        return send(response, 400, publicOAuthState(session));
      }
      session = { status: "callback-processing", message: "Google認証を確認しています。", credentials: { clientId: `runtime-${Date.now()}`, clientSecret: `runtime-${process.pid}` }, pkce: null, authorizationTarget: null, accessToken: `memory-${Date.now()}`, refreshToken: `memory-${process.pid}`, oauthGrantActive: true, secretNames: [], cleanup: null };
      testMetrics.tokenExchanges += 1;
      try { await registerSecrets(); }
      catch (error) {
        await revokeAndDelete({ cleanStatus: "failed", cleanMessage: error.message });
        session.errorCode = error.code;
        if (session.status === "failed") session.message = error.message;
        return send(response, 400, publicOAuthState(session));
      }
      session.status = "connected"; session.message = "Google認証とRepository Secret登録が完了しました。"; session.credentials = null; session.pkce = null; session.authorizationTarget = null; session.refreshToken = null;
      return send(response, 200, publicOAuthState(session));
    }
    if (request.method === "POST" && url.pathname === "/api/oauth/authorize") {
      await bodyJson(request);
      if (session.status !== "client-ready" || !session.credentials) return send(response, 409, { error: "OAuth client JSONを先に選んでください。", code: "oauth-client-required" });
      session.pkce = nextPkceState();
      session.authorizationTarget = authorizationRequest({ ...session.credentials, redirectUri: redirectUri(), ...session.pkce }).toString();
      session.status = "authorization-pending";
      session.message = "Google認証を待っています。";
      return send(response, 202, publicOAuthState(session));
    }
    if (request.method === "GET" && url.pathname === "/api/oauth/authorize") {
      if (!sessionGuard.hasSession(request)) return send(response, 403, { error: "設定画面のsessionを確認できません。", code: "session-mismatch" });
      if (session.status !== "authorization-pending" || !session.authorizationTarget) return send(response, 409, { error: "Google認証を開始できません。設定画面へ戻ってください。", code: "authorization-not-pending" });
      return send(response, 302, "", "text/plain; charset=utf-8", { location: session.authorizationTarget });
    }
    if (request.method === "GET" && url.pathname === "/oauth/callback") {
      if (session.status !== "authorization-pending" || !session.credentials || !session.pkce) {
        return send(response, 409, "<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><title>認証済み</title><h1>この認証結果は処理済みです。</h1><p>元のGoogle Chat設定画面へ戻ってください。設定や接続情報は変更していません。</p>", "text/html; charset=utf-8");
      }
      try {
        const code = validateCallback({ expectedState: session.pkce?.state, expectedOrigin: origin(), requestUrl: url.toString() });
        session.status = "callback-processing";
        session.authorizationTarget = null;
        testMetrics.tokenExchanges += 1;
        const tokens = synthetic
          ? { accessToken: `memory-access-${Date.now()}`, refreshToken: `memory-refresh-${process.pid}` }
          : await exchangeAuthorizationCode({ ...session.credentials, redirectUri: redirectUri(), code, verifier: session.pkce.verifier });
        session.accessToken = tokens.accessToken; session.refreshToken = tokens.refreshToken;
        session.oauthGrantActive = true;
        await registerSecrets();
        session.status = "connected"; session.message = "Google認証とRepository Secret登録が完了しました。"; session.credentials = null; session.pkce = null; session.authorizationTarget = null; session.refreshToken = null;
        return send(response, 200, "<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><title>認証完了</title><h1>Google認証が完了しました。</h1><p>元のGoogle Chat設定画面が自動的に次へ進みます。この認証タブは閉じて大丈夫です。</p><p>元の画面が進まない場合は、設定タブへ戻って接続状態を確認してください。</p>", "text/html; charset=utf-8");
      } catch (error) {
        const requiresCleanup = Boolean(session.accessToken || session.refreshToken || session.secretNames.length);
        if (requiresCleanup) await revokeAndDelete({ cleanStatus: "failed", cleanMessage: error.message });
        else session = { status: "failed", errorCode: error.code || "oauth-failed", message: error.message, credentials: null, pkce: null, authorizationTarget: null, accessToken: null, refreshToken: null, oauthGrantActive: false, secretNames: [], cleanup: null };
        session.errorCode = error.code || "oauth-failed";
        if (["admin-blocked", "audience-mismatch", "scope-insufficient"].includes(error.code)) session.managerChecklist = { scopes: GOOGLE_CHAT_SCOPES };
        if (session.status === "failed") session.message = error.message;
        return send(response, 400, "<!doctype html><html lang=\"ja\"><meta charset=\"utf-8\"><title>認証失敗</title><h1>Google認証を完了できませんでした。</h1><p>元のGoogle Chat設定画面に理由と次の操作を表示しています。この認証タブを閉じて設定タブへ戻ってください。</p>", "text/html; charset=utf-8");
      }
    }
    if (request.method === "GET" && url.pathname === "/api/oauth/status") {
      const result = publicOAuthState(session);
      if (synthetic && process.env.YASASHII_GOOGLE_CHAT_TEST_OBSERVABILITY === "1") result.testMetrics = testMetrics;
      return send(response, 200, result);
    }
    if (request.method === "POST" && url.pathname === "/api/spaces") {
      await bodyJson(request);
      if (session.status !== "connected") return send(response, 409, { error: "Google認証を完了してください。", code: "oauth-required" });
      const discovered = await currentClient().listSpaces();
      spaces = discovered.filter((space) => space.spaceType === "SPACE").map((space) => ({ name: space.name, displayName: space.displayName || `名称未取得 ${space.name.split("/").pop()}`, spaceType: "SPACE" }));
      if (spaces.length === 0) await revokeAndDelete();
      else if (configuredState().configured) {
        session.accessToken = null;
        session.refreshToken = null;
        session.credentials = null;
        session.pkce = null;
        session.status = "completed";
        session.message = "再認証とスペース一覧の更新が完了しました。";
      }
      return send(response, 200, { spaces, excluded: discovered.length - spaces.length, zero: spaces.length === 0, cleanup: session.cleanup, oauth: publicOAuthState(session) });
    }
    if (request.method === "POST" && url.pathname === "/api/initial-sync") {
      const input = await bodyJson(request);
      if (input.saveConsent !== true || input.commitPushConsent !== true) return send(response, 400, { error: "保存とGitのcommit・pushへの明示同意が必要です。", code: "consent-required" });
      if (!["1h", "3h", "6h", "12h", "manual"].includes(input.interval)) return send(response, 400, { error: "自動取得の間隔を選び直してください。" });
      if (input.interval !== "manual" && input.automaticPushConsent !== true) return send(response, 400, { error: "定期取得と自動commit・pushへの明示同意が必要です。", code: "consent-required" });
      if (session.status !== "connected") return send(response, 409, { error: "Google認証を完了してください。", code: "oauth-required" });
      session.status = "initial-sync-processing";
      session.message = "最初の取得を進めています。";
      const selected = [...new Set((input.selectedSpaceNames || []).map(String))];
      let resultStatus = 200;
      let resultBody;
      try {
        testMetrics.initialSyncs += 1;
        sync = await initialGoogleChatSync({ root, selectedSpaceNames: selected, spaces, client: currentClient() });
        const configPath = join(root, "google-chat", "config.json");
        const selectedSpaces = spaces.filter((space) => selected.includes(space.name));
        writeFileAtomicSafe(root, configPath, `${JSON.stringify({ version: 2, selectedSpaceNames: selected, selectedSpaces, interval: input.interval, scheduleEnabled: false, automaticPushConsent: false }, null, 2)}\n`, { mode: 0o600 });
        writeFileAtomicSafe(root, join(root, "google-chat", "spaces.json"), `${JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), spaces }, null, 2)}\n`, { mode: 0o600 });
        const git = await commitAndPush(["google-chat/config.json", "google-chat/spaces.json", "google-chat/state", "google-chat/history"]);
        let schedule = { status: "not-started", enabled: false, interval: input.interval };
        let config = readJson(configPath);
        try {
          const configured = await applyGoogleChatConfig({
            root,
            selectedSpaces,
            availableSpaces: spaces,
            interval: input.interval,
            automaticPushConsent: input.automaticPushConsent,
            commitPushConsent: input.commitPushConsent,
          });
          config = configured.config;
          schedule = { status: input.interval === "manual" ? "manual" : "configured", enabled: input.interval !== "manual", interval: input.interval, git: configured.status };
        } catch (scheduleError) {
          session.status = "completed-with-schedule-failure";
          session.message = input.interval === "manual" ? "初回取得は保存しましたが、手動取得の設定を完了できませんでした。" : "初回取得は保存しましたが、自動取得の設定を完了できませんでした。";
          resultStatus = 207;
          schedule = { status: "failed", enabled: false, interval: input.interval, code: scheduleError.code || "schedule-setup-failed", message: scheduleError.message };
        }
        session.status = schedule.status === "failed" ? "completed-with-schedule-failure" : "completed";
        if (schedule.status !== "failed") session.message = input.interval === "manual" ? "初回取得と手動のみの設定が完了しました。" : "初回取得と自動取得の設定が完了しました。";
        resultBody = { sync, git, schedule, config, savedLocally: true, tokenDiscarded: true, connectionState: schedule.status === "failed" ? "completed-with-schedule-failure" : "completed", workflowDispatches: 0 };
      } catch (error) {
        session.status = "save-failed";
        session.message = error.message || "初回取得の保存を完了できませんでした。";
        resultStatus = 400;
        resultBody = { error: session.message, code: error.code || "initial-sync-failed", sync, git: error.git || { status: "not-started", committed: false, pushed: false }, schedule: { status: "not-started", enabled: false, interval: input.interval }, savedLocally: existsSync(join(root, "google-chat")), tokenDiscarded: true, connectionState: "save-failed", workflowDispatches: 0 };
      } finally {
        session.accessToken = null;
        session.refreshToken = null;
        session.credentials = null;
        session.pkce = null;
      }
      return send(response, resultStatus, resultBody);
    }
    if (request.method === "POST" && url.pathname === "/api/settings") {
      const input = await bodyJson(request);
      const current = configuredState();
      if (!current.config) return send(response, 409, { error: "初回接続を先に完了してください。", code: "initial-setup-required" });
      const availableSpaces = spaces.length ? spaces : current.spaces;
      const allowed = new Map(availableSpaces.map((space) => [space.name, space]));
      const selectedNames = [...new Set((input.selectedSpaceNames || []).map(String))];
      if (selectedNames.some((name) => !allowed.has(name))) return send(response, 400, { error: "候補にないスペースは設定できません。新しいスペースを追加する場合は再認証して一覧を更新してください。", code: "space-not-allowed" });
      const result = await applyGoogleChatConfig({
        root,
        selectedSpaces: selectedNames.map((name) => allowed.get(name)),
        availableSpaces,
        interval: input.interval,
        automaticPushConsent: input.automaticPushConsent,
        commitPushConsent: input.commitPushConsent,
      });
      return send(response, 200, { result, current: configuredState() });
    }
    if (request.method === "POST" && url.pathname === "/api/cancel") { await bodyJson(request); await revokeAndDelete(); return send(response, 200, { oauth: publicOAuthState(session), cleanup: session.cleanup }); }
    if (request.method !== "GET") return send(response, 405, { error: "Method not allowed" });
    const names = new Map([["/", [join(assets, "index.html"), "text/html; charset=utf-8"]], ["/app.js", [googleApp, "text/javascript; charset=utf-8"]], ["/cleanup.js", [googleCleanup, "text/javascript; charset=utf-8"]], ["/common.js", [join(assets, "common.js"), "text/javascript; charset=utf-8"]], ["/style.css", [join(assets, "style.css"), "text/css; charset=utf-8"]]]);
    const resource = names.get(url.pathname);
    if (!resource || !existsSync(resource[0])) return send(response, 404, "Not found", "text/plain; charset=utf-8");
    return send(response, 200, readFileSync(resource[0]), resource[1]);
  } catch (error) {
    return send(response, 400, { error: error.message || "処理を完了できませんでした。", code: error.code || "failed" });
  }
});

verifyPrivateRepo();
server.listen(port, host, () => {
  const address = server.address();
  process.stdout.write(`Google Chat設定wizard: http://${host}:${address.port}/\n`);
});
