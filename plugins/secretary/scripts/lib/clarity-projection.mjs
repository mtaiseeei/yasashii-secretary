import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ClarityError, appendEvent, attention, history, rebuildState, status } from "./clarity-core.mjs";
import { FilesystemBoundaryError, safeWritePath, writeFileAtomicSafe } from "./safe-fs.mjs";
import { resolveClarityRoot, withClarityRootObservation } from "./clarity-root.mjs";

export const QUADRANT_VISUALS = Object.freeze({
  stabilize: Object.freeze({ quadrant: "q2", position: "左上", emoji: "🟢", label: "定着・検証", meaning: "安定している", color: "#16A34A" }),
  execute: Object.freeze({ quadrant: "q1", position: "右上", emoji: "🔵", label: "実行待ち", meaning: "あとは進めるだけ", color: "#2563EB" }),
  validate: Object.freeze({ quadrant: "q3", position: "左下", emoji: "🟡", label: "暫定実装・要再確認", meaning: "注意して確認する", color: "#D97706" }),
  decide: Object.freeze({ quadrant: "q4", position: "右下", emoji: "🔴", label: "設計・意思決定", meaning: "人間の判断が必要", color: "#DC2626" }),
});

const MANAGED_SHEETS = Object.freeze({ matrix: "clarity-matrix-sheet", structure: "clarity-structure-sheet" });
const SETTINGS_PATH = ".clarity/xmind-settings.json";

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function safeRoot(value) {
  try { return resolveClarityRoot(value || ".").root; }
  catch (error) { throw new ClarityError(error?.code || "root-unsafe", error instanceof Error ? error.message : "working rootを安全に確認できません。", 3, { changed: false, ...(error?.details || {}) }); }
}
function relativeTarget(root, value) {
  const absolute = resolve(root, value);
  const rel = relative(root, absolute);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new ClarityError("path-outside-root", "working root外へは書込みません。");
  return rel.split(sep).join("/");
}
function localTarget(root, value) {
  const requested = relativeTarget(root, value);
  const path = safeWritePath(root, requested);
  return { requested, target: relativeTarget(root, path), path };
}
function readTarget(path) {
  if (!existsSync(path)) return { bytes: null, identity: { exists: false, kind: "missing", sha256: null, bytes: 0 } };
  const bytes = readFileSync(path);
  return { bytes, identity: { exists: true, kind: "file", sha256: sha(bytes), bytes: bytes.length } };
}
function localApprovalDigest(artifact) { return sha(stableJson(artifact)); }
function staleLocalApproval(preview, reason) {
  return {
    ...preview,
    archive: undefined,
    status: "fallback-approval-required",
    changed: false,
    staleApproval: true,
    repreviewRequired: true,
    reason,
  };
}
function esc(value) { return String(value).replace(/[\r\n]+/gu, " ").replace(/["<>]/gu, "").trim(); }
function stableNumber(id, salt) { return Number.parseInt(sha(`${id}:${salt}`).slice(0, 8), 16) / 0xffffffff; }

export function stableCoordinate(item) {
  const centers = { stabilize: [25, 75], execute: [75, 75], validate: [25, 25], decide: [75, 25] };
  const [cx, cy] = centers[item.quadrant] || centers.decide;
  return { x: Number((cx + (stableNumber(item.itemId, "x") - 0.5) * 14).toFixed(3)), y: Number((cy + (stableNumber(item.itemId, "y") - 0.5) * 14).toFixed(3)) };
}

function snapshot(rootValue) {
  const root = safeRoot(rootValue);
  const state = rebuildState(root, { write: false }).state;
  return { root, state, status: status(root), attention: attention(root, { limit: 20, clock: state.generatedAt }), history: history(root) };
}

function legendMarkdown() {
  return Object.values(QUADRANT_VISUALS).map((v) => `- ${v.position} ${v.emoji} ${v.label} — ${v.meaning} — ${v.color}`).join("\n");
}
function matrixMarkdown(state) {
  const rows = state.items.filter((item) => item.activeMatrix !== false).sort((a, b) => a.itemId.localeCompare(b.itemId, "en"));
  return `# 決定×実行クラリティマトリクス\n\n上軸: 決まっている / 下軸: まだ決まっていない\n\n${legendMarkdown()}\n\n| Item ID | 項目 | 象限 | 意味 | 決定 | 実行 | 座標 |\n|---|---|---|---|---|---|---|\n${rows.map((item) => { const v = QUADRANT_VISUALS[item.quadrant]; const p = stableCoordinate(item); return `| ${item.itemId} | ${esc(item.title)} | ${v.emoji} ${v.label} | ${v.meaning} | ${item.decision.status} | ${item.execution.status} | ${p.x}, ${p.y} |`; }).join("\n")}\n`;
}
function overviewMarkdown(data) {
  const counts = Object.fromEntries(Object.keys(QUADRANT_VISUALS).map((key) => [key, data.state.items.filter((i) => i.activeMatrix !== false && i.quadrant === key).length]));
  return `# Project Clarity 概要\n\n- Project: ${esc(data.status.name)}\n- Mode: ${data.status.mode}\n- Item: ${data.state.items.length}件\n- Attention: ${data.attention.activeCount}件\n\n## マトリクス\n\n${Object.entries(QUADRANT_VISUALS).map(([key, v]) => `- ${v.emoji} ${v.label}: ${counts[key]}件 — ${v.meaning}`).join("\n")}\n`;
}
function attentionMarkdown(report) {
  const body = report.items.length ? report.items.map((row) => `## ${row.conclusion}\n\n- Item ID: ${row.itemId}\n- 理由: ${row.reasonLabels.join(" / ")}\n- 根拠: ${row.evidence.map((e) => e.summary).join(" / ") || "根拠不足"}\n- 選択: ${row.choices.join(" / ")}`).join("\n\n") : "現在、判断が必要な項目はありません。";
  return `# Attention\n\n${body}\n`;
}

function quadrantMermaid(state) {
  const points = state.items.filter((i) => i.activeMatrix !== false).sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map((item) => { const p = stableCoordinate(item); return `  \"${esc(item.title)} [${item.itemId}]\": [${(p.x / 100).toFixed(3)}, ${(p.y / 100).toFixed(3)}]`; });
  return `%%{init: {"themeVariables":{"quadrant1Fill":"#2563EB","quadrant2Fill":"#16A34A","quadrant3Fill":"#D97706","quadrant4Fill":"#DC2626"}}}%%\n%% 左上 🟢 定着・検証 / 安定している / #16A34A\n%% 右上 🔵 実行待ち / あとは進めるだけ / #2563EB\n%% 左下 🟡 暫定実装・要再確認 / 注意して確認する / #D97706\n%% 右下 🔴 設計・意思決定 / 人間の判断が必要 / #DC2626\nquadrantChart\n  title 決定×実行クラリティマトリクス\n  x-axis まだ進めていない --> 進めている\n  y-axis まだ決まっていない --> 決まっている\n  quadrant-1 🔵 実行待ち / あとは進めるだけ\n  quadrant-2 🟢 定着・検証 / 安定している\n  quadrant-3 🟡 暫定実装・要再確認 / 注意して確認する\n  quadrant-4 🔴 設計・意思決定 / 人間の判断が必要\n${points.join("\n")}\n`;
}
function structureMermaid(state, fallback = false) {
  const areas = new Map();
  for (const item of state.items) { const area = esc(item.areaPath || "未分類").split("/")[0]; if (!areas.has(area)) areas.set(area, []); areas.get(area).push(item); }
  if (fallback) return `flowchart TD\n  root[\"Project Clarity\"]\n${[...areas].sort(([a], [b]) => a.localeCompare(b, "ja")).flatMap(([area, items], ai) => [`  a${ai}[\"${area}\"]`, `  root --> a${ai}`, ...items.sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map((i, ii) => `  a${ai} --> a${ai}i${ii}[\"${esc(i.title)} [${i.itemId}]\"]`)]).join("\n")}\n`;
  return `mindmap\n  root((Project Clarity))\n${[...areas].sort(([a], [b]) => a.localeCompare(b, "ja")).map(([area, items]) => `    ${area}\n${items.sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map((i) => `      ${esc(i.title)} [${i.itemId}]`).join("\n")}`).join("\n")}\n`;
}
function dependencyMermaid(state) {
  const ids = new Set(state.items.map((i) => i.itemId));
  const nodes = state.items.slice().sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map((i, n) => `  n${n}[\"${esc(i.title)} [${i.itemId}]\"]`);
  const index = new Map(state.items.slice().sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map((i, n) => [i.itemId, n]));
  const edges = state.items.flatMap((i) => (i.dependencies || []).filter((id) => ids.has(id)).sort().map((id) => `  n${index.get(id)} --> n${index.get(i.itemId)}`));
  return `flowchart LR\n${nodes.join("\n")}\n${edges.length ? edges.join("\n") : "  none[\"依存関係なし\"]"}\n`;
}
function stateFlowMermaid() {
  return `stateDiagram-v2\n  [*] --> 探索中\n  探索中 --> 提案済み: 提案\n  提案済み --> 決定済み: 人間が承認\n  提案済み --> 却下: 人間が却下\n  決定済み --> 実行中: 着手\n  実行中 --> 実装済み: 完了\n  実装済み --> 検証済み: 検証成功\n  検証済み --> [*]\n`;
}

function buildProjectionBundleImpl(rootValue, { mindmapSyntaxAccepted = true } = {}) {
  const data = snapshot(rootValue);
  const files = {
    "overview.md": overviewMarkdown(data), "attention.md": attentionMarkdown(data.attention), "matrix.md": matrixMarkdown(data.state),
    "quadrant.mmd": quadrantMermaid(data.state), "structure.mmd": structureMermaid(data.state, !mindmapSyntaxAccepted),
    "dependencies.mmd": dependencyMermaid(data.state), "state-flow.mmd": stateFlowMermaid(),
  };
  const bytes = Object.keys(files).sort().map((name) => `${name}\0${files[name]}`).join("\0");
  return { status: "preview", changed: false, renderer: { available: false, verified: false, reason: "Mermaid rendererは実行していません。raw .mmdとMarkdownを保持します。" }, structureMode: mindmapSyntaxAccepted ? "mindmap" : "flowchart-fallback", files, digest: sha(bytes), stateDigest: sha(stableJson(data.state)) };
}

function writeProjectionBundleImpl(rootValue, options = {}) {
  const root = safeRoot(rootValue); const bundle = buildProjectionBundle(root, options); let changed = false;
  for (const [name, bytes] of Object.entries(bundle.files)) { const rel = `.clarity/projections/${name}`; if (!existsSync(safeWritePath(root, rel)) || readFileSync(safeWritePath(root, rel), "utf8") !== bytes) { writeFileAtomicSafe(root, rel, bytes, { encoding: "utf8" }); changed = true; } }
  return { ...bundle, status: changed ? "written" : "unchanged", changed, paths: Object.keys(bundle.files).map((name) => `.clarity/projections/${name}`) };
}

function getXmindSettingsImpl(rootValue) {
  const root = safeRoot(rootValue); const path = safeWritePath(root, SETTINGS_PATH);
  if (!existsSync(path)) return { xmindEnabled: false, source: "default", changed: false };
  const value = JSON.parse(readFileSync(path, "utf8"));
  return { xmindEnabled: value.xmindEnabled === true, source: "explicit-setting", changed: false };
}
function setXmindEnabledImpl(rootValue, enabled) {
  if (typeof enabled !== "boolean") throw new ClarityError("xmind-setting-invalid", "Xmind設定はONかOFFを明示してください。");
  const root = safeRoot(rootValue); status(root); const before = getXmindSettings(root); const bytes = stableJson({ schemaVersion: 1, xmindEnabled: enabled });
  if (existsSync(safeWritePath(root, SETTINGS_PATH)) && readFileSync(safeWritePath(root, SETTINGS_PATH), "utf8") === bytes) return { ...before, status: "unchanged" };
  writeFileAtomicSafe(root, SETTINGS_PATH, bytes, { encoding: "utf8" }); return { xmindEnabled: enabled, source: "explicit-setting", changed: true, status: enabled ? "enabled" : "disabled" };
}

export function resolveXmindProvider({ settings = { xmindEnabled: false }, mcp = {}, local = {}, localDecision = "unanswered", requestedProvider = "auto" } = {}) {
  const capable = Boolean(mcp.connected && mcp.capabilities?.create && mcp.capabilities?.read && mcp.capabilities?.update && mcp.capabilities?.stylePlacement);
  const providers = [
    { provider: "xmind-mcp", priority: 1, capability: capable, connected: Boolean(mcp.connected), selected: false, verified: Boolean(mcp.verified === true), reason: capable ? "create/read/updateと色・配置を利用できます" : (mcp.reason || "必要なMCP capabilityを確認できません") },
    { provider: "local-xmind", priority: 2, capability: Boolean(local.capable !== false), connected: true, selected: false, verified: false, reason: local.reason || "既知のXMind Zen内部構造を生成できます。実Xmindでのopen確認は未検証です" },
    { provider: "mermaid", priority: 3, capability: true, connected: true, selected: false, verified: false, reason: "raw .mmdとMarkdownへ安全にfallbackできます" },
  ];
  if (!settings.xmindEnabled) return { state: "stopped", selected: null, reason: "Xmind設定は既定OFFです", settingsEnabled: false, providers, nextActions: ["Xmindを使う場合だけ設定を明示的にONへ変更してください"] };
  if (capable && !mcp.failed) { providers[0].selected = true; return { state: "mcp-selected", selected: "xmind-mcp", reason: "capableかつconnectedのXmind MCPを第1優先で選択しました", settingsEnabled: true, providers, nextActions: [] }; }
  const mcpReason = requestedProvider === "local" ? "利用者がlocalを指定しました" : (mcp.failureReason || providers[0].reason);
  if (localDecision === "approved") { providers[1].selected = true; return { state: "local-selected-after-approval", selected: "local-xmind", reason: `${mcpReason}。local previewへの明示承認を確認しました`, settingsEnabled: true, providers, nextActions: [] }; }
  if (["rejected", "canceled"].includes(localDecision)) return { state: "stopped", selected: null, reason: `${mcpReason}。local fallbackは承認されませんでした`, settingsEnabled: true, providers, nextActions: ["Mermaid/Markdownを利用できます"] };
  return { state: "fallback-approval-required", selected: null, reason: `${mcpReason}。local .xmindへの書込みには明示承認が必要です`, settingsEnabled: true, providers, nextActions: ["Xmind MCPの接続・導入を確認する", "local previewを確認して承認する", "Mermaid/Markdownへfallbackする"] };
}

export function createXmindMcpAdapter(transport) {
  if (!transport || typeof transport.request !== "function") throw new ClarityError("xmind-mcp-adapter-invalid", "MCP transportにrequest関数が必要です。");
  const call = async (operation, request) => {
    const envelope = { contract: "agentic-secretary.xmind.v1", operation, request: { ...structuredClone(request), requiredSheets: ["決定×実行クラリティマトリクス", "Project構造"], visuals: QUADRANT_VISUALS } };
    const response = await transport.request(envelope);
    if (!response || response.ok !== true) throw new ClarityError("xmind-mcp-failed", `Xmind MCP ${operation}に失敗しました。`, 3, { operation, changed: false, response: response || null });
    return { operation, request: envelope, response: structuredClone(response), verified: false, verification: "isolated-fake-boundary" };
  };
  return { create: (request) => call("create", request), read: (request) => call("read", request), update: (request) => call("update", request) };
}

let crcTable;
function crc32(buffer) {
  if (!crcTable) crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); return c >>> 0; });
  let crc = 0xffffffff; for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }
export function packXmindArchive(entriesValue) {
  const entries = Object.entries(entriesValue).sort(([a], [b]) => a.localeCompare(b, "en")).map(([name, data]) => ({ name, nameBytes: Buffer.from(name), data: Buffer.isBuffer(data) ? data : Buffer.from(data) }));
  const locals = []; const centrals = []; let offset = 0;
  for (const entry of entries) {
    const crc = crc32(entry.data); const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x800), u16(0), u16(0), u16(0x21), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(entry.nameBytes.length), u16(0), entry.nameBytes, entry.data]); locals.push(local);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0x21), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(entry.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), entry.nameBytes])); offset += local.length;
  }
  const directory = Buffer.concat(centrals); return Buffer.concat([...locals, directory, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
}
export function unpackXmindArchive(buffer) {
  const data = Buffer.from(buffer); if (data.length > 32 * 1024 * 1024) throw new ClarityError("xmind-zip-too-large", "Xmind archiveが安全な読取り上限を超えています。"); const output = {}; let offset = 0; let totalSize = 0; let entryCount = 0;
  while (offset + 4 <= data.length && data.readUInt32LE(offset) === 0x04034b50) {
    entryCount += 1; if (entryCount > 200) throw new ClarityError("xmind-zip-too-many-entries", "Xmind archiveのentry数が安全な上限を超えています。");
    const flags = data.readUInt16LE(offset + 6); const method = data.readUInt16LE(offset + 8); const expectedCrc = data.readUInt32LE(offset + 14); const compressedSize = data.readUInt32LE(offset + 18); const size = data.readUInt32LE(offset + 22); const nameLength = data.readUInt16LE(offset + 26); const extraLength = data.readUInt16LE(offset + 28);
    if (flags & 0x08) throw new ClarityError("xmind-zip-unsupported", "data descriptor形式のZIPは安全に更新できません。");
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString("utf8"); if (!name || name.startsWith("/") || name.split("/").some((part) => part === "..") || Object.hasOwn(output, name)) throw new ClarityError("xmind-zip-unsafe", "Xmind archiveに危険または重複したentry pathがあります。");
    if (size > 16 * 1024 * 1024 || (totalSize += size) > 64 * 1024 * 1024) throw new ClarityError("xmind-zip-too-large", "Xmind archiveの展開後sizeが安全な上限を超えています。");
    const start = offset + 30 + nameLength + extraLength; const compressed = data.subarray(start, start + compressedSize); const value = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 16 * 1024 * 1024 }) : null;
    if (!value || value.length !== size || crc32(value) !== expectedCrc) throw new ClarityError("xmind-zip-unsupported", "対応していない、または破損したXmind ZIPです。"); output[name] = value; offset = start + compressedSize;
  }
  const eocd = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (entryCount === 0 || offset + 4 > data.length || data.readUInt32LE(offset) !== 0x02014b50 || eocd < offset || eocd + 22 > data.length || data.readUInt16LE(eocd + 10) !== entryCount) throw new ClarityError("xmind-zip-invalid", "Xmind ZIPのcentral directoryを確認できません。");
  return output;
}

function itemTopic(item) { const v = QUADRANT_VISUALS[item.quadrant]; return { id: `clarity-${item.itemId}`, class: "topic", title: `${v.emoji} ${item.title}`, labels: [`Clarity Item ID: ${item.itemId}`, v.label, v.meaning], position: stableCoordinate(item), style: { properties: { "svg:fill": v.color, "fo:color": "#FFFFFF" } } }; }
function quadrantTopic(key, items, preserved = []) { const v = QUADRANT_VISUALS[key]; return { id: `clarity-quadrant-${key}`, class: "topic", title: `${v.emoji} ${v.label} — ${v.meaning}`, labels: [v.position, v.color], style: { properties: { "svg:fill": v.color, "fo:color": "#FFFFFF" } }, children: { attached: [...items.filter((i) => i.quadrant === key).sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map(itemTopic), ...preserved] } }; }
function managedSheets(data, prior = []) {
  const priorMatrix = prior.find((s) => s.id === MANAGED_SHEETS.matrix); const oldBranches = priorMatrix?.rootTopic?.children?.attached?.filter((topic) => !String(topic.id || "").startsWith("clarity-quadrant-")) || [];
  const oldByQuadrant = new Map((priorMatrix?.rootTopic?.children?.attached || []).filter((topic) => String(topic.id || "").startsWith("clarity-quadrant-")).map((topic) => [String(topic.id).slice("clarity-quadrant-".length), (topic.children?.attached || []).filter((child) => !String(child.id || "").startsWith("clarity-ci_"))]));
  const matrix = { id: MANAGED_SHEETS.matrix, class: "sheet", title: "決定×実行クラリティマトリクス", rootTopic: { id: "clarity-matrix-root", class: "topic", title: "Project Clarity", labels: ["上軸: 決まっている", "下軸: まだ決まっていない"], children: { attached: [...Object.keys(QUADRANT_VISUALS).map((key) => quadrantTopic(key, data.state.items, oldByQuadrant.get(key) || [])), ...oldBranches] } } };
  const tree = new Map(); for (const item of data.state.items) { const area = (item.areaPath || "未分類").split("/")[0]; if (!tree.has(area)) tree.set(area, []); tree.get(area).push(item); }
  const priorStructure = prior.find((s) => s.id === MANAGED_SHEETS.structure); const oldStructure = priorStructure?.rootTopic?.children?.attached?.filter((topic) => !String(topic.id || "").startsWith("clarity-area-")) || [];
  const structure = { id: MANAGED_SHEETS.structure, class: "sheet", title: "Project構造", rootTopic: { id: "clarity-structure-root", class: "topic", title: "Project構造", children: { attached: [...[...tree].sort(([a], [b]) => a.localeCompare(b, "ja")).map(([area, items]) => ({ id: `clarity-area-${sha(area).slice(0, 12)}`, class: "topic", title: area, children: { attached: items.sort((a, b) => a.itemId.localeCompare(b.itemId, "en")).map(itemTopic) } })), ...oldStructure] } } };
  return [matrix, structure];
}

export function validateXmindStructure(buffer) {
  const entries = unpackXmindArchive(buffer); const required = ["content.json", "metadata.json", "manifest.json"]; const missing = required.filter((name) => !entries[name]); let sheets = [];
  try { sheets = JSON.parse(entries["content.json"]?.toString("utf8") || "null"); } catch { missing.push("content.json(valid JSON)"); }
  const managed = Array.isArray(sheets) ? sheets.filter((s) => Object.values(MANAGED_SHEETS).includes(s.id)) : [];
  const itemIds = Array.isArray(sheets) ? [...JSON.stringify(sheets).matchAll(/Clarity Item ID: (ci_[a-f0-9]{20})/gu)].map((m) => m[1]) : [];
  const text = entries["content.json"]?.toString("utf8") || ""; const visualComplete = Object.values(QUADRANT_VISUALS).every((v) => [v.emoji, v.label, v.meaning, v.color].every((part) => text.includes(part)));
  return { format: "xmind-zen-json-zip", structurallyValid: missing.length === 0 && Array.isArray(sheets) && managed.length === 2 && visualComplete, verified: false, openability: "not-verified-with-xmind-app", missing, entryNames: Object.keys(entries).sort(), sheetIds: Array.isArray(sheets) ? sheets.map((s) => s.id) : [], managedSheetCount: managed.length, itemIds: [...new Set(itemIds)].sort(), visualComplete };
}
function previewLocalXmindImpl(rootValue, targetValue, { mcpReason = "Xmind MCPを利用できません", requestedProvider = "auto" } = {}) {
  const data = snapshot(rootValue); const root = data.root; const targetInfo = localTarget(root, targetValue); const { target, path } = targetInfo; if (!target.toLowerCase().endsWith(".xmind")) throw new ClarityError("xmind-target-invalid", "local Xmindのtargetは.xmind fileを指定してください。");
  const existing = readTarget(path); const existingTarget = existing.identity; const existingBytes = existing.bytes; let priorSheets = [];
  if (existingBytes) { const entries = unpackXmindArchive(existingBytes); priorSheets = JSON.parse(entries["content.json"]?.toString("utf8") || "[]"); if (!Array.isArray(priorSheets)) throw new ClarityError("xmind-content-invalid", "既存Xmindのcontent.jsonがSheet配列ではありません。"); }
  const unrelatedSheets = priorSheets.filter((s) => !Object.values(MANAGED_SHEETS).includes(s.id)); const managed = managedSheets(data, priorSheets); const content = [...unrelatedSheets, ...managed];
  const oldEntries = existingBytes ? unpackXmindArchive(existingBytes) : {}; let oldMetadata = {}; let oldManifest = {}; try { oldMetadata = JSON.parse(oldEntries["metadata.json"]?.toString("utf8") || "{}"); } catch { /* 内部検査で不正を報告する。 */ } try { oldManifest = JSON.parse(oldEntries["manifest.json"]?.toString("utf8") || "{}"); } catch { /* 内部検査で不正を報告する。 */ }
  const metadata = { ...oldMetadata, creator: oldMetadata.creator || { name: "agentic-secretary", version: "clarity-v1" }, activeSheetId: oldMetadata.activeSheetId || MANAGED_SHEETS.matrix };
  const manifest = { ...oldManifest, "file-entries": { ...(oldManifest["file-entries"] || {}), "content.json": {}, "metadata.json": {} } };
  const entries = { ...oldEntries, "content.json": Buffer.from(stableJson(content)), "metadata.json": Buffer.from(stableJson(metadata)), "manifest.json": Buffer.from(stableJson(manifest)) };
  const archive = packXmindArchive(entries); const archiveDigest = sha(archive); const operation = existingTarget.exists ? "update" : "create";
  const existingImpact = existingTarget.exists
    ? { unrelatedSheetsPreserved: unrelatedSheets.map((s) => s.id), managedSheetsReplaced: managed.map((s) => s.id), unknownEntriesPreserved: Object.keys(oldEntries).filter((n) => !["content.json", "metadata.json", "manifest.json"].includes(n)).sort() }
    : { unrelatedSheetsPreserved: [], managedSheetsReplaced: [], unknownEntriesPreserved: [] };
  const authExpected = false; const creditExpected = false; const stateDigest = sha(stableJson(data.state));
  const approvalArtifact = {
    schema: "agentic-secretary.local-xmind-approval.v1",
    target: {
      canonicalRootRelativePath: target,
      workingRootDigest: sha(root),
      resolvedPathDigest: sha(path),
    },
    operation,
    providerGate: { provider: "local-xmind", requestedProvider, gate: "explicit-preview-approval", mcpReason },
    projection: { stateDigest, contentDigest: sha(entries["content.json"]), archiveDigest, bytes: archive.length },
    existingTarget,
    existingImpact,
    authExpected,
    creditExpected,
  };
  return { status: "fallback-approval-required", changed: false, requestedProvider, mcpReason, target, requestedTarget: targetInfo.requested, operation, existingTarget, existingImpact, refreshWarning: existingTarget.exists ? "Xmindでmapを開いている場合は、承認・保存後にfileを再読込してください" : null, authExpected, creditExpected, approvalRequired: true, approvalArtifact, approvalDigest: localApprovalDigest(approvalArtifact), archiveDigest, stateDigest, bytes: archive.length, internalValidation: validateXmindStructure(archive), archive };
}
function writeLocalXmindImpl(rootValue, targetValue, { approval, approvalDigest, mcpReason, requestedProvider } = {}) {
  const root = safeRoot(rootValue); let preview;
  try { preview = previewLocalXmind(root, targetValue, { mcpReason, requestedProvider }); }
  catch (error) {
    if (approval === "approved" && error instanceof FilesystemBoundaryError) return { status: "fallback-approval-required", changed: false, staleApproval: true, repreviewRequired: true, reason: "targetのpath解決またはsymlink状態が変わったため、書き込まずに再previewが必要です" };
    throw error;
  }
  if (approval !== "approved") return { ...preview, status: approval === "rejected" || approval === "canceled" ? "stopped" : "fallback-approval-required", archive: undefined, reason: "local .xmind書込みの明示承認がありません" };
  if (!approvalDigest || approvalDigest !== preview.approvalDigest) return staleLocalApproval(preview, "target、operation、既存map、影響、projection、provider条件のいずれかがpreviewから変わったため、書き込まずに再previewが必要です");

  let currentPreview;
  try { currentPreview = previewLocalXmind(root, targetValue, { mcpReason, requestedProvider }); }
  catch (error) {
    if (error instanceof FilesystemBoundaryError) return staleLocalApproval(preview, "targetのpath解決またはsymlink状態が変わったため、書き込まずに再previewが必要です");
    throw error;
  }
  if (currentPreview.approvalDigest !== approvalDigest) return staleLocalApproval(currentPreview, "apply直前にtarget、operation、既存map、影響、projection、provider条件が変わったため、書き込まずに再previewが必要です");

  const path = safeWritePath(root, currentPreview.target); const currentTarget = readTarget(path); const currentIdentity = currentTarget.identity;
  if (stableJson(currentIdentity) !== stableJson(currentPreview.approvalArtifact.existingTarget)) return staleLocalApproval(currentPreview, "apply直前に既存targetが変わったため、書き込まずに再previewが必要です");
  const current = currentTarget.bytes; const changed = !current || !current.equals(currentPreview.archive); if (changed) writeFileAtomicSafe(root, currentPreview.target, currentPreview.archive);
  return { ...currentPreview, archive: undefined, status: "local-selected-after-approval", provider: "local-xmind", changed, verified: false, reason: changed ? "承認対象とapply直前状態の一致を確認して書き込みました。実Xmindでのopen確認は未検証です" : "承認対象は一致し、archiveが同一bytesのため書込み不要でした", sha256: currentPreview.archiveDigest };
}

function proposeXmindEditImpl(rootValue, { itemId, section, value } = {}) {
  const data = snapshot(rootValue); const item = data.state.items.find((row) => row.itemId === itemId); if (!item) throw new ClarityError("item-missing", "指定したClarity Itemが見つかりません。");
  const allowed = { decision: ["proposed", "confirmed", "rejected", "superseded"], execution: ["not_started", "in_progress", "implemented", "verified", "operational", "rolled_back"], validation: ["unknown", "pending", "passed", "failed", "waived"] };
  if (!allowed[section]?.includes(value)) throw new ClarityError("xmind-proposal-invalid", "Xmind editの提案内容をClarity Eventへ安全に対応付けられません。");
  const proposalId = `xp_${sha(`${itemId}:${section}:${value}`).slice(0, 20)}`; return { proposalId, status: "approval-required", changed: false, itemId, section, from: item[section].status, to: value, stateDigest: sha(stableJson(data.state)), note: "Xmindは提案入力です。承認前はcanonical Stateを変更しません。" };
}
function applyXmindProposalImpl(rootValue, proposal, { decision = "unanswered" } = {}) {
  if (decision !== "approved") return { ...proposal, status: ["rejected", "canceled"].includes(decision) ? "stopped" : "approval-required", changed: false };
  const current = proposeXmindEdit(rootValue, { itemId: proposal.itemId, section: proposal.section, value: proposal.to }); if (current.proposalId !== proposal.proposalId || current.stateDigest !== proposal.stateDigest) throw new ClarityError("xmind-proposal-stale", "Stateまたは提案内容が変わったため、もう一度確認してください。");
  const types = { decision: { proposed: "decision.proposed", confirmed: "decision.confirmed", rejected: "decision.rejected", superseded: "decision.superseded" }, execution: {}, validation: {} }; const type = types[proposal.section]?.[proposal.to] || `${proposal.section}.changed`;
  const payload = proposal.section === "decision" ? { source: "xmind-proposal", humanConfirmed: true, proposalId: proposal.proposalId } : { status: proposal.to, proposalId: proposal.proposalId };
  const result = appendEvent(rootValue, { eventId: `cv_${sha(`xmind:${proposal.proposalId}`).slice(0, 20)}`, type, itemId: proposal.itemId, actor: "human-approved-xmind-proposal", payload }); return { ...proposal, status: result.changed ? "applied" : "unchanged", changed: result.changed, eventId: result.event.eventId };
}

function runRootRequest(rootValue, operation) {
  return withClarityRootObservation(rootValue, (handle) => operation(handle.root));
}

export function buildProjectionBundle(rootValue, options = {}) { return runRootRequest(rootValue, (root) => buildProjectionBundleImpl(root, options)); }
export function writeProjectionBundle(rootValue, options = {}) { return runRootRequest(rootValue, (root) => writeProjectionBundleImpl(root, options)); }
export function getXmindSettings(rootValue) { return runRootRequest(rootValue, getXmindSettingsImpl); }
export function setXmindEnabled(rootValue, enabled) { return runRootRequest(rootValue, (root) => setXmindEnabledImpl(root, enabled)); }
export function previewLocalXmind(rootValue, targetValue, options = {}) { return runRootRequest(rootValue, (root) => previewLocalXmindImpl(root, targetValue, options)); }
export function writeLocalXmind(rootValue, targetValue, options = {}) { return runRootRequest(rootValue, (root) => writeLocalXmindImpl(root, targetValue, options)); }
export function proposeXmindEdit(rootValue, options = {}) { return runRootRequest(rootValue, (root) => proposeXmindEditImpl(root, options)); }
export function applyXmindProposal(rootValue, proposal, options = {}) { return runRootRequest(rootValue, (root) => applyXmindProposalImpl(root, proposal, options)); }
