import { realpathSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { resolve, win32 } from "node:path";
import { runExternal, runExternalSync } from "./external-ops.mjs";

const DEFAULT_TIMEOUT_MS = 60_000;
const HASH = /^[0-9a-f]{40,64}$/i;

const messages = {
  "ingest-root-mismatch": "指定された場所とGitリポジトリのrootが一致しません。",
  "detached-head": "現在のGitはbranchを指していません。branchへ切り替えてから再試行してください。",
  "branch-mismatch": "現在のbranchが取り込み対象と一致しません。",
  "remote-missing": "指定されたGit remoteを確認できません。",
  "fetch-failed": "対象branchをremoteから確認できません。",
  timeout: "Gitの取り込みが時間切れになりました。",
  "inspect-failed": "Gitの現在状態を安全に確認できません。",
  diverged: "localとremoteの履歴が分岐しています。手動で解消してから再試行してください。",
  "dirty-conflict": "remoteの変更とlocalの未保存変更が同じpathで競合しています。",
  "fast-forward-failed": "remoteの変更をfast-forwardで取り込めませんでした。",
};

export class GitIngestError extends Error {
  constructor(code, { remote, branch, expectedBranch, reason, conflictPaths } = {}) {
    super(messages[code] || messages["inspect-failed"]);
    this.name = "GitIngestError";
    this.code = code;
    this.stage = "git-ingest";
    if (remote) this.remote = remote;
    if (branch) this.branch = branch;
    if (expectedBranch) this.expectedBranch = expectedBranch;
    if (reason) this.reason = reason;
    if (conflictPaths?.length) this.conflictPaths = [...new Set(conflictPaths)].sort();
  }

  toJSON() {
    return Object.fromEntries(["code", "stage", "remote", "branch", "expectedBranch", "reason", "conflictPaths"]
      .filter((key) => this[key] !== undefined)
      .map((key) => [key, this[key]]));
  }
}

function positive(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveGitIngestTimeout(value, envValue = process.env.YASASHII_CLI_TIMEOUT_MS) {
  if (value !== undefined) return positive(value);
  if (envValue !== undefined) return positive(envValue);
  return DEFAULT_TIMEOUT_MS;
}

function safeToken(value, kind) {
  const token = String(value || "");
  const safeRemote = kind !== "remote" || (/^[A-Za-z0-9_-](?:[A-Za-z0-9._/-]{0,126}[A-Za-z0-9_-])?$/.test(token)
    && !token.includes("..") && !token.includes("//") && !token.includes("@{") && !token.endsWith(".lock"));
  const valid = token && !token.startsWith("-") && !/[\0\r\n]/.test(token)
    && safeRemote
    && (kind !== "branch" || (!token.includes("..") && !token.includes("@{") && !/[~^:?*[\\]/.test(token) && !token.endsWith(".") && !token.endsWith("/")));
  if (!valid) throw new GitIngestError("inspect-failed", { reason: `invalid-${kind}` });
  return token;
}

function windowsPath(path) {
  const normalized = String(path).replaceAll("/", "\\");
  if (/^\\\\\?\\UNC\\/i.test(normalized)) return `\\\\${normalized.slice(8)}`;
  if (/^\\\\\?\\[A-Za-z]:\\/.test(normalized)) return normalized.slice(4);
  return normalized;
}

function canonical(path, platform = process.platform) {
  const absolute = platform === "win32" ? win32.resolve(windowsPath(path)) : resolve(path);
  const normalized = absolute.replaceAll("\\", "/").replace(/\/+$/, "") || "/";
  return platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized;
}

export function samePhysicalRoot(left, right, platform = process.platform) {
  return canonical(left, platform) === canonical(right, platform);
}

function safeRelativePath(path) {
  const value = String(path || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!value || value.startsWith("/") || value === ".." || value.startsWith("../") || /\0/.test(value)) return null;
  return value;
}

function nulPaths(output) {
  return String(output || "").split("\0").map(safeRelativePath).filter(Boolean);
}

function porcelainPaths(output) {
  const fields = String(output || "").split("\0");
  const paths = [];
  for (let index = 0; index < fields.length;) {
    const field = fields[index++];
    if (!field) continue;
    if (field.length < 4 || field[2] !== " ") throw new GitIngestError("inspect-failed", { reason: "status-parse-failed" });
    const status = field.slice(0, 2);
    const first = safeRelativePath(field.slice(3));
    if (!first) throw new GitIngestError("inspect-failed", { reason: "status-path-invalid" });
    paths.push(first);
    if (/[RC]/.test(status)) {
      const second = safeRelativePath(fields[index++]);
      if (!second) throw new GitIngestError("inspect-failed", { reason: "status-rename-parse-failed" });
      paths.push(second);
    }
  }
  return paths;
}

function resultStatus(result, accepted, context, details = {}) {
  if (!accepted.includes(result?.status)) throw new GitIngestError("inspect-failed", { ...details, reason: `${context}-command-failed` });
  return result;
}

function hash(result, context, details) {
  resultStatus(result, [0], context, details);
  const value = String(result.stdout || "").trim();
  if (!HASH.test(value)) throw new GitIngestError("inspect-failed", { ...details, reason: `${context}-parse-failed` });
  return value;
}

function branchMissing(result) {
  const text = `${result?.stdout || ""}\n${result?.stderr || ""}`.toLowerCase();
  return /couldn.t find remote ref|remote ref does not exist|not our ref/.test(text);
}

function* ingestPlan({ remote, expectedBranch }) {
  const base = { remote, ...(expectedBranch ? { branch: expectedBranch } : {}) };
  const rootResult = yield ["rev-parse", "--show-toplevel"];
  resultStatus(rootResult, [0], "root", base);
  const gitRoot = String(rootResult.stdout || "").trim();
  if (!gitRoot) throw new GitIngestError("inspect-failed", { ...base, reason: "root-parse-failed" });

  const branchResult = yield ["symbolic-ref", "--quiet", "--short", "HEAD"];
  if (branchResult.status === 1) throw new GitIngestError("detached-head", base);
  resultStatus(branchResult, [0], "branch", base);
  const currentBranch = String(branchResult.stdout || "").trim();
  if (!currentBranch || /[\0\r\n]/.test(currentBranch)) throw new GitIngestError("inspect-failed", { ...base, reason: "branch-parse-failed" });
  const branch = expectedBranch || currentBranch;
  if (currentBranch !== branch) throw new GitIngestError("branch-mismatch", { remote, branch: currentBranch, expectedBranch: branch, reason: "current-branch-mismatch" });
  const details = { remote, branch };

  const remoteResult = yield ["remote", "get-url", remote];
  if (remoteResult.status !== 0 || !String(remoteResult.stdout || "").trim()) throw new GitIngestError("remote-missing", { ...details, reason: "remote-unavailable" });

  const ref = `refs/heads/${branch}`;
  const fetchResult = yield ["fetch", remote, ref];
  if (fetchResult.status !== 0) throw new GitIngestError("fetch-failed", { ...details, reason: branchMissing(fetchResult) ? "branch-missing" : "fetch-failed" });

  const before = hash(yield ["rev-parse", "HEAD"], "head", details);
  const inspectedTarget = hash(yield ["rev-parse", "FETCH_HEAD^{commit}"], "fetch-head", details);
  if (before === inspectedTarget) return { status: "up-to-date", remote, branch, before, after: before, targetAdvanced: false };

  const headAncestor = yield ["merge-base", "--is-ancestor", "HEAD", "FETCH_HEAD^{commit}"];
  resultStatus(headAncestor, [0, 1], "head-ancestor", details);
  const targetAncestor = yield ["merge-base", "--is-ancestor", "FETCH_HEAD^{commit}", "HEAD"];
  resultStatus(targetAncestor, [0, 1], "target-ancestor", details);
  if (targetAncestor.status === 0) return { status: "local-ahead", remote, branch, before, after: before, targetAdvanced: false };
  if (headAncestor.status !== 0) throw new GitIngestError("diverged", { ...details, reason: "history-diverged" });

  // --no-renames ensures a rename is represented by both the deleted and added path.
  const remotePathsResult = yield ["diff", "--name-only", "-z", "--no-renames", "HEAD", "FETCH_HEAD^{commit}"];
  resultStatus(remotePathsResult, [0], "diff", details);
  const dirtyResult = yield ["status", "--porcelain=v1", "-z", "--untracked-files=all"];
  resultStatus(dirtyResult, [0], "status", details);
  const remotePaths = new Set(nulPaths(remotePathsResult.stdout));
  const conflicts = porcelainPaths(dirtyResult.stdout).filter((path) => remotePaths.has(path));
  if (conflicts.length) throw new GitIngestError("dirty-conflict", { ...details, reason: "dirty-overlap", conflictPaths: conflicts });

  const pullResult = yield ["pull", "--ff-only", "--no-rebase", remote, ref];
  if (pullResult.status !== 0) throw new GitIngestError("fast-forward-failed", { ...details, reason: "pull-failed" });
  const after = hash(yield ["rev-parse", "HEAD"], "post-head", details);
  const observedTarget = hash(yield ["rev-parse", "FETCH_HEAD^{commit}"], "post-fetch-head", details);
  if (after !== observedTarget) throw new GitIngestError("fast-forward-failed", { ...details, reason: "postcondition-mismatch" });
  return { status: "fast-forwarded", remote, branch, before, after, targetAdvanced: inspectedTarget !== observedTarget };
}

function mapCommandError(error, argv, details) {
  if (error?.code === "timeout") return new GitIngestError("timeout", { ...details, reason: "command-timeout" });
  const command = argv[0];
  if (command === "fetch") return new GitIngestError("fetch-failed", { ...details, reason: "fetch-failed" });
  if (command === "pull") return new GitIngestError("fast-forward-failed", { ...details, reason: "pull-failed" });
  return new GitIngestError("inspect-failed", { ...details, reason: `${command}-command-failed` });
}

async function physicalRoot(path) {
  try { return await realpath(path); } catch { return resolve(path); }
}

function physicalRootSync(path) {
  try { return realpathSync.native(path); } catch { return resolve(path); }
}

async function driveAsync(plan, options) {
  let next = plan.next();
  while (!next.done) {
    const argv = next.value;
    let result;
    try { result = await options.runner(options.git, argv, { cwd: options.root, timeoutMs: options.timeoutMs, label: "Git状態確認", allowFailure: true, shell: false }); }
    catch (error) { throw mapCommandError(error, argv, options.details); }
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel" && result.status === 0) {
      const left = await physicalRoot(options.root);
      const right = await physicalRoot(String(result.stdout || "").trim());
      if (!samePhysicalRoot(left, right)) throw new GitIngestError("ingest-root-mismatch", { reason: "root-mismatch" });
    }
    next = plan.next(result);
  }
  return next.value;
}

function driveSync(plan, options) {
  let next = plan.next();
  while (!next.done) {
    const argv = next.value;
    let result;
    try { result = options.runner(options.git, argv, { cwd: options.root, timeoutMs: options.timeoutMs, label: "Git状態確認", allowFailure: true, shell: false }); }
    catch (error) { throw mapCommandError(error, argv, options.details); }
    if (argv[0] === "rev-parse" && argv[1] === "--show-toplevel" && result.status === 0) {
      const left = physicalRootSync(options.root);
      const right = physicalRootSync(String(result.stdout || "").trim());
      if (!samePhysicalRoot(left, right)) throw new GitIngestError("ingest-root-mismatch", { reason: "root-mismatch" });
    }
    next = plan.next(result);
  }
  return next.value;
}

function options(input = {}) {
  const root = resolve(input.root || process.cwd());
  const remote = safeToken(input.remote || "origin", "remote");
  const expectedBranch = input.branch === undefined ? undefined : safeToken(input.branch, "branch");
  return {
    root,
    remote,
    expectedBranch,
    git: input.git || process.env.YASASHII_GIT_BIN || "git",
    timeoutMs: resolveGitIngestTimeout(input.timeoutMs),
    details: { remote, ...(expectedBranch ? { branch: expectedBranch } : {}) },
  };
}

export async function ingestGit(input = {}) {
  const configured = options(input);
  return driveAsync(ingestPlan(configured), { ...configured, runner: input.runner || runExternal });
}

export function ingestGitSync(input = {}) {
  const configured = options(input);
  return driveSync(ingestPlan(configured), { ...configured, runner: input.runner || runExternalSync });
}
