import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const FIXED = Object.freeze({
  yasashiiBase: "c6cfb40a6026c5447a8ec4729f517adb4cc51031",
  yasashiiBaseFileCount: 718,
  yasashiiBaseTreeSha256: "01dfe9e600c59473cc323cff0a22d554b93e2035be51eb0b013e8b8889918a8f",
  publicProduct: "5f08d454c05576fcff8ab32c10c00887b4c15a96",
  publicTree: "1fbffe636565355b875dcde35ff05d26cd7e15f00710c1c88a563866749037c5",
  publicCommon: "4aa6e8d4b21aa9e0020cfaa6edefd5ff0e6640fd2e8f937db00478190142f849",
  publicHandoffSha256: "09c3fa1289fa0af4d31c084a74ab108ce5cf85bcf3b3e7c9320cab72758d83c0",
  publicStatus: "public-user-decision-risk-accepted",
  publicEvaluatorPass: false,
  privateProduct: "d5598226213004d55781ca033985589907ae7b5d",
  privateTree: "920aea5d09b1aa51fcb5ebe23ab242a538c50445",
  privateFeedbackCommit: "556c80117c7a1db8f2dd4eabb997277d47e02a51",
  privateFeedbackSha256: "aa502ca0b3b53ece16822edc39b60b9a587b93c15f701ce1ad6578c2b9f47774",
  privateReceiptFileSha256: "bf6893f3891b10b9b86669308e123008f09eae05d6d8330a477eb1614a456745",
  privateReceiptInternalSha256: "0aac84a3d1beadcc7820a495205f292c4491e1758c5c9349a8ee523e68e82122",
  nextPermission: "yasashii-prewrite-only",
});

export const HOOK_BYTE_SYNC = Object.freeze([
  "plugins/secretary/hooks/hooks.json",
  "plugins/secretary/scripts/clarity-hook.mjs",
  "plugins/secretary/scripts/lib/clarity-hook.mjs",
]);

const BYTE_SYNC = new Set([
  "plugins/secretary/clarity/schemas/event.schema.json",
  "plugins/secretary/clarity/schemas/evidence.schema.json",
  "plugins/secretary/clarity/schemas/item.schema.json",
  "plugins/secretary/clarity/schemas/project.schema.json",
  "plugins/secretary/clarity/schemas/state.schema.json",
  ...HOOK_BYTE_SYNC,
  "plugins/secretary/scripts/clarity.mjs",
  "plugins/secretary/scripts/lib/clarity-core.mjs",
  "plugins/secretary/scripts/lib/clarity-drift.mjs",
  "plugins/secretary/scripts/lib/clarity-link.mjs",
  "plugins/secretary/scripts/lib/clarity-projection.mjs",
  "plugins/secretary/rules/common-language.md",
  "plugins/secretary/rules/conversation-contract.md",
  "plugins/secretary/rules/safety.md",
]);

const PRIVATE_ADDITIONS = Object.freeze([
  "plugins/secretary/.claude-plugin/plugin.json",
  "plugins/secretary/.codex-plugin/plugin.json",
]);

const GATE_SURFACES = new Set([
  "scripts/lib/sprint-041-prewrite.mjs",
  "scripts/sprint-041-prewrite.mjs",
  "scripts/sprint-041-test.mjs",
  "scripts/sprint-041-regression.sh",
  "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json",
  "docs/progress/sprint-041.md",
]);

const PROTECTED_GROUPS = Object.freeze([
  { id: "yasashii-readme", patterns: ["README.md"] },
  { id: "license", patterns: ["LICENSE"] },
  { id: "repo-agents", patterns: ["AGENTS.md", "CLAUDE.md"] },
  { id: "repo-owned-docs", patterns: ["docs/**"] },
  { id: "yasashii-copy-style", patterns: ["plugins/secretary/rules/copy/yasashii.json", "plugins/secretary/rules/styles/yasashii.md"] },
  { id: "yasashii-edition-identity", patterns: ["plugins/secretary/edition.json"] },
  { id: "overlay-definitions", patterns: ["secretary-overlay/**"] },
  { id: "marketplace-identity", patterns: [".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json"] },
  { id: "release-history", patterns: ["plugins/secretary/CHANGELOG.md", "plugins/yasashii-secretary/CHANGELOG.md", "scripts/master-release-gate.mjs", "scripts/archive-release-gate.mjs", "scripts/check-release-integrity.py"] },
]);

const ROLE_OWNERS = Object.freeze([
  { test: (path) => path === "docs/spec.md" || path.startsWith("docs/spec/"), owner: "planner" },
  { test: (path) => /^docs\/sprints\/sprint-[^/]+\.md$/u.test(path), owner: "planner" },
  { test: (path) => path === "docs/sprints/state.md", owner: "orchestrator" },
  { test: (path) => /^docs\/progress\/sprint-[^/]+\.md$/u.test(path), owner: "generator" },
  { test: (path) => /^docs\/feedback\/sprint-[^/]+\.md$/u.test(path), owner: "evaluator" },
]);

export class PrewriteError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PrewriteError";
    this.code = code;
    this.details = details;
  }
}

export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(condition, code, message, details = {}) {
  if (!condition) throw new PrewriteError(code, message, details);
}

function exactKeys(value, expected, code) {
  fail(value && typeof value === "object" && !Array.isArray(value), code, `${code}: object is required`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  fail(stable(actual) === stable(wanted), code, `${code}: unknown or missing key`, { actual, expected: wanted });
}

function json(path, code) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { throw new PrewriteError(code, `${code}: ${error.message}`); }
}

function normalizePath(path) {
  fail(typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.split("/").includes("..") && !path.includes("\\"), "invalid-path", "path must be normalized and relative", { path });
  return path;
}

function globRegex(pattern) {
  let body = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") { body += ".*"; index += 1; }
    else if (char === "*") body += "[^/]*";
    else body += char.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
  }
  return new RegExp(`${body}$`, "u");
}

function matches(path, patterns) { return patterns.some((pattern) => globRegex(pattern).test(path)); }
function sorted(values) { return [...new Set(values)].sort((a, b) => Buffer.from(a).compare(Buffer.from(b))); }

function walk(root, current = root) {
  const result = [];
  for (const name of readdirSync(current).sort((a, b) => a.localeCompare(b, "en"))) {
    if (name === ".git" || name === "node_modules") continue;
    const absolute = join(current, name);
    const rel = relative(root, absolute).replaceAll("\\", "/");
    const stat = lstatSync(absolute);
    fail(!stat.isSymbolicLink(), "symlink-rejected", "symlinks are not accepted by the prewrite gate", { path: rel });
    if (stat.isDirectory()) result.push(...walk(root, absolute));
    else if (stat.isFile()) result.push(rel);
    else throw new PrewriteError("unsupported-entry", "unsupported filesystem entry", { path: rel });
  }
  return result;
}

function fileEntry(root, path) {
  const target = join(root, path);
  if (!existsSync(target)) return null;
  const stat = lstatSync(target);
  fail(stat.isFile() && !stat.isSymbolicLink(), "path-type", "expected regular file", { path });
  return { path, mode: stat.mode & 0o111 ? "100755" : "100644", sha256: sha256(readFileSync(target)), size: stat.size };
}

function runGit(root, args, { allowFailure = false, encoding = "utf8" } = {}) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding, maxBuffer: 64 * 1024 * 1024 });
  if (!allowFailure) fail(result.status === 0, "git-required", `git ${args.join(" ")} failed`, { status: result.status, stderr: String(result.stderr || "").trim() });
  return result;
}

function materializedBase(root, baseRoot) {
  if (baseRoot) {
    const absolute = resolve(baseRoot);
    fail(existsSync(absolute) && lstatSync(absolute).isDirectory(), "base-root-missing", "fixed base root is missing", { baseRoot: absolute });
    return { root: absolute, source: "git-free-fixed-base-root", cleanup: null };
  }
  const inside = runGit(root, ["rev-parse", "--is-inside-work-tree"], { allowFailure: true });
  fail(inside.status === 0 && inside.stdout.trim() === "true", "base-source-required", "Git-free mode requires --base-root");
  const ancestor = runGit(root, ["merge-base", "--is-ancestor", FIXED.yasashiiBase, "HEAD"], { allowFailure: true });
  fail(ancestor.status === 0, "base-ancestry", "current source does not descend from fixed Yasashii base");
  const temp = resolve(join(process.env.TMPDIR || "/tmp", `sprint041-base-${process.pid}-${Date.now()}`));
  mkdirSync(temp, { recursive: false });
  const archive = runGit(root, ["archive", "--format=tar", FIXED.yasashiiBase], { encoding: null });
  const untar = spawnSync("tar", ["-xf", "-", "-C", temp], { input: archive.stdout, maxBuffer: 64 * 1024 * 1024 });
  fail(untar.status === 0, "base-archive", "fixed base archive could not be materialized", { stderr: String(untar.stderr || "").trim() });
  return { root: temp, source: "git-fixed-base-archive", cleanup: () => rmSync(temp, { recursive: true, force: true }) };
}

export function validatePublicHandoffDocument(handoff) {
  fail(handoff.schemaVersion === 1 && handoff.kind === "agentic-secretary-clarity-fixed-handoff", "handoff-schema", "public handoff schema or kind mismatch");
  fail(handoff.publicationStatus === FIXED.publicStatus, "public-status", "public publication status mismatch");
  exactKeys(handoff.acceptedSource, ["fullSha", "treeSha256", "fileCount", "commonTreeSha256", "commonFileCount"], "public-source-keys");
  fail(handoff.acceptedSource.fullSha === FIXED.publicProduct, "public-product", "public product mismatch");
  fail(handoff.acceptedSource.treeSha256 === FIXED.publicTree, "public-tree", "public tree digest mismatch");
  fail(handoff.acceptedSource.commonTreeSha256 === FIXED.publicCommon, "public-common", "public common digest mismatch");
  fail(handoff.acceptedSource.commonFileCount === 44 && handoff.acceptedSource.fileCount === 828, "public-count", "public path count mismatch");
  const gate = handoff.userDecisionPreWriteGate;
  fail(gate?.status === "ready", "public-gate-status", "public user-decision gate is not ready");
  fail(gate.requiredPublicationStatus === FIXED.publicStatus && gate.requiredAcceptanceBasisType === "user-risk-acceptance", "public-gate-basis", "public user-decision basis mismatch");
  fail(gate.evaluatorPass === false, "public-evaluator-pass", "public evaluatorPass must remain false");
  fail(gate.writesDownstream === false, "public-write-authority", "public handoff must not write downstream");
  fail(stable(handoff.downstreamOrder) === stable(["agentic-secretary-my-vault", "yasashii-secretary"]), "public-order", "public downstream order mismatch");
  fail(Array.isArray(handoff.commonPaths) && handoff.commonPaths.length === 44 && new Set(handoff.commonPaths).size === 44, "common-paths", "public common paths must be 44 unique paths");
  for (const path of handoff.commonPaths) normalizePath(path);
  for (const hook of HOOK_BYTE_SYNC) fail(handoff.commonPaths.includes(hook), "hook-path-missing", "required Hook byte-sync path is missing", { path: hook });
  const seams = handoff.adapterSeams;
  fail(Array.isArray(seams) && new Set(seams.map((item) => item.id)).size === seams.length, "adapter-seams", "adapter seam IDs must be unique");
  fail(seams.some((item) => item.id === "secretary-local" && item.path === "plugins/secretary/clarity/secretary-adapter.json" && item.owner === "public-common"), "adapter-owner", "secretary adapter owner mismatch");
  const yasProtected = handoff.protectedDownstreamPaths?.["yasashii-secretary"];
  fail(stable(yasProtected) === stable(["README.md", "docs/**", "plugins/secretary/rules/copy/yasashii.json", "plugins/secretary/rules/styles/yasashii.md"]), "handoff-protected", "Yasashii protected declaration mismatch");
}

export function validatePrivateReceiptDocument(receipt) {
  fail(receipt.schemaVersion === 1 && receipt.kind === "private-project-clarity-pass-receipt" && receipt.status === "final", "private-receipt-status", "private final PASS receipt is required");
  exactKeys(receipt.public, ["product", "treeSha256", "commonSha256", "governance", "governanceFeedbackSha256", "readyHandoffSha256", "protectedSnapshotSha256", "publicationStatus", "evaluatorPass"], "private-public-keys");
  fail(receipt.public.product === FIXED.publicProduct && receipt.public.treeSha256 === FIXED.publicTree && receipt.public.commonSha256 === FIXED.publicCommon && receipt.public.readyHandoffSha256 === FIXED.publicHandoffSha256, "private-public-tuple", "private receipt public tuple mismatch");
  fail(receipt.public.publicationStatus === FIXED.publicStatus && receipt.public.evaluatorPass === false, "private-public-status", "private receipt must preserve public non-PASS status");
  exactKeys(receipt.private, ["base", "candidate", "candidateTree", "productProjectionSha256"], "private-candidate-keys");
  fail(receipt.private.candidate === FIXED.privateProduct && receipt.private.candidateTree === FIXED.privateTree, "private-candidate", "private candidate or tree mismatch");
  exactKeys(receipt.feedback, ["path", "sha256", "verdict", "candidate"], "private-feedback-keys");
  fail(receipt.feedback.verdict === "PASS", "private-feedback-verdict", "private feedback must be PASS");
  fail(receipt.feedback.candidate === FIXED.privateProduct && receipt.feedback.sha256 === FIXED.privateFeedbackSha256, "private-feedback-binding", "private feedback binding mismatch");
  exactKeys(receipt.downstream, ["order", "nextPermission", "writesAuthorized", "releaseAuthorized", "publicPatchAuthorized"], "private-permission-keys");
  fail(stable(receipt.downstream.order) === stable(["agentic-secretary-my-vault", "yasashii-secretary"]), "private-order", "private downstream order mismatch");
  fail(receipt.downstream.nextPermission === FIXED.nextPermission, "next-permission", "private nextPermission mismatch");
  fail(receipt.downstream.writesAuthorized === false && receipt.downstream.releaseAuthorized === false && receipt.downstream.publicPatchAuthorized === false, "private-authority", "private receipt expanded write authority");
  fail(receipt.harnessRoleOwned?.productSyncIntersection === 0, "private-role-intersection", "private receipt has product/role-owned overlap");
  fail(Array.isArray(receipt.harnessRoleOwned?.paths) && receipt.harnessRoleOwned.paths.length > 0, "private-role-owned", "private role-owned inventory is missing");
  fail(new Set(receipt.harnessRoleOwned.paths.map((row) => row.path)).size === receipt.harnessRoleOwned.paths.length, "private-role-duplicate", "private role-owned inventory contains duplicates");
  for (const row of receipt.harnessRoleOwned.paths) {
    fail(classifyRoleOwned(row.path) === row.owner, "private-role-owner", "private role-owned owner mismatch", { path: row.path, owner: row.owner });
    fail(["added", "modified", "deleted", "type-changed"].includes(row.changeStatus), "private-role-status", "private role-owned status mismatch", { path: row.path, changeStatus: row.changeStatus });
  }
  fail(Array.isArray(receipt.protected) && receipt.protected.length === 7 && receipt.protected.every((row) => row.before === row.after && row.unauthorizedChanges === 0), "private-protected", "private protected snapshot mismatch");
  const body = { ...receipt }; delete body.receiptSha256;
  fail(receipt.receiptSha256 === FIXED.privateReceiptInternalSha256 && sha256(Buffer.from(stable(body))) === receipt.receiptSha256, "private-receipt-tamper", "private receipt internal digest mismatch");
}

function overlayDeclarations(root, baseFiles) {
  const overlayRoot = join(root, "secretary-overlay");
  const mapping = json(join(overlayRoot, "mapping.json"), "overlay-mapping");
  const anchors = json(join(overlayRoot, "anchors.json"), "overlay-anchors");
  const owned = json(join(overlayRoot, "downstream-owned.json"), "overlay-downstream-owned");
  const downstreamFiles = json(join(overlayRoot, "downstream-files.json"), "overlay-downstream-files");
  fail(mapping.schemaVersion === 1 && anchors.schemaVersion === 1 && owned.schemaVersion === 1 && downstreamFiles.schemaVersion === 1, "overlay-schema", "overlay declaration schema mismatch");
  fail(Array.isArray(owned.patterns) && new Set(owned.patterns).size === owned.patterns.length, "owned-duplicate", "downstream-owned patterns must be unique");
  fail(Array.isArray(downstreamFiles.files) && new Set(downstreamFiles.files).size === downstreamFiles.files.length, "downstream-files-duplicate", "downstream-files must be unique");
  for (const path of ["secretary-overlay/mapping.json", "secretary-overlay/anchors.json", "secretary-overlay/downstream-owned.json", "scripts/sync-secretary-overlay.mjs"]) {
    fail(baseFiles.includes(path), "overlay-support-stale", "required overlay workflow path is stale", { path });
  }
  for (const pattern of owned.patterns) fail(baseFiles.some((path) => globRegex(pattern).test(path)), "owned-stale", "downstream-owned pattern is stale", { pattern });
  const definitionDigest = treeDigest(root, [
    "secretary-overlay/anchors.json", "secretary-overlay/downstream-files.json", "secretary-overlay/downstream-owned.json",
    "secretary-overlay/mapping.json", "secretary-overlay/metadata-overrides.json", "secretary-overlay/upstream-base.json", "secretary-overlay/upstream-tree.json",
  ]);
  return { mapping, anchors, owned, downstreamFiles, definitionDigest };
}

function treeDigest(root, paths) {
  const hash = createHash("sha256");
  const entries = [];
  for (const path of sorted(paths)) {
    const entry = fileEntry(root, path);
    fail(entry, "snapshot-path-missing", "snapshot path is missing", { path });
    hash.update(path).update("\0").update(entry.mode).update("\0").update(readFileSync(join(root, path))).update("\0");
    entries.push(entry);
  }
  return { algorithm: "sorted-path-NUL-mode-NUL-bytes-NUL", fileCount: entries.length, sha256: hash.digest("hex") };
}

function verifyFixedBase(root, paths) {
  const digest = treeDigest(root, paths);
  fail(digest.fileCount === FIXED.yasashiiBaseFileCount && digest.sha256 === FIXED.yasashiiBaseTreeSha256, "fixed-base-tamper", "fixed Yasashii base snapshot mismatch", { expectedFiles: FIXED.yasashiiBaseFileCount, actualFiles: digest.fileCount, expectedSha256: FIXED.yasashiiBaseTreeSha256, actualSha256: digest.sha256 });
  return digest;
}

function classifyRoleOwned(path) {
  for (const rule of ROLE_OWNERS) if (rule.test(path)) return rule.owner;
  return null;
}

function diffRoots(baseRoot, currentRoot) {
  const before = new Set(walk(baseRoot));
  const after = new Set(walk(currentRoot));
  return sorted([...before, ...after]).filter((path) => stable(fileEntry(baseRoot, path)) !== stable(fileEntry(currentRoot, path))).map((path) => {
    const a = fileEntry(baseRoot, path); const b = fileEntry(currentRoot, path);
    return { path, changeStatus: !a ? "added" : !b ? "deleted" : "modified", before: a, after: b };
  });
}

function sourceInventory(baseRoot, root, productPaths) {
  const product = new Set(productPaths);
  const differences = diffRoots(baseRoot, root).filter((row) => row.path !== "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json");
  const productConflicts = differences.filter((row) => product.has(row.path));
  fail(productConflicts.length === 0, "dirty-product-conflict", "Clarity product path differs from fixed base before apply", { paths: productConflicts.map((row) => row.path) });
  const roleOwned = [];
  const gateOwned = [];
  const unknown = [];
  for (const row of differences) {
    const owner = classifyRoleOwned(row.path);
    if (owner) roleOwned.push({ path: row.path, owner, changeStatus: row.changeStatus });
    else if (GATE_SURFACES.has(row.path)) {
      if (row.path !== "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json") {
        gateOwned.push({ path: row.path, owner: "sprint-041-generator", changeStatus: row.changeStatus });
      }
    }
    else unknown.push(row.path);
  }
  fail(unknown.length === 0, "dirty-unknown", "unknown or conflicting source difference exists", { paths: unknown });
  fail(new Set(roleOwned.map((row) => row.path)).size === roleOwned.length, "role-owned-duplicate", "role-owned inventory contains duplicates");
  return { differences: differences.length, roleOwned, gateOwned, productConflicts: 0, unknown: 0 };
}

function protectedSnapshot(baseRoot, baseFiles) {
  const groups = [];
  for (const group of PROTECTED_GROUPS) {
    const paths = baseFiles.filter((path) => matches(path, group.patterns));
    fail(paths.length > 0, "protected-stale", "protected declaration matched no fixed-base paths", { id: group.id, patterns: group.patterns });
    groups.push({ id: group.id, patterns: group.patterns, ...treeDigest(baseRoot, paths) });
  }
  fail(new Set(groups.map((row) => row.id)).size === groups.length, "protected-duplicate", "protected group IDs must be unique");
  return { fixedBase: FIXED.yasashiiBase, groups, snapshotSha256: sha256(Buffer.from(stable(groups))) };
}

function pathManifest(baseRoot, handoff, ownedPatterns) {
  const publicPaths = handoff.commonPaths.map(normalizePath);
  const productPaths = sorted([...publicPaths, ...PRIVATE_ADDITIONS]);
  fail(productPaths.length === 46, "product-path-count", "expected 44 common plus 2 manifest paths", { count: productPaths.length });
  const rows = productPaths.map((path) => {
    const role = BYTE_SYNC.has(path) ? "byte-sync" : "adapted";
    const before = fileEntry(baseRoot, path);
    const actions = role === "byte-sync" ? ["read", "copy", "write"] : ["read", "adapt", "write"];
    const postcondition = role === "byte-sync"
      ? "mode-and-bytes-equal-fixed-public-product"
      : "declared-yasashii-transformation-and-identity-invariants-pass";
    return { path, source: publicPaths.includes(path) ? "public-common" : "private-required-manifest", role, reason: HOOK_BYTE_SYNC.includes(path) ? "public-hook-byte-sync-fixed" : role === "byte-sync" ? "host-neutral-common-core" : "yasashii-edition-adaptation-required", actions, before, postcondition };
  });
  fail(rows.filter((row) => row.role === "byte-sync").length === 16 && rows.filter((row) => row.role === "adapted").length === 30, "role-count", "path role count mismatch");
  for (const hook of HOOK_BYTE_SYNC) fail(rows.some((row) => row.path === hook && row.role === "byte-sync"), "hook-role", "Hook path is not byte-sync", { path: hook });
  const ownedWrites = rows.filter((row) => matches(row.path, ownedPatterns));
  fail(ownedWrites.length === 0, "downstream-owned-write", "planned product action targets a downstream-owned path", { paths: ownedWrites.map((row) => row.path) });
  const pathCounts = new Map(rows.map((row) => [row.path, (rows.filter((other) => other.path === row.path).length)]));
  const overlap = [...pathCounts].filter(([, count]) => count !== 1).map(([path]) => path);
  fail(overlap.length === 0, "role-overlap", "path role overlap exists", { paths: overlap });
  return {
    rows,
    counts: { publicCommon: 44, privateRequiredAdditions: 2, byteSync: 16, adapted: 30, supporting: 0, excluded: 0, protected: 0, productTotal: 46 },
    intersections: { byteSyncAdapted: [], productDownstreamOwned: [], productHarnessRoleOwned: [] },
    unknown: [], unclassified: [], unused: [], stale: [], blindCopy: 0,
    plannedApplyWrites: rows.length,
    observedPrewriteProductWrites: 0,
    manifestSha256: null,
  };
}

function completeRoleManifest(pathRoles, handoff, protectedBefore, handoffPath, privateReceiptPath) {
  const supporting = [
    { id: "public-ready-handoff", domain: "external-fixed-input", path: resolve(handoffPath), role: "supporting", actions: ["read"], writes: 0 },
    { id: "private-pass-receipt", domain: "external-fixed-input", path: resolve(privateReceiptPath), role: "supporting", actions: ["read"], writes: 0 },
  ];
  const excluded = handoff.excludedPaths.map((pattern) => ({ domain: "public-source", pattern, role: "excluded", actions: [], writes: 0 }));
  const protectedRoles = protectedBefore.groups.map((group) => ({ id: group.id, domain: "yasashii-fixed-base", patterns: group.patterns, role: "protected", actions: ["read", "protect"], writes: 0, fileCount: group.fileCount, sha256: group.sha256 }));
  const productPaths = pathRoles.rows.map((row) => row.path);
  const productExcluded = productPaths.filter((path) => matches(path, handoff.excludedPaths));
  fail(productExcluded.length === 0, "product-excluded-overlap", "product path overlaps a public excluded declaration", { paths: productExcluded });
  pathRoles.supporting = supporting;
  pathRoles.excluded = excluded;
  pathRoles.protected = protectedRoles;
  pathRoles.counts.supporting = supporting.length;
  pathRoles.counts.excluded = excluded.length;
  pathRoles.counts.protected = protectedRoles.length;
  pathRoles.intersections.productExcluded = [];
  pathRoles.intersections.productProtected = [];
  pathRoles.manifestSha256 = sha256(Buffer.from(stable({ rows: pathRoles.rows, supporting, excluded, protected: protectedRoles })));
  return pathRoles;
}

function yasashiiIdentity(baseRoot) {
  const edition = json(join(baseRoot, "plugins/secretary/edition.json"), "edition-json");
  fail(edition.edition === "yasashii-secretary", "edition-identity", "Yasashii edition identity mismatch");
  fail(edition.copy?.path === "rules/copy/yasashii.json", "copy-route", "Yasashii copy route mismatch");
  fail(edition.harness?.repository === "https://github.com/mtaiseeei/yasashii-harness", "harness-repository", "Yasashii Harness repository mismatch");
  fail(edition.harness?.installId === "harness@yasashii-harness" && edition.harness?.hosts?.claudeCode?.installId === "harness@yasashii-harness" && edition.harness?.hosts?.codex?.installId === "harness@yasashii-harness", "harness-id", "Yasashii Harness install ID mismatch");
  return { edition: edition.edition, copyPath: edition.copy.path, harnessRepository: edition.harness.repository, harnessInstallId: edition.harness.installId };
}

function buildReceiptBody({ handoffPath, privateReceiptPath, privateFeedbackCommit, handoff, privateReceipt, pathRoles, protectedBefore, source, overlay, identity, baseSource }) {
  return {
    schemaVersion: 1,
    kind: "yasashii-project-clarity-prewrite-receipt",
    sprint: "sprint-041",
    status: "prewrite-verified",
    fixedInputs: {
      yasashiiBase: FIXED.yasashiiBase,
      public: { product: FIXED.publicProduct, treeSha256: FIXED.publicTree, commonSha256: FIXED.publicCommon, handoffPath: resolve(handoffPath), handoffFileSha256: FIXED.publicHandoffSha256, publicationStatus: handoff.publicationStatus, evaluatorPass: false },
      private: { product: FIXED.privateProduct, tree: FIXED.privateTree, feedbackCommit: privateFeedbackCommit, feedbackSha256: FIXED.privateFeedbackSha256, receiptPath: resolve(privateReceiptPath), receiptFileSha256: FIXED.privateReceiptFileSha256, receiptInternalSha256: privateReceipt.receiptSha256, feedbackVerdict: privateReceipt.feedback.verdict },
    },
    authorization: { downstreamOrder: ["agentic-secretary-my-vault", "yasashii-secretary"], inputPermission: FIXED.nextPermission, writesAuthorized: false, applyAuthorized: false, releaseAuthorized: false, publicPatchAuthorized: false, nextScope: { sprint: "sprint-042", operation: "yasashii-product-apply-only", authorizedNow: false } },
    verification: { handoff: "PASS", privateReceipt: "PASS", fixedBase: "PASS", sourceBoundary: "PASS", overlayDeclarations: "PASS", yasashiiIdentity: "PASS", publicEvaluatorPassPreserved: true, privatePassNotPromotedToPublic: true },
    pathRoles,
    protectedBefore,
    sourceInventory: source,
    overlay: { definitionDigest: overlay.definitionDigest, mappingPath: "secretary-overlay/mapping.json", anchorsPath: "secretary-overlay/anchors.json", downstreamOwnedPath: "secretary-overlay/downstream-owned.json", syncWorkflow: "scripts/sync-secretary-overlay.mjs" },
    yasashiiIdentity: identity,
    writeAccounting: { clarityProductWrites: 0, publicWrites: 0, privateWrites: 0, upstreamWrites: 0, remoteWrites: 0, externalWrites: 0, receiptWrites: 1 },
    externalStates: { push: "not-run", tag: "not-run", release: "not-run", githubRelease: "not-run", marketplace: "not-run", installedCache: "not-run", newSession: "not-run", realWorkspace: "not-run", realXmind: "not-run", realHost: "not-run", connectors: "not-run" },
    provenance: { baseSource, receiptDeterministic: true, evaluatorVerdict: null, orchestratorStateWritten: false },
  };
}

function verifyReceiptDigest(receipt) {
  fail(receipt?.kind === "yasashii-project-clarity-prewrite-receipt" && receipt.status === "prewrite-verified", "yasashii-receipt-status", "Yasashii prewrite receipt status mismatch");
  const body = { ...receipt }; delete body.receiptSha256;
  fail(receipt.receiptSha256 === sha256(Buffer.from(stable(body))), "yasashii-receipt-tamper", "Yasashii prewrite receipt digest mismatch");
  fail(receipt.authorization?.writesAuthorized === false && receipt.authorization?.applyAuthorized === false && receipt.authorization?.nextScope?.sprint === "sprint-042" && receipt.authorization?.nextScope?.authorizedNow === false, "yasashii-receipt-authority", "Yasashii receipt expanded authority");
  fail(Object.entries(receipt.writeAccounting || {}).filter(([key]) => key !== "receiptWrites").every(([, value]) => value === 0), "yasashii-receipt-writes", "Yasashii receipt records a forbidden write");
  fail(receipt.provenance?.evaluatorVerdict === null && receipt.provenance?.orchestratorStateWritten === false, "yasashii-receipt-owner", "Yasashii receipt forged Evaluator or Orchestrator state");
}

export function inspectPrewrite(options) {
  const root = resolve(options.root);
  const handoffPath = resolve(options.handoffPath);
  const privateReceiptPath = resolve(options.privateReceiptPath);
  fail(options.privateFeedbackCommit === FIXED.privateFeedbackCommit, "private-feedback-commit", "private feedback commit mismatch");
  fail(sha256(readFileSync(handoffPath)) === FIXED.publicHandoffSha256, "handoff-file-tamper", "public handoff file digest mismatch");
  fail(sha256(readFileSync(privateReceiptPath)) === FIXED.privateReceiptFileSha256, "private-receipt-file-tamper", "private receipt file digest mismatch");
  const handoff = json(handoffPath, "handoff-json");
  const privateReceipt = json(privateReceiptPath, "private-receipt-json");
  validatePublicHandoffDocument(handoff);
  validatePrivateReceiptDocument(privateReceipt);
  const base = materializedBase(root, options.baseRoot);
  try {
    const baseFiles = walk(base.root);
    const fixedBaseDigest = verifyFixedBase(base.root, baseFiles);
    const overlay = overlayDeclarations(base.root, baseFiles);
    const pathRoles = pathManifest(base.root, handoff, overlay.owned.patterns);
    const source = sourceInventory(base.root, root, pathRoles.rows.map((row) => row.path));
    const protectedBefore = protectedSnapshot(base.root, baseFiles);
    completeRoleManifest(pathRoles, handoff, protectedBefore, handoffPath, privateReceiptPath);
    const identity = yasashiiIdentity(base.root);
    const body = buildReceiptBody({ handoffPath, privateReceiptPath, privateFeedbackCommit: options.privateFeedbackCommit, handoff, privateReceipt, pathRoles, protectedBefore, source, overlay, identity, baseSource: `${base.source}:${fixedBaseDigest.sha256}` });
    return { receipt: { ...body, receiptSha256: sha256(Buffer.from(stable(body))) }, summary: { productPaths: 46, byteSync: 16, adapted: 30, protectedGroups: protectedBefore.groups.length, roleOwned: source.roleOwned.length, gateOwned: source.gateOwned.length, observedProductWrites: 0 } };
  } finally { if (base.cleanup) base.cleanup(); }
}

export function emitReceipt(options) {
  const result = inspectPrewrite(options);
  const output = resolve(options.outputPath);
  const allowed = resolve(options.root, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json");
  fail(output === allowed, "receipt-output-path", "receipt output must use the Sprint 041 fixture path", { output, allowed });
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(result.receipt, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, output);
  return result;
}

export function verifyReceipt(options) {
  const actual = json(resolve(options.receiptPath), "yasashii-receipt-json");
  verifyReceiptDigest(actual);
  const expected = inspectPrewrite(options).receipt;
  fail(stable(actual) === stable(expected), "yasashii-receipt-binding", "Yasashii receipt no longer matches current fixed inputs or source snapshot");
  return { receipt: actual, summary: { verified: true, receiptSha256: actual.receiptSha256, observedProductWrites: 0 } };
}
