#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appendEvent, applyInit, history, rebuildState } from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import {
  QUADRANT_VISUALS, applyXmindProposal, buildProjectionBundle, createXmindMcpAdapter, getXmindSettings,
  packXmindArchive, previewLocalXmind, proposeXmindEdit, resolveXmindProvider, setXmindEnabled,
  stableCoordinate, unpackXmindArchive, validateXmindStructure, writeLocalXmind, writeProjectionBundle,
} from "../plugins/secretary/scripts/lib/clarity-projection.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const fixtureDir = join(repo, "scripts/fixtures/sprint-043-xmind-zen");
const work = mkdtempSync(join(tmpdir(), "agentic-s043-"));
process.env.CLARITY_NOW = "2026-08-28T12:00:00.000Z";
const primary = [...Array.from({ length: 10 }, (_, i) => `MM-${String(i + 1).padStart(3, "0")}`), ...Array.from({ length: 15 }, (_, i) => `XM-${String(i + 1).padStart(3, "0")}`), "IM-005"];
const visual = ["XV-001", "XV-002", "XV-003", "XV-004"];
const expected = [...primary, ...visual]; const results = [];
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function fixture(name, files = {}) { const root = join(work, name); write(join(root, "README.md"), `# ${name}\n`); for (const [path, value] of Object.entries(files)) write(join(root, path), value); applyInit(root); return root; }
function run(args) { return spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: "utf8", env: process.env }); }
function runJson(args) { const result = run(args); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
function assertStale(result) { assert.equal(result.status, "fallback-approval-required"); assert.equal(result.changed, false); assert.equal(result.staleApproval, true); assert.equal(result.repreviewRequired, true); }
function stateBytes(root) { return readFileSync(join(root, ".clarity/state.json")); }
function existingArchive() { return packXmindArchive(Object.fromEntries(readdirSync(fixtureDir).sort().map((name) => [name, readFileSync(join(fixtureDir, name))]))); }
function putExisting(root, name = "map.xmind") { write(join(root, name), existingArchive()); return name; }
function checkVisualText(text) { for (const v of Object.values(QUADRANT_VISUALS)) for (const token of [v.emoji, v.label, v.meaning, v.color]) assert(text.includes(token), token); }
async function test(id, title, fn, status = "pass") { assert(expected.includes(id), id); assert(!results.some((r) => r.id === id), `duplicate ${id}`); try { if (status === "not-run") { results.push({ id, status }); process.stdout.write(`NOT-RUN ${id} ${title}\n`); return; } await fn(); results.push({ id, status: "pass" }); process.stdout.write(`PASS ${id} ${title}\n`); } catch (error) { results.push({ id, status: "fail" }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); } }

try {
  await test("MM-001", "固定軸・4象限", () => { const root = fixture("mm001"); const m = buildProjectionBundle(root).files["quadrant.mmd"]; for (const line of ["y-axis まだ決まっていない --> 決まっている", "quadrant-1 🔵", "quadrant-2 🟢", "quadrant-3 🟡", "quadrant-4 🔴"]) assert(m.includes(line)); checkVisualText(m); });
  await test("MM-002", "全Itemにstable座標", () => { const root = fixture("mm002", { "src/a.js": "ok\n" }); const state = rebuildState(root, { write: false }).state; const bundle = buildProjectionBundle(root); for (const item of state.items) { const p = stableCoordinate(item); assert(bundle.files["matrix.md"].includes(`${p.x}, ${p.y}`)); assert(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100); } });
  await test("MM-003", "同一Stateのprojection bytesは同一", () => { const root = fixture("mm003"); assert.deepEqual(buildProjectionBundle(root).files, buildProjectionBundle(root).files); const a = writeProjectionBundle(root); const before = Object.fromEntries(a.paths.map((p) => [p, sha(readFileSync(join(root, p)))])); const b = writeProjectionBundle(root); assert.equal(b.changed, false); assert.deepEqual(Object.fromEntries(b.paths.map((p) => [p, sha(readFileSync(join(root, p)))])), before); });
  await test("MM-004", "stable jitterで重なりを抑制", () => { const root = fixture("mm004", { "docs/a.md": "a\n", "docs/b.md": "b\n" }); const points = rebuildState(root, { write: false }).state.items.map(stableCoordinate); assert.equal(new Set(points.map((p) => `${p.x}:${p.y}`)).size, points.length); });
  await test("MM-005", "日本語labelをMermaid安全文字で出力", () => { const root = fixture("mm005", { "docs/日本語.md": "# 顧客<確認>\n" }); const text = Object.values(buildProjectionBundle(root).files).join("\n"); for (const v of Object.values(QUADRANT_VISUALS)) assert(text.includes(v.label)); assert(!text.includes("<確認>")); });
  await test("MM-006", "mindmap構文失敗時flowchart fallback", () => { const root = fixture("mm006"); const result = buildProjectionBundle(root, { mindmapSyntaxAccepted: false }); assert.equal(result.structureMode, "flowchart-fallback"); assert(result.files["structure.mmd"].startsWith("flowchart TD")); assert(result.files["overview.md"]); });
  await test("MM-007", "Project構造図", () => { const root = fixture("mm007", { "src/a.js": "ok\n" }); const text = buildProjectionBundle(root).files["structure.mmd"]; assert(text.startsWith("mindmap")); assert(text.includes("src")); });
  await test("MM-008", "依存関係図", () => { const root = fixture("mm008"); const text = buildProjectionBundle(root).files["dependencies.mmd"]; assert(text.startsWith("flowchart LR")); assert(text.includes("依存関係なし")); });
  await test("MM-009", "状態遷移図", () => { const root = fixture("mm009"); const text = buildProjectionBundle(root).files["state-flow.mmd"]; for (const token of ["stateDiagram-v2", "探索中", "人間が承認", "検証済み"]) assert(text.includes(token)); });
  await test("MM-010", "rendererなしでもraw mmdとMarkdown保持", () => { const root = fixture("mm010"); const cliResult = run(["project", root, "--apply", "--json"]); assert.equal(cliResult.status, 0, cliResult.stderr); const result = JSON.parse(cliResult.stdout); assert.equal(result.renderer.available, false); assert.equal(result.renderer.verified, false); assert.equal(result.paths.filter((p) => p.endsWith(".mmd")).length, 4); assert.equal(result.paths.filter((p) => p.endsWith(".md")).length, 3); });

  await test("XM-001", "Xmind CLI不在でもClarityは成功しfallback案内", () => { const root = fixture("xm001"); const projection = buildProjectionBundle(root); const resolved = resolveXmindProvider({ settings: { xmindEnabled: true }, mcp: { connected: false, reason: "Xmind CLI/MCPなし" } }); assert(projection.files["overview.md"]); assert.equal(resolved.state, "fallback-approval-required"); assert(resolved.nextActions.some((row) => row.includes("接続・導入"))); assert(resolved.nextActions.some((row) => row.includes("Mermaid"))); });
  await test("XM-002", "既知XMind Zen構造を生成し内部検査", () => { const root = fixture("xm002"); setXmindEnabled(root, true); const preview = previewLocalXmind(root, "out.xmind"); const result = writeLocalXmind(root, "out.xmind", { approval: "approved", approvalDigest: preview.approvalDigest }); assert.equal(result.status, "local-selected-after-approval"); const report = validateXmindStructure(readFileSync(join(root, "out.xmind"))); assert.equal(report.structurallyValid, true); assert.equal(report.verified, false); assert.equal(report.openability, "not-verified-with-xmind-app"); });
  await test("XM-003", "2つの必須Sheet", () => { const root = fixture("xm003"); const sheets = JSON.parse(unpackXmindArchive(previewLocalXmind(root, "out.xmind").archive)["content.json"]); assert.deepEqual(sheets.map((s) => s.id).sort(), ["clarity-matrix-sheet", "clarity-structure-sheet"]); });
  await test("XM-004", "既存の追加Sheetを保持", () => { const root = fixture("xm004"); putExisting(root); const p = previewLocalXmind(root, "map.xmind"); writeLocalXmind(root, "map.xmind", { approval: "approved", approvalDigest: p.approvalDigest }); const sheets = JSON.parse(unpackXmindArchive(readFileSync(join(root, "map.xmind")))["content.json"]); assert(sheets.some((s) => s.id === "customer-notes-sheet")); });
  await test("XM-005", "credential非保存", () => { const root = fixture("xm005"); const bytes = previewLocalXmind(root, "out.xmind").archive.toString("utf8"); assert(!/token|password|credential|api[_-]?key/iu.test(bytes)); });
  await test("XM-006", "MCP切断時local承認またはMermaidへdegrade", () => { const fallback = resolveXmindProvider({ settings: { xmindEnabled: true }, mcp: { connected: false, reason: "切断" } }); assert.equal(fallback.state, "fallback-approval-required"); assert.equal(fallback.providers[2].provider, "mermaid"); assert.equal(fallback.providers[2].capability, true); });
  await test("XM-007", "実Xmind MCP connected create/read/update live evidence（外部live未承認）", null, "not-run");
  await test("XM-008", "Xmind editはproposalのみ", () => { const root = fixture("xm008"); const before = stateBytes(root); const itemId = json(join(root, ".clarity/state.json")).items[0].itemId; const p = proposeXmindEdit(root, { itemId, section: "decision", value: "proposed" }); assert.equal(p.status, "approval-required"); assert.deepEqual(stateBytes(root), before); });
  await test("XM-009", "proposal明示承認でEvent反映", () => { const root = fixture("xm009"); const itemId = json(join(root, ".clarity/state.json")).items[0].itemId; const p = proposeXmindEdit(root, { itemId, section: "decision", value: "proposed" }); const result = applyXmindProposal(root, p, { decision: "approved" }); assert.equal(result.status, "applied"); assert(history(root).events.some((e) => e.eventId === result.eventId)); });
  await test("XM-010", "proposal拒否でState不変", () => { const root = fixture("xm010"); const itemId = json(join(root, ".clarity/state.json")).items[0].itemId; const p = proposeXmindEdit(root, { itemId, section: "execution", value: "in_progress" }); const before = stateBytes(root); assert.equal(applyXmindProposal(root, p, { decision: "rejected" }).status, "stopped"); assert.deepEqual(stateBytes(root), before); });
  await test("XM-011", "stable Item ID mapping", () => { const root = fixture("xm011", { "src/a.js": "ok\n" }); const state = rebuildState(root, { write: false }).state; const report = validateXmindStructure(previewLocalXmind(root, "out.xmind").archive); assert.deepEqual(report.itemIds, state.items.map((i) => i.itemId).sort()); });
  await test("XM-012", "匿名CRM map", () => { const root = fixture("xm012", { "crm/accounts.md": "# 匿名企業A\n担当: 営業A\n" }); putExisting(root, "crm.xmind"); const content = unpackXmindArchive(previewLocalXmind(root, "crm.xmind").archive)["content.json"].toString(); assert(content.includes("匿名企業A")); assert(!content.includes("customer@example.com")); });
  await test("XM-013", "既存無関係Sheetとbranch保持", () => { const root = fixture("xm013"); putExisting(root); const p = previewLocalXmind(root, "map.xmind"); writeLocalXmind(root, "map.xmind", { approval: "approved", approvalDigest: p.approvalDigest }); const content = unpackXmindArchive(readFileSync(join(root, "map.xmind")))["content.json"].toString(); for (const token of ["customer-notes-sheet", "customer-unrelated-branch", "team-owned-matrix-branch", "team-owned-deep-branch"]) assert(content.includes(token)); });
  await test("XM-014", "open map edit previewに影響とrefresh警告", () => { const root = fixture("xm014"); putExisting(root); const p = previewLocalXmind(root, "map.xmind", { mcpReason: "MCP失敗" }); assert.equal(p.operation, "update"); assert(p.existingImpact.unrelatedSheetsPreserved.includes("customer-notes-sheet")); assert.equal(p.changed, false); assert(p.mcpReason.includes("失敗")); assert(p.refreshWarning.includes("再読込")); });
  await test("XM-015", "credit/auth見込みと承認gate", () => { const root = fixture("xm015"); assert.equal(run(["xmind-setting", root, "--enabled", "on", "--json"]).status, 0); const cliPreview = run(["xmind-local", root, "--target", "out.xmind", "--json"]); assert.equal(cliPreview.status, 0, cliPreview.stderr); const p = JSON.parse(cliPreview.stdout); assert.equal(p.creditExpected, false); assert.equal(p.authExpected, false); assert.equal(p.approvalRequired, true); assert.equal(Object.hasOwn(p, "archive"), false); assert.equal(existsSync(join(root, "out.xmind")), false); const noApproval = run(["xmind-local", root, "--target", "out.xmind", "--apply", "--json"]); assert.equal(noApproval.status, 0, noApproval.stderr); assert.equal(JSON.parse(noApproval.stdout).changed, false); assert.equal(existsSync(join(root, "out.xmind")), false); });
  await test("IM-005", "retryでXmind bytes同一", () => { const root = fixture("im005"); putExisting(root); const p1 = previewLocalXmind(root, "map.xmind"); writeLocalXmind(root, "map.xmind", { approval: "approved", approvalDigest: p1.approvalDigest }); const first = readFileSync(join(root, "map.xmind")); const p2 = previewLocalXmind(root, "map.xmind"); const second = writeLocalXmind(root, "map.xmind", { approval: "approved", approvalDigest: p2.approvalDigest }); assert.equal(second.changed, false); assert.deepEqual(readFileSync(join(root, "map.xmind")), first); });

  await test("XV-001", "resolver全stateと正直なcapability表示", () => { const root = fixture("xv001"); assert.equal(getXmindSettings(root).xmindEnabled, false); assert.equal(run(["xmind-setting", root, "--enabled", "on", "--json"]).status, 0); assert.equal(getXmindSettings(root).xmindEnabled, true); assert.equal(run(["xmind-setting", root, "--enabled", "off", "--json"]).status, 0); assert.equal(getXmindSettings(root).xmindEnabled, false); const off = resolveXmindProvider(); const capable = { connected: true, capabilities: { create: true, read: true, update: true, stylePlacement: true } }; const mcp = resolveXmindProvider({ settings: { xmindEnabled: true }, mcp: capable, requestedProvider: "local", localDecision: "approved" }); const wait = resolveXmindProvider({ settings: { xmindEnabled: true }, mcp: { connected: false } }); const local = resolveXmindProvider({ settings: { xmindEnabled: true }, mcp: { connected: false }, localDecision: "approved" }); const stop = resolveXmindProvider({ settings: { xmindEnabled: true }, mcp: { connected: false }, localDecision: "rejected" }); assert.deepEqual([off.state, mcp.state, wait.state, local.state, stop.state], ["stopped", "mcp-selected", "fallback-approval-required", "local-selected-after-approval", "stopped"]); assert.equal(mcp.providers[0].priority, 1); assert.equal(mcp.providers[0].selected, true); assert.equal(mcp.providers[0].verified, false); });
  await test("XV-002", "isolated fake MCPのcreate/read/update境界と固定visual", async () => { const calls = []; const adapter = createXmindMcpAdapter({ request: async (request) => { calls.push(request); return { ok: true, fakeId: `fake-${request.operation}` }; } }); const payload = { sheets: ["決定×実行", "Project構造"], visuals: QUADRANT_VISUALS }; for (const op of ["create", "read", "update"]) { const result = await adapter[op](payload); assert.equal(result.verified, false); assert.equal(result.verification, "isolated-fake-boundary"); } assert.deepEqual(calls.map((c) => c.operation), ["create", "read", "update"]); checkVisualText(JSON.stringify(calls)); });
  await test("XV-003", "local承認binding・固定visual・既存map保持・stale write 0", () => {
    const root = fixture("xv003"); putExisting(root); const p = previewLocalXmind(root, "map.xmind");
    assert.equal(p.internalValidation.structurallyValid, true); assert.equal(p.internalValidation.verified, false);
    assert.equal(p.approvalArtifact.target.canonicalRootRelativePath, "map.xmind"); assert.equal(p.approvalArtifact.operation, "update");
    assert.equal(p.approvalArtifact.projection.archiveDigest, p.archiveDigest); assert.equal(p.approvalArtifact.existingTarget.sha256, sha(readFileSync(join(root, "map.xmind"))));
    assert.equal(p.approvalArtifact.providerGate.provider, "local-xmind"); assert.equal(p.approvalArtifact.authExpected, false); assert.equal(p.approvalArtifact.creditExpected, false);
    const before = readFileSync(join(root, "map.xmind"));
    for (const approval of ["rejected", "canceled", "unanswered"]) {
      assert.equal(writeLocalXmind(root, "map.xmind", { approval, approvalDigest: p.approvalDigest }).changed, false);
      assert.deepEqual(readFileSync(join(root, "map.xmind")), before);
    }
    const done = writeLocalXmind(root, "map.xmind", { approval: "approved", approvalDigest: p.approvalDigest });
    assert.equal(done.status, "local-selected-after-approval"); const content = unpackXmindArchive(readFileSync(join(root, "map.xmind")))["content.json"].toString(); checkVisualText(content); assert(content.includes("customer-notes-sheet"));

    const cliRoot = fixture("xv003-cli"); setXmindEnabled(cliRoot, true); mkdirSync(join(cliRoot, "maps"), { recursive: true });
    const alias = runJson(["xmind-local", cliRoot, "--target", "maps/../maps/approved-a.xmind", "--json"]);
    const canonical = runJson(["xmind-local", cliRoot, "--target", "maps/approved-a.xmind", "--json"]);
    assert.equal(alias.target, "maps/approved-a.xmind"); assert.equal(alias.approvalDigest, canonical.approvalDigest);

    const crossTarget = runJson(["xmind-local", cliRoot, "--target", "maps/unapproved-b.xmind", "--apply", "--approval-digest", alias.approvalDigest, "--json"]);
    assertStale(crossTarget); assert.equal(existsSync(join(cliRoot, "maps/approved-a.xmind")), false); assert.equal(existsSync(join(cliRoot, "maps/unapproved-b.xmind")), false);
    const normalizedAliasApply = runJson(["xmind-local", cliRoot, "--target", "maps/approved-a.xmind", "--apply", "--approval-digest", alias.approvalDigest, "--json"]);
    assert.equal(normalizedAliasApply.status, "local-selected-after-approval"); assert.equal(normalizedAliasApply.changed, true); assert.equal(existsSync(join(cliRoot, "maps/approved-a.xmind")), true);

    const createPreview = runJson(["xmind-local", cliRoot, "--target", "maps/create-update.xmind", "--json"]); putExisting(cliRoot, "maps/create-update.xmind");
    const createToUpdate = runJson(["xmind-local", cliRoot, "--target", "maps/create-update.xmind", "--apply", "--approval-digest", createPreview.approvalDigest, "--json"]);
    assertStale(createToUpdate); assert.deepEqual(readFileSync(join(cliRoot, "maps/create-update.xmind")), existingArchive());

    putExisting(cliRoot, "maps/mutated.xmind"); const mutationPreview = runJson(["xmind-local", cliRoot, "--target", "maps/mutated.xmind", "--json"]);
    const mutatedEntries = unpackXmindArchive(readFileSync(join(cliRoot, "maps/mutated.xmind"))); const mutatedArchive = packXmindArchive({ ...mutatedEntries, "mutation.bin": Buffer.from("changed-after-preview") });
    writeFileSync(join(cliRoot, "maps/mutated.xmind"), mutatedArchive); const existingMutation = runJson(["xmind-local", cliRoot, "--target", "maps/mutated.xmind", "--apply", "--approval-digest", mutationPreview.approvalDigest, "--json"]);
    assertStale(existingMutation); assert.deepEqual(readFileSync(join(cliRoot, "maps/mutated.xmind")), mutatedArchive);

    const statePreview = runJson(["xmind-local", cliRoot, "--target", "maps/state-change.xmind", "--json"]); const itemId = json(join(cliRoot, ".clarity/state.json")).items[0].itemId;
    appendEvent(cliRoot, { type: "execution.changed", itemId, actor: "human-user", payload: { status: "in_progress" } });
    const stateMutation = runJson(["xmind-local", cliRoot, "--target", "maps/state-change.xmind", "--apply", "--approval-digest", statePreview.approvalDigest, "--json"]);
    assertStale(stateMutation); assert.equal(existsSync(join(cliRoot, "maps/state-change.xmind")), false);

    const symlinkPreview = runJson(["xmind-local", cliRoot, "--target", "maps/symlink-change.xmind", "--json"]); const outside = join(work, "xv003-outside.xmind"); writeFileSync(outside, existingArchive()); const outsideBefore = sha(readFileSync(outside));
    symlinkSync(outside, join(cliRoot, "maps/symlink-change.xmind")); const symlinkMutation = runJson(["xmind-local", cliRoot, "--target", "maps/symlink-change.xmind", "--apply", "--approval-digest", symlinkPreview.approvalDigest, "--json"]);
    assertStale(symlinkMutation); assert.equal(sha(readFileSync(outside)), outsideBefore);

    const approved = runJson(["xmind-local", cliRoot, "--target", "maps/approved.xmind", "--json"]); const applied = runJson(["xmind-local", cliRoot, "--target", "maps/approved.xmind", "--apply", "--approval-digest", approved.approvalDigest, "--json"]);
    assert.equal(applied.status, "local-selected-after-approval"); assert.equal(applied.changed, true); const approvedBytes = readFileSync(join(cliRoot, "maps/approved.xmind"));
    const retryPreview = runJson(["xmind-local", cliRoot, "--target", "maps/approved.xmind", "--json"]); const retry = runJson(["xmind-local", cliRoot, "--target", "maps/approved.xmind", "--apply", "--approval-digest", retryPreview.approvalDigest, "--json"]);
    assert.equal(retry.status, "local-selected-after-approval"); assert.equal(retry.changed, false); assert.deepEqual(readFileSync(join(cliRoot, "maps/approved.xmind")), approvedBytes);
  });
  await test("XV-004", "Mermaid style可否どちらでも意味文保持", () => { const root = fixture("xv004"); const capable = buildProjectionBundle(root); const fallback = buildProjectionBundle(root, { mindmapSyntaxAccepted: false }); checkVisualText(capable.files["quadrant.mmd"]); checkVisualText(fallback.files["quadrant.mmd"]); assert.equal(fallback.renderer.verified, false); });
} finally { delete process.env.CLARITY_NOW; rmSync(work, { recursive: true, force: true }); }

const registryText = readFileSync(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"), "utf8");
const registry = JSON.parse(registryText.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1] || "null");
assert.deepEqual(registry.primaryCaseIds["sprint-043"], primary, "primary registry missing/extra/order mismatch");
assert.deepEqual(registry.visualProviderCaseIds["sprint-043"], visual, "visual registry missing/extra/order mismatch");
assert.equal(new Set(expected).size, expected.length, "registry duplicate"); assert.deepEqual(results.map((r) => r.id), expected, "execution missing/duplicate/order mismatch");
const failed = results.filter((r) => r.status === "fail"); const notRun = results.filter((r) => r.status === "not-run");
assert.deepEqual(notRun.map((r) => r.id), ["XM-007"], "only real external live may be NOT-RUN");
process.stdout.write("SPRINT043_REGISTRY_MISSING=0 DUPLICATE=0 EXTRA=0\n");
process.stdout.write(`SPRINT043_CASE_PASS=${results.length - failed.length - notRun.length} FAIL=${failed.length} NOT_RUN=${notRun.length} TOTAL=${results.length}\n`);
if (failed.length) process.exit(1);
