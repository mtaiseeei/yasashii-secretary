import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const EDITION_IDS = Object.freeze(["agentic-secretary", "yasashii-secretary"]);
const EDITION_SET = new Set(EDITION_IDS);
const CONFIG_FIELDS = new Set(["schemaVersion", "edition", "distribution", "update", "workspaceProtection", "harness", "copy", "newWorkspace"]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel && rel !== ".." && !rel.startsWith(`..${sep}`);
}

function safeRead(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/") || relativePath.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) {
    return { status: "unsafe-path" };
  }
  const target = resolve(root, relativePath);
  if (!inside(root, target)) return { status: "unsafe-path" };
  let cursor = root;
  for (const part of relativePath.split("/")) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) return { status: "symlink" };
  }
  if (!existsSync(target)) return { status: "missing", path: target };
  if (!lstatSync(target).isFile()) return { status: "not-file", path: target };
  try { return { status: "file", path: target, bytes: readFileSync(target) }; }
  catch { return { status: "unreadable", path: target }; }
}

function parseJson(read) {
  if (read.status !== "file") return { status: read.status };
  try { return { status: "json", value: JSON.parse(read.bytes.toString("utf8")) }; }
  catch { return { status: "invalid-json" }; }
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`EditionConfigの${label}が欠落しています。`);
  return value;
}

function safeRelativePath(value) {
  return typeof value === "string" && Boolean(value)
    && !value.startsWith("/")
    && !value.split(/[\\/]/).some((part) => !part || part === "." || part === "..");
}

export function loadEditionConfig(pluginRootValue, configPathValue = null) {
  let pluginRoot;
  try { pluginRoot = realpathSync(resolve(pluginRootValue)); }
  catch { throw new Error("plugin rootを読み取れないためeditionを決められません。"); }
  const configPath = configPathValue ? resolve(configPathValue) : join(pluginRoot, "edition.json");
  if (!inside(pluginRoot, configPath)) throw new Error("EditionConfigがplugin root外を指しています。");
  let config;
  try { config = JSON.parse(readFileSync(configPath, "utf8")); }
  catch { throw new Error("EditionConfigを読み取れないため暗黙のyasashii fallbackは行いません。"); }
  if (!isPlainObject(config) || Object.keys(config).some((key) => !CONFIG_FIELDS.has(key)) || Object.keys(config).length !== CONFIG_FIELDS.size || config.schemaVersion !== 1) {
    throw new Error("EditionConfigのschemaまたは項目が不明です。暗黙のyasashii fallbackは行いません。");
  }
  if (!EDITION_SET.has(config.edition)) throw new Error("EditionConfigのeditionが未知です。暗黙のyasashii fallbackは行いません。");
  for (const [group, fields] of Object.entries({
    distribution: ["pluginId", "marketplaceId", "repository", "marketplaceUrl", "changelogUrl"],
    update: ["ledgerPath", "sessionDirectory", "protectionCommitPrefix"],
    workspaceProtection: ["canonicalMarker"],
    harness: ["marketplace", "plugin", "installId"],
    copy: ["path"],
    newWorkspace: ["botName", "botEmail"],
  })) {
    if (!isPlainObject(config[group])) throw new Error(`EditionConfigの${group}が欠落しています。`);
    for (const field of fields) requireString(config[group][field], `${group}.${field}`);
  }
  if (config.workspaceProtection.markerSchemaVersion !== 1
    || !Array.isArray(config.update.legacyLedgerPaths)
    || !Array.isArray(config.update.legacySessionDirectories)
    || !Array.isArray(config.workspaceProtection.legacyMarkerFiles)
    || !Array.isArray(config.workspaceProtection.legacyMarkerPrefixes)
    || !Array.isArray(config.workspaceProtection.legacyFingerprint)
    || !Array.isArray(config.copy.surfaces)
    || JSON.stringify([...config.copy.surfaces].sort()) !== JSON.stringify(["conversation", "developerHandoff", "diagnosis", "report"])) {
    throw new Error("EditionConfigのworkspace保護または4面copy設定が不正です。");
  }
  const ledgerPaths = [config.update.ledgerPath, ...config.update.legacyLedgerPaths];
  const sessionDirectories = [config.update.sessionDirectory, ...config.update.legacySessionDirectories];
  if (ledgerPaths.some((path) => !safeRelativePath(path)) || new Set(ledgerPaths).size !== ledgerPaths.length
    || sessionDirectories.some((directory) => !/^[A-Za-z0-9._-]+$/.test(directory))
    || new Set(sessionDirectories).size !== sessionDirectories.length
    || /[\r\n]/.test(config.update.protectionCommitPrefix)
    || !/^[^@\s]+@[^@\s]+$/.test(config.distribution.pluginId)
    || /\s/.test(config.distribution.marketplaceId)) {
    throw new Error("EditionConfigの更新pathまたは実行識別子が不正です。");
  }
  const copyRead = safeRead(pluginRoot, config.copy.path);
  const copyJson = parseJson(copyRead);
  if (copyJson.status !== "json" || !isPlainObject(copyJson.value?.surfaces) || config.copy.surfaces.some((surface) => !isPlainObject(copyJson.value.surfaces[surface]))) {
    throw new Error("EditionConfigの4面copyを確認できません。");
  }
  return Object.freeze({ ...config, pluginRoot, configPath });
}

function markerSignal(workspace, config) {
  const read = safeRead(workspace, config.workspaceProtection.canonicalMarker);
  if (read.status === "missing") return { present: false };
  const parsed = parseJson(read);
  if (parsed.status !== "json" || !isPlainObject(parsed.value)
    || Object.keys(parsed.value).sort().join(",") !== "edition,schemaVersion"
    || parsed.value.schemaVersion !== config.workspaceProtection.markerSchemaVersion
    || !EDITION_SET.has(parsed.value.edition)) {
    return { present: true, unknown: true, evidence: config.workspaceProtection.canonicalMarker };
  }
  return { present: true, edition: parsed.value.edition, evidence: config.workspaceProtection.canonicalMarker };
}

function ledgerSignals(workspace, config) {
  const signals = [];
  const canonical = parseJson(safeRead(workspace, config.update.ledgerPath));
  if (canonical.status !== "missing") {
    if (canonical.status === "json" && isPlainObject(canonical.value)
      && canonical.value.schemaVersion === 2 && EDITION_SET.has(canonical.value.edition) && Array.isArray(canonical.value.records)) {
      signals.push({ edition: canonical.value.edition, evidence: config.update.ledgerPath, kind: "canonical-ledger" });
    } else signals.push({ unknown: true, evidence: config.update.ledgerPath, kind: "canonical-ledger" });
  }
  for (const path of config.update.legacyLedgerPaths) {
    const parsed = parseJson(safeRead(workspace, path));
    if (parsed.status === "missing") continue;
    if (parsed.status === "json" && Array.isArray(parsed.value)) signals.push({ edition: "yasashii-secretary", evidence: path, kind: "legacy-ledger" });
    else signals.push({ unknown: true, evidence: path, kind: "legacy-ledger" });
  }
  return signals;
}

function legacyMarkerSignal(workspace, config) {
  const evidence = [];
  for (const path of config.workspaceProtection.legacyMarkerFiles) {
    const read = safeRead(workspace, path);
    if (!["missing", "file"].includes(read.status)) return { unknown: true, evidence: path, kind: "legacy-marker" };
    if (read.status !== "file") continue;
    const text = read.bytes.toString("utf8");
    if (config.workspaceProtection.legacyMarkerPrefixes.some((marker) => text.includes(marker))) evidence.push(path);
  }
  if (evidence.length) return { edition: "yasashii-secretary", evidence, kind: "legacy-marker" };
  const fingerprint = config.workspaceProtection.legacyFingerprint;
  if (fingerprint.length && fingerprint.every((item) => {
    const read = safeRead(workspace, item.path);
    return read.status === "file" && read.bytes.toString("utf8").includes(item.includes);
  })) return { edition: "yasashii-secretary", evidence: fingerprint.map((item) => item.path), kind: "legacy-fingerprint" };
  return null;
}

export function inspectWorkspaceEdition(workspaceValue, config) {
  let workspace;
  try { workspace = realpathSync(resolve(workspaceValue)); }
  catch { return { state: "unknown", allowed: false, workspace: resolve(workspaceValue), evidence: ["workspace-unreadable"], detectedEditions: [] }; }
  const marker = markerSignal(workspace, config);
  const ledger = ledgerSignals(workspace, config);
  const legacy = legacyMarkerSignal(workspace, config);
  const unknown = Boolean(marker.unknown || ledger.some((item) => item.unknown) || legacy?.unknown);
  const signals = [marker.edition ? { edition: marker.edition, evidence: marker.evidence, kind: "canonical-marker" } : null, ...ledger, legacy].filter(Boolean);
  const editions = [...new Set(signals.map((item) => item.edition).filter(Boolean))].sort();
  const hasCanonical = Boolean(marker.edition || ledger.some((item) => item.kind === "canonical-ledger" && item.edition));
  const legacyOnly = !hasCanonical && editions.length === 1 && editions[0] === "yasashii-secretary";
  let state;
  if (unknown) state = "unknown";
  else if (editions.length > 1) state = "mixed";
  else if (editions.length === 0) state = "new";
  else if (legacyOnly) state = config.edition === "yasashii-secretary" ? "legacy-yasashii" : "opposite-edition";
  else state = editions[0] === config.edition ? "same-edition" : "opposite-edition";
  return {
    state,
    workspace,
    configuredEdition: config.edition,
    detectedEditions: editions,
    evidence: [...new Set(signals.flatMap((item) => Array.isArray(item.evidence) ? item.evidence : [item.evidence]).filter(Boolean))].sort(),
    canonicalMarkerPath: config.workspaceProtection.canonicalMarker,
    ledgerPath: config.update.ledgerPath,
    legacy: legacyOnly,
    plannedMigration: state === "legacy-yasashii" ? `確認後にneutral markerとedition付きledgerへ移行予定: ${config.workspaceProtection.canonicalMarker}, ${config.update.ledgerPath}` : null,
  };
}

export function entryDecision(result, entry) {
  if (entry === "diagnose") return { allowed: true, readOnly: true };
  const allowed = entry === "onboarding"
    ? result.state === "new"
    : ["same-edition", "legacy-yasashii"].includes(result.state);
  return { allowed, readOnly: false };
}

export function refusalMessage(result, entry) {
  const detected = result.detectedEditions.length ? result.detectedEditions.join(", ") : result.state;
  const evidence = result.evidence.length ? result.evidence.join(", ") : "marker／ledgerなし";
  return `workspace edition guard: ${result.state}。検出: ${detected}。検出根拠: ${evidence}。現在のworkspace: ${result.workspace}。導入しようとしたedition: ${result.configuredEdition}。${entry}の書込み、Git、ledger、marker、履歴、設定、plugin操作は実行していません。安全のため停止しました。切替や削除は行いません。`;
}

export function assertWorkspaceEdition(workspace, config, entry) {
  const result = inspectWorkspaceEdition(workspace, config);
  const decision = entryDecision(result, entry);
  if (!decision.allowed) {
    const error = new Error(refusalMessage(result, entry));
    error.code = "edition-guard";
    error.result = result;
    throw error;
  }
  return { ...result, ...decision };
}

export function defaultPluginRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}
