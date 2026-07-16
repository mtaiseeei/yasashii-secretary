#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

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
    return execFileSync(binary, args, {
      cwd,
      encoding: "utf8",
      stdio: options.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(options.env || {}) },
    }).trim();
  } catch (error) {
    if (options.allowFailure) return null;
    const detail = String(error.stderr || "").trim();
    fail(options.message || detail || `${basename(binary)} の実行に失敗しました。`, options.code || 1);
  }
}

function collectTemplateEntries(source, current = "") {
  const absolute = join(source, current);
  const entries = [];
  for (const item of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(current, item.name);
    entries.push({ relativePath: child, directory: item.isDirectory() });
    if (item.isDirectory()) entries.push(...collectTemplateEntries(source, child));
  }
  return entries;
}

function prepareWorkspace(root, templates) {
  const source = realpathSync(templates);
  const destination = realpathSync(root);
  const entries = collectTemplateEntries(source);
  const conflicts = entries
    .filter(({ relativePath }) => existsSync(join(destination, relativePath)))
    .map(({ relativePath }) => relativePath);
  if (conflicts.length > 0) {
    fail(`既存ファイルと重なるため変更しません: ${conflicts.slice(0, 5).join(", ")}`, EXIT_CONFIRM);
  }
  for (const entry of entries.filter((item) => item.directory)) {
    mkdirSync(join(destination, entry.relativePath), { recursive: true });
  }
  for (const entry of entries.filter((item) => !item.directory)) {
    cpSync(join(source, entry.relativePath), join(destination, entry.relativePath), {
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

function listFiles(root, current = "") {
  const files = [];
  for (const item of readdirSync(join(root, current), { withFileTypes: true })) {
    if (item.name === ".git") continue;
    const child = join(current, item.name);
    if (item.isDirectory()) files.push(...listFiles(root, child));
    else if (item.isFile()) files.push(child);
  }
  return files;
}

function findSensitiveFiles(root) {
  const filenameRisk = /(^|\/)(\.env(?:\..+)?|credentials?[^/]*|secrets?[^/]*|id_rsa|id_ed25519|[^/]+\.(?:pem|key))$/i;
  const valueRisk = /(CHATWORK_API_TOKEN|x-chatworktoken)\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}/i;
  const risks = [];
  for (const file of listFiles(root)) {
    const normalized = file.split(sep).join("/");
    if (filenameRisk.test(normalized) && !/\.env\.example$/i.test(normalized)) {
      risks.push(normalized);
      continue;
    }
    const absolute = join(root, file);
    if (statSync(absolute).size > 1024 * 1024) continue;
    let body;
    try {
      body = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    if (valueRisk.test(body)) risks.push(normalized);
  }
  return risks;
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
  const root = realpathSync(rootValue);
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

  const risks = findSensitiveFiles(root);
  if (risks.length > 0) {
    fail(`資格情報の可能性があるファイルを検出したためcommitしません: ${risks.slice(0, 5).join(", ")}`, EXIT_CONFIRM);
  }

  if (!existingRoot) run(gitBinary, ["init", "-b", "main"], root, { message: "Git repoの初期化に失敗しました。" });
  run(gitBinary, ["add", "-A"], root, { message: "初回commitの準備に失敗しました。" });
  const hasStagedChanges = run(gitBinary, ["diff", "--cached", "--quiet"], root, { allowFailure: true, quiet: true }) === null;
  const hasHead = run(gitBinary, ["rev-parse", "--verify", "HEAD"], root, { allowFailure: true, quiet: true }) !== null;
  if (hasStagedChanges) {
    run(gitBinary, ["commit", "-m", hasHead ? "秘書とChatworkのworkspaceを設定" : "秘書workspaceを作成（初回セットアップ）"], root, {
      message: "初回commitに失敗しました。Gitの名前とメール設定を確認してください。",
    });
  } else if (!hasHead) {
    fail("commitするファイルがありません。初回設定の生成物を確認してください。", 1);
  }

  let remoteUrl;
  if (remotes.length > 0) {
    run(gitBinary, ["push", "-u", "origin", "HEAD"], root, { message: "既存private repoへの初回pushに失敗しました。" });
    remoteUrl = existingRemoteInfo.url;
  } else {
    const repoName = args.values.get("--repo");
    if (!repoName || !/^[A-Za-z0-9._-]{1,100}$/.test(repoName)) fail("安全なrepo名を --repo で指定してください。");
    run(ghBinary, ["repo", "create", repoName, "--private", "--source", root, "--remote", "origin", "--push"], root, {
      message: "private GitHub repoの作成または初回pushに失敗しました。",
    });
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
