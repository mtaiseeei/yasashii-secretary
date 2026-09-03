#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = join(ROOT, "scripts/fixtures/sprint-043-patch-003/actual-action-report.json");
const INPUTS = {
  publicCandidate: "fe3eab06d4fbd0b5b26d995129156f2fb2537dd2", publicTree: "2dd956ed987360781e2fccafb2ddbf52245219df",
  publicEvaluatorPass: "348cb1825a7f7e228e71e3799e2fdff0ea9b464e", publicFinalState: "4c37eaba23ace106b02709637ec7cde7cbf8bafc",
  privateCandidate: "a980208db3728fc2d12e61435b03cd4b33e79a29", privateTree: "a77fda7cbb1ea6536b4228a9002e3edcea6a7f1c",
  privateEvaluatorPass: "b0c2138b8dcf96c144344e96307a22d38b4af349", privateFinalState: "ed4068e57e1da32e4fc1d4bfa2680393e2e00eb3",
  yasashiiStartHead: "9009f892f678fbcbde9978e0bceb803d3f1ad7d5", yasashiiStartTree: "de744087388b60d0f0f2db221b204c57a0c31bcf",
};
const MAPPING = [
  ["plugins/secretary/scripts/clarity.mjs", "plugins/secretary/scripts/clarity.mjs", "public-byte-sync"],
  ["plugins/secretary/scripts/lib/clarity-core.mjs", "plugins/secretary/scripts/lib/clarity-core.mjs", "public-byte-sync"],
  ["plugins/secretary/scripts/lib/clarity-harness-scan.mjs", "plugins/secretary/scripts/lib/clarity-harness-scan.mjs", "public-byte-sync"],
  ["plugins/secretary/collaboration-inventory.json", "plugins/secretary/collaboration-inventory.json", "yasashii-adapted"],
  ["scripts/lib/sprint-049-inventory.mjs", "scripts/lib/sprint-049-inventory.mjs", "yasashii-adapted"],
  ["scripts/sprint-049-test.mjs", "scripts/sprint-042-collaboration-test.mjs", "yasashii-adapted"],
  ["scripts/sprint-050-patch-003-test.mjs", "scripts/sprint-043-patch-002-test.mjs", "protected-regression"],
  ["scripts/sprint-050-patch-004-test.mjs", "scripts/sprint-043-patch-003-test.mjs", "yasashii-supporting"],
  [".github/workflows/windows-recording-regression.yml", ".github/workflows/windows-recording-regression.yml", "yasashii-adapted"],
];
const PUBLIC = {
  "plugins/secretary/scripts/clarity.mjs": "a19adc1dc81fbe512f68867bc049ed887c36cdb3b927fc58ffeb91775d5155db",
  "plugins/secretary/scripts/lib/clarity-core.mjs": "1f66ebfeddf3dbae4c8aae34c21162401c0aaf72563b12750f34bc5e7f081c4f",
  "plugins/secretary/scripts/lib/clarity-harness-scan.mjs": "ddd4ae96fb89bb2cceae856aea8ffabc23ee49ea5929870834644be5f574d7a6",
  "plugins/secretary/collaboration-inventory.json": "368b580fbb52366cb8794f83ab065b81eb08e61e2edf64752fe4b9e1191c7310",
  "scripts/lib/sprint-049-inventory.mjs": "a69c1f2aa3eeccc1db9318f6617125a69deb3994244a00fbbe4c10e61911bd48",
  "scripts/sprint-049-test.mjs": "e0d796607fad7a813f1d6cc08f5f7e9b3e64b033f0d7c217b226c3f3af3ae603",
  "scripts/sprint-050-patch-003-test.mjs": "692dc6e7c5eca06fc3ff4650a554dd2b742ba6ea785e68bff91fb4ea6ff7f49b",
  "scripts/sprint-050-patch-004-test.mjs": "8efd81c79123df14260396d6daf71255d864d6d196058b635b6057faad7e531e",
  ".github/workflows/windows-recording-regression.yml": "1c4dad743bb17f5d7295a925eb4164bcd3436fb1a079ad5c3d169031f48ab66e",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (path) => sha(Buffer.from(readFileSync(join(ROOT, path), "utf8").replaceAll("\r\n", "\n")));
function mode(path) {
  if (process.platform !== "win32") return (lstatSync(join(ROOT, path)).mode & 0o111) ? "100755" : "100644";
  const result = spawnSync("git", ["-C", ROOT, "ls-files", "--stage", "--", path], { encoding: "utf8", shell: false, windowsHide: true,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" } });
  return result.status === 0 ? result.stdout.trim().split(/\s+/u)[0] : "100644";
}
function fail(code, detail = "") { throw new Error(`${code}${detail ? `:${detail}` : ""}`); }

export function validateActualActionReport(report) {
  assert.deepEqual(report.fixedInputs, INPUTS);
  if (report.schemaVersion !== 1 || report.reportId !== "yasashii-sprint-043-patch-003-actual-action") fail("action-report-schema");
  if (report.rows.length !== 9) fail("action-report-row-count");
  assert.deepEqual(report.rows.map(({ publicPath, path, role }) => [publicPath, path, role]), MAPPING);
  if (new Set(report.rows.map((row) => row.publicPath)).size !== 9 || new Set(report.rows.map((row) => row.path)).size !== 9) fail("action-report-overlap");
  for (const row of report.rows) {
    if (!existsSync(join(ROOT, row.path))) fail("action-report-path-missing", row.path);
    if (row.publicDigest !== PUBLIC[row.publicPath]) fail("action-report-public-digest", row.publicPath);
    if (digest(row.path) !== row.afterDigest) fail("action-report-after-digest", row.path);
    if (mode(row.path) !== row.afterMode) fail("action-report-mode", row.path);
    if (row.actualDiff !== (row.beforeDigest === row.afterDigest ? "unchanged" : "changed")) fail("action-report-diff", row.path);
    if (row.role === "public-byte-sync" && (row.publicDigest !== row.afterDigest || row.publicMode !== row.afterMode || row.privateDigest !== row.afterDigest)) fail("action-report-byte-sync", row.path);
    if (row.role === "yasashii-adapted" && (row.publicDigest === row.afterDigest || !row.sourceMarker || !readFileSync(join(ROOT, row.path), "utf8").includes(row.sourceMarker))) fail("action-report-adaptation", row.path);
    if (row.role === "protected-regression" && (row.beforeDigest !== row.afterDigest || row.actualAction !== "preserve")) fail("action-report-protected", row.path);
    if (row.role === "yasashii-supporting" && (row.beforeDigest !== null || row.actualAction !== "add")) fail("action-report-supporting", row.path);
  }
  assert.deepEqual(report.counts, { publicActualPaths: 9, byteSync: 3, adapted: 4, protectedRegression: 1, supporting: 1,
    unknown: 0, overlap: 0, missing: 0, extra: 0, stale: 0, unused: 0, unclassified: 0 });
  assert.deepEqual(report.supportingArtifacts, [
    "scripts/sprint-043-patch-003-test.mjs", "scripts/sprint-043-patch-003-classification.mjs",
    "scripts/sprint-043-patch-003-portability.mjs", "scripts/sprint-043-patch-003-regression.sh",
    "scripts/fixtures/sprint-043-patch-003/actual-action-report.json",
  ]);
  assert(report.supportingArtifacts.every((path) => existsSync(join(ROOT, path))));
  if (!report.externalOperations.every((row) => row.count === 0 && row.status === "NOT-RUN")) fail("action-report-external-operation");
  const product = report.rows.filter((row) => row.role === "public-byte-sync").map((row) => readFileSync(join(ROOT, row.path), "utf8")).join("\n");
  for (const literal of ["vault/05_secretary", "vault/10_sources", "rules/copy/my-vault", "private-my-vault-project-reference"]) if (product.includes(literal)) fail("action-report-private-literal", literal);
  if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//u.test(product)) fail("action-report-absolute-user-path");
  const skills = readdirSync(join(ROOT, "plugins/secretary/skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  const behaviors = JSON.parse(readFileSync(join(ROOT, "scripts/fixtures/sprint-043/final-matrix.json"), "utf8")).behaviorCount;
  assert.equal(skills, 17); assert.equal(behaviors, 62);
  assert(readFileSync(join(ROOT, "plugins/secretary/clarity/secretary-adapter.json"), "utf8").includes("secretary/projects/open/<project>/clarity"));
  const xmind = ["plugins/secretary/skills/clarity/SKILL.md", "plugins/secretary/scripts/lib/clarity-projection.mjs"].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  for (const token of ["#16A34A", "#2563EB", "#D97706", "#DC2626", "MCP"]) assert(xmind.includes(token), token);
  assert(/default.*OFF|既定.*OFF/iu.test(xmind));
  return { rows: 9, skills, behaviors };
}
function negatives(report) {
  const changes = [
    (x) => { x.rows[0].afterDigest = "0".repeat(64); }, (x) => { x.rows[0].afterMode = "100755"; },
    (x) => { x.rows[3].sourceMarker = "missing-marker"; }, (x) => { x.rows[0].path = "missing-path"; },
    (x) => { x.rows.pop(); }, (x) => { x.rows.push(structuredClone(x.rows[0])); },
    (x) => { x.rows[0].role = "yasashii-adapted"; }, (x) => { x.rows[0].publicDigest = "f".repeat(64); },
  ];
  for (const change of changes) { const candidate = structuredClone(report); change(candidate); assert.throws(() => validateActualActionReport(candidate)); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = JSON.parse(readFileSync(REPORT, "utf8")); const result = validateActualActionReport(report); negatives(report);
  process.stdout.write(`YASASHII_SPRINT043_PATCH003_CLASSIFICATION PASS=1 ROWS=${result.rows} BYTE_SYNC=3 ADAPTED=4 PROTECTED_REGRESSION=1 SUPPORTING=1 UNKNOWN=0 OVERLAP=0 MISSING=0 EXTRA=0 STALE=0 UNUSED=0 UNCLASSIFIED=0 SKILLS=${result.skills} BEHAVIORS=${result.behaviors} TAMPER_NEGATIVE=8 EXTERNAL_WRITES=0\n`);
}
