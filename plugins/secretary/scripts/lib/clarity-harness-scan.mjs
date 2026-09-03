import { closeSync, existsSync, lstatSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, extname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";

// agentic-secretary:clarity-harness-authoritative-scan:v1
export const HARNESS_SCAN_LIMITS = Object.freeze({
  maxReadBytes: 512 * 1024,
  maxFiles: 16,
  maxEntries: 32,
  maxFileBytes: 96 * 1024,
  maxStateSectionBytes: 128 * 1024,
  maxSpecReferences: 8,
});

const sensitiveNamePattern = /(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_[a-z0-9_-]+|.*(?:credential|secret|private[-_]?key|oauth|token).*)$/iu;
const secretValuePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[A-Z0-9]{16}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /(?:password|api[_-]?key|api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential)\s*[:=]\s*[^\s,;]+/iu,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@[^/\s]+/iu,
];
const credentialAssignmentPattern = /(?:password|api[_-]?key|api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential)\s*[:=]\s*([^\s,;]+)/giu;
const directSecretPatterns = secretValuePatterns.filter((_, index) => index !== 4);
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".gz", ".7z", ".exe", ".dll"]);
const currentIdPattern = /^sprint-\d{3}(?:-patch-\d{3})?$/u;
const currentIdToken = "sprint-\\d{3}(?:-patch-\\d{3})?";
const windowsReservedPattern = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function stableDigest(value) { return sha256(JSON.stringify(value)); }
function normalizeRelative(value) { return String(value ?? "").split("\\").join("/").replace(/^\.\//u, ""); }
function containsSecret(value) { return secretValuePatterns.some((pattern) => pattern.test(String(value ?? ""))); }
function placeholderValue(value) {
  let token = String(value ?? "").trim().replace(/[),.;]+$/u, "");
  token = token.replace(/^`+/u, "").replace(/`+$/u, "").replace(/[),.;]+$/u, "");
  if ((token.startsWith("\"") && token.endsWith("\"")) || (token.startsWith("'") && token.endsWith("'")) || (token.startsWith("`") && token.endsWith("`"))) token = token.slice(1, -1);
  return /^<[^<>\r\n]{1,80}>$/u.test(token)
    || /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/u.test(token)
    || /^\$[A-Za-z_][A-Za-z0-9_]*$/u.test(token)
    || /^(?:[*xX•._-]){3,}$/u.test(token)
    || /^(?:redacted|masked|placeholder|change[-_]?me|replace[-_]?me)$/iu.test(token);
}
function containsActualSecret(value) {
  const content = String(value ?? "");
  if (directSecretPatterns.some((pattern) => pattern.test(content))) return true;
  for (const match of content.matchAll(credentialAssignmentPattern)) {
    if (!placeholderValue(match[1])) return true;
  }
  return false;
}
function looksBinary(bytes, path) {
  if (binaryExtensions.has(extname(path).toLowerCase())) return true;
  return bytes.subarray(0, Math.min(bytes.length, 8192)).includes(0);
}

export function classifyHarnessRelativePath(value, { platform = process.platform } = {}) {
  const path = normalizeRelative(value);
  if (!path || path.startsWith("/") || isAbsolute(path) || path.split("/").some((part) => !part || part === "." || part === "..")) {
    return { ok: false, reason: "path-invalid" };
  }
  if (platform === "win32") {
    for (const part of path.split("/")) {
      if (/[<>:"|?*]/u.test(part) || /[. ]$/u.test(part) || windowsReservedPattern.test(part)) {
        return { ok: false, reason: windowsReservedPattern.test(part) ? "windows-reserved-name" : "windows-invalid-path" };
      }
    }
    const parsed = win32.parse(path.replaceAll("/", "\\"));
    if (parsed.root || parsed.isAbsolute) return { ok: false, reason: "path-invalid" };
  }
  return { ok: true, path };
}

function exactEntry(root, relativePath) {
  const checked = classifyHarnessRelativePath(relativePath);
  if (!checked.ok) return checked;
  let cursor = root;
  for (const part of checked.path.split("/")) {
    let entries;
    try { entries = readdirSync(cursor, { withFileTypes: true }); }
    catch (error) {
      if (["ENOENT", "ENOTDIR"].includes(error?.code)) return { ok: false, reason: "not-found" };
      return { ok: false, reason: "directory-unreadable" };
    }
    const exact = entries.find((entry) => entry.name === part);
    if (!exact) {
      const folded = entries.filter((entry) => entry.name.toLocaleLowerCase("en-US") === part.toLocaleLowerCase("en-US"));
      if (folded.length) return { ok: false, reason: "path-case-mismatch" };
      return { ok: false, reason: "not-found" };
    }
    cursor = join(cursor, exact.name);
    let stat;
    try { stat = lstatSync(cursor); }
    catch (error) { return { ok: false, reason: error?.code === "ENOENT" ? "not-found" : "stat-failed" }; }
    if (stat.isSymbolicLink()) return { ok: false, reason: "symlink-not-followed" };
  }
  return { ok: true, path: checked.path, absolute: cursor };
}

function boundedRead(path, limit) {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(limit);
    const bytesRead = readSync(descriptor, buffer, 0, limit, 0);
    return buffer.subarray(0, bytesRead);
  } finally { closeSync(descriptor); }
}

function structuralState(content) {
  const fields = { currentId: [], nextPlanned: [] };
  const rows = [];
  let fenced = null;
  let inComment = false;
  for (const original of content.replaceAll("\r\n", "\n").split("\n")) {
    let line = original;
    if (inComment) {
      const end = line.indexOf("-->");
      if (end < 0) continue;
      line = line.slice(end + 3);
      inComment = false;
    }
    for (;;) {
      const start = line.indexOf("<!--");
      if (start < 0) break;
      const end = line.indexOf("-->", start + 4);
      if (end < 0) { line = line.slice(0, start); inComment = true; break; }
      line = `${line.slice(0, start)}${line.slice(end + 3)}`;
    }
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    const fence = fenceMatch?.[1] || null;
    if (fence) {
      if (!fenced) fenced = { char: fence[0], length: fence.length };
      else if (fence[0] === fenced.char && fence.length >= fenced.length && line.slice(fenceMatch[0].length).trim() === "") fenced = null;
      continue;
    }
    if (fenced) continue;

    const metadata = line.match(/^- (Current ID|Next Planned):\s*(.*?)\s*$/u);
    if (metadata) {
      const key = metadata[1] === "Current ID" ? "currentId" : "nextPlanned";
      fields[key].push({ value: containsActualSecret(metadata[2]) ? null : metadata[2], unsafe: containsActualSecret(metadata[2]) });
      continue;
    }
    const row = line.match(/^\|\s*(sprint-\d{3}(?:-patch-\d{3})?)\s*\|\s*([a-z-]+)\s*\|/u);
    if (row) rows.push({ id: row[1], status: row[2] });
  }
  return { fields, rows };
}

function resolveStateField(entries, name) {
  if (entries.some((entry) => entry.unsafe)) return { value: null, coverage: "unresolved", reason: `${name}-secret-redacted`, present: true };
  const values = [...new Set(entries.map((entry) => entry.value))];
  if (values.length === 0) return { value: null, coverage: "not-found", reason: `${name}-missing`, present: false };
  if (values.length > 1) return { value: null, coverage: "unresolved", reason: `${name}-ambiguous`, present: true };
  return { value: values[0], coverage: "inspected", reason: "resolved", present: true };
}

function parseDeclaredCurrentIds(value) {
  const raw = String(value ?? "").trim();
  if (raw === "TBD") return { valid: true, ids: [], expression: "TBD" };
  const match = raw.match(new RegExp(`^(${currentIdToken}(?:\\s*\\/\\s*${currentIdToken})*)\\s*(?:[（(].*[）)])?$`, "u"));
  if (!match) return { valid: false, ids: [], expression: null };
  const ids = match[1].split(/\s*\/\s*/u);
  return { valid: ids.length > 0 && ids.every((id) => currentIdPattern.test(id)), ids, expression: raw };
}

function inspectSource(root, path, role, lane, { stateSection = false, absentReason = "not-found" } = {}) {
  lane.entriesSeen += 1;
  if (lane.entriesSeen > HARNESS_SCAN_LIMITS.maxEntries || lane.filesRead >= HARNESS_SCAN_LIMITS.maxFiles || lane.bytesRead >= HARNESS_SCAN_LIMITS.maxReadBytes) {
    return { path, role, coverage: "uninspected", reason: "authoritative-lane-limit", bytesRead: 0 };
  }
  if (sensitiveNamePattern.test(path)) return { path, role, coverage: "excluded", reason: "sensitive-name", bytesRead: 0 };
  const entry = exactEntry(root, path);
  if (!entry.ok) return { path, role, coverage: entry.reason === "not-found" ? "not-found" : entry.reason === "symlink-not-followed" ? "excluded" : "uninspected", reason: entry.reason === "not-found" ? absentReason : entry.reason, bytesRead: 0 };
  let size;
  try {
    const stat = statSync(entry.absolute);
    if (!stat.isFile()) return { path, role, coverage: "excluded", reason: "non-regular-file", bytesRead: 0 };
    size = stat.size;
  } catch (error) { return { path, role, coverage: "uninspected", reason: error?.code === "EACCES" ? "permission-denied" : "stat-failed", bytesRead: 0 }; }
  const perFileLimit = stateSection ? HARNESS_SCAN_LIMITS.maxStateSectionBytes : HARNESS_SCAN_LIMITS.maxFileBytes;
  const remaining = Math.max(0, HARNESS_SCAN_LIMITS.maxReadBytes - lane.bytesRead);
  const readLimit = Math.min(perFileLimit, remaining, size);
  if (!stateSection && size > perFileLimit) return { path, role, coverage: "uninspected", reason: "file-too-large", size, bytesRead: 0 };
  let bytes;
  try { bytes = boundedRead(entry.absolute, readLimit); }
  catch (error) { return { path, role, coverage: "uninspected", reason: error?.code === "EACCES" ? "permission-denied" : "file-unreadable", size, bytesRead: 0 }; }
  lane.filesRead += 1;
  lane.bytesRead += bytes.length;
  if (looksBinary(bytes, path)) return { path, role, coverage: "excluded", reason: "binary", size, bytesRead: bytes.length };
  const content = bytes.toString("utf8");
  if (stateSection) {
    const structure = structuralState(content);
    const redacted = containsActualSecret(content);
    const bounded = bytes.length < size;
    const digestStructure = {
      fields: Object.fromEntries(Object.entries(structure.fields).map(([key, entries]) => [key, resolveStateField(entries, key)])),
      rows: structure.rows,
      bounded,
      redacted,
    };
    return {
      path,
      role,
      coverage: "inspected",
      reason: redacted ? (bounded ? "bounded-section-secret-redacted" : "secret-content-redacted") : bounded ? "bounded-section-read" : "complete",
      size,
      bytesRead: bytes.length,
      partial: bounded || redacted,
      bounded,
      redacted,
      redactionReason: redacted ? "secret-like-content" : null,
      digest: stableDigest(digestStructure),
      stateStructure: structure,
    };
  }
  if (containsSecret(content)) return { path, role, coverage: "excluded", reason: "secret-like-content", size, bytesRead: bytes.length };
  const partial = bytes.length < size;
  return {
    path,
    role,
    coverage: "inspected",
    reason: partial ? "bounded-section-read" : "complete",
    size,
    bytesRead: bytes.length,
    partial,
    digest: sha256(Buffer.concat([Buffer.from(partial ? "partial\0" : "complete\0"), bytes])),
    content,
    summary: (content.match(/^#\s+(.+)$/mu)?.[1] || basename(path)).trim().slice(0, 160),
  };
}

function parseState(source) {
  if (source.coverage !== "inspected") return { currentId: null, currentStatus: null, nextPlanned: null, sourceSection: null, fallbackSource: null, inferred: false, reason: source.reason };
  const currentField = resolveStateField(source.stateStructure?.fields?.currentId || [], "current-id");
  const nextField = resolveStateField(source.stateStructure?.fields?.nextPlanned || [], "next-planned");
  const currentRaw = currentField.value;
  const nextRaw = nextField.value;
  const rows = source.stateStructure?.rows || [];
  const declared = parseDeclaredCurrentIds(currentRaw);
  const currentValid = declared.valid;
  let resolvedIds = [...declared.ids];
  let fallbackSource = null;
  let inferred = false;
  const currentUnsafe = currentField.coverage === "unresolved";
  if (resolvedIds.length === 0 && !currentUnsafe) {
    if (currentIdPattern.test(nextRaw || "")) { resolvedIds = [nextRaw]; fallbackSource = "next-planned"; inferred = true; }
    else {
      const lastDone = [...rows].reverse().find((row) => ["done", "done-by-user-decision"].includes(row.status));
      if (lastDone) { resolvedIds = [lastDone.id]; fallbackSource = "last-recorded-completion"; inferred = true; }
    }
  }
  const currentEntries = resolvedIds.map((id) => {
    const matchingRows = rows.filter((row) => row.id === id);
    return { id, row: matchingRows.length === 1 ? matchingRows[0] : null, ambiguous: matchingRows.length > 1 };
  });
  const currentEntry = currentEntries[0] || null;
  const currentRow = currentEntry?.row || null;
  const rowAmbiguous = currentEntries.some((entry) => entry.ambiguous);
  const rowUnresolved = currentEntries.some((entry) => !entry.row);
  const reason = currentUnsafe ? currentField.reason
    : !currentField.present ? "current-id-missing"
      : !currentValid ? "current-id-invalid"
        : rowAmbiguous ? "current-row-ambiguous"
          : source.bounded && rowUnresolved ? "state-section-unresolved" : "resolved";
  return {
    currentId: currentEntry?.id || null,
    currentIds: resolvedIds,
    declaredCurrentId: currentValid && (currentRaw === "TBD" || declared.ids.length === 1) ? (currentRaw === "TBD" ? "TBD" : declared.ids[0]) : null,
    declaredCurrentIds: currentValid ? declared.ids : [],
    declaredCurrentExpression: currentValid ? declared.expression : null,
    declaredCurrentPresent: currentField.present,
    currentStatus: currentRow?.status || null,
    currentEntries: currentEntries.map((entry) => ({ id: entry.id, status: entry.row?.status || null, tableRow: entry.row ? { id: entry.row.id, status: entry.row.status } : null })),
    nextPlanned: nextField.coverage === "inspected" && (nextRaw === "TBD" || currentIdPattern.test(nextRaw || "")) ? nextRaw : null,
    tableRow: currentRow ? { id: currentRow.id, status: currentRow.status } : null,
    sourceSection: currentRow ? "sprint-table-row" : currentRaw ? "metadata" : null,
    fallbackSource,
    inferred,
    valid: Boolean(currentValid && currentRaw),
    reason,
    redacted: Boolean(source.redacted),
    redactionReason: source.redactionReason || null,
    fieldCoverage: {
      currentId: { coverage: currentField.coverage, reason: currentField.reason },
      currentStatus: { coverage: currentEntries.length > 0 && !rowUnresolved ? "inspected" : "unresolved", reason: currentEntries.length > 0 && !rowUnresolved ? "resolved" : rowAmbiguous ? "current-row-ambiguous" : "current-row-unresolved" },
      nextPlanned: { coverage: nextField.coverage, reason: nextField.reason },
      tableRow: { coverage: currentEntries.length > 0 && !rowUnresolved ? "inspected" : "unresolved", reason: currentEntries.length > 0 && !rowUnresolved ? "resolved" : rowAmbiguous ? "current-row-ambiguous" : "current-row-unresolved" },
    },
  };
}

function parseSpecReferences(source) {
  if (source.coverage !== "inspected") return [];
  const paths = [];
  for (const match of source.content.matchAll(/\((?:\.\/)?(spec\/[a-z0-9_.-]+\.md)\)/giu)) {
    const path = `docs/${normalizeRelative(match[1])}`;
    if (!paths.includes(path)) paths.push(path);
    if (paths.length >= HARNESS_SCAN_LIMITS.maxSpecReferences) break;
  }
  return paths;
}

function roleStatus(source, state) {
  if (source.role === "evaluator-validation" && source.coverage === "not-found" && source.reason === "evaluation-not-yet-recorded") return "not-recorded";
  if (source.coverage !== "inspected") return source.coverage;
  if (source.role === "evaluator-validation") {
    if (/\bVerdict:\s*\*\*PASS\*\*|\bVerdict:\s*PASS\b/iu.test(source.content)) return "passed";
    if (/\bVerdict:\s*\*\*FAIL\*\*|\bVerdict:\s*FAIL\b/iu.test(source.content)) return "failed";
    if (/verification-scope-issue/iu.test(source.content)) return "verification-scope-issue";
    return "recorded-unclassified";
  }
  if (source.role === "orchestrator-execution-truth") return state.currentStatus || "status-unresolved";
  return "available";
}

function executionStatus(status) {
  if (["active"].includes(status)) return "in_progress";
  if (["awaiting-eval"].includes(status)) return "implemented";
  if (["done", "done-by-user-decision"].includes(status)) return "implemented";
  return "not_started";
}

export function scanHarnessAuthoritative(rootValue) {
  const root = resolve(rootValue);
  const lane = {
    limits: { ...HARNESS_SCAN_LIMITS }, entriesSeen: 0, filesRead: 0, bytesRead: 0,
    inspected: [], excluded: [], uninspected: [], notFound: [], partialReasons: [],
  };
  const stateSource = inspectSource(root, "docs/sprints/state.md", "orchestrator-execution-truth", lane, { stateSection: true });
  const specSource = inspectSource(root, "docs/spec.md", "spec-index", lane);
  const state = parseState(stateSource);
  const markerPresent = existsSync(join(root, "docs/sprints/state.md")) || existsSync(join(root, "docs/spec.md"));
  let kind = "non-harness";
  let reason = "harness-markers-not-found";
  if (markerPresent && stateSource.coverage === "inspected" && !state.valid) { kind = "invalid"; reason = state.reason; }
  else if (markerPresent && (stateSource.coverage !== "inspected" || specSource.coverage !== "inspected")) { kind = "partial"; reason = "harness-structure-partial"; }
  else if (markerPresent && state.valid && specSource.coverage === "inspected") { kind = "harness"; reason = "state-and-spec-confirmed"; }

  const sources = [stateSource, specSource];
  const hasSafeFallback = kind === "invalid"
    && state.inferred === true
    && currentIdPattern.test(state.currentId || "")
    && ["next-planned", "last-recorded-completion"].includes(state.fallbackSource);
  const currentIds = state.currentIds?.length ? state.currentIds : state.currentId ? [state.currentId] : [];
  if (kind === "harness" || hasSafeFallback) {
    for (const id of currentIds) {
      sources.push({ ...inspectSource(root, `docs/sprints/${id}.md`, "requirements", lane), sprintId: id });
      sources.push({ ...inspectSource(root, `docs/progress/${id}.md`, "generator-self-report", lane), sprintId: id });
      sources.push({ ...inspectSource(root, `docs/feedback/${id}.md`, "evaluator-validation", lane, { absentReason: "evaluation-not-yet-recorded" }), sprintId: id });
    }
    sources.push(inspectSource(root, "AGENTS.md", "root-guidance", lane));
    sources.push(inspectSource(root, "CLAUDE.md", "root-guidance", lane));
    const manifestPath = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"].find((path) => existsSync(join(root, path))) || "package.json";
    sources.push(inspectSource(root, manifestPath, "package-manifest", lane));
    // Current execution truth must not be starved by a large spec tree. Read
    // bounded detail references only after the Current bundle and root/package
    // guidance have received their reserved slots.
    for (const specPath of parseSpecReferences(specSource)) sources.push(inspectSource(root, specPath, "requirements-reference", lane));
  }
  const sourceRoles = sources.map((source) => ({
    path: source.path,
    role: source.role,
    coverage: source.coverage,
    reason: source.reason,
    status: roleStatus(source, state),
    digest: source.digest || null,
    size: source.redacted && source.role === "orchestrator-execution-truth" ? null : source.size ?? null,
    bytesRead: source.redacted && source.role === "orchestrator-execution-truth" ? null : source.bytesRead || 0,
    bytesReadAtMost: source.redacted && source.role === "orchestrator-execution-truth" ? HARNESS_SCAN_LIMITS.maxStateSectionBytes : null,
    partial: Boolean(source.partial),
    redacted: Boolean(source.redacted),
    redactionReason: source.redactionReason || null,
    ...(source.sprintId ? { sprintId: source.sprintId } : {}),
  }));
  for (const source of sources) {
    delete source.content;
    delete source.stateStructure;
    if (source.redacted && source.role === "orchestrator-execution-truth") {
      delete source.size;
      delete source.bytesRead;
      source.bytesReadAtMost = HARNESS_SCAN_LIMITS.maxStateSectionBytes;
    }
    const target = source.coverage === "inspected" ? lane.inspected : source.coverage === "excluded" ? lane.excluded : source.coverage === "not-found" ? lane.notFound : lane.uninspected;
    target.push(source);
    if (source.partial || (!["complete", "evaluation-not-yet-recorded", "not-found"].includes(source.reason) && source.coverage !== "inspected")) lane.partialReasons.push(`${source.path}:${source.reason}`);
  }
  if (hasSafeFallback) lane.partialReasons.push(`docs/sprints/state.md:${reason}`);
  lane.partialReasons = [...new Set(lane.partialReasons)];
  lane.partial = lane.partialReasons.length > 0;
  if (stateSource.redacted) {
    lane.bytesRead = null;
    lane.bytesReadAtMost = HARNESS_SCAN_LIMITS.maxReadBytes;
    lane.redactedUsage = true;
  }
  const bundles = (kind === "harness" || hasSafeFallback) ? currentIds.map((id) => {
    const entry = state.currentEntries?.find((row) => row.id === id) || { status: state.currentStatus };
    return {
      currentId: id,
      declaredCurrentId: state.declaredCurrentId,
      declaredCurrentIds: state.declaredCurrentIds,
      declaredCurrentExpression: state.declaredCurrentExpression,
      currentStatus: entry.status,
      nextPlanned: state.nextPlanned,
      sourceSection: state.sourceSection,
      fallbackSource: state.fallbackSource,
      inferred: state.inferred,
      partial: lane.partial,
      roles: sourceRoles
        .filter((source) => source.role === "orchestrator-execution-truth" || source.sprintId === id)
        .filter((source) => ["orchestrator-execution-truth", "requirements", "generator-self-report", "evaluator-validation"].includes(source.role))
        .map((source) => source.role === "orchestrator-execution-truth" ? { ...source, status: entry.status || "status-unresolved" } : source),
    };
  }) : [];
  const bundle = bundles[0] || null;
  const digestSources = sourceRoles.map(({ size: _size, bytesRead: _bytesRead, ...source }) => source);
  const coverageDigest = stableDigest({ detection: { kind, reason }, state, sources: digestSources, usage: { entriesSeen: lane.entriesSeen, filesRead: lane.filesRead }, partialReasons: lane.partialReasons });
  const candidates = bundles.map((currentBundle) => ({
    path: `docs/sprints/${currentBundle.currentId}.md`,
    title: `Harness ${currentBundle.currentId}`,
    contentDigest: coverageDigest,
    kind: "harness-current",
    source: "harness-authoritative",
    decisionStatus: currentBundle.roles.find((source) => source.role === "requirements")?.coverage === "inspected" ? "proposed" : "unknown",
    humanConfirmed: false,
    executionStatus: executionStatus(currentBundle.currentStatus),
    validationStatus: currentBundle.roles.find((source) => source.role === "evaluator-validation")?.status === "passed" ? "passed" : currentBundle.roles.find((source) => source.role === "evaluator-validation")?.status === "failed" ? "failed" : "unknown",
    evidenceLocator: { path: "docs/sprints/state.md", currentSprint: currentBundle.currentId, sources: currentBundle.roles.map((source) => source.path).join(",") },
    evidenceSummary: `Harness ${currentBundle.currentId}: state／requirements／Generator自己報告／Evaluator検証を分離して観測`,
    harnessBundle: currentBundle,
  }));
  return { detection: { kind, reason }, state, lane, sources: sourceRoles, bundle, bundles, candidates, coverageDigest };
}
