#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPkceState, authorizationRequest, GOOGLE_CHAT_SCOPES, parseDesktopClientJson, validateCallback } from "../plugins/yasashii-secretary/skills/google-chat/scripts/oauth-session.mjs";
import { initialGoogleChatSync } from "../plugins/yasashii-secretary/skills/google-chat/scripts/sync.mjs";
import { searchGoogleChat } from "../plugins/yasashii-secretary/skills/google-chat/scripts/search.mjs";
import { cleanupDescription } from "../plugins/yasashii-secretary/skills/google-chat/assets/wizard/cleanup.mjs";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixturePath = join(repo, "scripts", "fixtures", "google-chat-wizard", "google-chat.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
let passed = 0;
let failed = 0;
function check(name, condition) { if (condition) { passed += 1; process.stdout.write(`  PASS ${name}\n`); } else { failed += 1; process.stdout.write(`  FAIL ${name}\n`); } }
function temp(name) { const root = mkdtempSync(join(tmpdir(), `yasashii-s019-${name}-`)); execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root }); writeFileSync(join(root, "README.md"), "fixture\n"); execFileSync("git", ["add", "README.md"], { cwd: root }); execFileSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture"], { cwd: root }); execFileSync("git", ["remote", "add", "origin", `https://github.com/fixture/${name}.git`], { cwd: root }); return root; }
function localGitWorkspace(name) {
  const base = mkdtempSync(join(tmpdir(), `yasashii-s019-git-${name}-`));
  const remote = join(base, "remote.git");
  const root = join(base, "workspace");
  mkdirSync(root);
  execFileSync("git", ["init", "--bare", "-q", remote]);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.name", "fixture"], { cwd: root });
  execFileSync("git", ["config", "user.email", "fixture@example.invalid"], { cwd: root });
  writeFileSync(join(root, "README.md"), "fixture\n");
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  execFileSync("git", ["remote", "add", "origin", remote], { cwd: root });
  execFileSync("git", ["push", "-qu", "origin", "main"], { cwd: root });
  return { base, remote, root };
}

const pkce = createPkceState();
check("PKCE verifier/challengeとstateを別々に生成", pkce.verifier.length >= 43 && pkce.challenge.length >= 43 && pkce.state.length >= 32 && ![pkce.challenge, pkce.state].includes(pkce.verifier));
const runtimeId = ["runtime", "client", Date.now(), process.pid].join("-");
const runtimeSecret = ["runtime", "secret", process.pid, Date.now()].join("-");
const client = parseDesktopClientJson({ installed: { client_id: runtimeId, client_secret: runtimeSecret, auth_uri: "https://accounts.google.com/o/oauth2/v2/auth", token_uri: "https://oauth2.googleapis.com/token", redirect_uris: ["http://localhost"] } });
const auth = authorizationRequest({ ...client, redirectUri: "http://127.0.0.1:54321/oauth/callback", ...pkce });
check("OAuth要求はread-only 3 scopeだけ", auth.searchParams.get("scope").split(" ").sort().join() === [...GOOGLE_CHAT_SCOPES].sort().join() && !/write|admin|membership/.test(auth.searchParams.get("scope")));
check("OAuth要求はPKCE S256とstateとloopback", auth.searchParams.get("code_challenge_method") === "S256" && auth.searchParams.get("state") === pkce.state && auth.searchParams.get("redirect_uri").startsWith("http://127.0.0.1:"));
check("Web clientをDesktop appへfallbackしない", (() => { try { parseDesktopClientJson({ web: { client_id: runtimeId } }); return false; } catch (error) { return error.code === "desktop-client-required"; } })());
check("Google公式以外のOAuth endpointへ資格情報を送らない", (() => { try { parseDesktopClientJson({ installed: { client_id: runtimeId, client_secret: runtimeSecret, auth_uri: "https://example.invalid/auth", token_uri: "https://example.invalid/token", redirect_uris: ["http://localhost"] } }); return false; } catch (error) { return error.code === "client-json-invalid"; } })());
check("callback成功は認可コードだけを即時返す", validateCallback({ expectedState: "state-ok", expectedOrigin: "http://127.0.0.1:5000", requestUrl: "http://127.0.0.1:5000/oauth/callback?state=state-ok&code=runtime-code" }) === "runtime-code");
check("state不一致を拒否", (() => { try { validateCallback({ expectedState: "expected", expectedOrigin: "http://127.0.0.1:5000", requestUrl: "http://127.0.0.1:5000/oauth/callback?state=wrong&code=x" }); return false; } catch (error) { return error.code === "state-mismatch"; } })());
check("callback不一致を拒否", (() => { try { validateCallback({ expectedState: "s", expectedOrigin: "http://127.0.0.1:5000", requestUrl: "http://127.0.0.1:5001/oauth/callback?state=s&code=x" }); return false; } catch (error) { return error.code === "callback-mismatch"; } })());
check("同意拒否を区別", (() => { try { validateCallback({ expectedState: "s", expectedOrigin: "http://127.0.0.1:5000", requestUrl: "http://127.0.0.1:5000/oauth/callback?error=access_denied&state=s" }); return false; } catch (error) { return error.code === "access-denied"; } })());
const cleanupCopies = [
  cleanupDescription({ hadConnection: true, secretsDeleted: true, grantRevoked: true, manualCheckRequired: false }),
  cleanupDescription({ hadConnection: true, secretsDeleted: false, grantRevoked: true, manualCheckRequired: true }),
  cleanupDescription({ hadConnection: true, secretsDeleted: true, grantRevoked: false, manualCheckRequired: true }),
  cleanupDescription({ hadConnection: true, secretsDeleted: false, grantRevoked: false, manualCheckRequired: true }),
  cleanupDescription(null, { networkFailure: true }),
  cleanupDescription({ hadConnection: false, secretsDeleted: true, grantRevoked: false, manualCheckRequired: false }),
];
check("cleanup UIは全成功・Secret失敗・grant失敗・両失敗・通信失敗・接続前を区別", cleanupCopies[0].kind === "success" && cleanupCopies[1].technical.includes("Secrets and variables") && !cleanupCopies[1].technical.includes("アプリ権限ページ") && cleanupCopies[2].technical.includes("アプリ権限ページ") && !cleanupCopies[2].technical.includes("Secrets and variables") && cleanupCopies[3].technical.includes("Secrets and variables") && cleanupCopies[3].technical.includes("アプリ権限ページ") && cleanupCopies[4].text.includes("確認できません") && cleanupCopies[5].kind === "none");

function fixtureClient(data = fixture) {
  return {
    async listSpaces() { return data.spaces; },
    async getSpace(name) { return data.spaces.find((space) => space.name === name); },
    async listAllMessages(name) { const pages = data.messagePages[name] || [[]]; if (pages.some((page) => page?.error)) throw Object.assign(new Error("部分失敗"), { code: pages.find((page) => page.error).error }); return pages.flat(); },
    async displayName(name) { return data.people[name] || null; },
  };
}

const storageRoot = temp("storage");
const normalSpaces = fixture.spaces.filter((space) => space.spaceType === "SPACE");
const sync = await initialGoogleChatSync({ root: storageRoot, selectedSpaceNames: ["spaces/space-a", "spaces/space-empty", "spaces/space-fail"], spaces: normalSpaces, client: fixtureClient() });
check("全page・0件・space部分失敗を区別", sync.status === "partial" && sync.results.find((item) => item.name === "spaces/space-a").messages === 3 && sync.results.find((item) => item.name === "spaces/space-empty").messages === 0 && sync.results.find((item) => item.name === "spaces/space-fail").status === "failed");
const historyFiles = readdirSync(join(storageRoot, "google-chat", "history", "営業会議--space-a")).sort();
check("Asia/Tokyo日界で日付別Markdown", historyFiles.join() === "2026-07-16.md,2026-07-17.md");
const day17Path = join(storageRoot, "google-chat", "history", "営業会議--space-a", "2026-07-17.md");
const day17 = readFileSync(day17Path, "utf8");
check("thread・発言者fallback・添付metadata・削除metadataを保存", day17.includes("threads/thread-1") && day17.includes("Google Chatユーザー 200") && day17.includes("確認資料.pdf") && day17.includes("drive-reference-1") && day17.includes("削除済みメッセージ"));
check("添付本文を保存しない", !day17.includes("attachmentData") && !day17.includes("downloadUri"));
const before = day17;
await initialGoogleChatSync({ root: storageRoot, selectedSpaceNames: ["spaces/space-a"], spaces: normalSpaces, client: fixtureClient() });
const repeated = readFileSync(day17Path, "utf8");
check("同一message再取得で重複せず既存投稿を保持", (repeated.match(/google-chat-message:/g) || []).length === 2 && repeated === before);
const tamperedSpaces = [...normalSpaces, { name: "spaces/direct-a", displayName: "個別DM", spaceType: "SPACE" }];
const rejected = await initialGoogleChatSync({ root: temp("tamper"), selectedSpaceNames: ["spaces/direct-a"], spaces: tamperedSpaces, client: fixtureClient() });
check("取得実行時のspaceType再検証でDM拒否", rejected.status === "failed" && rejected.results[0].code === "space-type-rejected");
const found = searchGoogleChat({ root: storageRoot, query: "見積書", skipPull: true });
const missing = searchGoogleChat({ root: storageRoot, query: "存在しない語", skipPull: true });
check("基本検索foundはspace・日付・該当箇所", found.status === "found" && found.matches[0].path.includes("営業会議") && found.matches[0].date === "2026-07-16" && found.matches[0].line > 0);
check("not foundは保存済み範囲に限定", missing.status === "not-found-locally" && !missing.message.includes("Google Chatに存在しません"));

async function startServer(extraEnv = {}, options = {}) {
  const root = options.root || temp(`wizard-${Date.now()}`);
  const child = spawn(process.execPath, [join(repo, "plugins", "yasashii-secretary", "skills", "google-chat", "scripts", "wizard-server.mjs"), "--root", root, "--port", "0"], { env: { ...process.env, YASASHII_GOOGLE_CHAT_SYNTHETIC: "1", YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1", YASASHII_GOOGLE_CHAT_TEST_SECRETS: "1", YASASHII_GOOGLE_CHAT_SKIP_GIT: "1", YASASHII_GOOGLE_CHAT_FIXTURE: fixturePath, ...extraEnv } });
  let output = ""; child.stdout.on("data", (chunk) => { output += chunk; });
  let errors = ""; child.stderr.on("data", (chunk) => { errors += chunk; });
  for (let attempt = 0; attempt < 80 && !output.match(/http:\/\//); attempt += 1) await new Promise((wait) => setTimeout(wait, 50));
  const base = output.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
  if (!base) throw new Error(`wizard did not start: ${errors}`);
  return { child, root, base };
}

async function api(base, path, body) { const response = await fetch(`${base}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); return { response, json: await response.json() }; }
const wizard = await startServer();
const bootstrap = await api(wizard.base, "api/bootstrap");
check("Google Chat wizardはloopbackだけで起動し3時間初期値", wizard.base.startsWith("http://127.0.0.1:") && bootstrap.json.defaultInterval === "3h" && bootstrap.json.intervals.join() === "1h,3h,6h,12h,manual");
for (const [mode, code] of [["denied", "access-denied"], ["state-mismatch", "state-mismatch"], ["callback-mismatch", "callback-mismatch"], ["admin-blocked", "admin-blocked"], ["api-disabled", "api-disabled"]]) {
  const result = await api(wizard.base, "api/oauth/synthetic", { mode });
  check(`synthetic ${mode}を区別`, result.response.status === 400 && result.json.code === code && result.json.secretNames.length === 0);
}
const authorized = await api(wizard.base, "api/oauth/synthetic", { mode: "success" });
check("成功時は3 Secret名だけを返し値を返さない", authorized.response.ok && authorized.json.secretNames.join() === "GOOGLE_OAUTH_CLIENT_ID,GOOGLE_OAUTH_CLIENT_SECRET,GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT" && !JSON.stringify(authorized.json).includes(runtimeId));
const discovered = await api(wizard.base, "api/spaces", {});
check("候補はSPACEだけ・DM/group DM 0件・初期選択0", discovered.json.spaces.length === 3 && discovered.json.excluded === 2 && !JSON.stringify(discovered.json).includes("個別DM") && !JSON.stringify(discovered.json).includes("グループDM"));
const noConsent = await api(wizard.base, "api/initial-sync", { selectedSpaceNames: ["spaces/space-a"], interval: "3h", saveConsent: true, commitPushConsent: false });
check("専用確認の同意前は設定・履歴・commit・push 0", noConsent.response.status === 400 && !readFileSync(join(wizard.root, "README.md"), "utf8").includes("google-chat") && !readdirSync(wizard.root).includes("google-chat"));
const noAutomaticConsent = await api(wizard.base, "api/initial-sync", { selectedSpaceNames: ["spaces/space-a"], interval: "3h", saveConsent: true, commitPushConsent: true, automaticPushConsent: false });
check("自動取得の同意前は設定・履歴・commit・push 0", noAutomaticConsent.response.status === 400 && !readdirSync(wizard.root).includes("google-chat"));
const completed = await api(wizard.base, "api/initial-sync", { selectedSpaceNames: ["spaces/space-a", "spaces/space-empty"], interval: "3h", saveConsent: true, commitPushConsent: true, automaticPushConsent: true });
const completedConfig = JSON.parse(readFileSync(join(wizard.root, "google-chat", "config.json"), "utf8"));
check("1回の確定で初回取得と自動取得設定を完了", completed.response.ok && completed.json.tokenDiscarded === true && completed.json.workflowDispatches === 0 && completed.json.schedule.status === "configured" && completedConfig.interval === "3h" && completedConfig.scheduleEnabled === true && completedConfig.automaticPushConsent === true);
const manualWizard = await startServer();
await api(manualWizard.base, "api/oauth/synthetic", { mode: "success" });
await api(manualWizard.base, "api/spaces", {});
const manualCompleted = await api(manualWizard.base, "api/initial-sync", { selectedSpaceNames: ["spaces/space-empty"], interval: "manual", saveConsent: true, commitPushConsent: true, automaticPushConsent: false });
const manualConfig = JSON.parse(readFileSync(join(manualWizard.root, "google-chat", "config.json"), "utf8"));
check("手動のみも初回取得しscheduleを作らない", manualCompleted.response.ok && manualCompleted.json.sync.results.length === 1 && manualCompleted.json.schedule.status === "manual" && manualConfig.scheduleEnabled === false && manualConfig.automaticPushConsent === false && !readFileSync(join(manualWizard.root, ".github", "workflows", "google-chat-sync.yml"), "utf8").includes("  schedule:"));
manualWizard.child.kill("SIGTERM");
const cancelled = await api(wizard.base, "api/cancel", {});
check("OAuth後キャンセルはSecret削除とgrant revoke状態", cancelled.json.cleanup.secretsDeleted === true && cancelled.json.cleanup.grantRevoked === true && cancelled.json.oauth.secretNames.length === 0);
const persisted = readdirSync(wizard.root, { recursive: true }).filter((name) => typeof name === "string").map((name) => { try { return readFileSync(join(wizard.root, name), "utf8"); } catch { return ""; } }).join("\n");
check("runtime client ID・secret・tokenを永続化しない", !persisted.includes(runtimeId) && !persisted.includes(runtimeSecret) && !persisted.includes("memory-") && !persisted.includes("runtime-code"));
wizard.child.kill("SIGTERM");

const failedServer = await startServer({ YASASHII_GOOGLE_CHAT_SECRET_FAILURE: "1" });
const secretFailure = await api(failedServer.base, "api/oauth/synthetic", { mode: "success" });
check("Secret登録失敗で接続済みにしない", secretFailure.response.status === 400 && secretFailure.json.code === "secret-registration-failed" && secretFailure.json.secretNames.length === 0);
failedServer.child.kill("SIGTERM");

for (const cleanupCase of [
  { name: "全成功", env: {}, expected: [true, true, false] },
  { name: "Secret削除失敗", env: { YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE: "1" }, expected: [false, true, true] },
  { name: "grant revoke失敗", env: { YASASHII_GOOGLE_CHAT_GRANT_REVOKE_FAILURE: "1" }, expected: [true, false, true] },
  { name: "両方失敗", env: { YASASHII_GOOGLE_CHAT_SECRET_DELETE_FAILURE: "1", YASASHII_GOOGLE_CHAT_GRANT_REVOKE_FAILURE: "1" }, expected: [false, false, true] },
]) {
  const cleanupServer = await startServer(cleanupCase.env);
  await api(cleanupServer.base, "api/oauth/synthetic", { mode: "success" });
  const result = await api(cleanupServer.base, "api/cancel", {});
  check(`cleanup ${cleanupCase.name}を区別`, result.json.cleanup.hadConnection === true && result.json.cleanup.secretsDeleted === cleanupCase.expected[0] && result.json.cleanup.grantRevoked === cleanupCase.expected[1] && result.json.cleanup.manualCheckRequired === cleanupCase.expected[2]);
  cleanupServer.child.kill("SIGTERM");
}

const zeroFixturePath = join(mkdtempSync(join(tmpdir(), "yasashii-s019-zero-space-")), "zero.json");
writeFileSync(zeroFixturePath, `${JSON.stringify({ spaces: fixture.spaces.filter((space) => space.spaceType !== "SPACE"), messagePages: {}, people: {} }, null, 2)}\n`);
const zeroSpaceServer = await startServer({ YASASHII_GOOGLE_CHAT_FIXTURE: zeroFixturePath, YASASHII_GOOGLE_CHAT_GRANT_REVOKE_FAILURE: "1" });
await api(zeroSpaceServer.base, "api/oauth/synthetic", { mode: "success" });
const zeroSpaces = await api(zeroSpaceServer.base, "api/spaces", {});
check("0 SPACE APIはcleanup失敗結果を返す", zeroSpaces.json.zero === true && zeroSpaces.json.cleanup.hadConnection === true && zeroSpaces.json.cleanup.secretsDeleted === true && zeroSpaces.json.cleanup.grantRevoked === false && zeroSpaces.json.cleanup.manualCheckRequired === true);
zeroSpaceServer.child.kill("SIGTERM");

const normalUiServer = await startServer({ YASASHII_GOOGLE_CHAT_TEST_NORMAL_UI: "1" });
const normalClientJson = JSON.stringify({ installed: { client_id: runtimeId, client_secret: runtimeSecret, auth_uri: "https://accounts.google.com/o/oauth2/v2/auth", token_uri: "https://oauth2.googleapis.com/token", redirect_uris: ["http://localhost"] } });
await api(normalUiServer.base, "api/oauth/client", { clientJson: normalClientJson });
const normalBootstrap = await api(normalUiServer.base, "api/bootstrap");
const normalAppSource = await (await fetch(`${normalUiServer.base}app.js`)).text();
check("通常UIは別タブOAuthと元wizard pollingを使う", normalBootstrap.json.testing === false && normalBootstrap.json.oauth.status === "ready" && normalAppSource.includes('window.open("/api/oauth/authorize"') && normalAppSource.includes("waitForOAuth") && normalAppSource.includes("Googleの確認画面を") && normalAppSource.includes("もう一度開く"));
normalUiServer.child.kill("SIGTERM");

async function runGitSync({ name, selectedSpace, data }) {
  const workspace = localGitWorkspace(name);
  const dataRoot = mkdtempSync(join(tmpdir(), `yasashii-s019-fixture-${name}-`));
  const dataPath = join(dataRoot, "fixture.json");
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  const testServer = await startServer({ YASASHII_GOOGLE_CHAT_SKIP_GIT: "0", YASASHII_GOOGLE_CHAT_FIXTURE: dataPath }, { root: workspace.root });
  await api(testServer.base, "api/oauth/synthetic", { mode: "success" });
  await api(testServer.base, "api/spaces", {});
  const result = await api(testServer.base, "api/initial-sync", { selectedSpaceNames: [selectedSpace], interval: "3h", saveConsent: true, commitPushConsent: true, automaticPushConsent: true });
  testServer.child.kill("SIGTERM");
  return { workspace, result };
}

const zeroGit = await runGitSync({ name: "zero", selectedSpace: "spaces/space-empty", data: fixture });
const zeroRemoteCommits = Number(execFileSync("git", ["--git-dir", zeroGit.workspace.remote, "rev-list", "--count", "main"], { encoding: "utf8" }).trim());
check("local bare remoteへ0件でも初回結果と自動設定をcommit・push", zeroGit.result.response.ok && zeroGit.result.json.sync.results[0].messages === 0 && zeroGit.result.json.git.pushed === true && zeroGit.result.json.schedule.status === "configured" && zeroRemoteCommits === 3 && !readdirSync(join(zeroGit.workspace.root, "google-chat")).includes("history"));

const oneMessageFixture = structuredClone(fixture);
oneMessageFixture.messagePages["spaces/space-a"] = [[fixture.messagePages["spaces/space-a"][0][0]]];
const oneGit = await runGitSync({ name: "one", selectedSpace: "spaces/space-a", data: oneMessageFixture });
const oneRemoteCommits = Number(execFileSync("git", ["--git-dir", oneGit.workspace.remote, "rev-list", "--count", "main"], { encoding: "utf8" }).trim());
check("local bare remoteへ1件の履歴と自動設定をcommit・push", oneGit.result.response.ok && oneGit.result.json.sync.results[0].messages === 1 && oneGit.result.json.git.pushed === true && oneGit.result.json.schedule.status === "configured" && oneRemoteCommits === 3);

const failedGitWorkspace = localGitWorkspace("push-failure");
const failedGitServer = await startServer({ YASASHII_GOOGLE_CHAT_SKIP_GIT: "0" }, { root: failedGitWorkspace.root });
await api(failedGitServer.base, "api/oauth/synthetic", { mode: "success" });
await api(failedGitServer.base, "api/spaces", {});
execFileSync("git", ["remote", "set-url", "origin", join(failedGitWorkspace.base, "missing.git")], { cwd: failedGitWorkspace.root });
const failedGitResult = await api(failedGitServer.base, "api/initial-sync", { selectedSpaceNames: ["spaces/space-a"], interval: "3h", saveConsent: true, commitPushConsent: true, automaticPushConsent: true });
const failedGitStatus = await api(failedGitServer.base, "api/oauth/status");
check("Git push失敗でもtoken破棄とローカル生成物を正直に返す", failedGitResult.response.status === 400 && failedGitResult.json.code === "git-save-failed" && failedGitResult.json.savedLocally === true && failedGitResult.json.tokenDiscarded === true && failedGitResult.json.git.committed === true && failedGitResult.json.git.pushed === false && failedGitStatus.json.status === "save-failed");
failedGitServer.child.kill("SIGTERM");

const partialWorkspace = localGitWorkspace("initial-schedule-partial");
mkdirSync(join(partialWorkspace.root, ".github", "workflows"), { recursive: true });
writeFileSync(join(partialWorkspace.root, ".github", "workflows", "google-chat-sync.yml"), "利用者が確認中の既存ファイル\n");
const partialServer = await startServer({ YASASHII_GOOGLE_CHAT_SKIP_GIT: "0" }, { root: partialWorkspace.root });
await api(partialServer.base, "api/oauth/synthetic", { mode: "success" });
await api(partialServer.base, "api/spaces", {});
const partialResult = await api(partialServer.base, "api/initial-sync", { selectedSpaceNames: ["spaces/space-a"], interval: "3h", saveConsent: true, commitPushConsent: true, automaticPushConsent: true });
const partialConfig = JSON.parse(readFileSync(join(partialWorkspace.root, "google-chat", "config.json"), "utf8"));
check("初回保存後に自動設定だけ失敗した場合を全体成功にしない", partialResult.response.status === 207 && partialResult.json.git.pushed === true && partialResult.json.schedule.status === "failed" && partialResult.json.connectionState === "completed-with-schedule-failure" && partialConfig.scheduleEnabled === false && readFileSync(join(partialWorkspace.root, ".github", "workflows", "google-chat-sync.yml"), "utf8") === "利用者が確認中の既存ファイル\n");
partialServer.child.kill("SIGTERM");

const wizardServerSource = readFileSync(join(repo, "plugins", "yasashii-secretary", "skills", "google-chat", "scripts", "wizard-server.mjs"), "utf8");
check("Repository Secret値はghのstdinへ渡しハイフン文字を登録しない", wizardServerSource.includes('["secret", "set", name]') && wizardServerSource.includes("child.stdin.end(value)") && !wizardServerSource.includes('["secret", "set", name, "--body", "-"]'));

const common = readFileSync(join(repo, "plugins", "yasashii-secretary", "skills", "chatwork", "assets", "wizard", "common.js"), "utf8");
const css = readFileSync(join(repo, "plugins", "yasashii-secretary", "skills", "chatwork", "assets", "wizard", "style.css"), "utf8");
const chatApp = readFileSync(join(repo, "plugins", "yasashii-secretary", "skills", "chatwork", "assets", "wizard", "app.js"), "utf8");
const googleApp = readFileSync(join(repo, "plugins", "yasashii-secretary", "skills", "google-chat", "assets", "wizard", "app.js"), "utf8");
check("両wizardは同じshell・index・CSS assetを共有", chatApp.includes('installWizardShell("chatwork")') && googleApp.includes('installWizardShell("google-chat")') && common.includes("Chatworkの設定") && common.includes("Google Chatの設定"));
check("指定CTA色・黒前景・旧青0", common.includes("#F03747") && common.includes("#11BB62") && css.includes("color: #000000") && !/#3e6ae1/i.test(`${common}\n${css}\n${chatApp}\n${googleApp}`));
function luminance(hex) { const channels = hex.match(/[0-9a-f]{2}/gi).map((part) => parseInt(part, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4); return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]; }
check("指定背景と黒前景はcontrast 4.5:1以上", ["F03747", "11BB62"].every((hex) => (luminance(hex) + .05) / .05 >= 4.5));
check("両サービス3時間推奨・初期値", chatApp.includes('interval: "3h"') && chatApp.includes("3時間ごと（おすすめ・初期値）") && googleApp.includes('interval: "3h"') && googleApp.includes("3時間ごと（おすすめ・初期値）"));
check("cleanup通信失敗と手動確認先を成功扱いしない", googleApp.includes("cleanupDescription") && cleanupCopies[4].kind === "manual" && cleanupCopies[3].kind === "manual");

const distributed = [readFileSync(join(repo, "README.md"), "utf8"), readFileSync(join(repo, "plugins", "yasashii-secretary", "skills", "google-chat", "SKILL.md"), "utf8")].join("\n");
check("README高度設定と管理者順序・People API限界", distributed.includes("Google Chatをつなぐ（少し高度な設定）") && distributed.includes("Google Workspace管理者") && distributed.includes("Internal") && distributed.includes("Desktop app") && distributed.includes("連絡先にない同僚名"));
check("public repoにGoogle Chat workflow・利用者設定・履歴なし", !readdirSync(join(repo, "plugins", "yasashii-secretary", "workspace-templates", ".github", "workflows")).some((name) => /google|gchat/i.test(name)) && !readdirSync(join(repo, "plugins", "yasashii-secretary", "workspace-templates")).some((name) => name === "google-chat"));

process.stdout.write(`SPRINT019_PASS=${passed} SPRINT019_FAIL=${failed}\n`);
process.exit(failed ? 1 : 0);
