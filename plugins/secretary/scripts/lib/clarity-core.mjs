import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { copyTreeNoFollow, removeSafe, safeDeletePath, safeWritePath, writeFileAtomicSafe } from "./safe-fs.mjs";
import { runExternalSync } from "./external-ops.mjs";
import {
  refreshClarityRootAfterOwnedReplacement,
  resolveClarityRoot,
  revalidateClarityRoot,
  withClarityRootObservation,
} from "./clarity-root.mjs";
import { scanHarnessAuthoritative } from "./clarity-harness-scan.mjs";

export const CLARITY_SCHEMA_VERSION = 2;
export const CLARITY_MIN_SCHEMA_VERSION = 1;
export const CLARITY_LIMITS = Object.freeze({
  maxEntries: 500,
  maxFiles: 200,
  maxReadBytes: 2 * 1024 * 1024,
  maxFileBytes: 256 * 1024,
  maxCandidates: 24,
  maxReportRows: 80,
});

const decisionStatuses = new Set(["unknown", "exploring", "proposed", "confirmed", "rejected", "superseded"]);
const executionStatuses = new Set(["unknown", "not_started", "in_progress", "implemented", "verified", "operational", "rolled_back"]);
const validationStatuses = new Set(["unknown", "pending", "passed", "failed", "waived"]);
const alignmentStatuses = new Set(["unknown", "aligned", "possible_drift", "drift", "not_applicable"]);
const dispositions = new Set(["required", "candidate", "idea", "deferred", "rejected"]);
const modes = new Set(["standalone", "secretary-local", "linked-external", "portfolio"]);
const eventTypes = new Set([
  "item.discovered",
  "decision.pending",
  "decision.proposed",
  "decision.confirmed",
  "decision.rejected",
  "decision.superseded",
  "execution.changed",
  "validation.changed",
  "alignment.changed",
  "disposition.changed",
  "evidence.linked",
  "checkpoint.recorded",
  "attention.resolved",
  "attention.override",
  "link.accepted",
  "link.finalized",
  "link.disabled",
  "sync.applied",
  "sync.conflict.detected",
  "sync.conflict.resolved",
  "drift.waiver.recorded",
]);
const evidenceTypes = new Set([
  "user-confirmation", "project-decision", "adr", "spec-section", "meeting-reference",
  "git-commit", "git-diff", "pull-request", "test-run", "deployment", "file-reference",
  "task-reference", "xmind-proposal", "agent-observation",
]);

const excludedDirectories = new Set([
  ".git", ".clarity", "node_modules", "vendor", "dist", "build", "coverage", ".next", ".cache",
]);
const binaryExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".tar", ".7z",
  ".mp3", ".mp4", ".mov", ".avi", ".woff", ".woff2", ".ttf", ".class", ".jar", ".dylib", ".so", ".exe",
]);
const sensitiveNamePattern = /(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_[a-z0-9_-]+|.*(?:credential|secret|private[-_]?key|oauth|token).*)$/iu;
const secretValuePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /(?:password|api[_-]?key|api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential)\s*[:=]\s*[^\s,;]+/iu,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@[^/\s]+/iu,
];

const quadrantMeta = Object.freeze({
  stabilize: { label: "定着・検証", meaning: "安定している", emoji: "🟢", color: "#16A34A", position: "左上" },
  execute: { label: "実行待ち", meaning: "あとは進めるだけ", emoji: "🔵", color: "#2563EB", position: "右上" },
  validate: { label: "暫定実装・要再確認", meaning: "注意して確認する", emoji: "🟡", color: "#D97706", position: "左下" },
  decide: { label: "設計・意思決定", meaning: "人間の判断が必要", emoji: "🔴", color: "#DC2626", position: "右下" },
});

export const ATTENTION_STALENESS_DAYS = Object.freeze({ validationPending: 14, undecided: 30 });
export const ATTENTION_LEVELS = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1, none: 0 });
export const ATTENTION_REASONS = Object.freeze({
  implemented_without_confirmed_decision: { level: "high", label: "実装済みですが、確認済みの決定がありません" },
  confirmed_but_not_executed: { level: "medium", label: "決定済みですが、実行が開始されていません" },
  decision_implementation_drift: { level: "critical", label: "決定内容と現在の実装が一致しません" },
  possible_drift: { level: "high", label: "決定と実装に差がある可能性があります" },
  validation_failed: { level: "critical", label: "検証に失敗しています" },
  validation_pending_too_long: { level: "high", label: "実装後の確認が長期間行われていません" },
  undecided_stale: { level: "medium", label: "未決定のまま長期間滞留しています" },
  authority_conflict: { level: "critical", label: "2つの正本が異なる内容を主張しています" },
  sync_conflict: { level: "high", label: "接続先Repoとの同期結果が競合しています" },
  missing_evidence: { level: "medium", label: "状態を裏付ける根拠が不足しています" },
  dependency_blocked: { level: "medium", label: "依存項目が未解決です" },
  decision_owner_missing: { level: "medium", label: "誰が決めるか未設定です" },
  source_unreachable: { level: "low", label: "参照先を確認できません" },
});

export class ClarityError extends Error {
  constructor(code, message, exitCode = 3, details = {}) {
    super(message);
    this.name = "ClarityError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

function fail(condition, code, message, details = {}) {
  if (!condition) throw new ClarityError(code, message, 3, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix, value) {
  return `${prefix}_${sha256(String(value)).slice(0, 20)}`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function nowIso() {
  const injected = process.env.CLARITY_NOW || process.env.CC_SECRETARY_NOW;
  if (!injected) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(injected)) return `${injected}T00:00:00.000Z`;
  const parsed = new Date(injected);
  fail(!Number.isNaN(parsed.valueOf()), "time-invalid", "CLARITY_NOW／CC_SECRETARY_NOWはISO 8601形式で指定してください。");
  return parsed.toISOString();
}

const CANONICAL_LOCK_REL = ".clarity/lock.json";
const CANONICAL_LOCK_OWNER = "agentic-secretary:clarity";
const CANONICAL_LOCK_TTL_MS = 30_000;
const CANONICAL_LOCK_WAIT_MS = 15_000;

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function lockRecord(token) {
  const acquiredAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    owner: CANONICAL_LOCK_OWNER,
    kind: "canonical-write",
    token,
    acquiredAt,
    expiresAt: new Date(Date.parse(acquiredAt) + CANONICAL_LOCK_TTL_MS).toISOString(),
  };
}

function readOwnedLock(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const record = JSON.parse(readFileSync(path, "utf8"));
    return record?.owner === CANONICAL_LOCK_OWNER && record?.kind === "canonical-write" ? record : null;
  } catch { return null; }
}

function removeOwnedStaleLock(root, path, clock = Date.now()) {
  const record = readOwnedLock(path);
  if (!record || Number.isNaN(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) > clock) return false;
  const checked = safeDeletePath(root, CANONICAL_LOCK_REL);
  const current = readOwnedLock(checked);
  if (!current || current.token !== record.token || current.expiresAt !== record.expiresAt) return false;
  rmSync(checked);
  return true;
}

function withCanonicalWriteLock(rootValue, callback) {
  const root = rootPath(rootValue);
  const path = safeWritePath(root, CANONICAL_LOCK_REL);
  const token = sha256(`${process.pid}:${Date.now()}:${Math.random()}`);
  const started = Date.now();
  let acquired = false;
  while (!acquired) {
    let descriptor = null;
    try {
      const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
      descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
      const descriptorStat = fstatSync(descriptor);
      fail(descriptorStat.isFile(), "canonical-lock-unsafe", "Clarity canonical lockを通常fileとして作成できません。");
      writeFileSync(descriptor, stableJson(lockRecord(token)), "utf8");
      acquired = true;
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      if (error?.code !== "EEXIST") throw error;
      let stat;
      try { stat = lstatSync(path); }
      catch (statError) { if (statError?.code === "ENOENT") continue; throw statError; }
      fail(stat.isFile() && !stat.isSymbolicLink(), "canonical-lock-unsafe", "Clarity canonical lock pathが安全ではありません。");
      if (removeOwnedStaleLock(root, path)) continue;
      if (Date.now() - started >= CANONICAL_LOCK_WAIT_MS) {
        throw new ClarityError("canonical-lock-busy", "別のClarity書込みが進行中です。変更せず停止しました。", 4, { changed: false, nextAction: "処理完了後に再実行するか、doctorでlock状態を確認してください" });
      }
      sleepSync(10);
    } finally {
      if (descriptor !== null) closeSync(descriptor);
    }
  }
  try {
    return callback(root);
  } finally {
    try {
      const record = readOwnedLock(path);
      if (record?.token === token) rmSync(path);
    } catch { /* doctor／cleanupが残骸を扱う。 */ }
  }
}

function rootPath(value) {
  try {
    const root = resolveClarityRoot(value || ".").root;
    fail(root !== dirname(root), "root-unsafe", "filesystem rootはClarity working rootにできません。");
    return root;
  } catch (error) {
    if (error instanceof ClarityError) throw error;
    const code = error?.code || "root-unsafe";
    const message = error instanceof Error ? error.message : "working rootを安全に確認できません。";
    throw new ClarityError(code, message, 3, { changed: false, ...(error?.details || {}) });
  }
}

function relativePath(root, target) {
  const rel = relative(root, target).split(sep).join("/");
  fail(rel && rel !== "." && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel), "path-outside-root", "working root外のpathは扱えません。");
  return rel;
}

function safeRelative(value, label = "path") {
  const raw = String(value ?? "").split("\\").join("/").replace(/^\.\//u, "");
  fail(raw && !raw.startsWith("/") && !isAbsolute(raw) && raw.split("/").every((part) => part && part !== "." && part !== ".."), "path-invalid", `${label}は安全な相対pathで指定してください。`);
  return raw;
}

function containsSecret(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return secretValuePatterns.some((pattern) => pattern.test(serialized));
}

function oneLine(value, label, max = 240) {
  const normalized = String(value ?? "").trim();
  fail(normalized && !/[\r\n]/u.test(normalized), "value-invalid", `${label}は空でない1行にしてください。`);
  fail(normalized.length <= max, "value-too-long", `${label}は${max}文字以内にしてください。`);
  fail(!containsSecret(normalized), "secret-detected", `${label}にSecretらしき値があるため保存しません。`);
  return normalized;
}

function optionalGit(root, args) {
  try {
    const result = runExternalSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      timeoutMs: 5_000,
      maxBuffer: 2 * 1024 * 1024,
      allowFailure: true,
      label: "Clarity Git read-only inspection",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    });
    return result.status === 0 ? String(result.stdout).trim() : null;
  } catch { return null; }
}

function safeRemoteIdentity(raw) {
  if (!raw) return { status: "missing", repository: null };
  try {
    const normalized = raw.startsWith("git@") ? raw.replace(/^git@([^:]+):/u, "https://$1/") : raw;
    const url = new URL(normalized);
    if (url.username || url.password) return { status: "redacted", repository: null };
    return { status: "available", repository: `${url.hostname}${url.pathname.replace(/\.git$/u, "")}` };
  } catch {
    const scp = raw.match(/^[^@\s]+@([^:\s]+):([^\s]+)$/u);
    return scp ? { status: "available", repository: `${scp[1]}/${scp[2].replace(/\.git$/u, "")}` } : { status: "unparsed", repository: null };
  }
}

function sameFilesystemDirectory(leftPath, rightPath) {
  try {
    const left = statSync(leftPath, { bigint: true });
    const right = statSync(rightPath, { bigint: true });
    if (!left.isDirectory() || !right.isDirectory()) return false;
    // Windows can report the same NTFS directory through 8.3 and long path
    // spellings. dev/ino is the exact filesystem identity and does not weaken
    // the boundary to case-folding or string-prefix matching. If the host does
    // not expose an identity, fail closed instead of guessing from text.
    if ((left.dev === 0n && left.ino === 0n) || (right.dev === 0n && right.ino === 0n)) return false;
    return left.dev === right.dev && left.ino === right.ino;
  } catch {
    return false;
  }
}

function inspectRepoIdentityImpl(rootValue) {
  const root = rootPath(rootValue);
  const top = optionalGit(root, ["rev-parse", "--show-toplevel"]);
  if (!top) {
    return { kind: "non-git", rootName: basename(root), remote: { status: "not-applicable", repository: null }, branch: null, head: null };
  }
  let canonicalTop;
  try { canonicalTop = realpathSync(top); } catch { throw new ClarityError("git-root-unreadable", "Git top-levelを安全に確認できません。"); }
  fail(sameFilesystemDirectory(root, canonicalTop), "git-root-mismatch", "Clarity initはGit top-levelで実行してください。親または子Repoへ書き込みません。", { gitTopLevel: basename(canonicalTop) });
  return {
    kind: "git",
    rootName: basename(root),
    remote: safeRemoteIdentity(optionalGit(root, ["remote", "get-url", "origin"])),
    branch: optionalGit(root, ["symbolic-ref", "--short", "-q", "HEAD"]),
    head: optionalGit(root, ["rev-parse", "--verify", "HEAD"]),
  };
}

function reportRow(report, bucket, row) {
  if (report[bucket].length < CLARITY_LIMITS.maxReportRows) report[bucket].push(row);
  else report.omittedReportRows += 1;
}

function looksBinary(buffer, path) {
  if (binaryExtensions.has(extname(path).toLowerCase())) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

function titleFrom(content, path) {
  const heading = content.match(/^#\s+(.+)$/mu)?.[1]?.trim();
  return (heading || basename(path, extname(path))).slice(0, 120);
}

function classifyCandidate(path, content) {
  const normalized = path.toLowerCase();
  const isAdr = /(?:^|\/)(?:adr|adrs|decisions?)(?:\/|[-_])/u.test(normalized) || /\barchitecture decision record\b/iu.test(content.slice(0, 4096));
  const accepted = /(?:^|\n)\s*(?:status\s*:\s*|#+\s*status\s*\n+\s*)(?:accepted|approved|確定|承認済み)\b/iu.test(content);
  const draft = /(?:^|\n)\s*(?:status\s*:\s*|#+\s*status\s*\n+\s*)(?:draft|proposed|案|下書き)\b/iu.test(content);
  const superseded = /(?:^|\n)\s*(?:status\s*:\s*|#+\s*status\s*\n+\s*)(?:superseded|deprecated|置換済み|廃止)\b/iu.test(content);
  if (isAdr) return { kind: "decision", source: "adr", decisionSource: accepted ? "accepted-canonical" : "adr", decisionStatus: superseded ? "superseded" : accepted ? "confirmed" : draft ? "proposed" : "exploring", humanConfirmed: false };
  if (/(?:^|\/)(?:spec|specs|requirements?|design|docs\/spec)(?:\/|\.|[-_])/u.test(normalized)) return { kind: "specification", source: "spec", decisionStatus: "proposed", humanConfirmed: false };
  if (/^(?:readme|project)\.md$/iu.test(basename(path))) return { kind: "overview", source: "file", decisionStatus: "exploring", humanConfirmed: false };
  if (/^(?:package\.json|pyproject\.toml|cargo\.toml|go\.mod)$/u.test(basename(path).toLowerCase()) || /(?:^|\/)(?:src|app|lib)\//u.test(normalized)) {
    return { kind: "implementation", source: "file", decisionStatus: "unknown", humanConfirmed: false, executionStatus: "implemented" };
  }
  return null;
}

function scanGenericRepository(rootValue) {
  const root = rootPath(rootValue);
  const report = {
    limits: { ...CLARITY_LIMITS },
    entriesSeen: 0,
    filesRead: 0,
    bytesRead: 0,
    truncated: false,
    omittedReportRows: 0,
    inspected: [],
    excluded: [],
    uninspected: [],
    candidates: [],
  };
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en")); }
    catch { reportRow(report, "uninspected", { path: dir === root ? "." : relativePath(root, dir), reason: "directory-unreadable" }); continue; }
    for (const entry of entries) {
      if (report.entriesSeen >= CLARITY_LIMITS.maxEntries || report.filesRead >= CLARITY_LIMITS.maxFiles || report.bytesRead >= CLARITY_LIMITS.maxReadBytes) {
        report.truncated = true;
        reportRow(report, "uninspected", { path: dir === root ? "." : relativePath(root, dir), reason: "scan-limit-reached" });
        queue.length = 0;
        break;
      }
      report.entriesSeen += 1;
      const absolute = join(dir, entry.name);
      const rel = relativePath(root, absolute);
      if (entry.isSymbolicLink()) { reportRow(report, "excluded", { path: rel, reason: "symlink-not-followed" }); continue; }
      if (entry.isDirectory()) {
        if (excludedDirectories.has(entry.name) || entry.name.startsWith(".clarity-init-")) reportRow(report, "excluded", { path: rel, reason: "excluded-directory" });
        else queue.push(absolute);
        continue;
      }
      if (!entry.isFile()) { reportRow(report, "excluded", { path: rel, reason: "non-regular-file" }); continue; }
      if (sensitiveNamePattern.test(rel)) { reportRow(report, "excluded", { path: rel, reason: "sensitive-name" }); continue; }
      let size;
      try { size = statSync(absolute).size; } catch { reportRow(report, "uninspected", { path: rel, reason: "stat-failed" }); continue; }
      if (size > CLARITY_LIMITS.maxFileBytes) { reportRow(report, "excluded", { path: rel, reason: "file-too-large", size }); continue; }
      let bytes;
      try { bytes = readFileSync(absolute); } catch { reportRow(report, "uninspected", { path: rel, reason: "file-unreadable" }); continue; }
      if (looksBinary(bytes, rel)) { reportRow(report, "excluded", { path: rel, reason: "binary" }); continue; }
      report.filesRead += 1;
      report.bytesRead += bytes.length;
      const content = bytes.toString("utf8");
      if (containsSecret(content)) { reportRow(report, "excluded", { path: rel, reason: "secret-like-content" }); continue; }
      reportRow(report, "inspected", { path: rel, size: bytes.length });
      if (report.candidates.length >= CLARITY_LIMITS.maxCandidates) continue;
      const classification = classifyCandidate(rel, content);
      if (!classification) continue;
      report.candidates.push({
        path: rel,
        title: titleFrom(content, rel),
        contentDigest: sha256(bytes),
        ...classification,
      });
    }
  }
  if (!report.candidates.length) {
    const fallback = report.inspected[0];
    if (fallback) report.candidates.push({ path: fallback.path, title: basename(fallback.path), contentDigest: sha256(fallback.path), kind: "repository-area", source: "file", decisionStatus: "unknown", humanConfirmed: false });
  }
  report.candidates.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return report;
}

function scanRepositoryImpl(rootValue) {
  const root = rootPath(rootValue);
  const authoritative = scanHarnessAuthoritative(root);
  const generic = scanGenericRepository(root);
  if (!authoritative.bundle) {
    return {
      ...generic,
      harness: {
        detection: authoritative.detection,
        state: authoritative.state,
        coverageDigest: authoritative.coverageDigest,
      },
    };
  }
  const candidates = [
    ...authoritative.candidates,
    ...generic.candidates.slice(0, Math.max(0, CLARITY_LIMITS.maxCandidates - authoritative.candidates.length)),
  ];
  return {
    ...generic,
    truncated: generic.truncated || authoritative.lane.partial,
    candidates,
    harness: {
      detection: authoritative.detection,
      state: authoritative.state,
      bundle: authoritative.bundle,
      sources: authoritative.sources,
      coverageDigest: authoritative.coverageDigest,
    },
    lanes: {
      authoritative: authoritative.lane,
      generic: {
        limits: generic.limits,
        entriesSeen: generic.entriesSeen,
        filesRead: generic.filesRead,
        bytesRead: generic.bytesRead,
        inspected: generic.inspected,
        excluded: generic.excluded,
        uninspected: generic.uninspected,
        partial: generic.truncated,
        partialReasons: generic.truncated ? ["scan-limit-reached"] : [],
      },
    },
  };
}

function initialItem(projectId, candidate, timestamp) {
  const itemId = stableId("ci", `${projectId}:${candidate.path}:${candidate.title}`);
  return {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    itemId,
    title: oneLine(candidate.title, "Item title", 120),
    areaPath: safeRelative(candidate.path, "Item area path"),
    kind: candidate.kind,
    disposition: "candidate",
    deferredUntil: null,
    owner: null,
    decisionOwner: null,
    dependencies: [],
    externalRefs: [],
    confidence: "unknown",
    timestamps: { createdAt: timestamp, updatedAt: timestamp },
    attention: { level: "not_evaluated", reasons: [] },
    attentionContext: { impact: 0, urgency: 0, humanOverride: null, signals: [] },
    decision: {
      status: candidate.decisionStatus,
      source: candidate.decisionSource || candidate.source,
      humanConfirmed: Boolean(candidate.humanConfirmed),
      authority: "repository-reference",
      evidenceRefs: [],
      updatedAt: timestamp,
    },
    execution: {
      status: candidate.executionStatus || "not_started",
      authority: "repository-observation",
      evidenceRefs: [],
      updatedAt: timestamp,
    },
    validation: { status: candidate.validationStatus || "unknown", evidenceRefs: [], updatedAt: timestamp },
    alignment: { status: "unknown", evidenceRefs: [], updatedAt: timestamp },
  };
}

function fileEvidence(projectId, item, candidate, timestamp) {
  const type = candidate.source === "adr" ? "adr" : candidate.source === "spec" ? "spec-section" : candidate.source === "harness-authoritative" ? "agent-observation" : "file-reference";
  return {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    evidenceId: stableId("ce", `${projectId}:${type}:${candidate.path}:${candidate.contentDigest}`),
    type,
    source: candidate.source,
    locator: candidate.evidenceLocator || { path: candidate.path },
    summary: (candidate.evidenceSummary || `${candidate.kind}候補: ${candidate.title}`).slice(0, 240),
    observedAt: timestamp,
    contentDigest: candidate.contentDigest,
    sensitivity: "non-secret-reference",
    availability: "available",
  };
}

function eventFor(projectId, type, itemId, actor, occurredAt, payload) {
  return {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    eventId: stableId("cv", `${projectId}:${type}:${itemId || "project"}:${JSON.stringify(payload)}`),
    type,
    itemId: itemId || null,
    actor,
    occurredAt,
    payload,
  };
}

export function validateProject(project) {
  fail(project && Number.isInteger(project.schemaVersion)
    && project.schemaVersion >= CLARITY_MIN_SCHEMA_VERSION
    && project.schemaVersion <= CLARITY_SCHEMA_VERSION,
  "project-schema-invalid", "Clarity Project schemaVersionが未対応です。");
  fail(/^cp_[a-f0-9]{20}$/u.test(project.clarityProjectId || ""), "project-schema-invalid", "Clarity Project IDが不正です。");
  fail(modes.has(project.mode), "project-schema-invalid", "Clarity modeが不正です。");
  fail(project.repoIdentity && ["git", "non-git"].includes(project.repoIdentity.kind), "project-schema-invalid", "Repo identityが不正です。");
  fail(project.compatibility?.reader?.min === 1 && project.compatibility?.reader?.max >= project.schemaVersion
    && project.compatibility?.writer?.min === 1 && project.compatibility?.writer?.max >= project.schemaVersion,
  "project-schema-invalid", "reader／writer互換範囲が不正です。");
  fail(!containsSecret(project), "secret-detected", "Project metadataにSecretらしき値があるため拒否します。");
  return project;
}

export function validateItem(item) {
  fail(item && Number.isInteger(item.schemaVersion)
    && item.schemaVersion >= CLARITY_MIN_SCHEMA_VERSION
    && item.schemaVersion <= CLARITY_SCHEMA_VERSION
    && /^ci_[a-f0-9]{20}$/u.test(item.itemId || ""), "item-schema-invalid", "Clarity Item schemaが不正です。");
  oneLine(item.title, "Item title", 120);
  safeRelative(item.areaPath, "Item area path");
  fail(dispositions.has(item.disposition), "item-schema-invalid", "Item dispositionが不正です。");
  fail(decisionStatuses.has(item.decision?.status), "item-schema-invalid", "Decision statusが不正です。");
  fail(executionStatuses.has(item.execution?.status), "item-schema-invalid", "Execution statusが不正です。");
  fail(validationStatuses.has(item.validation?.status), "item-schema-invalid", "Validation statusが不正です。");
  fail(alignmentStatuses.has(item.alignment?.status), "item-schema-invalid", "Alignment statusが不正です。");
  fail(item.owner === null || typeof item.owner === "string", "item-schema-invalid", "Item ownerが不正です。");
  fail(item.decisionOwner === null || typeof item.decisionOwner === "string", "item-schema-invalid", "Decision ownerが不正です。");
  fail(Array.isArray(item.dependencies) && item.dependencies.every((value) => typeof value === "string"), "item-schema-invalid", "Item dependenciesが不正です。");
  fail(Array.isArray(item.externalRefs) && item.externalRefs.every((value) => typeof value === "string"), "item-schema-invalid", "Item external refsが不正です。");
  fail(["unknown", "observed", "verified"].includes(item.confidence), "item-schema-invalid", "Item confidenceが不正です。");
  fail(item.timestamps && !Number.isNaN(new Date(item.timestamps.createdAt).valueOf()) && !Number.isNaN(new Date(item.timestamps.updatedAt).valueOf()), "item-schema-invalid", "Item timestampsが不正です。");
  fail(item.attention && ["not_evaluated", "critical", "high", "medium", "low", "none"].includes(item.attention.level)
    && Array.isArray(item.attention.reasons), "item-schema-invalid", "Item attentionが不正です。");
  if (item.attentionContext !== undefined) {
    fail(item.attentionContext && typeof item.attentionContext === "object" && !Array.isArray(item.attentionContext), "item-schema-invalid", "Attention contextが不正です。");
    fail(Number.isFinite(item.attentionContext.impact ?? 0) && Number.isFinite(item.attentionContext.urgency ?? 0), "item-schema-invalid", "Attention impact／urgencyが不正です。");
    fail(Array.isArray(item.attentionContext.signals ?? []), "item-schema-invalid", "Attention signalsが不正です。");
    const override = item.attentionContext.humanOverride;
    fail(override == null || (typeof override === "object" && ["critical", "high", "medium", "low", "none"].includes(override.level)), "item-schema-invalid", "人間指定のAttention levelが不正です。");
  }
  if (item.decision.status === "confirmed") {
    fail(item.decision.humanConfirmed === true || item.decision.source === "accepted-canonical", "human-confirmation-invalid", "confirmed Decisionには人間確認または現在有効な明示正本が必要です。");
  }
  fail(!containsSecret(item), "secret-detected", "ItemにSecretらしき値があるため拒否します。");
  return item;
}

export function validateEvent(event) {
  fail(event && Number.isInteger(event.schemaVersion)
    && event.schemaVersion >= CLARITY_MIN_SCHEMA_VERSION
    && event.schemaVersion <= CLARITY_SCHEMA_VERSION
    && /^cv_[a-f0-9]{20}$/u.test(event.eventId || ""), "event-schema-invalid", "Clarity Event schemaが不正です。");
  fail(eventTypes.has(event.type), "event-schema-invalid", `未対応のEvent typeです: ${event.type}`);
  fail(!event.itemId || /^ci_[a-f0-9]{20}$/u.test(event.itemId), "event-schema-invalid", "EventのItem IDが不正です。");
  oneLine(event.actor, "Event actor", 80);
  fail(!Number.isNaN(new Date(event.occurredAt).valueOf()), "event-schema-invalid", "Event occurredAtが不正です。");
  fail(!containsSecret(event), "secret-detected", "EventにSecretらしき値があるため拒否します。");
  if (event.type === "item.discovered") validateItem(event.payload?.item);
  if (event.type === "decision.confirmed") fail(event.payload?.humanConfirmed === true || event.payload?.source === "accepted-canonical", "human-confirmation-invalid", "confirmed Eventには人間確認または明示正本が必要です。");
  if (event.type === "attention.override") {
    fail(["critical", "high", "medium", "low", "none"].includes(event.payload?.level), "event-schema-invalid", "Attention override levelが不正です。");
    oneLine(event.payload?.reason, "Attention override reason", 160);
    fail(Number.isFinite(Number(event.payload?.rank || 0)), "event-schema-invalid", "Attention override rankが不正です。");
  }
  if (/^(?:link|sync)\./u.test(event.type)) {
    fail(event.itemId === null, "event-schema-invalid", "link／sync EventはProject-level Eventとして記録してください。");
    fail(/^cl_[a-f0-9]{20}$/u.test(event.payload?.linkId || ""), "event-schema-invalid", "link／sync Eventのlink IDが不正です。");
  }
  if (event.type === "drift.waiver.recorded") {
    fail(/^ci_[a-f0-9]{20}$/u.test(event.itemId || ""), "event-schema-invalid", "Drift waiverはItem単位で記録してください。");
    fail(["active", "revoked"].includes(event.payload?.status), "event-schema-invalid", "Drift waiver statusが不正です。");
    oneLine(event.payload?.reason, "Drift waiver reason", 200);
    oneLine(event.payload?.scope, "Drift waiver scope", 160);
    if (event.payload?.expiresAt !== null) fail(!Number.isNaN(Date.parse(event.payload?.expiresAt)), "event-schema-invalid", "Drift waiver期限が不正です。");
  }
  return event;
}

function validateLocator(locator) {
  fail(locator && typeof locator === "object" && !Array.isArray(locator), "evidence-schema-invalid", "Evidence locatorが不正です。");
  for (const [key, raw] of Object.entries(locator)) {
    const value = oneLine(raw, `Evidence locator.${key}`, 300);
    if (key.toLowerCase().includes("path")) safeRelative(value, `Evidence locator.${key}`);
    if (key === "sha") fail(/^[a-f0-9]{7,64}$/iu.test(value), "evidence-schema-invalid", "Git SHAが不正です。");
  }
}

export function validateEvidence(evidence) {
  fail(evidence && Number.isInteger(evidence.schemaVersion)
    && evidence.schemaVersion >= CLARITY_MIN_SCHEMA_VERSION
    && evidence.schemaVersion <= CLARITY_SCHEMA_VERSION
    && /^ce_[a-f0-9]{20}$/u.test(evidence.evidenceId || ""), "evidence-schema-invalid", "Clarity Evidence schemaが不正です。");
  fail(evidenceTypes.has(evidence.type), "evidence-schema-invalid", `未対応のEvidence typeです: ${evidence.type}`);
  oneLine(evidence.source, "Evidence source", 120);
  validateLocator(evidence.locator);
  oneLine(evidence.summary, "Evidence summary", 240);
  fail(/^[a-f0-9]{64}$/u.test(evidence.contentDigest || ""), "evidence-schema-invalid", "Evidence digestが不正です。");
  fail(evidence.sensitivity === "non-secret-reference", "evidence-schema-invalid", "Evidence sensitivityは非機密参照だけを保存できます。");
  fail(["available", "source_unreachable"].includes(evidence.availability), "evidence-schema-invalid", "Evidence availabilityが不正です。");
  fail(!containsSecret(evidence), "secret-detected", "EvidenceにSecretらしき値があるため保存しません。");
  return evidence;
}

function jsonLines(path, validator) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const rows = text.split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new ClarityError("jsonl-invalid", `${basename(path)} ${index + 1}行目がJSONではありません。`); }
  });
  rows.forEach(validator);
  const ids = rows.map((row) => row.eventId || row.evidenceId);
  fail(new Set(ids).size === ids.length, "duplicate-id", `${basename(path)}に重複IDがあります。`);
  return rows;
}

function readCanonical(rootValue) {
  const root = rootPath(rootValue);
  let clarity;
  try { clarity = safeWritePath(root, ".clarity"); }
  catch (error) {
    if (["symlink-boundary", "filesystem-boundary"].includes(error?.code)) throw new ClarityError("root-internal-symlink", "Repo内の.clarityが安全な通常directoryではないため、参照先を追わず停止しました。", 3, { changed: false });
    throw error;
  }
  fail(existsSync(clarity) && lstatSync(clarity).isDirectory() && !lstatSync(clarity).isSymbolicLink(), "clarity-not-initialized", "このRepoにはClarityが初期化されていません。");
  const projectPath = safeWritePath(root, ".clarity/project.json");
  fail(existsSync(projectPath), "project-missing", ".clarity/project.jsonがありません。");
  let project;
  try { project = JSON.parse(readFileSync(projectPath, "utf8")); }
  catch { throw new ClarityError("project-json-invalid", ".clarity/project.jsonがJSONではありません。"); }
  validateProject(project);
  const events = jsonLines(safeWritePath(root, ".clarity/events.jsonl"), validateEvent);
  const evidence = jsonLines(safeWritePath(root, ".clarity/evidence.jsonl"), validateEvidence);
  return { root, clarity, project, events, evidence };
}

function findCanonicalItemImpl(rootValue, itemId) {
  const canonical = readCanonical(rootValue);
  return buildState(canonical.project, canonical.events, canonical.evidence).items.find((item) => item.itemId === itemId) || null;
}

function implemented(status) {
  return ["implemented", "verified", "operational"].includes(status);
}

export function deriveQuadrant(decisionStatus, executionStatus) {
  const confirmed = decisionStatus === "confirmed";
  const done = implemented(executionStatus);
  if (confirmed && done) return "stabilize";
  if (confirmed && !done) return "execute";
  if (!confirmed && done) return "validate";
  return "decide";
}

function applyEvent(item, event) {
  const payload = event.payload || {};
  if (["checkpoint.recorded", "attention.resolved"].includes(event.type)) return;
  if (event.type === "attention.override") {
    fail(["critical", "high", "medium", "low", "none"].includes(payload.level), "event-schema-invalid", "Attention override levelが不正です。");
    item.attentionContext = {
      ...(item.attentionContext || { impact: 0, urgency: 0, signals: [] }),
      humanOverride: { level: payload.level, reason: payload.reason || null, rank: Number(payload.rank || 0) },
    };
  } else if (event.type === "decision.pending" || event.type === "decision.proposed") {
    item.decision = { ...item.decision, status: "proposed", source: payload.source || "agent-inference", humanConfirmed: false, updatedAt: event.occurredAt };
  } else if (event.type === "decision.confirmed") {
    item.decision = { ...item.decision, status: "confirmed", source: payload.source, humanConfirmed: Boolean(payload.humanConfirmed), authority: payload.authority || item.decision.authority, updatedAt: event.occurredAt };
  } else if (event.type === "decision.rejected") {
    item.decision = { ...item.decision, status: "rejected", humanConfirmed: Boolean(payload.humanConfirmed), updatedAt: event.occurredAt };
  } else if (event.type === "decision.superseded") {
    item.decision = { ...item.decision, status: "superseded", humanConfirmed: Boolean(payload.humanConfirmed), updatedAt: event.occurredAt };
  } else if (event.type === "execution.changed") {
    fail(executionStatuses.has(payload.status), "event-schema-invalid", "Execution Eventのstatusが不正です。");
    item.execution = { ...item.execution, status: payload.status, updatedAt: event.occurredAt };
  } else if (event.type === "validation.changed") {
    fail(validationStatuses.has(payload.status), "event-schema-invalid", "Validation Eventのstatusが不正です。");
    item.validation = { ...item.validation, status: payload.status, updatedAt: event.occurredAt };
  } else if (event.type === "alignment.changed") {
    fail(alignmentStatuses.has(payload.status), "event-schema-invalid", "Alignment Eventのstatusが不正です。");
    item.alignment = { ...item.alignment, status: payload.status, updatedAt: event.occurredAt };
  } else if (event.type === "disposition.changed") {
    fail(dispositions.has(payload.disposition), "event-schema-invalid", "Disposition Eventの値が不正です。");
    item.disposition = payload.disposition;
    item.deferredUntil = payload.deferredUntil || null;
  } else if (event.type === "evidence.linked") {
    const section = payload.section;
    fail(["decision", "execution", "validation", "alignment"].includes(section), "event-schema-invalid", "Evidence link sectionが不正です。");
    const refs = new Set(item[section].evidenceRefs || []);
    refs.add(payload.evidenceId);
    item[section] = { ...item[section], evidenceRefs: [...refs].sort() };
  } else if (event.type === "drift.waiver.recorded") {
    item.alignment = {
      ...item.alignment,
      waiver: {
        status: payload.status,
        reason: payload.reason,
        scope: payload.scope,
        expiresAt: payload.expiresAt ?? null,
        eventId: event.eventId,
        updatedAt: event.occurredAt,
      },
      updatedAt: event.occurredAt,
    };
  }
  item.timestamps = { ...item.timestamps, updatedAt: event.occurredAt };
}

function ageDays(value, clock) {
  const then = new Date(value).valueOf();
  const now = new Date(clock).valueOf();
  return Number.isNaN(then) || Number.isNaN(now) ? 0 : Math.max(0, Math.floor((now - then) / 86_400_000));
}

function evidenceRefs(item) {
  return [...new Set([
    ...(item.decision?.evidenceRefs || []),
    ...(item.execution?.evidenceRefs || []),
    ...(item.validation?.evidenceRefs || []),
    ...(item.alignment?.evidenceRefs || []),
  ])].sort();
}

function attentionForItem(item, itemsById, evidenceById, clock) {
  const reasons = [];
  const excluded = item.disposition === "idea" || item.disposition === "rejected"
    || ["rejected", "superseded"].includes(item.decision.status)
    || (item.disposition === "deferred" && item.deferredUntil && item.deferredUntil > clock.slice(0, 10));
  if (excluded) return { eligible: false, level: "none", reasons: [], ageDays: 0 };
  if (item.disposition === "deferred" && item.deferredUntil && item.deferredUntil <= clock.slice(0, 10)) reasons.push("deferred_due");
  if (item.decision.status !== "confirmed" && implemented(item.execution.status)) reasons.push("implemented_without_confirmed_decision");
  if (item.decision.status === "confirmed" && !implemented(item.execution.status) && item.execution.status !== "in_progress") reasons.push("confirmed_but_not_executed");
  const waiver = item.alignment?.waiver || null;
  const waiverActive = waiver?.status === "active"
    && (!waiver.expiresAt || (!Number.isNaN(Date.parse(waiver.expiresAt)) && Date.parse(waiver.expiresAt) > Date.parse(clock)));
  if (!waiverActive && item.alignment.status === "drift") reasons.push("decision_implementation_drift");
  if (!waiverActive && item.alignment.status === "possible_drift") reasons.push("possible_drift");
  if (item.validation.status === "failed") reasons.push("validation_failed");
  if (item.validation.status === "pending" && implemented(item.execution.status)
    && ageDays(item.validation.updatedAt, clock) >= ATTENTION_STALENESS_DAYS.validationPending) reasons.push("validation_pending_too_long");
  const undecidedAge = ageDays(item.decision.updatedAt || item.timestamps.createdAt, clock);
  if (!["confirmed", "rejected", "superseded"].includes(item.decision.status)
    && undecidedAge >= ATTENTION_STALENESS_DAYS.undecided) reasons.push("undecided_stale");
  const signals = new Set(item.attentionContext?.signals || []);
  if (item.authorityConflict === true || signals.has("authority_conflict")) reasons.push("authority_conflict");
  if (item.syncConflict === true || signals.has("sync_conflict")) reasons.push("sync_conflict");
  const refs = evidenceRefs(item);
  const evidenceMissing = item.attentionContext?.missingEvidence === true
    || (item.decision.status === "confirmed" && !(item.decision.evidenceRefs || []).length)
    || (implemented(item.execution.status) && !(item.execution.evidenceRefs || []).length)
    || (["pending", "failed", "passed"].includes(item.validation.status) && !(item.validation.evidenceRefs || []).length);
  if (evidenceMissing) reasons.push("missing_evidence");
  const blocked = (item.dependencies || []).filter((id) => {
    const dependency = itemsById.get(id);
    return !dependency || !implemented(dependency.execution?.status) || dependency.validation?.status === "failed";
  });
  if (blocked.length || signals.has("dependency_blocked")) reasons.push("dependency_blocked");
  if (item.decision.status !== "confirmed" && !item.decisionOwner) reasons.push("decision_owner_missing");
  if (refs.some((id) => evidenceById.get(id)?.availability === "source_unreachable")) reasons.push("source_unreachable");
  for (const signal of signals) if (ATTENTION_REASONS[signal]) reasons.push(signal);
  const unique = [...new Set(reasons)].sort((a, b) => {
    const severity = (ATTENTION_LEVELS[ATTENTION_REASONS[b]?.level] || 0) - (ATTENTION_LEVELS[ATTENTION_REASONS[a]?.level] || 0);
    return severity || a.localeCompare(b, "en");
  });
  const override = item.attentionContext?.humanOverride || null;
  const derivedLevel = unique.reduce((level, reason) => {
    const next = ATTENTION_REASONS[reason]?.level || (reason === "deferred_due" ? "medium" : "none");
    return ATTENTION_LEVELS[next] > ATTENTION_LEVELS[level] ? next : level;
  }, "none");
  const level = override?.level || derivedLevel;
  return { eligible: level !== "none" && unique.length > 0, level, reasons: unique, ageDays: undecidedAge, blocked, override };
}

function attentionChoice(reason) {
  if (["decision_implementation_drift", "possible_drift"].includes(reason)) return ["根拠を確認する", "決定か実装を見直す", "今回は保留する"];
  if (["authority_conflict", "sync_conflict"].includes(reason)) return ["正本を確認する", "競合を保留する", "詳細を開く"];
  if (["validation_failed", "validation_pending_too_long"].includes(reason)) return ["検証結果を確認する", "再検証する", "今回は保留する"];
  return ["今確認する", "担当・期限を決める", "今回は保留する"];
}

export function evaluateAttention(state, evidence = [], { clock = nowIso(), limit = 3 } = {}) {
  fail(state && Array.isArray(state.items), "state-schema-invalid", "Attention評価にはcanonical State itemsが必要です。");
  fail(Array.isArray(evidence), "evidence-schema-invalid", "Attention評価のEvidenceが配列ではありません。");
  fail(Number.isInteger(limit) && limit >= 1 && limit <= 20, "attention-limit-invalid", "Attention表示件数は1〜20で指定してください。");
  state.items.forEach(validateItem);
  evidence.forEach(validateEvidence);
  fail(new Set(state.items.map((item) => item.itemId)).size === state.items.length, "duplicate-id", "Attention評価Stateに重複Item IDがあります。");
  fail(new Set(evidence.map((row) => row.evidenceId)).size === evidence.length, "duplicate-id", "Attention評価Evidenceに重複IDがあります。");
  const evidenceById = new Map(evidence.map((row) => [row.evidenceId, row]));
  const itemsById = new Map(state.items.map((item) => [item.itemId, item]));
  const dispositionRank = { required: 3, candidate: 2, deferred: 1, idea: 0, rejected: 0 };
  const entries = state.items.map((item) => {
    const result = attentionForItem(item, itemsById, evidenceById, clock);
    if (!result.eligible) return null;
    const primaryReason = result.reasons[0];
    const refs = evidenceRefs(item).map((id) => evidenceById.get(id)).filter(Boolean);
    const proof = refs.slice(0, 3).map((row) => ({ evidenceId: row.evidenceId, summary: row.summary, availability: row.availability }));
    const inference = item.decision.source === "agent-inference" || item.confidence === "unknown";
    const unverified = item.validation.status === "unknown" || item.validation.status === "pending" || item.confidence !== "verified";
    return {
      itemId: item.itemId,
      title: item.title,
      level: result.level,
      reasons: result.reasons,
      reasonLabels: result.reasons.map((reason) => ATTENTION_REASONS[reason]?.label || "期限が到来したため再確認が必要です"),
      conclusion: `${item.title}は${result.level === "critical" ? "至急" : "人間の"}確認が必要です`,
      evidence: proof.length ? proof : [{ evidenceId: null, summary: "根拠不足（未検証）", availability: "source_unreachable" }],
      choices: attentionChoice(primaryReason),
      inference,
      unverified,
      humanOverride: result.override ? { level: result.override.level, reason: result.override.reason || null } : null,
      detailPath: ".clarity/state.json",
      _rank: {
        severity: ATTENTION_LEVELS[result.level],
        disposition: dispositionRank[item.disposition] || 0,
        impact: Number(item.attentionContext?.impact || 0),
        urgency: Number(item.attentionContext?.urgency || 0),
        age: result.ageDays,
        dependency: result.blocked.length,
        conflict: result.reasons.some((reason) => reason.includes("conflict")) ? 1 : 0,
        validation: result.reasons.some((reason) => reason.startsWith("validation_")) ? 1 : 0,
        human: Number(item.attentionContext?.humanOverride?.rank || 0),
      },
    };
  }).filter(Boolean).sort((a, b) => {
    for (const key of ["severity", "disposition", "impact", "urgency", "age", "dependency", "conflict", "validation", "human"]) {
      if (a._rank[key] !== b._rank[key]) return b._rank[key] - a._rank[key];
    }
    return a.itemId.localeCompare(b.itemId, "en");
  });
  const visible = entries.slice(0, limit).map(({ _rank, ...entry }) => entry);
  const counts = Object.fromEntries(["critical", "high", "medium", "low"].map((level) => [level, entries.filter((row) => row.level === level).length]));
  const otherCount = Math.max(0, entries.length - visible.length);
  return {
    conclusion: entries.length ? `今、人間が考える必要がある項目は${entries.length}件です` : "現在、判断が必要な項目はありません",
    activeCount: entries.length,
    counts,
    items: visible,
    otherCount,
    detailPath: ".clarity/state.json",
    technicalHandoff: {
      command: "clarity attention <repo-root> --json",
      path: ".clarity/state.json",
      error: null,
      evidenceIds: visible.flatMap((item) => item.evidence.map((row) => row.evidenceId).filter(Boolean)),
      remainingCount: otherCount,
    },
  };
}

export function buildState(project, events, evidence, clock = nowIso()) {
  validateProject(project);
  events.forEach(validateEvent);
  evidence.forEach(validateEvidence);
  const evidenceById = new Map(evidence.map((row) => [row.evidenceId, row]));
  const itemMap = new Map();
  for (const event of events) {
    if (event.type === "item.discovered") {
      const item = structuredClone(event.payload.item);
      if (!itemMap.has(item.itemId)) itemMap.set(item.itemId, item);
      continue;
    }
    if (event.type === "checkpoint.recorded" || /^(?:link|sync)\./u.test(event.type)) continue;
    const item = itemMap.get(event.itemId);
    fail(item, "event-item-missing", `Eventが存在しないItemを参照しています: ${event.itemId}`);
    applyEvent(item, event);
  }
  const baseItems = [...itemMap.values()].map((item) => {
    validateItem(item);
    const quadrant = deriveQuadrant(item.decision.status, item.execution.status);
    return {
      ...item,
      quadrant,
      quadrantLabel: quadrantMeta[quadrant].label,
      quadrantMeaning: quadrantMeta[quadrant].meaning,
      inProgress: item.execution.status === "in_progress",
      activeMatrix: !["rejected", "superseded"].includes(item.decision.status) && item.disposition !== "rejected",
      attentionEligible: false,
      attentionReasons: [],
      attention: { level: "not_evaluated", reasons: [] },
    };
  }).sort((a, b) => a.itemId.localeCompare(b.itemId, "en"));
  const itemsById = new Map(baseItems.map((candidate) => [candidate.itemId, candidate]));
  const items = baseItems.map((item) => {
    const raw = attentionForItem(item, itemsById, evidenceById, clock);
    return {
      ...item,
      attentionEligible: raw.eligible,
      attentionReasons: raw.reasons,
      attention: { level: raw.level, reasons: raw.reasons },
    };
  });
  const generatedAt = events.map((event) => event.occurredAt).sort().at(-1) || project.createdAt;
  return {
    schemaVersion: project.schemaVersion,
    clarityProjectId: project.clarityProjectId,
    generatedAt,
    source: { eventCount: events.length, evidenceCount: evidence.length },
    quadrants: Object.fromEntries(Object.keys(quadrantMeta).map((key) => [key, items.filter((item) => item.activeMatrix && item.quadrant === key).map((item) => item.itemId)])),
    items,
  };
}

export function validateState(state) {
  fail(state && Number.isInteger(state.schemaVersion)
    && state.schemaVersion >= CLARITY_MIN_SCHEMA_VERSION
    && state.schemaVersion <= CLARITY_SCHEMA_VERSION
    && /^cp_[a-f0-9]{20}$/u.test(state.clarityProjectId || ""), "state-schema-invalid", "Clarity State schemaが不正です。");
  fail(Array.isArray(state.items), "state-schema-invalid", "State itemsが配列ではありません。");
  for (const item of state.items) {
    validateItem(item);
    fail(item.quadrant === deriveQuadrant(item.decision.status, item.execution.status), "state-quadrant-invalid", "State quadrantがDecision／Executionと一致しません。");
  }
  fail(!containsSecret(state), "secret-detected", "StateにSecretらしき値があるため拒否します。");
  return state;
}

function writeIfChanged(root, rel, bytes) {
  const path = safeWritePath(root, rel);
  if (existsSync(path) && readFileSync(path, "utf8") === bytes) return false;
  writeFileAtomicSafe(root, rel, bytes, { encoding: "utf8" });
  return true;
}

function rebuildStateUnlocked(rootValue, { write = true } = {}) {
  const canonical = readCanonical(rootValue);
  const state = buildState(canonical.project, canonical.events, canonical.evidence);
  validateState(state);
  const bytes = stableJson(state);
  const changed = write ? writeIfChanged(canonical.root, ".clarity/state.json", bytes) : false;
  return { state, bytes, digest: sha256(bytes), changed };
}

function rebuildStateImpl(rootValue, { write = true } = {}) {
  if (!write) return rebuildStateUnlocked(rootValue, { write: false });
  return withCanonicalWriteLock(rootValue, (root) => rebuildStateUnlocked(root, { write: true }));
}

function rootEntry() {
  return `<!-- agentic-secretary:clarity:v1:start -->\n# Project Clarity\n\n- 正本: \`.clarity/project.json\`、\`.clarity/events.jsonl\`、\`.clarity/evidence.jsonl\`\n- 現在状態: \`.clarity/state.json\`（Event／Evidenceから再構築できます）\n- 手動入口: \`clarity status\` / \`clarity history\` / \`clarity rebuild\`\n<!-- agentic-secretary:clarity:v1:end -->\n`;
}

function initializedPreview(root) {
  const canonical = readCanonical(root);
  const entryPath = safeWritePath(root, "CLARITY.md");
  const hasEntry = existsSync(entryPath) && readFileSync(entryPath, "utf8").includes("agentic-secretary:clarity:v1:start");
  return {
    action: "repair-or-noop",
    initialized: true,
    clarityProjectId: canonical.project.clarityProjectId,
    writes: hasEntry || canonical.project.rootEntry.status === "external-conflict" ? [] : ["CLARITY.md"],
    conflicts: canonical.project.rootEntry.status === "external-conflict" ? [{ path: "CLARITY.md", reason: "existing-unmanaged-file-preserved" }] : [],
    itemCount: buildState(canonical.project, canonical.events, canonical.evidence).items.length,
  };
}

function previewInitImpl(rootValue) {
  const root = rootPath(rootValue);
  let clarityPath;
  try { clarityPath = safeWritePath(root, ".clarity"); }
  catch (error) {
    if (["symlink-boundary", "filesystem-boundary"].includes(error?.code)) throw new ClarityError("root-internal-symlink", "Repo内の.clarityが安全ではないため、参照先を追わず停止しました。", 3, { changed: false });
    throw error;
  }
  if (existsSync(clarityPath)) return initializedPreview(root);
  const repoIdentity = inspectRepoIdentity(root);
  const scan = scanRepository(root);
  const existingRootEntry = existsSync(safeWritePath(root, "CLARITY.md"));
  const identitySeed = `${repoIdentity.kind}:${repoIdentity.remote.repository || repoIdentity.rootName}:${realpathSync(root)}`;
  const projectId = stableId("cp", identitySeed);
  return {
    action: "initialize",
    initialized: false,
    project: { clarityProjectId: projectId, name: repoIdentity.rootName, mode: "standalone", repoIdentity },
    scan,
    candidates: scan.candidates.map(({ contentDigest, ...candidate }) => ({ ...candidate, digest: contentDigest })),
    writes: [".clarity/project.json", ".clarity/events.jsonl", ".clarity/evidence.jsonl", ".clarity/state.json", ...(existingRootEntry ? [] : ["CLARITY.md"])],
    conflicts: existingRootEntry ? [{ path: "CLARITY.md", reason: "existing-unmanaged-file-preserved" }] : [],
    uninspected: scan.uninspected,
    excluded: scan.excluded,
  };
}

function createCanonicalFromPreview(root, preview) {
  const timestamp = nowIso();
  const project = {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    clarityProjectId: preview.project.clarityProjectId,
    name: oneLine(preview.project.name, "Project name", 120),
    mode: "standalone",
    createdAt: timestamp,
    repoIdentity: preview.project.repoIdentity,
    secretaryLink: null,
    compatibility: { reader: { min: 1, max: CLARITY_SCHEMA_VERSION }, writer: { min: 1, max: CLARITY_SCHEMA_VERSION } },
    rootEntry: { path: "CLARITY.md", status: preview.conflicts.length ? "external-conflict" : "managed-block" },
  };
  validateProject(project);
  const evidence = [];
  const events = [];
  for (const candidate of preview.scan.candidates) {
    const item = initialItem(project.clarityProjectId, candidate, timestamp);
    const proof = fileEvidence(project.clarityProjectId, item, candidate, timestamp);
    item.decision.evidenceRefs = [proof.evidenceId];
    if (item.execution.status !== "not_started") item.execution.evidenceRefs = [proof.evidenceId];
    if (item.validation.status !== "unknown") item.validation.evidenceRefs = [proof.evidenceId];
    validateItem(item);
    validateEvidence(proof);
    evidence.push(proof);
    events.push(eventFor(project.clarityProjectId, "item.discovered", item.itemId, "clarity-init", timestamp, { item }));
  }
  fail(events.length > 0, "no-candidates", "実Repo由来のItem候補を作れないため、空テンプレで初期化しません。", { scan: preview.scan });
  const state = buildState(project, events, evidence, timestamp);
  return { project, events, evidence, state };
}

function applyInitImpl(rootValue) {
  const root = rootPath(rootValue);
  const preview = previewInit(root);
  if (preview.initialized) {
    let changed = false;
    if (preview.writes.includes("CLARITY.md")) changed = writeIfChanged(root, "CLARITY.md", rootEntry());
    const rebuilt = rebuildState(root, { write: true });
    return { status: changed || rebuilt.changed ? "repaired" : "unchanged", preview, changes: { rootEntry: changed, state: rebuilt.changed } };
  }
  const canonical = createCanonicalFromPreview(root, preview);
  const nonce = `${process.pid}-${Date.now()}`;
  const stageRel = `.clarity-init-${nonce}`;
  const stage = safeWritePath(root, stageRel);
  const target = safeWritePath(root, ".clarity");
  fail(!existsSync(target), "clarity-conflict", ".clarity/が同時に作成されたため、上書きせず停止しました。");
  mkdirSync(stage);
  try {
    writeFileSync(join(stage, "project.json"), stableJson(canonical.project), { encoding: "utf8", flag: "wx" });
    writeFileSync(join(stage, "events.jsonl"), canonical.events.map((row) => JSON.stringify(row)).join("\n") + "\n", { encoding: "utf8", flag: "wx" });
    writeFileSync(join(stage, "evidence.jsonl"), canonical.evidence.map((row) => JSON.stringify(row)).join("\n") + "\n", { encoding: "utf8", flag: "wx" });
    writeFileSync(join(stage, "state.json"), stableJson(canonical.state), { encoding: "utf8", flag: "wx" });
    if (process.env.CLARITY_FAIL_AT === "before-canonical") throw new ClarityError("failure-injected", "テスト用: canonical rename前に停止しました。", 4);
    revalidateClarityRoot(root);
    renameSync(stage, target);
  } finally {
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  }
  if (process.env.CLARITY_FAIL_AT === "after-canonical") {
    throw new ClarityError("init-partial", "Clarity canonicalは作成済みですが、root entryは未完了です。再実行で残りだけを完了できます。", 4, { completed: [".clarity/"], pending: preview.conflicts.length ? [] : ["CLARITY.md"] });
  }
  let entryWritten = false;
  if (!preview.conflicts.length) entryWritten = writeIfChanged(root, "CLARITY.md", rootEntry());
  return { status: preview.conflicts.length ? "initialized-with-root-entry-conflict" : "initialized", clarityProjectId: canonical.project.clarityProjectId, itemCount: canonical.state.items.length, entryWritten, preview };
}

function appendJsonLineUnlocked(root, rel, row, idKey, validator) {
  validator(row);
  const path = safeWritePath(root, rel);
  const rows = jsonLines(path, validator);
  if (rows.some((existing) => existing[idKey] === row[idKey])) return false;
  const bytes = `${rows.map((existing) => JSON.stringify(existing)).join("\n")}${rows.length ? "\n" : ""}${JSON.stringify(row)}\n`;
  writeFileAtomicSafe(root, rel, bytes, { encoding: "utf8" });
  return true;
}

function assertCanonicalProjectionSafe(root, canonical) {
  const path = safeWritePath(root, ".clarity/state.json");
  fail(existsSync(path), "state-missing", ".clarity/state.jsonがありません。doctor／rebuildを明示実行するまで変更しません。", { changed: false });
  let stored;
  try { stored = JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new ClarityError("state-json-invalid", ".clarity/state.jsonがJSONではありません。doctor／rebuildを明示実行するまで変更しません。", 3, { changed: false }); }
  validateState(stored);
  const expected = buildState(canonical.project, canonical.events, canonical.evidence);
  fail(stableJson(stored) === stableJson(expected), "state-mismatch", "StateがEvent／Evidenceと一致しません。doctor／rebuildを明示実行するまで変更しません。", { changed: false });
}

function assertStoredStateValidBeforeLock(root) {
  const path = safeWritePath(root, ".clarity/state.json");
  fail(existsSync(path), "state-missing", ".clarity/state.jsonがありません。doctor／rebuildを明示実行するまで変更しません。", { changed: false });
  let stored;
  try { stored = JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new ClarityError("state-json-invalid", ".clarity/state.jsonがJSONではありません。doctor／rebuildを明示実行するまで変更しません。", 3, { changed: false }); }
  validateState(stored);
}

function appendEventImpl(rootValue, input) {
  const preflightRoot = rootPath(rootValue);
  readCanonical(preflightRoot);
  assertStoredStateValidBeforeLock(preflightRoot);
  return withCanonicalWriteLock(rootValue, (root) => {
    const canonical = readCanonical(root);
    assertCanonicalProjectionSafe(root, canonical);
    if (canonical.project.schemaVersion < CLARITY_SCHEMA_VERSION && ["checkpoint.recorded", "attention.resolved", "attention.override", "drift.waiver.recorded"].includes(input.type)) {
      throw new ClarityError("migration-required", "この操作の前にschema migrationが必要です。変更していません。", 3, { changed: false, nextAction: "clarity migrate previewを確認してください" });
    }
    const payload = structuredClone(input.payload || {});
    const occurredAt = input.occurredAt || nowIso();
    const event = {
      schemaVersion: canonical.project.schemaVersion,
      eventId: input.eventId || stableId("cv", `${canonical.project.clarityProjectId}:${input.type}:${input.itemId}:${JSON.stringify(payload)}`),
      type: input.type,
      itemId: input.itemId,
      actor: input.actor || "manual-cli",
      occurredAt,
      payload,
    };
    const changed = appendJsonLineUnlocked(canonical.root, ".clarity/events.jsonl", event, "eventId", validateEvent);
    const rebuilt = rebuildStateUnlocked(canonical.root, { write: true });
    return { event, changed, stateChanged: rebuilt.changed, state: rebuilt.state };
  });
}

function appendEvidenceImpl(rootValue, input) {
  const preflightRoot = rootPath(rootValue);
  readCanonical(preflightRoot);
  assertStoredStateValidBeforeLock(preflightRoot);
  return withCanonicalWriteLock(rootValue, (root) => {
    const canonical = readCanonical(root);
    assertCanonicalProjectionSafe(root, canonical);
    const normalized = {
      schemaVersion: canonical.project.schemaVersion,
      evidenceId: input.evidenceId || stableId("ce", `${canonical.project.clarityProjectId}:${input.type}:${input.source}:${JSON.stringify(input.locator)}:${input.contentDigest || sha256(input.summary || "")}`),
      type: input.type,
      source: input.source,
      locator: input.locator,
      summary: input.summary,
      observedAt: input.observedAt || nowIso(),
      contentDigest: input.contentDigest || sha256(input.summary || ""),
      sensitivity: input.sensitivity || "non-secret-reference",
      availability: input.availability || "available",
    };
    const changed = appendJsonLineUnlocked(canonical.root, ".clarity/evidence.jsonl", normalized, "evidenceId", validateEvidence);
    const rebuilt = rebuildStateUnlocked(canonical.root, { write: true });
    return { evidence: normalized, changed, stateChanged: rebuilt.changed };
  });
}

function attentionImpl(rootValue, { limit = 3, clock = nowIso() } = {}) {
  const canonical = readCanonical(rootValue);
  const state = buildState(canonical.project, canonical.events, canonical.evidence, clock);
  return evaluateAttention(state, canonical.evidence, { clock, limit });
}

function setAttentionOverrideImpl(rootValue, { itemId, level, reason = "利用者が優先度を指定", rank = 0, operationId } = {}) {
  const canonical = readCanonical(rootValue);
  fail(canonical.project.schemaVersion === CLARITY_SCHEMA_VERSION, "migration-required", "Attention overrideの前にschema migrationが必要です。", { changed: false, nextAction: "clarity migrate previewを確認してください" });
  const state = buildState(canonical.project, canonical.events, canonical.evidence);
  fail(state.items.some((item) => item.itemId === itemId), "item-missing", "指定したClarity Itemが見つかりません。", { changed: false });
  fail(["critical", "high", "medium", "low", "none"].includes(level), "attention-level-invalid", "Attention levelはcritical／high／medium／low／noneから選んでください。", { changed: false });
  const safeReason = oneLine(reason, "Attention override reason", 160);
  const opId = operationId || stableId("op", `${canonical.project.clarityProjectId}:attention-override:${itemId}:${level}:${safeReason}:${rank}`);
  const result = appendEvent(canonical.root, {
    eventId: stableId("cv", `${canonical.project.clarityProjectId}:attention-override:${opId}`),
    type: "attention.override",
    itemId,
    actor: "human-user",
    occurredAt: nowIso(),
    payload: { operationId: opId, level, reason: safeReason, rank: Number(rank || 0) },
  });
  return { status: result.changed ? "saved" : "unchanged", changed: result.changed, operationId: opId, eventId: result.event.eventId, itemId, level, reason: safeReason };
}

function checkpointImpl(rootValue, {
  operationId,
  summary = "現在のClarity状態をcheckpointしました",
  failAt = process.env.CLARITY_CHECKPOINT_FAIL_AT || "",
} = {}) {
  const canonical = readCanonical(rootValue);
  fail(canonical.project.schemaVersion === CLARITY_SCHEMA_VERSION, "migration-required", "checkpointの前にschema migrationが必要です。", { changed: false, nextAction: "clarity migrate previewを確認してください" });
  const opId = operationId || stableId("op", `${canonical.project.clarityProjectId}:checkpoint:${nowIso()}`);
  const priorSame = canonical.events.find((event) => event.type === "checkpoint.recorded" && event.payload?.operationId === opId);
  if (priorSame) return { status: "unchanged", operationId: opId, eventId: priorSame.eventId, duplicate: false };
  const state = buildState(canonical.project, canonical.events, canonical.evidence);
  const active = state.items.filter((item) => item.attentionEligible).map((item) => ({ itemId: item.itemId, reasons: item.attentionReasons }));
  const proof = appendEvidence(canonical.root, {
    evidenceId: stableId("ce", `${canonical.project.clarityProjectId}:checkpoint:${opId}`),
    type: "agent-observation",
    source: "clarity-checkpoint",
    locator: { operationId: opId, kind: "checkpoint" },
    summary: oneLine(summary, "Checkpoint summary", 240),
    observedAt: nowIso(),
    contentDigest: sha256(JSON.stringify({ operationId: opId, active })),
  });
  if (failAt === "after-evidence") {
    throw new ClarityError("checkpoint-partial", "checkpointのEvidenceは保存済みですが、Eventが未完了です。再実行で残りだけを完了できます。", 4, {
      operationId: opId, changed: true, completed: ["checkpoint-evidence"], pending: ["resolution-events", "checkpoint-event"],
    });
  }
  const refreshed = readCanonical(canonical.root);
  const previous = [...refreshed.events].reverse().find((event) => event.type === "checkpoint.recorded");
  const currentById = new Map(active.map((row) => [row.itemId, new Set(row.reasons)]));
  let resolvedCount = 0;
  for (const old of previous?.payload?.active || []) {
    for (const reason of old.reasons || []) {
      if (currentById.get(old.itemId)?.has(reason)) continue;
      const result = appendEvent(canonical.root, {
        eventId: stableId("cv", `${canonical.project.clarityProjectId}:attention-resolved:${opId}:${old.itemId}:${reason}`),
        type: "attention.resolved",
        itemId: old.itemId,
        actor: "clarity-checkpoint",
        occurredAt: nowIso(),
        payload: { operationId: opId, reason, previousCheckpointId: previous.eventId },
      });
      if (result.changed) resolvedCount += 1;
    }
  }
  if (failAt === "before-event") {
    throw new ClarityError("checkpoint-partial", "解消履歴まで保存済みですが、checkpoint Eventが未完了です。再実行で収束します。", 4, {
      operationId: opId, changed: true, completed: ["checkpoint-evidence", "resolution-events"], pending: ["checkpoint-event"],
    });
  }
  const recorded = appendEvent(canonical.root, {
    eventId: stableId("cv", `${canonical.project.clarityProjectId}:checkpoint:${opId}`),
    type: "checkpoint.recorded",
    itemId: null,
    actor: "clarity-checkpoint",
    occurredAt: nowIso(),
    payload: { operationId: opId, evidenceId: proof.evidence.evidenceId, active },
  });
  return { status: recorded.changed || proof.changed || resolvedCount ? "saved" : "unchanged", operationId: opId, eventId: recorded.event.eventId, evidenceId: proof.evidence.evidenceId, resolvedCount, duplicate: false };
}

function migratedItem(item) {
  return {
    ...item,
    schemaVersion: CLARITY_SCHEMA_VERSION,
    attentionContext: item.attentionContext || { impact: 0, urgency: 0, humanOverride: null, signals: [] },
  };
}

function migrationData(rootValue) {
  const root = rootPath(rootValue);
  const clarity = safeWritePath(root, ".clarity");
  fail(existsSync(clarity) && lstatSync(clarity).isDirectory() && !lstatSync(clarity).isSymbolicLink(), "clarity-not-initialized", "このRepoにはClarityが初期化されていません。");
  const projectPath = safeWritePath(root, ".clarity/project.json");
  let project;
  try { project = JSON.parse(readFileSync(projectPath, "utf8")); }
  catch { throw new ClarityError("migration-source-invalid", "旧schemaのproject.jsonがJSONではありません。変更していません。", 3, { changed: false }); }
  fail(Number.isInteger(project.schemaVersion), "migration-source-invalid", "旧schemaのversionを確認できません。変更していません。", { changed: false });
  fail(project.schemaVersion >= CLARITY_MIN_SCHEMA_VERSION && project.schemaVersion <= CLARITY_SCHEMA_VERSION,
    "migration-version-unsupported", "このschema versionは自動migration対象ではありません。変更していません。", { changed: false, schemaVersion: project.schemaVersion });
  if (project.schemaVersion === CLARITY_SCHEMA_VERSION) {
    validateProject(project);
    return { root, clarity, current: true, fromVersion: project.schemaVersion, toVersion: CLARITY_SCHEMA_VERSION, project, events: null, evidence: null, state: null };
  }
  const events = jsonLines(safeWritePath(root, ".clarity/events.jsonl"), validateEvent).map((event) => ({
    ...event,
    schemaVersion: CLARITY_SCHEMA_VERSION,
    ...(event.type === "item.discovered" ? { payload: { ...event.payload, item: migratedItem(event.payload.item) } } : {}),
  }));
  const evidence = jsonLines(safeWritePath(root, ".clarity/evidence.jsonl"), validateEvidence).map((row) => ({ ...row, schemaVersion: CLARITY_SCHEMA_VERSION }));
  const migratedProject = {
    ...project,
    schemaVersion: CLARITY_SCHEMA_VERSION,
    compatibility: { reader: { min: 1, max: CLARITY_SCHEMA_VERSION }, writer: { min: 1, max: CLARITY_SCHEMA_VERSION } },
  };
  validateProject(migratedProject);
  events.forEach(validateEvent);
  evidence.forEach(validateEvidence);
  let storedState;
  try { storedState = JSON.parse(readFileSync(safeWritePath(root, ".clarity/state.json"), "utf8")); }
  catch { throw new ClarityError("migration-source-invalid", "旧schemaのstate.jsonがJSONではありません。変更していません。", 3, { changed: false }); }
  const rebuiltState = buildState(migratedProject, events, evidence);
  const state = {
    ...storedState,
    ...rebuiltState,
    source: { ...(storedState.source || {}), ...rebuiltState.source },
    quadrants: { ...(storedState.quadrants || {}), ...rebuiltState.quadrants },
  };
  validateState(state);
  return { root, clarity, current: false, fromVersion: project.schemaVersion, toVersion: CLARITY_SCHEMA_VERSION, project: migratedProject, events, evidence, state };
}

function previewMigrationImpl(rootValue) {
  const data = migrationData(rootValue);
  return {
    status: data.current ? "current" : "preview",
    changed: false,
    fromVersion: data.fromVersion,
    toVersion: data.toVersion,
    writes: data.current ? [] : [".clarity/project.json", ".clarity/events.jsonl", ".clarity/evidence.jsonl", ".clarity/state.json"],
    preserves: ["Event history", "Evidence identity", "unknown fields", "利用者file", ".clarity/runtime"],
    eventCount: data.events?.length ?? readCanonical(data.root).events.length,
    evidenceCount: data.evidence?.length ?? readCanonical(data.root).evidence.length,
    nextAction: data.current ? "追加操作は不要です" : "内容を確認し、明示的に --apply を付けてください",
  };
}

function applyMigrationImpl(rootValue, { failAt = process.env.CLARITY_MIGRATION_FAIL_AT || "" } = {}) {
  const data = migrationData(rootValue);
  if (data.current) return { ...previewMigration(data.root), status: "unchanged" };
  const nonce = `${process.pid}-${Date.now()}`;
  const stage = safeWritePath(data.root, `.clarity-migrate-${nonce}`);
  const backup = safeWritePath(data.root, `.clarity-migrate-backup-${nonce}`);
  let swapped = false;
  let backedUp = false;
  try {
    copyTreeNoFollow(data.clarity, stage);
    writeFileSync(join(stage, "project.json"), stableJson(data.project), "utf8");
    writeFileSync(join(stage, "events.jsonl"), `${data.events.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
    writeFileSync(join(stage, "evidence.jsonl"), `${data.evidence.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
    writeFileSync(join(stage, "state.json"), stableJson(data.state), "utf8");
    if (failAt === "before-swap") throw new Error("migration-before-swap");
    renameSync(data.clarity, backup); backedUp = true;
    if (failAt === "after-backup") throw new Error("migration-after-backup");
    renameSync(stage, data.clarity); swapped = true;
    if (failAt === "after-swap") throw new Error("migration-after-swap");
    rmSync(backup, { recursive: true, force: true }); backedUp = false;
  } catch (error) {
    if (swapped && existsSync(data.clarity)) rmSync(data.clarity, { recursive: true, force: true });
    if (backedUp && existsSync(backup)) renameSync(backup, data.clarity);
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
    throw new ClarityError("migration-failed", "migrationは完了せず、旧schemaを利用可能な状態へ戻しました。再実行できます。", 4, {
      changed: false, fromVersion: data.fromVersion, toVersion: data.toVersion, error: error instanceof Error ? error.message : String(error), nextAction: "原因を確認してmigrate --applyを再実行してください",
    });
  }
  return { status: "migrated", changed: true, fromVersion: data.fromVersion, toVersion: data.toVersion, eventCount: data.events.length, evidenceCount: data.evidence.length, preservedHistory: true, nextAction: "doctorで整合を確認してください" };
}

const ownedRuntimeName = /^(?:lock\.json|checkpoint-[a-f0-9_-]+\.json|operation-[a-f0-9_-]+\.json|\.tmp-[a-f0-9_-]+)$/u;

function previewRuntimeCleanupImpl(rootValue, { clock = nowIso() } = {}) {
  const canonical = readCanonical(rootValue);
  const runtime = safeWritePath(canonical.root, ".clarity/runtime");
  const candidates = [];
  const preserved = [];
  function inspectOwnedRecord(rel, path) {
    let record;
    try { record = JSON.parse(readFileSync(path, "utf8")); }
    catch { preserved.push({ path: rel, reason: "ownership-unverified" }); return; }
    if (record.owner !== "agentic-secretary:clarity") { preserved.push({ path: rel, reason: "not-owned" }); return; }
    const expiresAt = record.expiresAt || record.staleAfter;
    if (!expiresAt || Number.isNaN(new Date(expiresAt).valueOf()) || new Date(expiresAt).valueOf() > new Date(clock).valueOf()) {
      preserved.push({ path: rel, reason: "active-or-unverified" }); return;
    }
    candidates.push({ path: rel, reason: "owned-stale-runtime", expiresAt });
  }
  const canonicalLock = safeWritePath(canonical.root, CANONICAL_LOCK_REL);
  if (existsSync(canonicalLock)) {
    const stat = lstatSync(canonicalLock);
    if (!stat.isFile() || stat.isSymbolicLink()) preserved.push({ path: CANONICAL_LOCK_REL, reason: "not-owned" });
    else inspectOwnedRecord(CANONICAL_LOCK_REL, canonicalLock);
  }
  if (existsSync(runtime)) {
    fail(lstatSync(runtime).isDirectory() && !lstatSync(runtime).isSymbolicLink(), "runtime-unsafe", "runtime pathが安全な通常directoryではないため変更しません。");
    for (const entry of readdirSync(runtime, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const rel = `.clarity/runtime/${entry.name}`;
      if (!entry.isFile() || entry.isSymbolicLink() || !ownedRuntimeName.test(entry.name)) { preserved.push({ path: rel, reason: "not-owned" }); continue; }
      inspectOwnedRecord(rel, join(runtime, entry.name));
    }
  }
  return { status: candidates.length ? "cleanup-available" : "clean", changed: false, candidates, preserved, nextAction: candidates.length ? "内容を確認し、明示的に cleanup --apply を付けてください" : "追加操作は不要です" };
}

function applyRuntimeCleanupImpl(rootValue, options = {}) {
  const preview = previewRuntimeCleanup(rootValue, options);
  const root = rootPath(rootValue);
  for (const candidate of preview.candidates) {
    const path = resolve(root, candidate.path);
    const stat = lstatSync(path);
    fail(stat.isFile() && !stat.isSymbolicLink(), "runtime-changed", "cleanup対象がpreview後に変わったため、削除していません。", { changed: false, path: candidate.path });
    let record;
    try { record = JSON.parse(readFileSync(path, "utf8")); } catch { record = null; }
    fail(record?.owner === "agentic-secretary:clarity" && (record.expiresAt || record.staleAfter) === candidate.expiresAt,
      "runtime-changed", "cleanup対象の所有情報がpreview後に変わったため、削除していません。", { changed: false, path: candidate.path });
  }
  const removed = [];
  for (const candidate of preview.candidates) {
    if (removeSafe(root, candidate.path).removed) removed.push(candidate.path);
  }

  let runtimeDirectory = { status: "preserved", removed: false, reason: removed.length ? "not-empty" : "no-owned-runtime-removed" };
  if (removed.length) {
    try {
      const runtime = safeDeletePath(root, ".clarity/runtime");
      if (!existsSync(runtime)) runtimeDirectory = { status: "missing", removed: false, reason: "already-missing" };
      else {
        const stat = lstatSync(runtime);
        if (!stat.isDirectory() || stat.isSymbolicLink()) runtimeDirectory = { status: "preserved", removed: false, reason: "unsafe-or-changed" };
        else if (readdirSync(runtime).length > 0) runtimeDirectory = { status: "preserved", removed: false, reason: "not-empty" };
        else {
          try {
            // rmdirSyncは空directoryだけを削除する。直前確認後にentryが増えても再帰削除せず保持する。
            rmdirSync(runtime);
            runtimeDirectory = { status: "removed", removed: true, reason: "empty-owned-runtime" };
          } catch (error) {
            if (error?.code === "ENOENT") runtimeDirectory = { status: "missing", removed: false, reason: "already-missing" };
            else if (["ENOTEMPTY", "EEXIST"].includes(error?.code)) runtimeDirectory = { status: "preserved", removed: false, reason: "not-empty" };
            else runtimeDirectory = { status: "preserved", removed: false, reason: "directory-cleanup-failed", errorCode: error?.code || "unknown" };
          }
        }
      }
    } catch (error) {
      runtimeDirectory = { status: "preserved", removed: false, reason: "unsafe-or-changed", errorCode: error?.code || "unknown" };
    }
  }

  const changed = removed.length > 0 || runtimeDirectory.removed;
  return { ...preview, status: changed ? "cleaned" : "unchanged", changed, removed, runtimeDirectory, nextAction: changed ? "doctorでruntime状態を再確認してください" : "追加操作は不要です" };
}

function readStoredState(root) {
  const path = safeWritePath(root, ".clarity/state.json");
  if (!existsSync(path)) return { state: null, error: "state-missing" };
  try {
    const state = JSON.parse(readFileSync(path, "utf8"));
    validateState(state);
    return { state, error: null };
  } catch (error) {
    return { state: null, error: error instanceof ClarityError ? error.code : "state-json-invalid" };
  }
}

function hookDiagnostic(root, { host = null, hookState = null } = {}) {
  const normalizedHost = host === "claude" ? "claudeCode" : host;
  const normalizedState = String(hookState || "").toLowerCase();
  const validStates = new Set(["supported", "verified", "degraded", "unverified", "untrusted", "disabled", "failure"]);
  if (normalizedState && !validStates.has(normalizedState)) throw new ClarityError("hook-state-invalid", "Hook状態はsupported／verified／degraded／unverified／untrusted／disabled／failureで指定してください。");
  if (normalizedState === "untrusted") {
    return {
      status: "degraded",
      host: normalizedHost || "codex",
      supported: true,
      verified: false,
      reason: "Hookの定義は認識されていますが、trust未承認のため実行されません",
      nextAction: "Codexの /hooks を開き、現在のHook定義をreviewしてtrustしてください。trust前もmanual Skillは利用できます",
    };
  }
  if (["disabled", "failure", "degraded"].includes(normalizedState)) {
    return {
      status: "degraded",
      host: normalizedHost,
      supported: true,
      verified: false,
      reason: normalizedState === "disabled" ? "Hookが無効です" : normalizedState === "failure" ? "Hook commandが失敗しています" : "Hookはdegraded状態です",
      nextAction: "manualのclarity status／attention／checkpointを使い、doctorで原因を確認してください",
    };
  }
  if (normalizedState === "verified") return { status: "verified", host: normalizedHost, supported: true, verified: true, reason: "指定hostの実event証拠があります", nextAction: "追加操作は不要です" };
  if (normalizedState === "supported") return { status: "supported", host: normalizedHost, supported: true, verified: false, reason: "manifest／fixtureで対応していますが実eventは未検証です", nextAction: "対象hostの実eventを別々に確認してください" };
  const eventsRoot = safeWritePath(root, ".clarity/runtime/hooks/events");
  const hosts = new Set();
  if (existsSync(eventsRoot) && lstatSync(eventsRoot).isDirectory() && !lstatSync(eventsRoot).isSymbolicLink()) {
    for (const session of readdirSync(eventsRoot).slice(0, 80)) {
      const directory = join(eventsRoot, session);
      if (!existsSync(directory) || !lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) continue;
      for (const name of readdirSync(directory).filter((value) => /^he_[a-f0-9]{24}\.json$/u.test(value)).slice(-80)) {
        try { const event = JSON.parse(readFileSync(join(directory, name), "utf8")); if (["codex", "claudeCode"].includes(event.host)) hosts.add(event.host); } catch { /* invalid runtime evidence never becomes verified */ }
      }
    }
  }
  const selectedSeen = normalizedHost ? hosts.has(normalizedHost) : hosts.size > 0;
  return {
    status: selectedSeen ? "supported" : "unverified",
    host: normalizedHost,
    supported: true,
    verified: false,
    observedHosts: [...hosts].sort(),
    reason: selectedSeen ? "runtime eventはありますが、実host live評価のverified判定は別管理です" : "Hook live eventは未検証です",
    nextAction: normalizedHost === "codex" ? "Codexの /hooks でtrust／disabled状態を確認し、実eventを検証してください" : "対象hostのplugin load／disable／実eventを検証してください",
  };
}

function linkedProjectDiagnostic(root, project) {
  const link = project.secretaryLink;
  if (!link?.linkId) return { status: "not-linked", healthy: true, stale: false, reason: "active linkはありません" };
  if (!/^cl_[a-f0-9]{20}$/u.test(link.linkId)) return { status: "broken", healthy: false, stale: false, reason: "Project metadataのlink IDが不正です", issues: ["link-id-invalid"] };
  const path = safeWritePath(root, `.clarity/links/${link.linkId}.json`);
  if (!existsSync(path)) return { status: "broken", healthy: false, stale: false, reason: "reciprocal manifestがありません", issues: ["manifest-missing"] };
  let manifest;
  try { manifest = JSON.parse(readFileSync(path, "utf8")); }
  catch { return { status: "broken", healthy: false, stale: false, reason: "reciprocal manifestがJSONではありません", issues: ["manifest-invalid"] }; }
  const issues = [];
  if (manifest.linkId !== link.linkId) issues.push("link-id-mismatch");
  if (manifest.local?.projectId !== project.clarityProjectId) issues.push("project-id-mismatch");
  if (manifest.manifestDigest !== link.manifestDigest) issues.push("manifest-digest-mismatch");
  if (manifest.state !== "active") issues.push(`link-${manifest.state || "unknown"}`);
  const metaPath = safeWritePath(root, `.clarity/imports/${link.linkId}/meta.json`);
  let importedAt = null;
  if (existsSync(metaPath)) {
    try { importedAt = JSON.parse(readFileSync(metaPath, "utf8")).importedAt || null; }
    catch { issues.push("import-meta-invalid"); }
  }
  const stale = !importedAt || Number.isNaN(new Date(importedAt).valueOf()) || new Date(nowIso()).valueOf() - new Date(importedAt).valueOf() > 7 * 86_400_000;
  if (stale) issues.push("sync-stale");
  return { status: issues.length ? "broken" : "healthy", healthy: !issues.length, stale, reason: issues.length ? "linkの再確認が必要です" : "reciprocal linkとimportは正常です", linkId: link.linkId, peerProjectId: link.peerProjectId, importedAt, issues };
}

function xmindDiagnostic(root) {
  const settingsPath = safeWritePath(root, ".clarity/xmind-settings.json");
  if (!existsSync(settingsPath)) return { status: "disabled", enabled: false, source: "default", verified: true };
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (settings.schemaVersion !== 1 || typeof settings.xmindEnabled !== "boolean") return { status: "broken", enabled: false, source: "explicit-setting", verified: false, issue: "settings-invalid" };
    return { status: settings.xmindEnabled ? "enabled" : "disabled", enabled: settings.xmindEnabled, source: "explicit-setting", verified: true };
  } catch {
    return { status: "broken", enabled: false, source: "explicit-setting", verified: false, issue: "settings-json-invalid" };
  }
}

function doctorImpl(rootValue, options = {}) {
  const canonical = readCanonical(rootValue);
  const expected = buildState(canonical.project, canonical.events, canonical.evidence);
  const expectedBytes = stableJson(expected);
  const stored = readStoredState(canonical.root);
  const storedBytes = stored.state ? stableJson(stored.state) : null;
  const humanConfirmationMismatch = stored.error === "human-confirmation-invalid" || Boolean(stored.state && stored.state.items.some((item) => {
    const rebuilt = expected.items.find((candidate) => candidate.itemId === item.itemId);
    return rebuilt && (item.decision.humanConfirmed !== rebuilt.decision.humanConfirmed || item.decision.status !== rebuilt.decision.status);
  }));
  const cleanup = previewRuntimeCleanup(canonical.root);
  const schemaStatus = canonical.project.schemaVersion === CLARITY_SCHEMA_VERSION ? "current" : "migration-available";
  const projectionOk = !stored.error && storedBytes === expectedBytes;
  const hook = hookDiagnostic(canonical.root, options);
  const link = linkedProjectDiagnostic(canonical.root, canonical.project);
  const xmind = xmindDiagnostic(canonical.root);
  return {
    ok: projectionOk && cleanup.candidates.length === 0 && !["degraded", "untrusted", "failure"].includes(hook.status) && link.healthy && xmind.status !== "broken",
    mode: canonical.project.mode,
    schemaVersion: canonical.project.schemaVersion,
    currentSchemaVersion: CLARITY_SCHEMA_VERSION,
    schemaStatus,
    clarityProjectId: canonical.project.clarityProjectId,
    repoIdentity: canonical.project.repoIdentity,
    remoteStatus: canonical.project.repoIdentity.remote.status,
    stateError: stored.error,
    stateMismatch: storedBytes !== expectedBytes,
    humanConfirmationMismatch,
    eventCount: canonical.events.length,
    evidenceCount: canonical.evidence.length,
    itemCount: expected.items.length,
    rootEntry: canonical.project.rootEntry,
    capabilities: {
      hook,
      link,
      xmind,
      projection: { status: projectionOk ? "正常" : "要再構築", verified: projectionOk },
      lock: { status: cleanup.candidates.length ? "残骸あり" : "残骸なし", verified: true },
    },
    runtimeCleanup: cleanup,
    nextAction: schemaStatus === "migration-available" ? "migrate previewを確認してください" : cleanup.candidates.length ? "cleanup previewを確認してください" : !link.healthy ? "link mapping／manual bundle／manifestを確認してください" : !["supported", "verified"].includes(hook.status) ? hook.nextAction : projectionOk ? "追加操作は不要です" : "clarity rebuildを実行してください",
  };
}

function statusImpl(rootValue) {
  const canonical = readCanonical(rootValue);
  const state = buildState(canonical.project, canonical.events, canonical.evidence);
  const attentionResult = evaluateAttention(state, canonical.evidence, { limit: 3 });
  return {
    conclusion: attentionResult.conclusion,
    clarityProjectId: canonical.project.clarityProjectId,
    name: canonical.project.name,
    mode: canonical.project.mode,
    repoIdentity: canonical.project.repoIdentity,
    linkHealth: linkedProjectDiagnostic(canonical.root, canonical.project),
    itemCount: state.items.length,
    quadrants: Object.fromEntries(Object.entries(state.quadrants).map(([key, ids]) => [key, { label: quadrantMeta[key].label, count: ids.length }])),
    partial: doctor(canonical.root).stateMismatch,
    matrixLabel: "決定×実行クラリティマトリクス",
    attention: { activeCount: attentionResult.activeCount, counts: attentionResult.counts, top: attentionResult.items, otherCount: attentionResult.otherCount, detailPath: attentionResult.detailPath },
  };
}

function historyImpl(rootValue) {
  const canonical = readCanonical(rootValue);
  return {
    clarityProjectId: canonical.project.clarityProjectId,
    events: canonical.events.map((event) => ({ eventId: event.eventId, type: event.type, itemId: event.itemId, actor: event.actor, occurredAt: event.occurredAt, ...(event.type === "attention.resolved" ? { resolution: event.payload } : {}) })),
    evidence: canonical.evidence.map((item) => ({ evidenceId: item.evidenceId, type: item.type, source: item.source, locator: item.locator, observedAt: item.observedAt, availability: item.availability })),
    resolvedAttention: canonical.events.filter((event) => event.type === "attention.resolved").map((event) => ({ eventId: event.eventId, itemId: event.itemId, reason: event.payload.reason, occurredAt: event.occurredAt })),
    alignmentHistory: canonical.events.filter((event) => event.type === "alignment.changed" || event.type === "drift.waiver.recorded").map((event) => ({
      eventId: event.eventId,
      type: event.type,
      itemId: event.itemId,
      occurredAt: event.occurredAt,
      status: event.payload.status,
      reason: event.payload.reason || null,
      scope: event.type === "drift.waiver.recorded" ? event.payload.scope : null,
      expiresAt: event.type === "drift.waiver.recorded" ? event.payload.expiresAt : null,
      operationId: event.payload.operationId || null,
    })),
  };
}

function projectDecisionFiles(secretaryRoot, projectName) {
  const name = oneLine(projectName, "Project name", 100);
  fail(!/[\\/]/u.test(name) && !name.includes(".."), "project-name-invalid", "Project名が安全ではありません。");
  const projectDir = safeWritePath(secretaryRoot, `projects/open/${name}`);
  fail(existsSync(projectDir) && lstatSync(projectDir).isDirectory() && !lstatSync(projectDir).isSymbolicLink(), "project-missing", "generic open projectが見つかりません。");
  return { projectDir, projectFile: safeWritePath(secretaryRoot, `projects/open/${name}/PROJECT.md`), decisionsFile: safeWritePath(secretaryRoot, `projects/open/${name}/DECISIONS.md`) };
}

function findDecision(files, decision) {
  const escaped = decision.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const path of [files.projectFile, files.decisionsFile]) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const match = text.match(new RegExp(`(D-\\d{3})[^\\n]*${escaped}`, "u"));
    if (match) return { id: match[1], path: basename(path) };
  }
  return null;
}

function rawCanonicalDigest(root) {
  const rows = [];
  for (const rel of [".clarity/project.json", ".clarity/events.jsonl", ".clarity/evidence.jsonl", ".clarity/state.json"]) {
    const path = join(root, rel);
    let stat;
    try { stat = lstatSync(path); } catch { throw new ClarityError("clarity-root-changed", "Secretary Project更新後のClarity canonicalを再確認できません。", 3, { changed: false }); }
    fail(stat.isFile() && !stat.isSymbolicLink(), "clarity-root-changed", "Secretary Project更新後のClarity canonical pathが安全ではありません。", { changed: false });
    rows.push(`${rel}:${sha256(readFileSync(path))}`);
  }
  return sha256(rows.join("\n"));
}

function decideGenericProjectImpl(rootValue, {
  secretaryRoot: secretaryRootValue,
  projectName,
  itemId,
  decision,
  current,
  next,
  operationId,
  failAt = process.env.CLARITY_DECISION_FAIL_AT || "",
} = {}) {
  const root = rootPath(rootValue);
  const secretary = rootPath(secretaryRootValue);
  const files = projectDecisionFiles(secretary, projectName);
  const canonical = readCanonical(root);
  const expectedProjectRoot = canonical.project.mode === "secretary-local" ? dirname(root) : root;
  fail(realpathSync(files.projectDir) === expectedProjectRoot, "project-root-mismatch", "Clarity rootとgeneric project rootが一致しません。別Repoへwriteしません。");
  const selectedItem = itemId || buildState(canonical.project, canonical.events, canonical.evidence).items[0]?.itemId;
  fail(selectedItem, "item-missing", "Decisionを関連付けるClarity Itemがありません。");
  const safeDecision = oneLine(decision, "Decision", 240);
  const safeCurrent = oneLine(current, "Current status", 240);
  const safeNext = oneLine(next, "Next entry", 240);
  const opId = operationId || stableId("op", `${canonical.project.clarityProjectId}:${projectName}:${safeDecision}`);
  const prior = canonical.events.filter((event) => event.payload?.operationId === opId);
  if (prior.some((event) => event.type === "decision.confirmed")) {
    return { status: "unchanged", operationId: opId, decision: findDecision(files, safeDecision), duplicate: false };
  }
  let pendingChanged = false;
  if (!prior.some((event) => event.type === "decision.pending")) {
    pendingChanged = appendEvent(root, { type: "decision.pending", itemId: selectedItem, actor: "human-confirmation", payload: { operationId: opId, source: "generic-project-decision", humanConfirmed: false } }).changed;
  }
  let stored = findDecision(files, safeDecision);
  let projectDecisionChanged = false;
  if (!stored) {
    const canonicalBeforeProjectWrite = rawCanonicalDigest(root);
    if (failAt === "decision-write") {
      throw new ClarityError("decision-partial", "Clarityには確認待ちを記録しましたが、Decision正本の書込みに失敗しました。確定表示していません。", 4, {
        operationId: opId,
        changed: pendingChanged,
        completed: ["clarity-pending"],
        pending: ["project-decision", "clarity-confirmation"],
        nextAction: "同じDecisionを再実行し、Project正本とClarity確定Eventの未完了分だけを完了してください",
      });
    }
    const projectTool = resolve(dirname(fileURLToPath(import.meta.url)), "../project-tools.mjs");
    let result;
    try {
      result = runExternalSync(process.execPath, [projectTool, "add-decision", secretary, projectName, "--decision", safeDecision, "--current", safeCurrent, "--next", safeNext, "--confirm"], {
        encoding: "utf8",
        timeoutMs: 15_000,
        maxBuffer: 2 * 1024 * 1024,
        allowFailure: true,
        label: "generic project Decision write",
        env: { ...process.env, CC_SECRETARY_NOW: process.env.CC_SECRETARY_NOW || nowIso() },
      });
    } catch (error) {
      throw new ClarityError("decision-partial", "Clarityには確認待ちを記録しましたが、既存Decision正本の処理が安全に完了しませんでした。確定表示していません。", 4, {
        operationId: opId,
        changed: pendingChanged,
        completed: ["clarity-pending"],
        pending: ["project-decision", "clarity-confirmation"],
        nextAction: "原因を確認して同じDecisionを再実行し、未完了分だけを完了してください",
        decisionError: error?.code || "external-operation-failed",
      });
    }
    if (result.status !== 0) {
      throw new ClarityError("decision-partial", "Clarityには確認待ちを記録しましたが、既存Decision正本は更新できませんでした。確定表示していません。", 4, {
        operationId: opId,
        changed: pendingChanged,
        completed: ["clarity-pending"],
        pending: ["project-decision", "clarity-confirmation"],
        nextAction: "原因を確認して同じDecisionを再実行し、未完了分だけを完了してください",
        decisionExit: result.status,
        decisionError: String(result.stderr || "").trim().slice(0, 300),
      });
    }
    const canonicalAfterProjectWrite = rawCanonicalDigest(root);
    fail(canonicalAfterProjectWrite === canonicalBeforeProjectWrite, "clarity-root-changed", "Project更新中にClarity canonicalの実体が変わったため、確定Eventを書かず停止しました。", { changed: false });
    refreshClarityRootAfterOwnedReplacement(root);
    stored = findDecision(files, safeDecision);
    fail(stored, "decision-write-unverified", "既存Decision seam成功後の正本を再確認できませんでした。");
    projectDecisionChanged = true;
  }
  if (failAt === "clarity-finalize") {
    throw new ClarityError("decision-partial", "Decision正本は更新済みですが、Clarity確定Eventが未完了です。再実行はDecisionを重複せず残りだけ完了します。", 4, {
      operationId: opId,
      changed: pendingChanged || projectDecisionChanged,
      completed: ["project-decision"],
      pending: ["clarity-confirmation"],
      nextAction: "同じDecisionを再実行し、Clarity確定Eventだけを完了してください",
      decision: stored,
    });
  }
  const result = appendEvent(root, {
    type: "decision.confirmed",
    itemId: selectedItem,
    actor: "human-confirmation",
    payload: {
      operationId: opId,
      source: "generic-project-decision",
      humanConfirmed: true,
      authority: "project-decision-canonical",
      decisionRef: `${stored.path}#${stored.id}`,
    },
  });
  return { status: result.changed ? "saved" : "unchanged", operationId: opId, decision: stored, eventId: result.event.eventId, duplicate: false };
}

function runRootRequest(rootValue, operation) {
  return withClarityRootObservation(rootValue, (handle) => operation(handle.root));
}

export function inspectRepoIdentity(rootValue) { return runRootRequest(rootValue, inspectRepoIdentityImpl); }
export function scanRepository(rootValue) { return runRootRequest(rootValue, scanRepositoryImpl); }
export function findCanonicalItem(rootValue, itemId) { return runRootRequest(rootValue, (root) => findCanonicalItemImpl(root, itemId)); }
export function rebuildState(rootValue, options = {}) { return runRootRequest(rootValue, (root) => rebuildStateImpl(root, options)); }
export function previewInit(rootValue) { return runRootRequest(rootValue, previewInitImpl); }
export function applyInit(rootValue) { return runRootRequest(rootValue, applyInitImpl); }
export function appendEvent(rootValue, input) { return runRootRequest(rootValue, (root) => appendEventImpl(root, input)); }
export function appendEvidence(rootValue, input) { return runRootRequest(rootValue, (root) => appendEvidenceImpl(root, input)); }
export function attention(rootValue, options = {}) { return runRootRequest(rootValue, (root) => attentionImpl(root, options)); }
export function setAttentionOverride(rootValue, options = {}) { return runRootRequest(rootValue, (root) => setAttentionOverrideImpl(root, options)); }
export function checkpoint(rootValue, options = {}) { return runRootRequest(rootValue, (root) => checkpointImpl(root, options)); }
export function previewMigration(rootValue) { return runRootRequest(rootValue, previewMigrationImpl); }
export function applyMigration(rootValue, options = {}) { return runRootRequest(rootValue, (root) => applyMigrationImpl(root, options)); }
export function previewRuntimeCleanup(rootValue, options = {}) { return runRootRequest(rootValue, (root) => previewRuntimeCleanupImpl(root, options)); }
export function applyRuntimeCleanup(rootValue, options = {}) { return runRootRequest(rootValue, (root) => applyRuntimeCleanupImpl(root, options)); }
export function doctor(rootValue, options = {}) { return runRootRequest(rootValue, (root) => doctorImpl(root, options)); }
export function status(rootValue) { return runRootRequest(rootValue, statusImpl); }
export function history(rootValue) { return runRootRequest(rootValue, historyImpl); }
export function decideGenericProject(rootValue, options = {}) { return runRootRequest(rootValue, (root) => decideGenericProjectImpl(root, options)); }
