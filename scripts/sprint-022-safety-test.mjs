#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  removeSafe,
  renameSafe,
  safeWritePath,
  workingRoot,
  writeFileAtomicSafe,
} from "../plugins/yasashii-secretary/scripts/lib/safe-fs.mjs";
import { fetchWithTimeout, runExternal } from "../plugins/yasashii-secretary/scripts/lib/external-ops.mjs";
import { commitOwnedChanges } from "../plugins/yasashii-secretary/scripts/lib/safe-git.mjs";
import { latestRelease } from "../plugins/yasashii-secretary/scripts/update-diagnose.mjs";
import { applyChatworkConfig } from "../plugins/yasashii-secretary/skills/chatwork/scripts/config-transaction.mjs";
import { createGoogleChatClient } from "../plugins/yasashii-secretary/skills/google-chat/scripts/client.mjs";
import { exchangeRefreshToken } from "../plugins/yasashii-secretary/skills/google-chat/scripts/refresh-token.mjs";
import { exchangeAuthorizationCode } from "../plugins/yasashii-secretary/skills/google-chat/scripts/oauth-session.mjs";
import { fetchWithTimeout as distributedFetchWithTimeout } from "../plugins/yasashii-secretary/skills/google-chat/scripts/runtime-safety.mjs";
import { searchGoogleChat } from "../plugins/yasashii-secretary/skills/google-chat/scripts/search.mjs";
import { systemRunner } from "../plugins/yasashii-secretary/skills/google-chat/scripts/cloud-setup.mjs";
import { writeSpaceHistory } from "../plugins/yasashii-secretary/skills/google-chat/scripts/history.mjs";
import { requestJson as chatworkRequest } from "../plugins/yasashii-secretary/workspace-templates/chatwork/scripts/chatwork-sync.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(realpathSync(tmpdir()), "yasashii-s022-"));
let pass = 0;
let fail = 0;

function check(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    process.stdout.write(`PASS ${name}\n`);
  } else {
    fail += 1;
    process.stdout.write(`FAIL ${name}${detail ? `: ${detail}` : ""}\n`);
  }
}

async function rejects(name, action, code) {
  try {
    await action();
    check(name, false, "拒否されませんでした");
  } catch (error) {
    check(name, !code || error?.code === code, `code=${error?.code || "none"}`);
    return error;
  }
  return null;
}

function snapshot(path) {
  const stat = statSync(path);
  return {
    hash: createHash("sha256").update(readFileSync(path)).digest("hex"),
    size: stat.size,
    mode: stat.mode,
    mtimeMs: stat.mtimeMs,
  };
}

function unchanged(before, after) {
  return before.hash === after.hash && before.size === after.size && before.mode === after.mode && before.mtimeMs === after.mtimeMs;
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function gitRepositoryState(root) {
  return {
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    index: execFileSync("git", ["write-tree"], { cwd: root, encoding: "utf8" }).trim(),
    worktree: execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root, encoding: "utf8" }),
  };
}

function delay(ms) { return new Promise((resolveDelay) => setTimeout(resolveDelay, ms)); }

function responseWithHangingBody({ ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    body: {},
    json: () => new Promise(() => {}),
    text: () => new Promise(() => {}),
  };
}

function productionFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return /\.(?:mjs|js)$/.test(entry.name) ? [path] : [];
  });
}

try {
  const root = join(work, "workspace");
  const outside = join(work, "outside");
  mkdirSync(root);
  mkdirSync(outside);
  const sentinel = join(outside, "sentinel.txt");
  writeFileSync(sentinel, "outside-sentinel\n");
  const sentinelBefore = snapshot(sentinel);

  symlinkSync(outside, join(root, "ancestor-link"));
  await rejects("Node途中ancestorの外向きsymlinkを拒否", () => Promise.resolve(safeWritePath(root, "ancestor-link/new/deep/file.txt")), "symlink-boundary");
  check("Node拒否前の外部部分生成0件", !existsSync(join(outside, "new")) && unchanged(sentinelBefore, snapshot(sentinel)));

  symlinkSync(sentinel, join(root, "final-link"));
  await rejects("Node最終要素の外向きsymlinkを拒否", () => Promise.resolve(writeFileAtomicSafe(root, "final-link", "changed\n")), "symlink-boundary");
  check("Node最終symlink拒否で参照先不変", unchanged(sentinelBefore, snapshot(sentinel)));

  const rootLink = join(work, "workspace-link");
  symlinkSync(root, rootLink);
  await rejects("Node working root自身のsymlinkを拒否", () => Promise.resolve(workingRoot(rootLink)), "working-root-unsafe");

  const requestedRootBase = join(work, "requested-root-base");
  const requestedRootOutside = join(work, "requested-root-outside");
  const requestedRootNested = join(requestedRootOutside, "nested");
  mkdirSync(requestedRootBase);
  mkdirSync(requestedRootNested, { recursive: true });
  symlinkSync(requestedRootOutside, join(requestedRootBase, "escape"));
  const requestedRoot = join(requestedRootBase, "escape", "nested");
  await rejects("workingRoot入力の途中component symlinkを拒否", () => Promise.resolve(workingRoot(requestedRoot)), "working-root-unsafe");
  await rejects("途中component symlink rootからの原子的書込みを拒否", () => Promise.resolve(writeFileAtomicSafe(requestedRoot, "escaped.txt", "blocked\n")), "working-root-unsafe");
  check("途中component symlink root拒否で外部作成0件", !existsSync(join(requestedRootNested, "escaped.txt")));

  const fileTarget = join(outside, "file-target.txt");
  writeFileSync(fileTarget, "file-target\n");
  const fileBefore = snapshot(fileTarget);
  symlinkSync(fileTarget, join(root, "delete-file-link"));
  const removedFileLink = removeSafe(root, "delete-file-link");
  check("file symlink削除はlinkだけを削除", removedFileLink.kind === "symlink" && !existsSync(join(root, "delete-file-link")) && unchanged(fileBefore, snapshot(fileTarget)));

  const dirTarget = join(outside, "directory-target");
  mkdirSync(dirTarget);
  writeFileSync(join(dirTarget, "keep.txt"), "keep-directory\n");
  const dirFileBefore = snapshot(join(dirTarget, "keep.txt"));
  symlinkSync(dirTarget, join(root, "delete-directory-link"));
  const removedDirectoryLink = removeSafe(root, "delete-directory-link", { recursive: true });
  check("directory symlink削除も参照先を辿らない", removedDirectoryLink.kind === "symlink" && existsSync(dirTarget) && unchanged(dirFileBefore, snapshot(join(dirTarget, "keep.txt"))));

  const normal = join(root, "normal.txt");
  writeFileSync(normal, "normal\n");
  const moved = renameSafe(root, "normal.txt", "nested/renamed.txt");
  check("通常working root内の作成・renameが成功", readFileSync(moved, "utf8") === "normal\n" && !existsSync(normal));
  check("通常file削除が成功", removeSafe(root, moved).kind === "file" && !existsSync(moved));

  const externalRepo = join(work, "confirmed-development-repo");
  mkdirSync(externalRepo);
  const workspacePointer = join(root, "development-repo");
  symlinkSync(externalRepo, workspacePointer);
  await rejects("秘書workspace内の外部repo symlink経由は拒否", () => Promise.resolve(writeFileAtomicSafe(root, "development-repo/src/new.txt", "blocked\n")), "symlink-boundary");
  check("symlink経由拒否の外部repo副作用0件", !existsSync(join(externalRepo, "src")));
  writeFileAtomicSafe(externalRepo, "src/new.txt", "allowed\n");
  writeFileAtomicSafe(externalRepo, "src/new.txt", "updated\n");
  renameSafe(externalRepo, "src/new.txt", "src/renamed.txt");
  const externalRemoved = removeSafe(externalRepo, "src/renamed.txt");
  check("外部repo自身をworking rootにした通常開発を許可", externalRemoved.kind === "file" && !existsSync(join(externalRepo, "src", "renamed.txt")) && readlinkSync(workspacePointer) === externalRepo);

  const secretary = join(work, "secretary");
  cpSync(join(repo, "plugins", "yasashii-secretary", "templates"), secretary, { recursive: true });
  const shellFileTarget = join(outside, "shell-file.txt");
  writeFileSync(shellFileTarget, "shell-file\n");
  const shellFileBefore = snapshot(shellFileTarget);
  symlinkSync(shellFileTarget, join(secretary, "memory", "shell-file-link"));
  const memoryTools = join(repo, "plugins", "yasashii-secretary", "skills", "memory-care", "scripts", "memory-tools.sh");
  const noConfirm = spawnSync("bash", [memoryTools, "delete", secretary, "shell-file-link"], { encoding: "utf8" });
  check("shell symlink削除は2段階確認を維持", noConfirm.status === 3 && lstatSync(join(secretary, "memory", "shell-file-link")).isSymbolicLink());
  const confirmed = spawnSync("bash", [memoryTools, "delete", secretary, "shell-file-link", "--confirm"], { encoding: "utf8" });
  check("shell file symlinkは確認後linkだけ削除", confirmed.status === 0 && !existsSync(join(secretary, "memory", "shell-file-link")) && unchanged(shellFileBefore, snapshot(shellFileTarget)));

  symlinkSync(dirTarget, join(secretary, "memory", "shell-dir-link"));
  const confirmedDir = spawnSync("bash", [memoryTools, "delete", secretary, "shell-dir-link", "--confirm"], { encoding: "utf8" });
  check("shell directory symlinkも参照先を保持", confirmedDir.status === 0 && existsSync(dirTarget) && unchanged(dirFileBefore, snapshot(join(dirTarget, "keep.txt"))));

  const shellOutside = join(outside, "2026");
  rmSync(join(secretary, "docs"), { recursive: true, force: true });
  symlinkSync(outside, join(secretary, "docs"));
  const workspaceTools = join(repo, "plugins", "yasashii-secretary", "scripts", "workspace-tools.sh");
  const shellBoundary = spawnSync("bash", [workspaceTools, "save-deliverable", secretary, "2026-07-19", "境界確認"], { input: "本文", encoding: "utf8" });
  check("shell成果物導線も外向きsymlinkを拒否", shellBoundary.status === 3 && !existsSync(shellOutside));

  const shellRequestedBase = join(work, "shell-requested-base");
  const shellRequestedOutside = join(work, "shell-requested-outside");
  const shellRequestedSecretary = join(shellRequestedOutside, "nested");
  mkdirSync(shellRequestedBase);
  mkdirSync(shellRequestedOutside);
  cpSync(join(repo, "plugins", "yasashii-secretary", "templates"), shellRequestedSecretary, { recursive: true });
  symlinkSync(shellRequestedOutside, join(shellRequestedBase, "escape"));
  const shellRequestedRoot = join(shellRequestedBase, "escape", "nested");
  const shellRequestedSentinel = join(shellRequestedSecretary, "memory", "component-sentinel.txt");
  const shellRequestedDelete = join(shellRequestedSecretary, "memory", "component-delete.txt");
  writeFileSync(shellRequestedSentinel, "shell-component-sentinel\n");
  writeFileSync(shellRequestedDelete, "shell-component-delete\n");
  const shellRequestedSentinelBefore = snapshot(shellRequestedSentinel);
  const shellRequestedDeleteBefore = snapshot(shellRequestedDelete);
  const shellComponentWrite = spawnSync("bash", [workspaceTools, "save-deliverable", shellRequestedRoot, "2026-07-19", "途中component"], { input: "拒否する本文", encoding: "utf8" });
  check("Shell途中component symlink rootの通常writeを副作用前に拒否", shellComponentWrite.status === 3 && !existsSync(join(shellRequestedSecretary, "docs", "2026", "07", "2026-07-19_途中component.md")));
  const shellComponentDelete = spawnSync("bash", [memoryTools, "delete", shellRequestedRoot, "component-delete.txt", "--confirm"], { encoding: "utf8" });
  check("Shell途中component symlink rootの確認済み通常deleteを副作用前に拒否", shellComponentDelete.status === 3 && unchanged(shellRequestedDeleteBefore, snapshot(shellRequestedDelete)));
  check("Shell途中component拒否で外部sentinel・metadata・入力link不変", unchanged(shellRequestedSentinelBefore, snapshot(shellRequestedSentinel)) && readlinkSync(join(shellRequestedBase, "escape")) === shellRequestedOutside && readdirSync(shellRequestedBase).join("\0") === "escape");

  const updateRequestedBase = join(work, "update-requested-base");
  const updateRequestedOutside = join(work, "update-requested-outside");
  const updateExternalRepo = join(updateRequestedOutside, "nested");
  mkdirSync(updateRequestedBase);
  mkdirSync(updateExternalRepo, { recursive: true });
  symlinkSync(updateRequestedOutside, join(updateRequestedBase, "escape"));
  const updateRequestedRoot = join(updateRequestedBase, "escape", "nested");
  const updateSentinel = join(updateExternalRepo, "sentinel.txt");
  writeFileSync(updateSentinel, "update-component-sentinel\n");
  execFileSync("git", ["init", "-q"], { cwd: updateExternalRepo });
  execFileSync("git", ["config", "user.email", "fixture@example.com"], { cwd: updateExternalRepo });
  execFileSync("git", ["config", "user.name", "Sprint 022 fixture"], { cwd: updateExternalRepo });
  execFileSync("git", ["add", "sentinel.txt"], { cwd: updateExternalRepo });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: updateExternalRepo });
  const updateBefore = gitRepositoryState(updateExternalRepo);
  const updateSentinelBefore = snapshot(updateSentinel);
  const updateApply = join(repo, "plugins", "yasashii-secretary", "scripts", "update-apply.mjs");
  const updateComponentResult = spawnSync(process.execPath, [updateApply, "start", "--workspace", updateRequestedRoot, "--current-plugin-root", join(repo, "plugins", "yasashii-secretary"), "--no-network", "--json"], { cwd: repo, encoding: "utf8" });
  const updateAfter = gitRepositoryState(updateExternalRepo);
  check("更新入口は途中component symlink workspaceを非0終了で拒否", updateComponentResult.status !== 0);
  check("更新workspace拒否で外部HEAD・index・worktree・sentinel不変", JSON.stringify(updateAfter) === JSON.stringify(updateBefore) && unchanged(updateSentinelBefore, snapshot(updateSentinel)));
  check("更新workspace拒否はsession・内部部分生成・入力link変更0件", !existsSync(join(updateExternalRepo, ".git", "yasashii-secretary-update", "session.json")) && readlinkSync(join(updateRequestedBase, "escape")) === updateRequestedOutside && readdirSync(updateRequestedBase).join("\0") === "escape");

  const chatRoot = join(work, "chat-config-root");
  const chatOutside = join(outside, "chat-config");
  mkdirSync(chatRoot);
  mkdirSync(chatOutside);
  symlinkSync(chatOutside, join(chatRoot, "chatwork"));
  process.env.YASASHII_CHATWORK_TEST_PRIVATE = "1";
  process.env.YASASHII_CHATWORK_TEST_SECRET = "1";
  process.env.YASASHII_CHATWORK_SKIP_GIT = "1";
  await rejects("Chatwork設定のNode書込み境界", () => applyChatworkConfig({ root: chatRoot, selectedRoomIds: ["1"], interval: "manual", automaticPushConsent: false }), "symlink-boundary");
  delete process.env.YASASHII_CHATWORK_TEST_PRIVATE;
  delete process.env.YASASHII_CHATWORK_TEST_SECRET;
  delete process.env.YASASHII_CHATWORK_SKIP_GIT;
  check("Chatwork境界拒否で外部設定0件", !existsSync(join(chatOutside, "config.json")));

  const googleRoot = join(work, "google-history-root");
  const googleOutside = join(outside, "google-history");
  mkdirSync(googleRoot);
  mkdirSync(googleOutside);
  symlinkSync(googleOutside, join(googleRoot, "google-chat"));
  await rejects("Google Chat履歴のNode書込み境界", () => Promise.resolve(writeSpaceHistory({
    root: googleRoot,
    space: { name: "spaces/AAA", displayName: "安全境界" },
    messages: [{ name: "spaces/AAA/messages/1", createTime: "2026-07-19T00:00:00Z", sender: "fixture", thread: null, text: "fixture", attachments: [], deleted: false, deletionType: null }],
  })), "symlink-boundary");
  check("Google Chat境界拒否で外部履歴0件", !existsSync(join(googleOutside, "history")));

  const hangScript = join(work, "hang-fixture.mjs");
  writeFileSync(hangScript, `import {spawn} from "node:child_process"; import {writeFileSync} from "node:fs";\nconst [mode,pidFile,sideEffect]=process.argv.slice(2);\nif(mode==="child"){writeFileSync(pidFile,String(process.pid));setInterval(()=>{},1000)}\nelse if(mode==="success"){process.stdout.write("retry-ok\\n")}\nelse{spawn(process.execPath,[process.argv[1],"child",pidFile,sideEffect],{stdio:"ignore"});setTimeout(()=>writeFileSync(sideEffect,"unsafe"),1000);setInterval(()=>{},1000)}\n`);
  const bins = join(work, "bins");
  mkdirSync(bins);
  for (const name of ["git", "gh", "claude", "gcloud"]) symlinkSync(process.execPath, join(bins, name));
  for (const name of ["git", "gh", "claude", "gcloud"]) {
    const pidFile = join(work, `${name}.pid`);
    const sideEffect = join(work, `${name}.after-timeout`);
    const started = Date.now();
    await rejects(`${name} hangを有限時間でtimeout`, () => runExternal(join(bins, name), [hangScript, "hang", pidFile, sideEffect], { timeoutMs: 120, label: name }), "timeout");
    await delay(350);
    const childPid = existsSync(pidFile) ? Number(readFileSync(pidFile, "utf8")) : 0;
    check(`${name} timeout後の子process・後続副作用0件`, Date.now() - started < 2_000 && !existsSync(sideEffect) && (!childPid || !alive(childPid)));
    const retried = await runExternal(join(bins, name), [hangScript, "success", pidFile, sideEffect], { timeoutMs: 500, label: name });
    check(`${name} timeout後に安全に再試行可能`, retried.stdout.trim() === "retry-ok");
  }

  const hostileScript = join(work, "hostile-process.mjs");
  writeFileSync(hostileScript, `#!/usr/bin/env node
import {appendFileSync,writeFileSync} from "node:fs";
import {spawn} from "node:child_process";
const pidFile=process.env.YASASHII_FIXTURE_PID; const sideEffect=process.env.YASASHII_FIXTURE_EFFECT; const log=process.env.YASASHII_FIXTURE_LOG;
if(log&&process.argv[2]!=="--child") appendFileSync(log,process.argv.slice(2).join(" ")+"\\n");
if(process.env.YASASHII_FIXTURE_MODE==="success"){process.stdout.write(process.env.YASASHII_FIXTURE_OUTPUT||"retry-ok\\n");process.exit(0)}
if(process.argv[2]==="--child"){if(pidFile)writeFileSync(pidFile,String(process.pid));process.on("SIGTERM",()=>{});if(sideEffect)setTimeout(()=>writeFileSync(sideEffect,"unsafe"),900);setInterval(()=>{},1000)}
else{spawn(process.execPath,[process.argv[1],"--child"],{stdio:"ignore",env:process.env});process.on("SIGTERM",()=>process.exit(0));if(process.env.YASASHII_FIXTURE_MODE==="overflow"){const chunk="x".repeat(4096);setInterval(()=>process.stdout.write(chunk),0)}else setInterval(()=>{},1000)}
`);
  chmodSync(hostileScript, 0o755);

  const hostilePid = join(work, "hostile.pid");
  const hostileEffect = join(work, "hostile.effect");
  const hostileEnv = { ...process.env, YASASHII_FIXTURE_PID: hostilePid, YASASHII_FIXTURE_EFFECT: hostileEffect, YASASHII_FIXTURE_MODE: "hang" };
  await rejects("親がSIGTERMで先に終了しても子孫へSIGKILL escalation", () => runExternal(process.execPath, [hostileScript], { env: hostileEnv, timeoutMs: 80, label: "親先行終了fixture" }), "timeout");
  await delay(80);
  const hostileChildPid = existsSync(hostilePid) ? Number(readFileSync(hostilePid, "utf8")) : 0;
  check("親先行終了後の子孫・後続副作用0件", hostileChildPid > 0 && !alive(hostileChildPid) && !existsSync(hostileEffect));

  const overflowPid = join(work, "overflow.pid");
  const overflowEffect = join(work, "overflow.effect");
  const overflowStarted = Date.now();
  const overflowError = await rejects("maxBuffer超過をtimeout前に終了", () => runExternal(process.execPath, [hostileScript], {
    env: { ...process.env, YASASHII_FIXTURE_PID: overflowPid, YASASHII_FIXTURE_EFFECT: overflowEffect, YASASHII_FIXTURE_MODE: "overflow" },
    timeoutMs: 5_000,
    maxBuffer: 1024,
    label: "大量出力fixture",
  }), "max-buffer");
  await delay(80);
  const overflowChildPid = existsSync(overflowPid) ? Number(readFileSync(overflowPid, "utf8")) : 0;
  const overflowElapsed = Date.now() - overflowStarted;
  const overflowBytes = Buffer.byteLength(overflowError?.stdout || "");
  check("maxBuffer後のbuffer増加・子孫・副作用0件", overflowElapsed < 1_500 && overflowBytes <= 1024 && (!overflowChildPid || !alive(overflowChildPid)) && !existsSync(overflowEffect), `elapsed=${overflowElapsed} bytes=${overflowBytes} pid=${overflowChildPid} alive=${overflowChildPid > 0 && alive(overflowChildPid)} effect=${existsSync(overflowEffect)}`);

  const exitProbe = join(work, "external-exit-probe.mjs");
  writeFileSync(exitProbe, `import {runExternal} from ${JSON.stringify(new URL("../plugins/yasashii-secretary/scripts/lib/external-ops.mjs", import.meta.url).href)};try{await runExternal(process.execPath,[${JSON.stringify(hostileScript)}],{env:{...process.env,YASASHII_FIXTURE_MODE:"hang"},timeoutMs:50,label:"exit-probe"})}catch{}\n`);
  const probeStarted = Date.now();
  execFileSync(process.execPath, [exitProbe], { timeout: 2_000, stdio: "ignore" });
  check("終了後のlistener・timerがprocessを保持しない", Date.now() - probeStarted < 1_500);

  const safeGitRoot = join(work, "safe-git-product");
  mkdirSync(safeGitRoot);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: safeGitRoot });
  execFileSync("git", ["config", "user.name", "Sprint 022"], { cwd: safeGitRoot });
  execFileSync("git", ["config", "user.email", "sprint022@example.invalid"], { cwd: safeGitRoot });
  mkdirSync(join(safeGitRoot, "owned"));
  mkdirSync(join(safeGitRoot, "memory"));
  writeFileSync(join(safeGitRoot, "owned", "data.txt"), "initial\n");
  writeFileSync(join(safeGitRoot, "memory", "note.md"), "initial memory\n");
  execFileSync("git", ["add", "owned/data.txt", "memory/note.md"], { cwd: safeGitRoot });
  execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: safeGitRoot });
  writeFileSync(join(safeGitRoot, "owned", "data.txt"), "changed\n");
  const safeGitLog = join(work, "safe-git.log");
  const safeGitPid = join(work, "safe-git.pid");
  const safeGitEffect = join(work, "safe-git.effect");
  const previousGitBin = process.env.YASASHII_GIT_BIN;
  const previousGitTimeout = process.env.YASASHII_GIT_TIMEOUT_MS;
  process.env.YASASHII_GIT_BIN = hostileScript;
  process.env.YASASHII_GIT_TIMEOUT_MS = "600";
  process.env.YASASHII_FIXTURE_MODE = "hang";
  process.env.YASASHII_FIXTURE_LOG = safeGitLog;
  process.env.YASASHII_FIXTURE_PID = safeGitPid;
  process.env.YASASHII_FIXTURE_EFFECT = safeGitEffect;
  await rejects("safe-git allowFailureでもtimeoutをnullへ変換しない", () => Promise.resolve(commitOwnedChanges({ root: safeGitRoot, ownedPaths: ["owned"], message: "timeout後はcommitしない" })), "timeout");
  await delay(80);
  const safeGitCalls = existsSync(safeGitLog) ? readFileSync(safeGitLog, "utf8").trim().split("\n").filter(Boolean) : [];
  const safeGitChildPid = existsSync(safeGitPid) ? Number(readFileSync(safeGitPid, "utf8")) : 0;
  check("safe-git timeout後のcommit・push・子孫・副作用0件", safeGitCalls.length === 1 && !safeGitCalls.some((line) => /commit|push/.test(line)) && safeGitChildPid > 0 && !alive(safeGitChildPid) && !existsSync(safeGitEffect), `calls=${JSON.stringify(safeGitCalls)} pid=${safeGitChildPid} alive=${safeGitChildPid > 0 && alive(safeGitChildPid)} effect=${existsSync(safeGitEffect)}`);
  if (previousGitBin === undefined) delete process.env.YASASHII_GIT_BIN; else process.env.YASASHII_GIT_BIN = previousGitBin;
  if (previousGitTimeout === undefined) delete process.env.YASASHII_GIT_TIMEOUT_MS; else process.env.YASASHII_GIT_TIMEOUT_MS = previousGitTimeout;
  delete process.env.YASASHII_FIXTURE_MODE; delete process.env.YASASHII_FIXTURE_LOG; delete process.env.YASASHII_FIXTURE_PID; delete process.env.YASASHII_FIXTURE_EFFECT;
  const safeGitRetry = commitOwnedChanges({ root: safeGitRoot, ownedPaths: ["owned"], message: "timeout後の再試行" });
  check("safe-git timeout後の同一操作を安全に再試行", safeGitRetry.status === "committed" && readFileSync(join(safeGitRoot, "owned", "data.txt"), "utf8") === "changed\n");

  writeFileSync(join(safeGitRoot, "memory", "note.md"), "changed memory\n");
  const memoryLog = join(work, "memory-commit.log");
  const memoryPid = join(work, "memory-commit.pid");
  const memoryEffect = join(work, "memory-commit.effect");
  const beforeMemoryCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: safeGitRoot, encoding: "utf8" }).trim();
  const memoryTimeout = spawnSync("bash", [memoryTools, "commit", safeGitRoot, "timeout後はcommitしない"], {
    encoding: "utf8",
    timeout: 3_000,
    env: {
      ...process.env,
      YASASHII_GIT_BIN: hostileScript,
      YASASHII_CLI_TIMEOUT_MS: "250",
      YASASHII_FIXTURE_MODE: "hang",
      YASASHII_FIXTURE_LOG: memoryLog,
      YASASHII_FIXTURE_PID: memoryPid,
      YASASHII_FIXTURE_EFFECT: memoryEffect,
    },
  });
  await delay(80);
  const memoryCalls = existsSync(memoryLog) ? readFileSync(memoryLog, "utf8").trim().split("\n").filter(Boolean) : [];
  const memoryChildPid = existsSync(memoryPid) ? Number(readFileSync(memoryPid, "utf8")) : 0;
  const afterMemoryTimeout = execFileSync("git", ["rev-parse", "HEAD"], { cwd: safeGitRoot, encoding: "utf8" }).trim();
  check("memory commit前処理timeoutでcommit・push・子孫・副作用0件", memoryTimeout.status !== 0 && memoryCalls.length === 1 && !memoryCalls.some((line) => /commit|push/.test(line)) && beforeMemoryCommit === afterMemoryTimeout && memoryChildPid > 0 && !alive(memoryChildPid) && !existsSync(memoryEffect), `status=${memoryTimeout.status} calls=${JSON.stringify(memoryCalls)} pid=${memoryChildPid}`);
  const memoryRetry = spawnSync("bash", [memoryTools, "commit", safeGitRoot, "timeout後のmemory再試行"], { encoding: "utf8", timeout: 5_000 });
  const afterMemoryRetry = execFileSync("git", ["rev-parse", "HEAD"], { cwd: safeGitRoot, encoding: "utf8" }).trim();
  check("memory commitをtimeout後に安全に再試行", memoryRetry.status === 0 && afterMemoryRetry !== beforeMemoryCommit && execFileSync("git", ["status", "--porcelain", "--", "memory"], { cwd: safeGitRoot, encoding: "utf8" }).trim() === "");

  const searchRoot = join(work, "search-product");
  mkdirSync(join(searchRoot, "google-chat", "history"), { recursive: true });
  writeFileSync(join(searchRoot, "google-chat", "history", "2026-07-19.md"), "# fixture\n検索対象\n");
  const searchLog = join(work, "search.log");
  const searchPid = join(work, "search.pid");
  process.env.YASASHII_GIT_BIN = hostileScript;
  process.env.YASASHII_CLI_TIMEOUT_MS = "600";
  process.env.YASASHII_FIXTURE_MODE = "hang";
  process.env.YASASHII_FIXTURE_LOG = searchLog;
  process.env.YASASHII_FIXTURE_PID = searchPid;
  const searchTimeout = searchGoogleChat({ root: searchRoot, query: "検索対象" });
  await delay(80);
  const searchChildPid = existsSync(searchPid) ? Number(readFileSync(searchPid, "utf8")) : 0;
  const searchCalls = existsSync(searchLog) ? readFileSync(searchLog, "utf8").trim().split("\n").filter(Boolean) : [];
  check("Google Chat検索のgit pull timeoutで検索・後続操作0件", searchTimeout.status === "sync-failed" && searchTimeout.code === "timeout" && searchCalls.length === 1 && searchChildPid > 0 && !alive(searchChildPid), `result=${JSON.stringify(searchTimeout)} calls=${JSON.stringify(searchCalls)} pid=${searchChildPid} alive=${searchChildPid > 0 && alive(searchChildPid)}`);
  const searchRetry = searchGoogleChat({ root: searchRoot, query: "検索対象", skipPull: true });
  check("Google Chat検索をtimeout後に安全に再試行", searchRetry.status === "found");
  delete process.env.YASASHII_GIT_BIN; delete process.env.YASASHII_CLI_TIMEOUT_MS; delete process.env.YASASHII_FIXTURE_MODE; delete process.env.YASASHII_FIXTURE_LOG; delete process.env.YASASHII_FIXTURE_PID;

  const cloudBin = join(work, "cloud-bin");
  mkdirSync(cloudBin);
  symlinkSync(hostileScript, join(cloudBin, "gcloud"));
  const oldPath = process.env.PATH;
  process.env.PATH = `${cloudBin}:${oldPath}`;
  process.env.YASASHII_CLI_TIMEOUT_MS = "80";
  process.env.YASASHII_FIXTURE_MODE = "hang";
  process.env.YASASHII_FIXTURE_PID = join(work, "cloud.pid");
  const cloudTimeout = systemRunner("gcloud", ["version", "--format=json"], { cwd: work });
  await delay(80);
  const cloudChildPid = existsSync(process.env.YASASHII_FIXTURE_PID) ? Number(readFileSync(process.env.YASASHII_FIXTURE_PID, "utf8")) : 0;
  process.env.YASASHII_FIXTURE_MODE = "success";
  process.env.YASASHII_FIXTURE_OUTPUT = "{}";
  const cloudRetry = systemRunner("gcloud", ["version", "--format=json"], { cwd: work });
  check("cloud-setupのgcloud timeout・子孫0件・再試行成功", cloudTimeout.status === 124 && cloudChildPid > 0 && !alive(cloudChildPid) && cloudRetry.status === 0 && cloudRetry.stdout === "{}");
  process.env.PATH = oldPath; delete process.env.YASASHII_CLI_TIMEOUT_MS; delete process.env.YASASHII_FIXTURE_MODE; delete process.env.YASASHII_FIXTURE_PID; delete process.env.YASASHII_FIXTURE_OUTPUT;

  await rejects("共通HTTP hangをtimeoutとして分類", () => fetchWithTimeout("https://fixture.invalid/hang", {}, { timeoutMs: 60, label: "公式情報取得", fetchImpl: () => new Promise(() => {}) }), "timeout");
  const googleClient = createGoogleChatClient({ accessToken: "fixture", timeoutMs: 60, fetchImpl: () => new Promise(() => {}) });
  await rejects("Google Chat API hangをtimeoutとして分類", () => googleClient.listSpaces(), "timeout");
  await rejects("Google OAuth hangをtimeoutとして分類", () => exchangeRefreshToken({ clientId: "fixture", clientSecret: "fixture", refreshToken: "fixture", timeoutMs: 60, fetchImpl: () => new Promise(() => {}) }), "timeout");

  const chatworkTimeout = await rejects("Chatwork API hangをtimeoutで停止", () => chatworkRequest("/rooms", { timeoutMs: 60, fetchImpl: () => new Promise(() => {}) }), "timeout");
  check("Chatwork timeoutを空結果・成功へ誤分類しない", chatworkTimeout?.message.includes("時間切れ"));

  const sharedBodyResponse = await fetchWithTimeout("https://fixture.invalid/body", {}, { timeoutMs: 60, label: "公式情報取得", fetchImpl: async () => responseWithHangingBody() });
  await rejects("共通HTTPはheader後のtext停止もtimeout", () => sharedBodyResponse.text(), "timeout");

  const googleBodyClient = createGoogleChatClient({ accessToken: "fixture", timeoutMs: 60, fetchImpl: async () => responseWithHangingBody() });
  await rejects("Google Chat APIのjson body停止をtimeout", () => googleBodyClient.listSpaces(), "timeout");
  await rejects("Google OAuth refreshのjson body停止をtimeout", () => exchangeRefreshToken({ clientId: "fixture", clientSecret: "fixture", refreshToken: "fixture", timeoutMs: 60, fetchImpl: async () => responseWithHangingBody() }), "timeout");
  await rejects("Google OAuth code交換のjson body停止をtimeout", () => exchangeAuthorizationCode({ tokenUri: "https://fixture.invalid/token", clientId: "fixture", clientSecret: "fixture", redirectUri: "http://127.0.0.1/callback", code: "fixture", verifier: "fixture", timeoutMs: 60, fetchImpl: async () => responseWithHangingBody() }), "timeout");
  await rejects("Chatwork APIのjson body停止をtimeout", () => chatworkRequest("/rooms", { timeoutMs: 60, fetchImpl: async () => responseWithHangingBody() }), "timeout");

  const previousHttpTimeout = process.env.YASASHII_HTTP_TIMEOUT_MS;
  process.env.YASASHII_HTTP_TIMEOUT_MS = "60";
  const officialResult = await latestRelease({ values: new Map(), flags: new Set() }, { fetchImpl: async () => responseWithHangingBody() });
  if (previousHttpTimeout === undefined) delete process.env.YASASHII_HTTP_TIMEOUT_MS; else process.env.YASASHII_HTTP_TIMEOUT_MS = previousHttpTimeout;
  check("公式情報取得のbody停止は有限時間で未確認扱い", officialResult.version === null && /接続できず|確認できません/.test(officialResult.reason));

  const abortListeners = new Set();
  const callerReason = Object.assign(new Error("caller stopped"), { code: "caller-abort" });
  const callerSignal = {
    aborted: false,
    reason: undefined,
    addEventListener(_name, listener) { abortListeners.add(listener); },
    removeEventListener(_name, listener) { abortListeners.delete(listener); },
  };
  const callerResponse = await distributedFetchWithTimeout("https://fixture.invalid/caller", { signal: callerSignal }, { timeoutMs: 1_000, label: "配布runtime", fetchImpl: async () => responseWithHangingBody() });
  const callerBody = callerResponse.json();
  callerSignal.aborted = true;
  callerSignal.reason = callerReason;
  for (const listener of [...abortListeners]) listener();
  const callerAbortError = await rejects("配布runtimeはcaller abortをそのまま伝播", () => callerBody, "caller-abort");
  check("caller abortをtimeoutへ誤分類せずlistenerを解放", callerAbortError === callerReason && abortListeners.size === 0);

  const pluginRoot = join(repo, "plugins", "yasashii-secretary");
  const directSyncUsers = productionFiles(pluginRoot).filter((path) => !path.endsWith("scripts/lib/external-ops.mjs") && /\b(?:execFileSync|spawnSync|execSync)\b/.test(readFileSync(path, "utf8")));
  check("productionの直接execFileSync・spawnSync inventoryは0件", directSyncUsers.length === 0, directSyncUsers.map((path) => path.slice(repo.length + 1)).join(", "));
  const routedSources = [
    "scripts/lib/safe-git.mjs",
    "scripts/update-apply.mjs",
    "scripts/workspace-repo.mjs",
    "scripts/project-tools.mjs",
    "skills/chatwork/scripts/wizard-server.mjs",
    "skills/google-chat/scripts/wizard-server.mjs",
    "skills/google-chat/scripts/cloud-setup.mjs",
    "skills/google-chat/scripts/search.mjs",
  ];
  check("主要production callsiteを共通安全処理へ集約", routedSources.every((path) => /external-ops\.mjs/.test(readFileSync(join(pluginRoot, path), "utf8"))) && /safe-external\.mjs/.test(readFileSync(memoryTools, "utf8")));
} finally {
  rmSync(work, { recursive: true, force: true });
}

process.stdout.write(`SPRINT022_PASS=${pass} SPRINT022_FAIL=${fail}\n`);
if (fail > 0) process.exitCode = 1;
