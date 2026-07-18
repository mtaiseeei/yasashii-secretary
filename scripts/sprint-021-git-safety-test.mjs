#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyChatworkConfig } from "../plugins/yasashii-secretary/skills/chatwork/scripts/config-transaction.mjs";
import { applyGoogleChatConfig } from "../plugins/yasashii-secretary/skills/google-chat/scripts/config-transaction.mjs";
import { commitOwnedChanges, pushOwnedCommit, stagedSnapshot } from "../plugins/yasashii-secretary/scripts/lib/safe-git.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "yasashii-sprint-021-"));
let pass = 0;
let fail = 0;
const emitted = [];

function check(condition, label) {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stdout.write(`FAIL ${label}\n`); }
}

function run(binary, args, cwd, env = {}, allowFailure = false) {
  const result = spawnSync(binary, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  emitted.push(result.stdout || "", result.stderr || "");
  if (result.status !== 0 && !allowFailure) throw new Error(`${binary} failed (${result.status})`);
  return result;
}

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function write(root, path, body) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
}

function init(name) {
  const root = join(work, name);
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Sprint 021 Fixture");
  git(root, "config", "user.email", "sprint-021@example.invalid");
  return root;
}

function baseline(root, files = { "README.md": "# fixture\n" }) {
  for (const [path, body] of Object.entries(files)) write(root, path, body);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "fixture baseline");
  return git(root, "rev-parse", "HEAD");
}

function bare(name) {
  const target = join(work, `${name}.git`);
  git(work, "init", "-q", "--bare", target);
  return target;
}

function commitPaths(root, commit = "HEAD") {
  return git(root, "diff-tree", "--root", "--no-commit-id", "--name-only", "-r", commit).split("\n").filter(Boolean).sort();
}

function synthetic(label) {
  return ["SYN", label, String(process.pid), "x".repeat(28)].join("_");
}

function withEnv(values, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
  return Promise.resolve(callback()).finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

try {
  const owned = init("owned");
  baseline(owned, { "README.md": "base\n", "tracked-unstaged.txt": "before\n" });
  write(owned, "unrelated-staged.txt", "staged\n");
  git(owned, "add", "unrelated-staged.txt");
  write(owned, "tracked-unstaged.txt", "after\n");
  write(owned, "unrelated-untracked.txt", "untracked\n");
  write(owned, "secretary/memory/note.md", "safe memory\n");
  const indexBefore = stagedSnapshot(owned);
  const ownedResult = commitOwnedChanges({ root: owned, ownedPaths: ["secretary"], message: "記憶を安全に記録" });
  check(ownedResult.status === "committed" && commitPaths(owned).join(",") === "secretary/memory/note.md", "所有pathだけをcommit");
  check(stagedSnapshot(owned) === indexBefore, "既存indexのstaged内容をbyte単位で維持");
  check(readFileSync(join(owned, "tracked-unstaged.txt"), "utf8") === "after\n" && existsSync(join(owned, "unrelated-untracked.txt")), "unstaged／untrackedを維持");

  const changed = init("candidate-changed");
  const changedHead = baseline(changed);
  write(changed, "secretary/memory/note.md", "first\n");
  let changedError;
  try {
    commitOwnedChanges({
      root: changed,
      ownedPaths: ["secretary"],
      message: "候補差し替えfixture",
      afterScan: () => write(changed, "secretary/memory/note.md", `changed-${synthetic("candidate")}\n`),
    });
  } catch (error) { changedError = error; emitted.push(error.message || ""); }
  check(changedError?.code === "candidate-changed" && git(changed, "rev-parse", "HEAD") === changedHead, "検査後に候補が変わるとcommit 0件");

  const hooked = init("local-hook");
  baseline(hooked);
  write(hooked, ".git/hooks/pre-commit", "#!/bin/sh\nprintf 'api_key = HOOK12345678\\n' > secretary/hook-secret.txt\ngit add secretary/hook-secret.txt\n");
  chmodSync(join(hooked, ".git/hooks/pre-commit"), 0o755);
  write(hooked, "secretary/memory/note.md", "safe hook fixture\n");
  const hookedResult = commitOwnedChanges({ root: hooked, ownedPaths: ["secretary"], message: "hook分離fixture" });
  check(hookedResult.status === "committed" && !existsSync(join(hooked, "secretary/hook-secret.txt")) && commitPaths(hooked).join(",") === "secretary/memory/note.md", "利用者hookを分離し検査後の候補追加を防ぐ");

  const secretCases = [
    ["oauth-client.json", () => JSON.stringify({ installed: { client_id: synthetic("client"), client_secret: synthetic("client-secret"), token_uri: "https://oauth2.example.invalid/token" } })],
    ["client-secret.txt", () => `client_secret=${synthetic("client-secret")}`],
    ["authorization.txt", () => `authorization_code=${synthetic("authorization")}`],
    ["access.txt", () => `access_token=${synthetic("access")}`],
    ["refresh.txt", () => `refresh_token=${synthetic("refresh")}`],
    ["chatwork.txt", () => `CHATWORK_API_TOKEN=${synthetic("chatwork")}`],
    ["legacy-api-key.txt", () => "api_key = ABCDEF123456"],
    ["private.pem", () => `-----BEGIN PRIVATE KEY-----\n${synthetic("private-key")}\n-----END PRIVATE KEY-----`],
    ["credential-url.txt", () => `https://fixture:${synthetic("url")}@example.invalid/path`],
    ["oauth-callback-query.txt", () => `http://127.0.0.1:48123/oauth/callback?state=${synthetic("query-state")}&code=${synthetic("query-code")}`],
    ["oauth-callback-fragment.txt", () => `https://app.example.invalid/oauth/callback#state=${synthetic("fragment-state")}&code=${synthetic("fragment-code")}`],
    ["letters-client-secret.txt", () => "client_secret=alphabeticcredential"],
    ["letters-access-token.txt", () => "access_token=alphabeticcredential"],
    ["letters-refresh-token.txt", () => "refresh_token=alphabeticcredential"],
    ["letters-authorization-code.txt", () => "authorization_code=alphabeticcredential"],
    ["camel-client-secret.json", () => JSON.stringify({ clientSecret: "alphabeticcredential" })],
    ["oauth-callback-letters.txt", () => "http://127.0.0.1/oauth/callback?state=examplestate&code=alphabeticcredential"],
    ["credential-url-camel.txt", () => "https://example.invalid/callback?clientSecret=alphabeticcredential"],
    ["shell-client-secret.sh", () => "client_secret=alphabetshellcredential"],
    ["shell-export-secret.bash", () => "export CLIENT_SECRET=alphabetbashcredential"],
    ["shell-local-secret.sh", () => "local access_token=alphabetlocalcredential"],
    ["shell-readonly-secret.sh", () => "readonly refresh_token=alphabetreadonlycredential"],
    ["shell-declare-secret.bash", () => "declare -gx authorizationCode=alphabetdeclarecredential"],
    ["shell-typeset-secret.zsh", () => "typeset -gx clientSecret=alphabetzshcredential"],
    ["shell-double-quoted-secret.sh", () => "CLIENT_SECRET=\"alphabetquotedcredential\""],
    ["shell-single-quoted-secret.zsh", () => "clientSecret='alphabetsinglequotedcredential'"],
    ["shell-default-secret.sh", () => "readonly client_secret=${CLIENT_SECRET:-alphabeticfallback}"],
    ["js-quoted-snake.js", () => "export default {\n  client_secret: \"alphabetjscredential\",\n};\n"],
    ["js-quoted-camel.mjs", () => "export default {\n  clientSecret: 'alphabetcamelcredential',\n};\n"],
  ];
  const generatedSecrets = [];
  let callbackHistoryProtected = true;
  let shellHistoryProtected = true;
  for (const [name, makeBody] of secretCases) {
    const target = init(`secret-${name.replace(/[^a-z0-9]/gi, "-")}`);
    const before = baseline(target);
    const body = makeBody();
    generatedSecrets.push(...body.match(/SYN_[A-Za-z0-9_-]+/g) || []);
    write(target, `secretary/${name}`, body);
    let error;
    try { commitOwnedChanges({ root: target, ownedPaths: ["secretary"], message: "拒否fixture" }); }
    catch (caught) { error = caught; emitted.push(caught.message || ""); }
    check(error?.code === "secret-detected" && git(target, "rev-parse", "HEAD") === before, `${name}をcommit前に拒否`);
    if (name.startsWith("oauth-callback-")) {
      const history = git(target, "log", "-p", "--all");
      callbackHistoryProtected = callbackHistoryProtected && !body.match(/SYN_[A-Za-z0-9_-]+/g)?.some((value) => history.includes(value));
    }
    if (name.startsWith("shell-")) {
      const history = git(target, "log", "-p", "--all");
      shellHistoryProtected = shellHistoryProtected && !history.includes(body);
    }
  }
  check(callbackHistoryProtected, "OAuth callbackのquery／fragmentをGit履歴へ残さない");
  check(shellHistoryProtected, "shell内の資格情報literalをGit履歴へ残さない");
  const normal = init("normal-document");
  baseline(normal);
  write(normal, "secretary/docs/security.md", [
    "OAuth client JSONは保存しません。access tokenという用語だけを説明します。",
    "OAuth callback URLのqueryにはcodeパラメータが返りますが、値は保存しません。",
    "通常の検索URL: https://example.invalid/search?code=sample&lang=ja",
    "説明用callback: https://docs.example.invalid/oauth/callback?code=redacted&state=example",
    "",
  ].join("\n"));
  check(commitOwnedChanges({ root: normal, ownedPaths: ["secretary"], message: "通常文書" }).status === "committed", "通常文書を誤拒否しない");
  const safeNames = init("safe-credential-filenames");
  baseline(safeNames);
  write(safeNames, "secretary/docs/oauth-guide.json", JSON.stringify({ oauth: "ブラウザで許可し、値は保存しません" }));
  write(safeNames, "secretary/docs/token-handling.txt", "tokenはRepository Secretだけで扱います。値はここに書きません。\n");
  write(safeNames, "secretary/docs/credential-policy.json", JSON.stringify({ policy: "資格情報を文書や履歴へ保存しない" }));
  check(commitOwnedChanges({ root: safeNames, ownedPaths: ["secretary/docs"], message: "安全な資格情報説明" }).status === "committed", "oauth／token／credentialを含む安全なファイル名を誤拒否しない");

  const safeRuntimeReferences = init("safe-runtime-references");
  baseline(safeRuntimeReferences);
  write(safeRuntimeReferences, "secretary/runtime/direct.sh", "client_secret=$CLIENT_SECRET\n");
  write(safeRuntimeReferences, "secretary/runtime/braced.bash", "export CLIENT_SECRET=${OAUTH_CLIENT_SECRET}\n");
  write(safeRuntimeReferences, "secretary/runtime/local.sh", "local access_token=$OAUTH_ACCESS_TOKEN\n");
  write(safeRuntimeReferences, "secretary/runtime/readonly.sh", "readonly refresh_token=\"${OAUTH_REFRESH_TOKEN}\"\n");
  write(safeRuntimeReferences, "secretary/runtime/declare.bash", "declare -gx authorization_code=${OAUTH_AUTHORIZATION_CODE}\n");
  write(safeRuntimeReferences, "secretary/runtime/quoted.zsh", "typeset -gx clientSecret=\"$RUNTIME_CLIENT_SECRET\" # runtime reference\n");
  write(safeRuntimeReferences, "secretary/runtime/double-dash.sh", "export -- CHATWORK_API_TOKEN=$RUNTIME_CHATWORK_TOKEN\n");
  write(safeRuntimeReferences, "secretary/runtime/empty.sh", "CLIENT_SECRET=\nreadonly ACCESS_TOKEN=''\ndeclare REFRESH_TOKEN\n");
  check(
    commitOwnedChanges({ root: safeRuntimeReferences, ownedPaths: ["secretary/runtime"], message: "shell runtime参照" }).status === "committed",
    "shellの明示的なruntime変数参照を誤拒否しない",
  );

  const safeCodeReferences = init("safe-code-references");
  baseline(safeCodeReferences);
  write(safeCodeReferences, "secretary/runtime/oauth.mjs", [
    "const clientSecret = process.env.OAUTH_CLIENT_SECRET;",
    "export const oauth = {",
    "  client_secret: clientSecret,",
    "  access_token: process.env.OAUTH_ACCESS_TOKEN,",
    "};",
    "",
  ].join("\n"));
  check(
    commitOwnedChanges({ root: safeCodeReferences, ownedPaths: ["secretary/runtime"], message: "コードruntime参照" }).status === "committed",
    "clientSecret／process.envのruntime参照を誤拒否しない",
  );

  const commitFail = init("commit-fail");
  const commitFailHead = baseline(commitFail);
  write(commitFail, "secretary/memory/note.md", "retryable\n");
  const commitFailIndex = stagedSnapshot(commitFail);
  let commitFailure;
  await withEnv({ GIT_AUTHOR_NAME: "", GIT_AUTHOR_EMAIL: "", GIT_COMMITTER_NAME: "", GIT_COMMITTER_EMAIL: "" }, async () => {
    try { commitOwnedChanges({ root: commitFail, ownedPaths: ["secretary"], message: "失敗fixture" }); }
    catch (error) { commitFailure = error; emitted.push(error.message || ""); }
  });
  check(Boolean(commitFailure) && git(commitFail, "rev-parse", "HEAD") === commitFailHead && stagedSnapshot(commitFail) === commitFailIndex && existsSync(join(commitFail, "secretary/memory/note.md")), "commit失敗は既存indexを守り再試行可能");

  const fakeGh = join(work, "fake-gh.sh");
  writeFileSync(fakeGh, "#!/bin/sh\nif [ \"$1 $2\" = \"repo view\" ]; then printf '{\"visibility\":\"PRIVATE\",\"url\":\"https://example.invalid/private\"}'; exit 0; fi\nexit 2\n");
  chmodSync(fakeGh, 0o755);
  const publish = init("publish");
  const publishRemote = bare("publish-remote");
  git(publish, "remote", "add", "origin", publishRemote);
  write(publish, "secretary/memory/MEMORY.md", "# memory\n");
  write(publish, "unrelated-staged.txt", "staged\n");
  git(publish, "add", "unrelated-staged.txt");
  write(publish, "unrelated-root.txt", "do not publish\n");
  const publishIndex = stagedSnapshot(publish);
  const publishResult = run("node", [join(repo, "plugins/yasashii-secretary/scripts/workspace-repo.mjs"), "publish", "--root", publish, "--visibility", "private", "--confirm", "--use-existing-remote"], publish, { YASASHII_GH_BIN: fakeGh });
  check(publishResult.status === 0 && commitPaths(publish).join(",") === "secretary/memory/MEMORY.md", "初回publishは明示inventoryだけをcommit");
  check(stagedSnapshot(publish) === publishIndex && existsSync(join(publish, "unrelated-root.txt")), "初回publishも既存stage／rootファイルを維持");
  check(git(publishRemote, "rev-parse", "refs/heads/main") === git(publish, "rev-parse", "HEAD"), "初回publishは検証済みcommitをlocal bare remoteへpush");

  const publishSecret = init("publish-secret");
  const publishSecretHead = baseline(publishSecret);
  const publishSecretRemote = bare("publish-secret-remote");
  git(publishSecret, "remote", "add", "origin", publishSecretRemote);
  const publishSecretValue = synthetic("publish-oauth");
  generatedSecrets.push(publishSecretValue);
  write(publishSecret, "secretary/oauth-client.json", JSON.stringify({ installed: { client_id: synthetic("id"), client_secret: publishSecretValue, token_uri: "https://oauth2.example.invalid/token" } }));
  const rejectedPublish = run("node", [join(repo, "plugins/yasashii-secretary/scripts/workspace-repo.mjs"), "publish", "--root", publishSecret, "--visibility", "private", "--confirm", "--use-existing-remote"], publishSecret, { YASASHII_GH_BIN: fakeGh }, true);
  check(rejectedPublish.status === 3 && git(publishSecret, "rev-parse", "HEAD") === publishSecretHead && run("git", ["show-ref"], publishSecretRemote, {}, true).stdout === "", "OAuth JSONの初回publishはcommit／push 0件");

  const publishCallback = init("publish-callback");
  const publishCallbackHead = baseline(publishCallback);
  const publishCallbackRemote = bare("publish-callback-remote");
  git(publishCallback, "remote", "add", "origin", publishCallbackRemote);
  const publishCallbackValue = synthetic("publish-callback-code");
  generatedSecrets.push(publishCallbackValue);
  write(publishCallback, "secretary/docs/oauth-result.txt", `http://localhost:49152/oauth/callback?state=${synthetic("publish-state")}&code=${publishCallbackValue}\n`);
  const rejectedCallbackPublish = run("node", [join(repo, "plugins/yasashii-secretary/scripts/workspace-repo.mjs"), "publish", "--root", publishCallback, "--visibility", "private", "--confirm", "--use-existing-remote"], publishCallback, { YASASHII_GH_BIN: fakeGh }, true);
  const callbackHistory = git(publishCallback, "log", "-p", "--all");
  check(
    rejectedCallbackPublish.status === 3
      && git(publishCallback, "rev-parse", "HEAD") === publishCallbackHead
      && run("git", ["show-ref"], publishCallbackRemote, {}, true).stdout === ""
      && !callbackHistory.includes(publishCallbackValue),
    "OAuth callbackの認可コードを初回publish前に拒否しcommit／push／履歴露出0件",
  );

  const chatwork = init("chatwork");
  baseline(chatwork);
  const chatRemote = bare("chatwork-remote");
  git(chatwork, "remote", "add", "origin", chatRemote);
  git(chatwork, "push", "-q", "-u", "origin", "main");
  write(chatwork, "unrelated-stage.txt", "keep staged\n");
  git(chatwork, "add", "unrelated-stage.txt");
  write(chatwork, "unrelated-untracked.txt", "keep untracked\n");
  const chatIndex = stagedSnapshot(chatwork);
  await withEnv({ YASASHII_CHATWORK_TEST_PRIVATE: "1", YASASHII_CHATWORK_TEST_SECRET: "1" }, () => applyChatworkConfig({ root: chatwork, selectedRoomIds: ["101"], interval: "3h", automaticPushConsent: true }));
  check(commitPaths(chatwork).every((path) => [".github/workflows/chatwork-sync.yml", "chatwork/config.json"].includes(path)), "Chatwork設定は所有pathだけをcommit");
  check(stagedSnapshot(chatwork) === chatIndex && existsSync(join(chatwork, "unrelated-untracked.txt")), "Chatwork設定は既存stage／untrackedを維持");

  const google = init("google-chat");
  baseline(google);
  const googleRemote = bare("google-remote");
  git(google, "remote", "add", "origin", googleRemote);
  git(google, "push", "-q", "-u", "origin", "main");
  write(google, "unrelated-stage.txt", "keep staged\n");
  git(google, "add", "unrelated-stage.txt");
  write(google, "chatwork/config.json", "{\"existing\":true}\n");
  const googleIndex = stagedSnapshot(google);
  const spaces = [{ name: "spaces/fixture", displayName: "Fixture", spaceType: "SPACE" }];
  await withEnv({ YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1", YASASHII_GOOGLE_CHAT_TEST_SECRETS: "1" }, () => applyGoogleChatConfig({ root: google, selectedSpaces: spaces, availableSpaces: spaces, interval: "3h", automaticPushConsent: true, commitPushConsent: true }));
  check(commitPaths(google).every((path) => path.startsWith("google-chat/") || path === ".github/workflows/google-chat-sync.yml"), "Google Chat初回設定は所有pathだけをcommit");
  check(stagedSnapshot(google) === googleIndex && readFileSync(join(google, "chatwork/config.json"), "utf8") === "{\"existing\":true}\n", "Google Chat初回設定は別サービスと既存stageを維持");
  write(google, "unrelated-second.txt", "second stage\n");
  git(google, "add", "unrelated-second.txt");
  const secondIndex = stagedSnapshot(google);
  await withEnv({ YASASHII_GOOGLE_CHAT_TEST_PRIVATE: "1", YASASHII_GOOGLE_CHAT_TEST_SECRETS: "1" }, () => applyGoogleChatConfig({ root: google, selectedSpaces: spaces, availableSpaces: spaces, interval: "6h", automaticPushConsent: true, commitPushConsent: true }));
  check(stagedSnapshot(google) === secondIndex && commitPaths(google).every((path) => path.startsWith("google-chat/") || path === ".github/workflows/google-chat-sync.yml"), "Google Chat通常設定変更も既存stageを維持");

  const googleWizardSource = readFileSync(join(repo, "plugins/yasashii-secretary/skills/google-chat/scripts/wizard-server.mjs"), "utf8");
  check(
    googleWizardSource.includes("commitOwnedChanges")
      && googleWizardSource.includes("pushOwnedCommit")
      && !googleWizardSource.includes('execFileSync(git, ["add"'),
    "Google Chat初期履歴も共通の所有commit／push経路を使う",
  );

  const memory = init("memory");
  baseline(memory, {
    "README.md": "base\n",
    "secretary/memory/MEMORY.md": "# memory\n",
    "secretary/docs/guide.md": "before\n",
    "secretary/projects/existing/PROJECT.md": "before\n",
  });
  write(memory, "secretary/projects/existing/staged.md", "keep staged\n");
  git(memory, "add", "secretary/projects/existing/staged.md");
  write(memory, "secretary/docs/guide.md", "keep unstaged\n");
  write(memory, "secretary/projects/existing/untracked.md", "keep untracked\n");
  write(memory, "secretary/memory/MEMORY.md", "# memory\n- updated\n");
  const memoryIndex = stagedSnapshot(memory);
  const memoryDocsBefore = readFileSync(join(memory, "secretary/docs/guide.md"), "utf8");
  const memoryUntrackedBefore = readFileSync(join(memory, "secretary/projects/existing/untracked.md"), "utf8");
  const memoryResult = run("bash", [join(repo, "plugins/yasashii-secretary/skills/memory-care/scripts/memory-tools.sh"), "commit", join(memory, "secretary"), "記憶を更新"], memory);
  check(memoryResult.status === 0 && commitPaths(memory).join(",") === "secretary/memory/MEMORY.md", "memory commitは実際に更新したmemory関連pathだけをcommit");
  check(
    stagedSnapshot(memory) === memoryIndex
      && readFileSync(join(memory, "secretary/docs/guide.md"), "utf8") === memoryDocsBefore
      && readFileSync(join(memory, "secretary/projects/existing/untracked.md"), "utf8") === memoryUntrackedBefore,
    "memory commitはprojects／docsのstaged／unstaged／untrackedをbyte単位で維持",
  );

  const noUpstream = init("no-upstream-prior-commit");
  const noUpstreamOldHead = baseline(noUpstream);
  const noUpstreamRemote = bare("no-upstream-prior-remote");
  git(noUpstream, "remote", "add", "origin", noUpstreamRemote);
  write(noUpstream, "secretary/memory/MEMORY.md", "# new memory\n");
  const noUpstreamCommit = commitOwnedChanges({ root: noUpstream, ownedPaths: ["secretary/memory"], message: "今回の所有commit" });
  let noUpstreamError;
  try {
    pushOwnedCommit({ root: noUpstream, oldHead: noUpstreamCommit.oldHead, newHead: noUpstreamCommit.newHead, setUpstream: true });
  } catch (error) { noUpstreamError = error; emitted.push(error.message || ""); }
  check(
    noUpstreamError?.code === "push-base-changed"
      && noUpstreamCommit.oldHead === noUpstreamOldHead
      && run("git", ["show-ref"], noUpstreamRemote, {}, true).stdout === "",
    "upstream未設定の空remoteへ今回以前の別commitを黙ってpushしない",
  );

  const existingRemoteBase = init("no-upstream-existing-base");
  const existingBase = baseline(existingRemoteBase);
  const existingBaseRemote = bare("no-upstream-existing-base-remote");
  git(existingRemoteBase, "remote", "add", "origin", existingBaseRemote);
  git(existingRemoteBase, "push", "-q", "origin", "main");
  write(existingRemoteBase, "secretary/memory/MEMORY.md", "# allowed update\n");
  const existingBaseCommit = commitOwnedChanges({ root: existingRemoteBase, ownedPaths: ["secretary/memory"], message: "remote基点からの所有commit" });
  const existingBasePush = pushOwnedCommit({ root: existingRemoteBase, oldHead: existingBaseCommit.oldHead, newHead: existingBaseCommit.newHead, setUpstream: true });
  check(
    existingBaseCommit.oldHead === existingBase
      && existingBasePush.status === "pushed"
      && git(existingBaseRemote, "rev-parse", "refs/heads/main") === existingBaseCommit.newHead,
    "upstream未設定でもremote先端が今回の基点なら所有commitだけをpush",
  );

  const conflict = init("push-conflict");
  baseline(conflict);
  const conflictRemote = bare("conflict-remote");
  git(conflict, "remote", "add", "origin", conflictRemote);
  git(conflict, "push", "-q", "-u", "origin", "main");
  const attacker = join(work, "attacker");
  run("git", ["clone", "-q", conflictRemote, attacker], work);
  git(attacker, "config", "user.name", "Attacker Fixture");
  git(attacker, "config", "user.email", "attacker@example.invalid");
  write(attacker, "remote-change.txt", "remote advance\n");
  git(attacker, "add", "remote-change.txt");
  git(attacker, "commit", "-q", "-m", "remote advance");
  git(attacker, "push", "-q");
  write(conflict, "unrelated-stage.txt", "keep staged\n");
  git(conflict, "add", "unrelated-stage.txt");
  write(conflict, "unrelated-unstaged.txt", "keep unstaged\n");
  const conflictHead = git(conflict, "rev-parse", "HEAD");
  const conflictIndex = stagedSnapshot(conflict);
  let conflictError;
  await withEnv({ YASASHII_CHATWORK_TEST_PRIVATE: "1", YASASHII_CHATWORK_TEST_SECRET: "1" }, async () => {
    try { await applyChatworkConfig({ root: conflict, selectedRoomIds: ["202"], interval: "3h", automaticPushConsent: true }); }
    catch (error) { conflictError = error; emitted.push(error.message || ""); }
  });
  check(conflictError?.code === "git-conflict" && git(conflict, "rev-parse", "HEAD") === conflictHead, "non-fast-forwardは所有commitをrollback");
  check(stagedSnapshot(conflict) === conflictIndex && existsSync(join(conflict, "unrelated-unstaged.txt")) && !existsSync(join(conflict, "chatwork/config.json")), "push失敗でも既存変更を維持し所有pathだけ復元");

  const output = emitted.join("\n");
  check(generatedSecrets.every((value) => !output.includes(value)), "拒否した資格情報の値をstdout／stderrへ出さない");
} finally {
  rmSync(work, { recursive: true, force: true });
}

process.stdout.write(`PASS=${pass} FAIL=${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
