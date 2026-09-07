#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestGit, ingestGitSync, samePhysicalRoot, resolveGitIngestTimeout } from "../plugins/secretary/scripts/lib/git-ingest.mjs";
import { dispatchCorrelatedWorkflow, resolveRunDiscoveryTiming, watchCorrelatedWorkflow } from "../plugins/secretary/scripts/lib/actions-run.mjs";
import { runExternalSync } from "../plugins/secretary/scripts/lib/external-ops.mjs";
import { isCurrentSyncResult } from "../plugins/secretary/skills/chatwork/scripts/wizard-server.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = realpathSync(mkdtempSync(join(tmpdir(), "secretary-sprint-051-")));
const isolatedHome = join(work, "home");
const isolatedXdg = join(work, "xdg");
mkdirSync(isolatedHome);
mkdirSync(isolatedXdg);
Object.assign(process.env, { HOME: isolatedHome, XDG_CONFIG_HOME: isolatedXdg, GIT_CONFIG_NOSYSTEM: "1", LC_ALL: "C" });
const requireWindows = process.argv.includes("--require-windows");
let passed = 0;
let failed = 0;

function check(condition, label, detail = "") {
  if (condition) { passed += 1; process.stdout.write(`PASS ${label}\n`); }
  else { failed += 1; process.stderr.write(`FAIL ${label}${detail ? `: ${detail}` : ""}\n`); }
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: "utf8", shell: false, ...options });
  if (result.error) throw result.error;
  return result;
}

const locator = process.platform === "win32" ? ["where.exe", ["git.exe"]] : ["which", ["git"]];
const realGit = run(locator[0], locator[1]).stdout.split(/\r?\n/).find(Boolean)?.trim();
if (!realGit || (process.platform === "win32" && !/git\.exe$/i.test(realGit))) throw new Error("real Git executableを確認できません");
if (requireWindows && process.platform !== "win32") throw new Error("--require-windows はWindows runner専用です");

function git(cwd, args, allowFailure = false) {
  const result = run(realGit, args, { cwd });
  if (!allowFailure && result.status !== 0) throw new Error(`fixture git failed: ${args.join(" ")}\n${result.stderr}`);
  return result;
}

function fixture(name) {
  const root = join(work, name);
  const bare = join(root, "remote.git");
  const seed = join(root, "seed");
  const candidate = join(root, "candidate");
  mkdirSync(root, { recursive: true });
  git(root, ["init", "--bare", "-q", bare]);
  git(root, ["clone", "-q", bare, seed]);
  for (const target of [seed]) {
    git(target, ["config", "user.name", "Fixture"]);
    git(target, ["config", "user.email", "fixture@example.invalid"]);
  }
  writeFileSync(join(seed, "base.txt"), "base\n");
  writeFileSync(join(seed, "rename-old.txt"), "rename\n");
  writeFileSync(join(seed, "日本語.txt"), "base\n");
  git(seed, ["add", "."]); git(seed, ["commit", "-q", "-m", "base"]); git(seed, ["branch", "-M", "main"]); git(seed, ["push", "-q", "origin", "main"]);
  git(bare, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(root, ["clone", "-q", bare, candidate]);
  git(candidate, ["config", "user.name", "Fixture"]); git(candidate, ["config", "user.email", "fixture@example.invalid"]);
  return { root, bare, seed, candidate };
}

function remoteCommit(target, path, content = "remote\n") {
  mkdirSync(dirname(join(target.seed, path)), { recursive: true });
  writeFileSync(join(target.seed, path), content);
  git(target.seed, ["add", "."]); git(target.seed, ["commit", "-q", "-m", `remote ${path}`]); git(target.seed, ["push", "-q", "origin", "main"]);
}

function capturedRunner(log, intercept = () => null) {
  return (binary, argv, options) => {
    log.push([...argv]);
    const intercepted = intercept(argv, options);
    return intercepted || runExternalSync(binary, argv, options);
  };
}

function errorOf(callback) {
  try { callback(); return null; } catch (error) { return error; }
}

async function asyncErrorOf(callback) {
  try { await callback(); return null; } catch (error) { return error; }
}

function safePayload(error) {
  return JSON.stringify(error?.toJSON?.() || error || {});
}

function repositorySnapshot(cwd) {
  return [
    git(cwd, ["rev-parse", "HEAD"]).stdout.trim(),
    git(cwd, ["status", "--porcelain=v1", "-z"]).stdout,
    git(cwd, ["ls-files", "--stage", "-z"]).stdout,
  ];
}

try {
  git(work, ["config", "--global", "pull.rebase", "true"]);
  git(work, ["config", "--global", "pull.ff", "false"]);
  check(process.env.HOME === isolatedHome && process.env.XDG_CONFIG_HOME === isolatedXdg && process.env.GIT_CONFIG_NOSYSTEM === "1" && process.env.LC_ALL === "C", "実Git fixtureを隔離HOME/XDG/system config/localeで実行");
  check(resolveGitIngestTimeout(undefined, undefined) === 60_000 && resolveGitIngestTimeout(321, "999") === 321 && resolveGitIngestTimeout("bad", "999") === 60_000 && resolveGitIngestTimeout(undefined, 654) === 654, "Git timeoutはhelper入力 > env > 60秒、無効入力は60秒");
  check(samePhysicalRoot("C:\\Repo\\", "c:/repo", "win32")
    && samePhysicalRoot("\\\\?\\C:\\Repo", "c:/repo", "win32")
    && samePhysicalRoot("\\\\?\\UNC\\Server\\Share\\Repo", "\\\\server\\share\\repo", "win32")
    && !samePhysicalRoot("\\\\?\\C:\\Repo", "D:\\Repo", "win32")
    && !samePhysicalRoot("/tmp/a", "/tmp/b", "linux"), "Windows case/separator/device prefixを正規化し別rootを拒否");

  const up = fixture("up-to-date");
  const upLog = [];
  const upResult = ingestGitSync({ root: up.candidate, git: realGit, runner: capturedRunner(upLog) });
  check(upResult.status === "up-to-date" && !upLog.some(([command]) => command === "pull"), "up-to-dateはpullせず成功");
  check((await ingestGit({ root: up.candidate, git: realGit })).status === "up-to-date", "async経路も実Git rootを物理identityで同一判定");

  const symlink = join(up.root, "candidate-link");
  try { symlinkSync(up.candidate, symlink, process.platform === "win32" ? "junction" : "dir"); }
  catch { /* Windowsの権限設定によってsymlink不可の場合はreal root検査を継続する。 */ }
  if (existsSync(symlink)) check(ingestGitSync({ root: symlink, git: realGit }).status === "up-to-date", "symlink rootを物理identityで同一判定");
  else check(process.platform === "win32", "symlink作成不可はWindows runnerだけ許容");

  const ahead = fixture("local-ahead");
  writeFileSync(join(ahead.candidate, "local.txt"), "local\n"); git(ahead.candidate, ["add", "local.txt"]); git(ahead.candidate, ["commit", "-q", "-m", "local"]);
  check(ingestGitSync({ root: ahead.candidate, git: realGit }).status === "local-ahead", "local-aheadを成功分類");

  const fast = fixture("fast-forward-dirty");
  remoteCommit(fast, "remote.txt");
  git(fast.candidate, ["config", "--unset", "branch.main.remote"], true);
  git(fast.candidate, ["config", "--unset", "branch.main.merge"], true);
  git(fast.candidate, ["config", "--local", "pull.rebase", "true"]);
  git(fast.candidate, ["config", "--local", "pull.ff", "false"]);
  writeFileSync(join(fast.candidate, "base.txt"), "tracked dirty\n");
  writeFileSync(join(fast.candidate, "staged.txt"), "staged\n"); git(fast.candidate, ["add", "staged.txt"]);
  writeFileSync(join(fast.candidate, "untracked.txt"), "untracked\n");
  const beforeStatus = git(fast.candidate, ["status", "--porcelain=v1", "-z", "--", "base.txt", "staged.txt", "untracked.txt"]).stdout;
  const beforeIndex = git(fast.candidate, ["ls-files", "--stage", "--", "staged.txt"]).stdout;
  const beforeConfig = git(fast.candidate, ["config", "--local", "--list"]).stdout;
  const beforePolicy = ["--local", "--global"].flatMap((scope) => ["pull.rebase", "pull.ff"].map((key) => git(fast.candidate, ["config", scope, "--get", key]).stdout.trim()));
  const beforeUpstream = git(fast.candidate, ["config", "--local", "--get-regexp", "^branch\\.main\\.(remote|merge)$"], true).stdout;
  const fastLog = [];
  const fastResult = ingestGitSync({ root: fast.candidate, git: realGit, runner: capturedRunner(fastLog) });
  check(fastResult.status === "fast-forwarded" && fastResult.after === git(fast.candidate, ["rev-parse", "FETCH_HEAD^{commit}"]).stdout.trim(), "非競合dirtyのままfast-forward");
  check(beforeStatus === git(fast.candidate, ["status", "--porcelain=v1", "-z", "--", "base.txt", "staged.txt", "untracked.txt"]).stdout && beforeIndex === git(fast.candidate, ["ls-files", "--stage", "--", "staged.txt"]).stdout, "tracked/untracked/staged差分とindexを保持");
  const afterPolicy = ["--local", "--global"].flatMap((scope) => ["pull.rebase", "pull.ff"].map((key) => git(fast.candidate, ["config", scope, "--get", key]).stdout.trim()));
  const afterUpstream = git(fast.candidate, ["config", "--local", "--get-regexp", "^branch\\.main\\.(remote|merge)$"], true).stdout;
  check(beforeConfig === git(fast.candidate, ["config", "--local", "--list"]).stdout && beforePolicy.join() === "true,false,true,false" && afterPolicy.join() === beforePolicy.join() && beforeUpstream === "" && afterUpstream === beforeUpstream, "相反するlocal/global pull設定とupstream未設定を変更しない");
  const pulls = fastLog.filter(([command]) => command === "pull");
  check(pulls.length === 1 && pulls[0].join(" ") === "pull --ff-only --no-rebase origin refs/heads/main", "upstream非依存の明示remote/ref pull");

  const conflict = fixture("dirty-conflict");
  git(conflict.seed, ["mv", "rename-old.txt", "rename-new.txt"]); writeFileSync(join(conflict.seed, "日本語.txt"), "remote\n"); git(conflict.seed, ["commit", "-qam", "remote rename"]); git(conflict.seed, ["push", "-q", "origin", "main"]);
  writeFileSync(join(conflict.candidate, "rename-old.txt"), "dirty\n"); writeFileSync(join(conflict.candidate, "日本語.txt"), "dirty\n");
  const conflictBefore = repositorySnapshot(conflict.candidate);
  const conflictLog = [];
  const conflictError = errorOf(() => ingestGitSync({ root: conflict.candidate, git: realGit, runner: capturedRunner(conflictLog) }));
  check(conflictError?.code === "dirty-conflict" && conflictError.conflictPaths.includes("rename-old.txt") && conflictError.conflictPaths.includes("日本語.txt")
    && repositorySnapshot(conflict.candidate).join("\0") === conflictBefore.join("\0") && conflictLog.filter(([command]) => command === "fetch").length === 1
    && !conflictLog.some(([command]) => command === "pull"), "dirty衝突はfetch後にHEAD/status/index不変・pull 0でNUL-safe停止");

  const diverged = fixture("diverged");
  writeFileSync(join(diverged.candidate, "local.txt"), "local\n"); git(diverged.candidate, ["add", "local.txt"]); git(diverged.candidate, ["commit", "-q", "-m", "local"]); remoteCommit(diverged, "remote.txt");
  const divergedBefore = repositorySnapshot(diverged.candidate);
  const divergedLog = [];
  const divergedError = errorOf(() => ingestGitSync({ root: diverged.candidate, git: realGit, runner: capturedRunner(divergedLog) }));
  check(divergedError?.code === "diverged" && repositorySnapshot(diverged.candidate).join("\0") === divergedBefore.join("\0")
    && divergedLog.filter(([command]) => command === "fetch").length === 1
    && !divergedLog.some(([command]) => ["diff", "status", "pull"].includes(command)), "divergedはfetch・祖先判定後にHEAD/status/index不変、diff/status/pull 0で停止");

  const branches = fixture("branch-cases");
  check(errorOf(() => ingestGitSync({ root: branches.candidate, branch: "other", git: realGit }))?.code === "branch-mismatch", "branch切替をbranch-mismatchで停止");
  git(branches.candidate, ["checkout", "--detach", "-q"]);
  check(errorOf(() => ingestGitSync({ root: branches.candidate, git: realGit }))?.code === "detached-head", "symbolic-ref終了1だけdetached-head");

  const missing = fixture("missing");
  const missingRemote = errorOf(() => ingestGitSync({ root: missing.candidate, remote: "absent", git: realGit }));
  check(missingRemote?.code === "remote-missing", "remote欠落を分類");
  const unsafeRemote = errorOf(() => ingestGitSync({ root: missing.candidate, remote: "https://synthetic-user:synthetic-password@example.invalid/repo?credential=SYNTHETIC_MARKER", git: realGit }));
  check(unsafeRemote?.code === "inspect-failed" && unsafeRemote.reason === "invalid-remote" && !/synthetic|example|credential/i.test(safePayload(unsafeRemote)), "URL・userinfo・query形式remoteをpayloadへ残さず拒否");
  const missingBranch = errorOf(() => ingestGitSync({ root: missing.candidate, branch: "absent", git: realGit }));
  check(missingBranch?.code === "branch-mismatch", "現在branch不一致をfetchより前に停止");

  const fault = fixture("faults"); remoteCommit(fault, "remote.txt");
  const rootBefore = repositorySnapshot(fault.candidate);
  const syncRootLog = [];
  const asyncRootLog = [];
  const rootIntercept = (argv) => argv.join(" ") === "rev-parse --show-toplevel" ? { status: 0, stdout: `${fault.seed}\n`, stderr: "" } : null;
  const rootMismatch = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner(syncRootLog, rootIntercept) }));
  const asyncRootMismatch = await asyncErrorOf(() => ingestGit({ root: fault.candidate, git: realGit, runner: capturedRunner(asyncRootLog, rootIntercept) }));
  check(rootMismatch?.code === "ingest-root-mismatch" && asyncRootMismatch?.code === "ingest-root-mismatch" && repositorySnapshot(fault.candidate).join("\0") === rootBefore.join("\0")
    && [syncRootLog, asyncRootLog].every((log) => log.length === 1 && log[0].join(" ") === "rev-parse --show-toplevel")
    && !safePayload(rootMismatch).includes(fault.root) && !safePayload(asyncRootMismatch).includes(fault.root), "sync/async root不一致はHEAD/status/index不変、symbolic-ref/remote/fetch/pull前で停止し絶対path非表示");
  const inspect = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => argv[0] === "symbolic-ref" ? { status: 2, stdout: "", stderr: "secret raw" } : null) }));
  check(inspect?.code === "inspect-failed", "symbolic-ref予期しない非0をinspect-failed");
  const fetchMissing = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => argv[0] === "fetch" ? { status: 128, stdout: "", stderr: "fatal: couldn't find remote ref; https://user:pass@example.invalid/x?token=secret" } : null) }));
  check(fetchMissing?.code === "fetch-failed" && fetchMissing.reason === "branch-missing" && !/example|pass|secret/.test(safePayload(fetchMissing)), "remote branch欠落をsanitized fetch-failed");
  const fetchFailed = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => argv[0] === "fetch" ? { status: 128, stdout: "", stderr: "network unavailable https://user:pass@example.invalid/?secret=yes" } : null) }));
  check(fetchFailed?.code === "fetch-failed" && fetchFailed.reason === "fetch-failed" && !/example|pass|secret/.test(safePayload(fetchFailed)), "一般fetch失敗もraw stderrなしで停止");
  const timed = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => { if (argv[0] === "fetch") throw Object.assign(new Error("raw secret"), { code: "timeout" }); return null; }) }));
  check(timed?.code === "timeout", "Git hangをtimeout分類し後続停止");
  const mergeInspect = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => argv[0] === "merge-base" ? { status: 2, stdout: "", stderr: "raw" } : null) }));
  check(mergeInspect?.code === "inspect-failed", "merge-base終了1とinspect errorを区別");
  const pullFailure = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => argv[0] === "pull" ? { status: 1, stdout: "", stderr: "URL secret" } : null) }));
  check(pullFailure?.code === "fast-forward-failed" && pullFailure.reason === "pull-failed", "pull最終防衛失敗を分類");
  const copyConflict = errorOf(() => ingestGitSync({ root: fault.candidate, git: realGit, runner: capturedRunner([], (argv) => {
    if (argv[0] === "diff") return { status: 0, stdout: "remote.txt\0remote-copy.txt\0", stderr: "" };
    if (argv[0] === "status") return { status: 0, stdout: "C  remote-copy.txt\0remote.txt\0", stderr: "" };
    return null;
  }) }));
  check(copyConflict?.code === "dirty-conflict" && copyConflict.conflictPaths.join() === "remote-copy.txt,remote.txt", "copy statusの旧新pathを両方parse");
  let postFetchReads = 0;
  const post = fixture("postcondition"); remoteCommit(post, "remote.txt");
  const postError = errorOf(() => ingestGitSync({ root: post.candidate, git: realGit, runner: capturedRunner([], (argv) => {
    if (argv.join(" ") === "rev-parse FETCH_HEAD^{commit}" && ++postFetchReads === 2) return { status: 0, stdout: `${"0".repeat(40)}\n`, stderr: "" };
    return null;
  }) }));
  check(postError?.code === "fast-forward-failed" && postError.reason === "postcondition-mismatch", "pull後HEADと実際のFETCH_HEAD不一致を停止");

  const race = fixture("race"); remoteCommit(race, "first.txt"); let advanced = false;
  const raceResult = ingestGitSync({ root: race.candidate, git: realGit, runner: capturedRunner([], (argv) => {
    if (argv[0] === "pull" && !advanced) { advanced = true; remoteCommit(race, "second.txt"); }
    return null;
  }) });
  check(raceResult.status === "fast-forwarded" && raceResult.targetAdvanced === true && existsSync(join(race.candidate, "second.txt")), "fetch/pull競合窓で実際のpostconditionとtarget進行を報告");

  const timing = resolveRunDiscoveryTiming({ env: {} });
  const invalidTiming = resolveRunDiscoveryTiming({ discoveryTimeoutMs: "bad", pollIntervalMs: 0, pollMaxIntervalMs: Infinity, env: { YASASHII_RUN_DISCOVERY_TIMEOUT_MS: "999", YASASHII_RUN_POLL_MS: "999", YASASHII_RUN_POLL_MAX_MS: "999" } });
  check(timing.discoveryTimeoutMs === 60_000 && timing.pollIntervalMs === 250 && timing.pollMaxIntervalMs === 2_000 && invalidTiming.discoveryTimeoutMs === 60_000 && invalidTiming.pollIntervalMs === 250, "run発見timeout/pollの優先順位と無効値fallback");
  let clock = 10_000; const waits = []; let lists = 0;
  const actionsRunner = async (_binary, argv) => {
    if (argv.join(" ") === "branch --show-current") return { status: 0, stdout: "main\n", stderr: "" };
    if (argv[0] === "workflow") return { status: 0, stdout: "", stderr: "" };
    if (argv[0] === "run" && argv[1] === "list") {
      lists += 1;
      const current = lists > 6 ? [{ databaseId: 77, createdAt: new Date(10_000).toISOString(), headBranch: "main", workflowName: "Fixture", displayTitle: "Fixture [12345678]" }] : [{ databaseId: 1, createdAt: new Date(1_000).toISOString(), headBranch: "main", workflowName: "Fixture", displayTitle: "Fixture [oldold00]" }];
      return { status: 0, stdout: JSON.stringify(current), stderr: "" };
    }
    throw new Error(`unexpected ${argv.join(" ")}`);
  };
  const foundRun = await dispatchCorrelatedWorkflow({ root: work, workflowFile: "fixture.yml", workflowName: "Fixture", correlationId: "12345678", discoveryTimeoutMs: 10_000, pollIntervalMs: 250, pollMaxIntervalMs: 2_000, now: () => clock, wait: async (ms) => { waits.push(ms); clock += ms; }, runner: actionsRunner });
  check(foundRun.runId === "77" && waits.join() === "250,500,1000,2000,2000", "5秒超でも古いrunを拒否し指数backoff上限内で今回runを採用", waits.join());
  let timeoutClock = 0;
  const timeoutError = await (async () => { try { await dispatchCorrelatedWorkflow({ root: work, workflowFile: "fixture.yml", workflowName: "Fixture", correlationId: "timeout01", discoveryTimeoutMs: 1_000, now: () => timeoutClock, wait: async (ms) => { timeoutClock += ms; }, runner: async (_binary, argv) => argv.join(" ") === "branch --show-current" ? { status: 0, stdout: "main\n", stderr: "" } : argv[0] === "run" ? { status: 0, stdout: "[]", stderr: "" } : { status: 0, stdout: "", stderr: "" } }); } catch (error) { return error; } })();
  check(timeoutError?.code === "run-correlation-unconfirmed" && timeoutClock === 1_000, "1秒CLI overrideはdeadlineでrun未確認停止");

  const watchRun = { runId: "88", branch: "main", workflowFile: "fixture.yml" };
  const workflowCommands = [];
  const conclusion = await (async () => { try { await watchCorrelatedWorkflow({ root: work, run: watchRun, runner: async (_binary, argv) => {
    workflowCommands.push(argv.join(" "));
    if (argv[1] === "watch") throw Object.assign(new Error("failed"), { code: 1, stderr: "watch failed" });
    if (argv.includes("--json")) return { status: 0, stdout: '{"status":"completed","conclusion":"failure"}', stderr: "" };
    return { status: 0, stdout: "HTTP 403 forbidden\n失敗種別: network\nSYNTHETIC_SECRET https://example.invalid/private?token=value /private/fixture/path", stderr: "" };
  } }); } catch (error) { return error; } })();
  const conclusionPayload = safePayload(conclusion);
  check(conclusion.code === "workflow-conclusion-failure" && conclusion.stage === "actions-run" && conclusion.reason === "service-network"
    && workflowCommands.filter((value) => value.includes("--json")).length === 1 && workflowCommands.filter((value) => value.includes("--log-failed")).length === 1
    && !/SYNTHETIC_SECRET|example\.invalid|private\/fixture|stdout|stderr/.test(conclusionPayload), "実gh同様のJSON conclusion後にlogを1回だけ読み、workflow reasonだけをraw非保持で分類");
  const ghFailures = [
    [Object.assign(new Error("timeout"), { code: "timeout", killed: true }), "actions-run-timeout"],
    [Object.assign(new Error("killed"), { killed: true }), "actions-run-killed"],
    [Object.assign(new Error("auth"), { stderr: "HTTP 401 bad credentials" }), "actions-run-auth"],
    [Object.assign(new Error("transport"), { code: "ENETUNREACH" }), "actions-run-transport"],
  ];
  for (const [source, expected] of ghFailures) {
    const observed = await (async () => { try { await watchCorrelatedWorkflow({ root: work, run: watchRun, runner: async (_binary, argv) => { if (argv[1] === "watch") throw source; return { status: 0, stdout: "{}", stderr: "" }; } }); } catch (error) { return error; } })();
    check(observed.code === expected && observed.stage === "actions-run", `gh失敗を${expected}へsanitized分類`);
  }
  let nonConclusionLogCalls = 0;
  const viewAuth = await (async () => { try { await watchCorrelatedWorkflow({ root: work, run: watchRun, runner: async (_binary, argv) => {
    if (argv[1] === "watch") throw Object.assign(new Error("failed"), { code: 1 });
    if (argv.includes("--log-failed")) nonConclusionLogCalls += 1;
    return { status: 0, stdout: '{"status":"in_progress","conclusion":null}', stderr: "HTTP 403 forbidden" };
  } }); } catch (error) { return error; } })();
  check(viewAuth.code === "actions-run-auth" && nonConclusionLogCalls === 0, "watch/JSON viewの診断だけをgh分類へ使い未確定workflow logを読まない");
  const branchError = await (async () => { try { await dispatchCorrelatedWorkflow({ root: work, workflowFile: "fixture.yml", workflowName: "Fixture", correlationId: "branch001", runner: async (_binary, argv) => argv[0] === "branch" ? { status: 0, stdout: "", stderr: "" } : { status: 0, stdout: "[]", stderr: "" } }); } catch (error) { return error; } })();
  check(branchError.code === "branch-unconfirmed" && branchError.stage === "dispatch" && branchError.actionsStarted === false, "branch未確認はdispatch前・Actions未開始");

  const paths = [
    "plugins/secretary/skills/chatwork/scripts/wizard-server.mjs",
    "plugins/secretary/skills/chatwork/scripts/search-flow.mjs",
    "plugins/secretary/skills/google-chat/scripts/search.mjs",
    "plugins/secretary/skills/google-chat/scripts/search-flow.mjs",
    "plugins/secretary/skills/google-chat/scripts/actions-discovery.mjs",
  ];
  const sources = paths.map((path) => readFileSync(join(repo, path), "utf8"));
  check(sources.every((source) => source.includes("git-ingest.mjs")) && sources[0].split("ingestGit({").length - 1 === 2, "6 callsiteが共通helperへwiring");
  check(!sources.join("\n").includes('["pull", "--ff-only", "--no-rebase"]'), "6 callsiteの未分類直接pullは0件");
  const ui = readFileSync(join(repo, "plugins/secretary/skills/chatwork/assets/wizard/app.js"), "utf8");
  check(["discover-failure", "settings-result-failure", "initial-result-failure", "stageFailure", "workflow-conclusion-failure", "この端末への取り込みだけ失敗", "現在の状態を直ちに修復するcommandではありません"].every((value) => ui.includes(value)), "Chatwork 3失敗画面だけにstage別回復案内");
  const runTime = "2026-09-04T12:00:00.000Z";
  check(!isCurrentSyncResult(null, { createdAt: runTime }) && !isCurrentSyncResult({ status: "success", attemptedAt: "2026-09-04T11:59:59.000Z", results: [] }, { createdAt: runTime }) && isCurrentSyncResult({ status: "success", attemptedAt: runTime, results: [] }, { createdAt: runTime }), "初回・設定変更の欠落／古いsync結果をresult-missing条件にする");
  check(sources[0].includes("isCurrentSyncResult(sync, run, previousSync)") && sources[0].includes('stage: "result-missing"'), "runSync共有経路が初回・設定変更のcurrent sync postconditionを適用");
  const css = readFileSync(join(repo, "plugins/secretary/skills/chatwork/assets/wizard/style.css"), "utf8");
  check(ui.includes('<pre class="failure-command">') && css.includes(".failure-command") && css.includes("white-space: pre-wrap") && css.includes("overflow-wrap: anywhere"), "Chatwork 3失敗画面の長い手動commandをmobile幅内で折り返す");

  const forbidden = new Set(["merge", "rebase", "stash", "reset", "restore", "commit", "--force", "--set-upstream", "-u"]);
  check(!fastLog.flat().some((token) => forbidden.has(token)) && fastLog.every((argv) => Array.isArray(argv)), "製品Git argvに禁止token 0件（--no-rebase等を誤判定しない）");
} finally {
  rmSync(work, { recursive: true, force: true });
}

process.stdout.write(`SPRINT051_PLATFORM=${process.platform} SPRINT051_PASS=${passed} SPRINT051_FAIL=${failed}\n`);
if (failed) process.exit(1);
