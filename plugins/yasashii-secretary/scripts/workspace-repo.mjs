#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { commitOwnedChanges, inspectWorkingCandidates, pushOwnedCommit } from "./lib/safe-git.mjs";
import { runExternalSync } from "./lib/external-ops.mjs";
import { ensureSafeDirectory, safeWritePath, workingRoot } from "./lib/safe-fs.mjs";

const EXIT_USAGE = 2;
const EXIT_CONFIRM = 3;

function fail(message, code = EXIT_USAGE) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const result = { command: argv[0], values: new Map(), flags: new Set() };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`未対応の引数です: ${token}`);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result.values.set(token, next);
      index += 1;
    } else {
      result.flags.add(token);
    }
  }
  return result;
}

function run(binary, args, cwd, options = {}) {
  try {
    return runExternalSync(binary, args, {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...(options.env || {}) },
      timeoutMs: Number(options.timeout || process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
      label: basename(binary),
    }).stdout.trim();
  } catch (error) {
    const timedOut = error?.code === "timeout";
    if (options.allowFailure && !timedOut && error?.code !== "max-buffer") return null;
    const detail = String(error.stderr || "").trim();
    fail(timedOut
      ? `${basename(binary)} の処理が時間切れになりました。後続処理は行っていません。`
      : options.message || detail || `${basename(binary)} の実行に失敗しました。`, options.code || 1);
  }
}

function collectTemplateEntries(source, current = "") {
  const absolute = join(source, current);
  const entries = [];
  for (const item of readdirSync(absolute, { withFileTypes: true })) {
    if (item.isSymbolicLink()) fail(`templateにsymlinkがあるため準備を止めました: ${join(current, item.name)}`, EXIT_CONFIRM);
    const child = join(current, item.name);
    entries.push({ relativePath: child, directory: item.isDirectory() });
    if (item.isDirectory()) entries.push(...collectTemplateEntries(source, child));
  }
  return entries;
}

function prepareWorkspace(root, templates) {
  const source = realpathSync(templates);
  const destination = workingRoot(root);
  const entries = collectTemplateEntries(source);
  // すべての書込み先を先に確認する。1件でも境界外ならdirectoryを部分生成しない。
  const targets = new Map(entries.map((entry) => [entry.relativePath, safeWritePath(destination, entry.relativePath)]));
  const conflicts = entries
    .filter(({ relativePath }) => existsSync(join(destination, relativePath)))
    .map(({ relativePath }) => relativePath);
  if (conflicts.length > 0) {
    fail(`既存ファイルと重なるため変更しません: ${conflicts.slice(0, 5).join(", ")}`, EXIT_CONFIRM);
  }
  for (const entry of entries.filter((item) => item.directory)) {
    ensureSafeDirectory(destination, targets.get(entry.relativePath));
  }
  for (const entry of entries.filter((item) => !item.directory)) {
    const sourcePath = join(source, entry.relativePath);
    if (!lstatSync(sourcePath).isFile()) fail(`templateの通常fileではないため準備を止めました: ${entry.relativePath}`, EXIT_CONFIRM);
    cpSync(sourcePath, targets.get(entry.relativePath), {
      errorOnExist: true,
      force: false,
    });
  }
  process.stdout.write(`${JSON.stringify({ status: "prepared", root: destination })}\n`);
}

function gitRoot(root, gitBinary) {
  const found = run(gitBinary, ["rev-parse", "--show-toplevel"], root, { allowFailure: true, quiet: true });
  return found ? realpathSync(found) : null;
}

function verifyExistingRemote(root, ghBinary) {
  const raw = run(ghBinary, ["repo", "view", "--json", "visibility,url"], root, {
    quiet: true,
    message: "既存remoteのprivate状態を確認できませんでした。pushは行っていません。",
  });
  let info;
  try {
    info = JSON.parse(raw);
  } catch {
    fail("既存remoteの確認結果を読み取れませんでした。pushは行っていません。", 1);
  }
  if (String(info.visibility).toUpperCase() !== "PRIVATE") {
    fail("public repoには秘書やChatwork履歴を保存できません。private repoを指定してください。", EXIT_CONFIRM);
  }
  return info;
}

function publishWorkspace(args) {
  const rootValue = args.values.get("--root");
  if (!rootValue) fail("--root を指定してください。");
  const root = workingRoot(rootValue);
  if (args.values.get("--visibility") && args.values.get("--visibility") !== "private") {
    fail("public repoは選べません。--visibility private を指定してください。", EXIT_CONFIRM);
  }
  if (!args.flags.has("--confirm")) {
    fail("repo作成・初回pushの前に確認が必要です。内容を確認後、--confirm を付けてください。", EXIT_CONFIRM);
  }
  if (!existsSync(join(root, "secretary"))) fail("secretary/ がありません。先に初回設定を完了してください。");
  if (existsSync(join(root, "secretary", ".git"))) {
    fail("secretary/ 内に別のGit repoがあります。自動削除はしません。統合方法を確認してください。", EXIT_CONFIRM);
  }

  const gitBinary = process.env.YASASHII_GIT_BIN || "git";
  const ghBinary = process.env.YASASHII_GH_BIN || "gh";
  const existingRoot = gitRoot(root, gitBinary);
  if (existingRoot && existingRoot !== root) {
    fail("指定先は別のGit repoの内側です。repo rootでやり直してください。", EXIT_CONFIRM);
  }
  const remotes = existingRoot
    ? (run(gitBinary, ["remote"], root, { quiet: true, allowFailure: true }) || "").split(/\s+/).filter(Boolean)
    : [];
  if (remotes.length > 0 && !args.flags.has("--use-existing-remote")) {
    fail(`既存remote (${remotes.join(", ")}) があります。現在のrepoを使う確認前は変更しません。`, EXIT_CONFIRM);
  }
  let existingRemoteInfo = null;
  if (remotes.length > 0) {
    if (!remotes.includes("origin")) fail("既存remoteにoriginがありません。remote構成を確認するまで変更しません。", EXIT_CONFIRM);
    existingRemoteInfo = verifyExistingRemote(root, ghBinary);
  }

  // 初回publishが所有するinventoryを明示する。repo rootの既存文書や別作業は対象にしない。
  const publishInventory = [
    "secretary",
    "chatwork",
    "google-chat",
    ".github/workflows/chatwork-sync.yml",
    ".github/workflows/google-chat-sync.yml",
    ".yasashii-secretary/update-ledger.json",
  ].filter((path) => existsSync(join(root, path)));
  try {
    // commit対象外のrootファイルに資格情報が混ざっていても、初回push前に停止する。
    // commitへ入れるのは上で明示したinventoryだけ。
    inspectWorkingCandidates(root, readdirSync(root).filter((name) => name !== ".git"));
  } catch (error) {
    fail(error.message || "初回commit候補を安全に検査できないため停止しました。", EXIT_CONFIRM);
  }

  if (!existingRoot) run(gitBinary, ["init", "-b", "main"], root, { message: "Git repoの初期化に失敗しました。" });
  const hasHead = run(gitBinary, ["rev-parse", "--verify", "HEAD"], root, { allowFailure: true, quiet: true }) !== null;
  let committed;
  try {
    committed = commitOwnedChanges({
      root,
      ownedPaths: publishInventory,
      message: hasHead ? "秘書とチャットのworkspaceを設定" : "秘書workspaceを作成（初回セットアップ）",
    });
  } catch (error) {
    fail(error.message || "初回commitに失敗しました。Gitの名前とメール設定を確認してください。", error.code === "secret-detected" ? EXIT_CONFIRM : 1);
  }
  if (committed.status !== "committed" && !hasHead) {
    fail("commitするファイルがありません。初回設定の生成物を確認してください。", 1);
  }
  const commit = committed.newHead;
  let remoteUrl;
  if (remotes.length > 0) {
    try { pushOwnedCommit({ root, oldHead: committed.oldHead, newHead: commit, remote: "origin", setUpstream: true }); }
    catch (error) { fail(error.message || "private repoへのpushに失敗しました。", 1); }
    remoteUrl = existingRemoteInfo.url;
  } else {
    const repoName = args.values.get("--repo");
    if (!repoName || !/^[A-Za-z0-9._-]{1,100}$/.test(repoName)) fail("安全なrepo名を --repo で指定してください。");
    run(ghBinary, ["repo", "create", repoName, "--private", "--source", root, "--remote", "origin"], root, {
      message: "private GitHub repoを作成できませんでした。初回commitはローカルに残り、既存のstageや別作業は変更していません。",
    });
    try { pushOwnedCommit({ root, oldHead: committed.oldHead, newHead: commit, remote: "origin", setUpstream: true }); }
    catch (error) { fail(error.message || "private GitHub repoへの初回pushに失敗しました。", 1); }
    remoteUrl = run(gitBinary, ["remote", "get-url", "origin"], root, { quiet: true });
  }

  process.stdout.write(`${JSON.stringify({ status: "published", visibility: "PRIVATE", remote: remoteUrl, pushed: true })}\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.command === "prepare") {
  const root = args.values.get("--root");
  const templates = args.values.get("--templates");
  if (!root || !templates) fail("prepare には --root と --templates が必要です。");
  prepareWorkspace(resolve(root), resolve(templates));
} else if (args.command === "publish") {
  publishWorkspace(args);
} else {
  fail("使い方: workspace-repo.mjs prepare|publish ...");
}
