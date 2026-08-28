import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  ClarityError,
  appendEvidence,
  appendEvent,
  attention,
  findCanonicalItem,
  history,
} from "./clarity-core.mjs";
import { runExternalSync } from "./external-ops.mjs";
import { workingRoot } from "./safe-fs.mjs";

const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_SOURCE_LINES = 240;
const MAX_MARKERS = 12;
const DECISION_TYPES = new Set(["project-decision", "adr", "spec-section", "meeting-reference"]);
const IMPLEMENTATION_TYPES = new Set(["file-reference", "git-commit", "git-diff", "test-run", "deployment"]);
const ALIGNMENTS = new Set(["unknown", "aligned", "possible_drift", "drift", "not_applicable"]);
const forbiddenPath = /(?:^|\/)(?:\.git(?:\/|$)|\.clarity\/runtime(?:\/|$)|\.env(?:\.|\/|$)|[^/]*(?:credential|secret|private[-_]?key|oauth|token|transcript)[^/]*)(?:\/|$)?/iu;
const secretValue = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b|\bAKIA[A-Z0-9]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b|(?:password|api[_-]?key|api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|credential)\s*[:=]\s*[^\s,;]+)/iu;

function fail(condition, code, message, details = {}) {
  if (!condition) throw new ClarityError(code, message, 3, { changed: false, ...details });
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function stableId(prefix, value) { return `${prefix}_${sha(String(value)).slice(0, 20)}`; }
function line(value, label, max = 200) {
  const normalized = String(value ?? "").trim();
  fail(normalized && !/[\r\n]/u.test(normalized) && normalized.length <= max, "drift-input-invalid", `${label}は空でない${max}文字以内の1行にしてください。`);
  fail(!secretValue.test(normalized), "drift-secret-detected", `${label}にSecretらしき値があるため比較しません。`);
  return normalized;
}
function relativeLocatorPath(value, label) {
  const raw = String(value ?? "").split("\\").join("/").replace(/^\.\//u, "");
  fail(raw && !raw.startsWith("/") && !isAbsolute(raw) && raw.split("/").every((part) => part && part !== "." && part !== ".."), "drift-path-invalid", `${label}はworking root内の安全な相対pathで指定してください。`);
  fail(!forbiddenPath.test(raw), "drift-path-sensitive", `${label}はcredential／Secret／transcript候補または内部runtimeを指すため比較しません。`);
  return raw;
}
function assertNoSymlink(root, rel) {
  const target = resolve(root, rel);
  const relCheck = relative(root, target);
  fail(relCheck && relCheck !== ".." && !relCheck.startsWith(`..${sep}`) && !isAbsolute(relCheck), "drift-path-invalid", "Evidence locatorはworking root内で指定してください。");
  let cursor = root;
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) break;
    const stat = lstatSync(cursor);
    fail(!stat.isSymbolicLink(), "drift-path-symlink", "Drift Evidence locatorにsymlink／junctionを使えません。", { path: rel });
  }
  return target;
}
function git(root, args) {
  const result = runExternalSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeoutMs: 5_000,
    maxBuffer: MAX_SOURCE_BYTES + 4096,
    allowFailure: true,
    label: "Clarity Drift Git read-only inspection",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  return result.status === 0 ? String(result.stdout) : null;
}
function boundedSlice(text, locator) {
  fail(Buffer.byteLength(text) <= MAX_SOURCE_BYTES, "drift-source-too-large", `Evidence sourceは${MAX_SOURCE_BYTES} bytes以内にしてください。`);
  const lines = text.split(/\r?\n/u);
  const start = locator.lineStart === undefined ? 1 : Number(locator.lineStart);
  const end = locator.lineEnd === undefined ? Math.min(lines.length, start + MAX_SOURCE_LINES - 1) : Number(locator.lineEnd);
  fail(Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end - start + 1 <= MAX_SOURCE_LINES, "drift-range-invalid", `Evidence範囲は1〜${MAX_SOURCE_LINES}行で指定してください。`);
  fail(start <= Math.max(1, lines.length), "drift-range-invalid", "Evidence開始行がsource範囲外です。");
  return { content: lines.slice(start - 1, end).join("\n"), lineStart: start, lineEnd: Math.min(end, lines.length) };
}
function markers(claim, label) {
  fail(claim && typeof claim === "object" && !Array.isArray(claim), "drift-input-invalid", `${label}.claimが必要です。`);
  const field = line(claim.field, `${label}.claim.field`, 120);
  const value = line(claim.value, `${label}.claim.value`, 120);
  fail(Array.isArray(claim.markers) && claim.markers.length >= 1 && claim.markers.length <= MAX_MARKERS, "drift-input-invalid", `${label}.claim.markersは1〜${MAX_MARKERS}件にしてください。`);
  return { field, value, markers: claim.markers.map((item) => line(item, `${label}.claim.marker`, 120)) };
}
function normalizeText(value) { return String(value).normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, " "); }

function inspectLocator(root, side, role) {
  fail(side && typeof side === "object" && !Array.isArray(side), "drift-input-invalid", `${role} Evidenceが必要です。`);
  const allowed = role === "decision" ? DECISION_TYPES : IMPLEMENTATION_TYPES;
  fail(allowed.has(side.type), "drift-input-invalid", `${role} Evidence typeが不正です。`);
  const claim = markers(side.claim, role);
  const locator = side.locator;
  fail(locator && typeof locator === "object" && !Array.isArray(locator), "drift-input-invalid", `${role}.locatorが必要です。`);
  const path = relativeLocatorPath(locator.path, `${role}.locator.path`);
  let raw;
  let current = true;
  let shaValue = null;
  if (["git-commit", "git-diff"].includes(side.type)) {
    shaValue = line(locator.sha, `${role}.locator.sha`, 64);
    fail(/^[a-f0-9]{7,64}$/iu.test(shaValue), "drift-input-invalid", `${role}.locator.shaがGit SHAではありません。`);
    const head = git(root, ["rev-parse", "HEAD"])?.trim() || null;
    const resolved = git(root, ["rev-parse", `${shaValue}^{commit}`])?.trim() || null;
    fail(resolved, "drift-source-unreachable", "指定commitを確認できません。", { path });
    current = Boolean(head && resolved === head);
    raw = git(root, ["show", `${resolved}:${path}`]);
    fail(raw !== null, "drift-source-unreachable", "指定commitのEvidence pathを確認できません。", { path });
    shaValue = resolved;
  } else {
    const target = assertNoSymlink(root, path);
    fail(existsSync(target) && lstatSync(target).isFile(), "drift-source-unreachable", "Evidence pathを通常fileとして確認できません。", { path });
    const stat = lstatSync(target);
    fail(stat.size <= MAX_SOURCE_BYTES, "drift-source-too-large", `Evidence sourceは${MAX_SOURCE_BYTES} bytes以内にしてください。`, { path });
    raw = readFileSync(target, "utf8");
  }
  fail(!secretValue.test(raw), "drift-secret-detected", "Evidence sourceにSecretらしき値があるため比較・保存しません。", { path });
  const selected = boundedSlice(raw, locator);
  const haystack = normalizeText(selected.content);
  const matched = claim.markers.filter((marker) => haystack.includes(normalizeText(marker)));
  return {
    type: side.type,
    locator: { path, lineStart: selected.lineStart, lineEnd: selected.lineEnd, ...(shaValue ? { sha: shaValue } : {}) },
    claim,
    matched,
    verified: matched.length > 0,
    current,
    contentDigest: sha(selected.content),
    authority: side.authority || "source",
  };
}

function authoritativeImplementation(root, implementation) {
  const observed = inspectLocator(root, implementation, "implementation");
  if (observed.authority !== "generated") return { observed, authoritative: observed, generated: false };
  if (!implementation.generatedFrom) return { observed, authoritative: null, generated: true };
  const source = inspectLocator(root, { ...implementation.generatedFrom, authority: "source" }, "implementation");
  return { observed, authoritative: source, generated: true };
}

function evidenceSummary(role, inspected) {
  const suffix = inspected.current === false ? "historical" : "current";
  return `${role} ${inspected.claim.field}=${inspected.claim.value} (${suffix})`;
}

export function compareDrift(rootValue, input) {
  const root = workingRoot(rootValue);
  fail(input && input.schemaVersion === 1, "drift-input-invalid", "Drift comparison schemaVersionは1にしてください。");
  const itemId = line(input.itemId, "itemId", 32);
  fail(/^ci_[a-f0-9]{20}$/u.test(itemId), "drift-input-invalid", "itemIdが不正です。");
  fail(findCanonicalItem(root, itemId), "item-missing", "指定したClarity Itemが見つかりません。");
  if (input.applicable === false) {
    return { status: "not_applicable", itemId, changed: false, alignment: "not_applicable", reason: "comparison-not-applicable", decision: null, implementation: null, comparisonDigest: sha(canonical(input)) };
  }
  const decision = inspectLocator(root, input.decision, "decision");
  const implementationSet = authoritativeImplementation(root, input.implementation);
  const implementation = implementationSet.authoritative;
  let alignment = "unknown";
  let reason = "insufficient-evidence";
  if (implementationSet.generated && !implementation) reason = "generated-source-authority-missing";
  else if (!implementation.current) reason = "historical-implementation-not-current";
  else if (decision.claim.field !== implementation.claim.field) reason = "comparison-field-mismatch";
  else if (!decision.verified || !implementation.verified) { alignment = "possible_drift"; reason = "marker-evidence-incomplete"; }
  else if (decision.claim.value === implementation.claim.value) { alignment = "aligned"; reason = implementationSet.generated ? "generated-source-aligned" : "claims-aligned"; }
  else { alignment = "drift"; reason = implementationSet.generated ? "generated-source-drift" : "claims-differ"; }
  fail(ALIGNMENTS.has(alignment), "drift-result-invalid", "Drift comparison resultが不正です。");
  const result = {
    status: alignment,
    itemId,
    changed: false,
    alignment,
    reason,
    decision: { type: decision.type, locator: decision.locator, field: decision.claim.field, value: decision.claim.value, verified: decision.verified, matchedMarkerCount: decision.matched.length, contentDigest: decision.contentDigest },
    implementation: implementation ? { type: implementation.type, locator: implementation.locator, field: implementation.claim.field, value: implementation.claim.value, verified: implementation.verified, current: implementation.current, contentDigest: implementation.contentDigest, generated: implementationSet.generated, observedGeneratedLocator: implementationSet.generated ? implementationSet.observed.locator : null } : { generated: true, current: false, sourceAuthority: "missing" },
  };
  result.comparisonDigest = sha(canonical(result));
  return result;
}

function evidenceInput(itemId, role, side, comparisonDigest) {
  const evidenceId = stableId("ce", `drift:${itemId}:${role}:${side.contentDigest}:${canonical(side.locator)}`);
  return {
    evidenceId,
    type: side.type,
    source: `clarity-drift-${role}`,
    locator: side.locator,
    summary: evidenceSummary(role, { ...side, claim: { field: side.field, value: side.value } }),
    contentDigest: side.contentDigest,
    sensitivity: "non-secret-reference",
    availability: side.current === false ? "source_unreachable" : "available",
    comparisonDigest,
  };
}

export function applyDrift(rootValue, input, { apply = false, failAt = process.env.CLARITY_DRIFT_FAIL_AT || "" } = {}) {
  const root = workingRoot(rootValue);
  const compared = compareDrift(root, input);
  if (!apply) return { ...compared, status: "preview", nextAction: "双方のlocatorと比較結果を確認し、明示的に --apply を付けてください" };
  fail(compared.decision && compared.implementation?.sourceAuthority !== "missing", "drift-evidence-insufficient", "保存可能な双方のEvidenceが揃っていません。追加調査後に再実行してください。");
  const operationId = input.operationId ? line(input.operationId, "operationId", 80) : stableId("op", `drift:${compared.itemId}:${compared.comparisonDigest}`);
  const decisionInput = evidenceInput(compared.itemId, "decision", compared.decision, compared.comparisonDigest);
  const implementationInput = evidenceInput(compared.itemId, "implementation", compared.implementation, compared.comparisonDigest);
  const decisionEvidence = appendEvidence(root, decisionInput);
  const implementationEvidence = appendEvidence(root, implementationInput);
  if (failAt === "after-evidence") throw new ClarityError("drift-partial", "Drift Evidenceは保存済みですが、State反映が未完了です。再実行で収束します。", 4, { changed: true, operationId, completed: ["decision-evidence", "implementation-evidence"], pending: ["evidence-links", "alignment-event"] });
  const eventBase = `${compared.itemId}:${operationId}`;
  const linkDecision = appendEvent(root, { eventId: stableId("cv", `${eventBase}:decision-link`), type: "evidence.linked", itemId: compared.itemId, actor: "clarity-drift", payload: { section: "decision", evidenceId: decisionEvidence.evidence.evidenceId, operationId } });
  const linkExecution = appendEvent(root, { eventId: stableId("cv", `${eventBase}:execution-link`), type: "evidence.linked", itemId: compared.itemId, actor: "clarity-drift", payload: { section: "execution", evidenceId: implementationEvidence.evidence.evidenceId, operationId } });
  const linkAlignmentDecision = appendEvent(root, { eventId: stableId("cv", `${eventBase}:alignment-decision-link`), type: "evidence.linked", itemId: compared.itemId, actor: "clarity-drift", payload: { section: "alignment", evidenceId: decisionEvidence.evidence.evidenceId, operationId } });
  const linkAlignmentImplementation = appendEvent(root, { eventId: stableId("cv", `${eventBase}:alignment-implementation-link`), type: "evidence.linked", itemId: compared.itemId, actor: "clarity-drift", payload: { section: "alignment", evidenceId: implementationEvidence.evidence.evidenceId, operationId } });
  if (failAt === "before-alignment") throw new ClarityError("drift-partial", "Drift Evidence linkは保存済みですが、alignment反映が未完了です。再実行で収束します。", 4, { changed: true, operationId, completed: ["evidence", "evidence-links"], pending: ["alignment-event"] });
  const alignmentEvent = appendEvent(root, { eventId: stableId("cv", `${eventBase}:alignment:${compared.alignment}:${compared.comparisonDigest}`), type: "alignment.changed", itemId: compared.itemId, actor: "clarity-drift", payload: { status: compared.alignment, operationId, reason: compared.reason, comparisonDigest: compared.comparisonDigest, decisionEvidenceId: decisionEvidence.evidence.evidenceId, implementationEvidenceId: implementationEvidence.evidence.evidenceId } });
  const changed = [decisionEvidence, implementationEvidence, linkDecision, linkExecution, linkAlignmentDecision, linkAlignmentImplementation, alignmentEvent].some((entry) => entry.changed);
  const report = attention(root, { limit: 20 });
  const ranked = report.items.find((row) => row.itemId === compared.itemId) || null;
  return { ...compared, status: changed ? "applied" : "unchanged", changed, operationId, evidenceIds: [decisionEvidence.evidence.evidenceId, implementationEvidence.evidence.evidenceId], eventId: alignmentEvent.event.eventId, attention: ranked ? { reason: ranked.reasons[0], level: ranked.level, rank: report.items.findIndex((row) => row.itemId === compared.itemId) + 1, ranking: "attention-deterministic-rank" } : null };
}

export function recordDriftWaiver(rootValue, input, { apply = false } = {}) {
  const root = workingRoot(rootValue);
  const itemId = line(input.itemId, "itemId", 32);
  const item = findCanonicalItem(root, itemId);
  fail(item, "item-missing", "指定したClarity Itemが見つかりません。");
  const status = line(input.status || "active", "waiver status", 16);
  fail(["active", "revoked"].includes(status), "drift-waiver-invalid", "waiver statusはactive／revokedから選んでください。");
  const reason = line(input.reason, "waiver reason", 200);
  const scope = line(input.scope, "waiver scope", 160);
  if (input.expiresAt) fail(!Number.isNaN(Date.parse(input.expiresAt)), "drift-waiver-invalid", "waiver期限はISO 8601で指定してください。");
  const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
  const operationId = input.operationId ? line(input.operationId, "operationId", 80) : stableId("op", `drift-waiver:${itemId}:${status}:${reason}:${scope}:${expiresAt || "none"}`);
  const preview = { status: "preview", changed: false, itemId, waiver: { status, reason, scope, expiresAt }, operationId, currentAlignment: item.alignment.status, nextAction: "理由・範囲・期限を確認し、明示的に --apply を付けてください" };
  if (!apply) return preview;
  const result = appendEvent(root, { eventId: stableId("cv", `drift-waiver:${operationId}`), type: "drift.waiver.recorded", itemId, actor: "human-user", payload: { operationId, status, reason, scope, expiresAt } });
  const report = attention(root, { limit: 20 });
  return { ...preview, status: result.changed ? "saved" : "unchanged", changed: result.changed, eventId: result.event.eventId, activeAttention: report.items.some((row) => row.itemId === itemId), historyCount: history(root).alignmentHistory.filter((row) => row.itemId === itemId).length };
}

export function commitClarityOwned(rootValue, { message = "Project Clarity checkpoint", apply = false } = {}) {
  const root = workingRoot(rootValue);
  const safeMessage = line(message, "commit message", 160);
  const top = git(root, ["rev-parse", "--show-toplevel"])?.trim();
  fail(top && resolve(top) === root, "clarity-commit-non-git", "Clarity commitはGit top-levelでだけ実行できます。");
  const changedText = git(root, ["diff", "--name-only", "HEAD", "--", ".clarity", "CLARITY.md"]);
  const changedPaths = String(changedText || "").split(/\r?\n/u).filter(Boolean).sort();
  for (const path of changedPaths) {
    fail(path === "CLARITY.md" || (path.startsWith(".clarity/") && !path.startsWith(".clarity/runtime/")), "clarity-commit-scope", "Clarity所有外のpathをcommitしません。", { path });
  }
  const preview = { status: changedPaths.length ? "preview" : "unchanged", changed: false, paths: changedPaths, push: false, branchChange: false, remoteChange: false, nextAction: changedPaths.length ? "対象pathを確認し、明示的に --apply を付けてください" : "commit対象のClarity変更はありません" };
  if (!apply || !changedPaths.length) return preview;
  const beforeBranch = git(root, ["symbolic-ref", "--short", "-q", "HEAD"])?.trim() || null;
  const beforeRemote = git(root, ["remote", "-v"]) || "";
  const result = runExternalSync("git", ["-C", root, "commit", "--only", "-m", safeMessage, "--", ...changedPaths], {
    encoding: "utf8",
    timeoutMs: 15_000,
    maxBuffer: 2 * 1024 * 1024,
    allowFailure: true,
    label: "Clarity owned-path commit",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  fail(result.status === 0, "clarity-commit-failed", "Clarity所有pathのcommitに失敗しました。既存stageは変更していません。");
  const commit = git(root, ["rev-parse", "HEAD"])?.trim();
  const committed = String(git(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", commit]) || "").split(/\r?\n/u).filter(Boolean).sort();
  fail(committed.every((path) => changedPaths.includes(path)), "clarity-commit-scope", "commitにClarity所有外のpathが含まれました。", { committed });
  fail((git(root, ["symbolic-ref", "--short", "-q", "HEAD"])?.trim() || null) === beforeBranch, "clarity-commit-branch-changed", "commit中にbranchが変わりました。");
  fail((git(root, ["remote", "-v"]) || "") === beforeRemote, "clarity-commit-remote-changed", "commit中にremoteが変わりました。");
  return { ...preview, status: "committed", changed: true, commit, committedPaths: committed };
}
