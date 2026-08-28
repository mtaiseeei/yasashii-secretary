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
import { createHash } from "node:crypto";
import { join } from "node:path";
import { safeWritePath, workingRoot } from "./safe-fs.mjs";
import {
  CLARITY_SCHEMA_VERSION,
  ClarityError,
  buildState,
  decideGenericProject,
  findCanonicalItem,
  history,
  status,
  validateEvent,
  validateEvidence,
  validateItem,
  validateProject,
  validateState,
} from "./clarity-core.mjs";

const PROJECT_LIMIT = 100;
const DISPLAY_LIMIT = 3;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix, seed) {
  return `${prefix}_${sha256(String(seed)).slice(0, 20)}`;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function nowIso() {
  const injected = process.env.CLARITY_NOW || process.env.CC_SECRETARY_NOW;
  if (!injected) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(injected)) return `${injected}T00:00:00.000Z`;
  const parsed = new Date(injected);
  if (Number.isNaN(parsed.valueOf())) throw new ClarityError("time-invalid", "固定時刻はISO 8601形式で指定してください。");
  return parsed.toISOString();
}

function projectName(value) {
  const name = String(value ?? "").trim();
  if (!name || name.length > PROJECT_LIMIT || name === "." || name === ".." || name.startsWith(".") || name.includes("..") || /[\\/\0\r\n]/u.test(name)) {
    throw new ClarityError("project-name-invalid", "Project名が安全ではありません。");
  }
  return name;
}

function directory(path, label) {
  if (!existsSync(path)) return false;
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ClarityError("project-root-unsafe", `${label}が通常のdirectoryではありません。`);
  return true;
}

function projectRecord(root, name, scope) {
  const rel = scope === "legacy" ? `projects/${name}` : `projects/${scope}/${name}`;
  const dir = safeWritePath(root, rel);
  if (!directory(dir, rel)) return null;
  const file = safeWritePath(root, `${rel}/PROJECT.md`);
  if (!existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) {
    throw new ClarityError("project-file-invalid", `${rel}/PROJECT.mdを安全に読めません。`);
  }
  return { root, name, scope, rel, dir, file, markdown: readFileSync(file, "utf8") };
}

export function resolveSecretaryProject(secretaryRootValue, rawName, { closedOnly = false, includeClosed = false } = {}) {
  const root = workingRoot(secretaryRootValue);
  const name = projectName(rawName);
  if (closedOnly) {
    const closed = projectRecord(root, name, "closed");
    if (!closed) throw new ClarityError("project-missing", "指定されたclosed Projectが見つかりません。");
    return { ...closed, conflict: null };
  }
  const open = projectRecord(root, name, "open");
  const legacy = projectRecord(root, name, "legacy");
  if (open) return { ...open, conflict: legacy ? { preferred: "open", ignored: "legacy", reason: "open-preferred" } : null };
  if (legacy) return { ...legacy, conflict: null };
  if (includeClosed) {
    const closed = projectRecord(root, name, "closed");
    if (closed) return { ...closed, conflict: null };
  }
  throw new ClarityError("project-missing", "進行中のProjectが見つかりません。closedは明示指定時だけ参照します。");
}

function clarityRoot(record) {
  return safeWritePath(record.root, `${record.rel}/clarity`);
}

function clarityEntry() {
  return `<!-- yasashii-secretary:clarity-secretary-local:v1:start -->\n# Project Clarity\n\n- mode: secretary-local\n- 正本: \`.clarity/project.json\`、\`.clarity/events.jsonl\`、\`.clarity/evidence.jsonl\`\n- 状態: \`.clarity/state.json\`（Event／Evidenceから再構築可能）\n- Project lifecycleと実行タスクの正本は親Project側が維持します。\n<!-- yasashii-secretary:clarity-secretary-local:v1:end -->\n`;
}

function createCanonical(record) {
  const timestamp = nowIso();
  const projectDigest = sha256(record.markdown);
  const idSeed = `secretary-local:${record.rel}:${projectDigest}`;
  const clarityProjectId = stableId("cp", idSeed);
  const evidenceId = stableId("ce", `${clarityProjectId}:project-reference:${projectDigest}`);
  const itemId = stableId("ci", `${clarityProjectId}:PROJECT.md:current-state`);
  const project = {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    clarityProjectId,
    name: record.name,
    mode: "secretary-local",
    createdAt: timestamp,
    repoIdentity: { kind: "non-git", rootName: record.name, remote: { status: "not-applicable", repository: null }, branch: null, head: null },
    secretaryLink: {
      projectRef: "PROJECT.md",
      referenceBase: "secretary-project-root",
      lifecycleAuthority: "projects",
      decisionAuthority: "project-decision-canonical",
      taskAuthority: "existing-task-seams",
    },
    compatibility: { reader: { min: 1, max: CLARITY_SCHEMA_VERSION }, writer: { min: 1, max: CLARITY_SCHEMA_VERSION } },
    rootEntry: { path: "CLARITY.md", status: "managed-block" },
  };
  const item = {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    itemId,
    title: `${record.name}の現在状況`,
    areaPath: "PROJECT.md",
    kind: "project-state",
    disposition: "candidate",
    deferredUntil: null,
    owner: null,
    decisionOwner: null,
    dependencies: [],
    externalRefs: [],
    confidence: "observed",
    timestamps: { createdAt: timestamp, updatedAt: timestamp },
    attention: { level: "not_evaluated", reasons: [] },
    attentionContext: { impact: 1, urgency: 0, humanOverride: null, signals: [] },
    decision: { status: "exploring", source: "project-reference", humanConfirmed: false, authority: "project-decision-canonical", evidenceRefs: [evidenceId], updatedAt: timestamp },
    execution: { status: "in_progress", authority: "projects-lifecycle", evidenceRefs: [evidenceId], updatedAt: timestamp },
    validation: { status: "unknown", evidenceRefs: [], updatedAt: timestamp },
    alignment: { status: "unknown", evidenceRefs: [], updatedAt: timestamp },
  };
  const evidence = {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    evidenceId,
    type: "file-reference",
    source: "generic-secretary-project",
    locator: { id: "PROJECT.md", project: record.name },
    summary: "Projectの現在状況への参照",
    observedAt: timestamp,
    contentDigest: projectDigest,
    sensitivity: "non-secret-reference",
    availability: "available",
  };
  const event = {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    eventId: stableId("cv", `${clarityProjectId}:item.discovered:${itemId}`),
    type: "item.discovered",
    itemId,
    actor: "secretary-local-init",
    occurredAt: timestamp,
    payload: { item },
  };
  validateProject(project);
  validateItem(item);
  validateEvidence(evidence);
  validateEvent(event);
  const state = buildState(project, [event], [evidence], timestamp);
  validateState(state);
  return { project, events: [event], evidence: [evidence], state };
}

export function previewSecretaryProjectClarity(secretaryRootValue, rawName, options = {}) {
  const record = resolveSecretaryProject(secretaryRootValue, rawName, options);
  const target = clarityRoot(record);
  const initialized = existsSync(target);
  if (initialized) directory(target, `${record.rel}/clarity`);
  return {
    status: initialized ? "initialized" : "preview",
    changed: false,
    project: { name: record.name, scope: record.scope, path: `${record.rel}/PROJECT.md` },
    resolver: { selected: record.scope, conflict: record.conflict },
    mode: "secretary-local",
    target: `${record.rel}/clarity`,
    writes: initialized ? [] : [`${record.rel}/clarity/.clarity`, `${record.rel}/clarity/CLARITY.md`],
    lifecycleAuthority: "projects",
    decisionAuthority: "project-decision-canonical",
    taskAuthority: "existing-task-seams",
  };
}

export function applySecretaryProjectClarity(secretaryRootValue, rawName) {
  const record = resolveSecretaryProject(secretaryRootValue, rawName);
  if (record.scope !== "open") throw new ClarityError("project-scope-read-only", "legacy Projectは既存resolverどおり読み取り専用です。openへの明示移行前はClarityを二重作成しません。");
  const target = clarityRoot(record);
  if (existsSync(target)) {
    const report = secretaryProjectClarityStatus(secretaryRootValue, rawName);
    return { status: "unchanged", changed: false, clarityProjectId: report.clarityProjectId, target: `${record.rel}/clarity` };
  }
  const canonical = createCanonical(record);
  const stage = safeWritePath(record.root, `${record.rel}/.clarity-secretary-init-${process.pid}-${Date.now()}`);
  mkdirSync(stage);
  try {
    const internal = join(stage, ".clarity");
    mkdirSync(internal);
    writeFileSync(join(internal, "project.json"), stableJson(canonical.project), { encoding: "utf8", flag: "wx" });
    writeFileSync(join(internal, "events.jsonl"), `${canonical.events.map((row) => JSON.stringify(row)).join("\n")}\n`, { encoding: "utf8", flag: "wx" });
    writeFileSync(join(internal, "evidence.jsonl"), `${canonical.evidence.map((row) => JSON.stringify(row)).join("\n")}\n`, { encoding: "utf8", flag: "wx" });
    writeFileSync(join(internal, "state.json"), stableJson(canonical.state), { encoding: "utf8", flag: "wx" });
    writeFileSync(join(stage, "CLARITY.md"), clarityEntry(), { encoding: "utf8", flag: "wx" });
    if (process.env.CLARITY_SECRETARY_FAIL_AT === "before-apply") throw new ClarityError("failure-injected", "テスト用: Secretary-local適用前に停止しました。", 4);
    if (existsSync(target)) throw new ClarityError("clarity-conflict", "同時にClarityが作成されたため上書きしません。");
    renameSync(stage, target);
  } finally {
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
  }
  return { status: "initialized", changed: true, clarityProjectId: canonical.project.clarityProjectId, itemCount: canonical.state.items.length, target: `${record.rel}/clarity` };
}

function readProjectClarity(record) {
  const root = clarityRoot(record);
  if (!existsSync(root)) return null;
  directory(root, `${record.rel}/clarity`);
  const projectPath = safeWritePath(root, ".clarity/project.json");
  let project;
  try { project = JSON.parse(readFileSync(projectPath, "utf8")); }
  catch { throw new ClarityError("project-json-invalid", "Clarity project.jsonを安全に読めません。"); }
  validateProject(project);
  return { root, project, report: status(root), history: history(root) };
}

function localReferenceHealth(record, clarityProject) {
  const link = clarityProject.secretaryLink;
  if (!link || typeof link.projectRef !== "string") return "local-reference-missing";
  let target;
  try {
    target = link.referenceBase === "secretary-project-root"
      ? safeWritePath(record.root, `${record.rel}/${link.projectRef}`)
      : safeWritePath(record.root, link.projectRef);
  } catch { return "local-reference-invalid"; }
  if (target !== record.file || !existsSync(target)) return "local-reference-stale";
  const stat = lstatSync(target);
  return stat.isFile() && !stat.isSymbolicLink() ? "local-reference-healthy" : "local-reference-invalid";
}

export function secretaryProjectClarityStatus(secretaryRootValue, rawName, options = {}) {
  const record = resolveSecretaryProject(secretaryRootValue, rawName, options);
  const clarity = readProjectClarity(record);
  if (!clarity) {
    return {
      initialized: false,
      mode: "secretary-local",
      project: { name: record.name, scope: record.scope, path: `${record.rel}/PROJECT.md` },
      resolver: { selected: record.scope, conflict: record.conflict },
      attention: { activeCount: 0, top: [], otherCount: 0 },
      linkHealth: "not-initialized",
      lifecycleAuthority: "projects",
    };
  }
  return {
    initialized: true,
    clarityProjectId: clarity.report.clarityProjectId,
    mode: clarity.report.mode,
    project: { name: record.name, scope: record.scope, path: `${record.rel}/PROJECT.md` },
    resolver: { selected: record.scope, conflict: record.conflict },
    attention: clarity.report.attention,
    linkHealth: clarity.report.linkHealth?.status === "broken"
      ? (clarity.report.linkHealth.stale ? "linked-stale" : "linked-broken")
      : clarity.report.linkHealth?.status === "healthy"
        ? "linked-healthy"
        : localReferenceHealth(record, clarity.project),
    linkDiagnostic: clarity.report.linkHealth,
    lifecycleAuthority: "projects",
    detailPath: `${record.rel}/clarity/.clarity/state.json`,
  };
}

export function renderSecretaryProjectClaritySummary(secretaryRootValue, rawName, options = {}) {
  const report = secretaryProjectClarityStatus(secretaryRootValue, rawName, options);
  if (!report.initialized) return "";
  const first = report.attention.top[0];
  const important = first ? `${first.title}（${first.reasonLabels.join("／")}）` : "現在、判断が必要な項目はありません";
  return `\n## Project Clarity\n\n- mode: ${report.mode}\n- Attention: ${report.attention.activeCount}件（${important}）\n- link health: ${report.linkHealth}\n- 詳細: \`clarity/.clarity/state.json\`\n`;
}

function listProjectRecords(root) {
  const rows = [];
  const scope = "open";
  const rel = "projects/open";
  const dir = safeWritePath(root, rel);
  if (!existsSync(dir) || !directory(dir, rel)) return rows;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "ja"))) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
    try {
      const record = projectRecord(root, entry.name, scope);
      if (!record || /^status:\s*completed\s*$/mu.test(record.markdown)) continue;
      rows.push(record);
    } catch { rows.push({ root, name: entry.name, scope, rel: `${rel}/${entry.name}`, error: "source-unreadable" }); }
  }
  return rows;
}

export function portfolioRollup(secretaryRootValue) {
  const root = workingRoot(secretaryRootValue);
  const projects = [];
  const unverifiedSources = [];
  const attention = [];
  let activeCount = 0;
  for (const record of listProjectRecords(root)) {
    if (record.error) { unverifiedSources.push({ project: record.name, reason: record.error }); continue; }
    try {
      const clarity = readProjectClarity(record);
      if (!clarity) {
        projects.push({ name: record.name, scope: record.scope, clarity: "not-initialized", attentionCount: 0, top: null });
        continue;
      }
      const top = clarity.report.attention.top[0] || null;
      const externalLink = clarity.report.linkHealth || { status: "not-linked", stale: false, healthy: true };
      projects.push({ name: record.name, scope: record.scope, clarity: "available", attentionCount: clarity.report.attention.activeCount, linkHealth: externalLink.status, linkStale: Boolean(externalLink.stale), top: top ? { itemId: top.itemId, title: top.title, level: top.level, reasons: top.reasonLabels, lagDays: Number(top._rank?.age || 0) } : null });
      activeCount += clarity.report.attention.activeCount;
      for (const item of clarity.report.attention.top) attention.push({ project: record.name, ...item });
    } catch (error) {
      unverifiedSources.push({ project: record.name, reason: error?.code || "source-unreadable" });
    }
  }
  const severity = { critical: 4, high: 3, medium: 2, low: 1 };
  attention.sort((a, b) => (severity[b.level] || 0) - (severity[a.level] || 0) || a.project.localeCompare(b.project, "ja") || a.itemId.localeCompare(b.itemId, "en"));
  return {
    mode: "portfolio",
    source: "generic-secretary-open-projects",
    projectCount: projects.length,
    projects,
    attention: {
      activeCount,
      top: attention.slice(0, DISPLAY_LIMIT).map(({ _rank, ...item }) => ({
        ...item,
        evidence: (item.evidence || []).slice(0, 3).map((row) => ({ evidenceId: row.evidenceId, summary: row.summary, availability: row.availability })),
        choices: (item.choices || []).slice(0, 3),
        lagDays: Number(_rank?.age || 0),
      })),
      otherCount: Math.max(0, activeCount - Math.min(DISPLAY_LIMIT, attention.length)),
    },
    unverifiedSources,
    closedIncluded: false,
    connectorReads: 0,
    itemBodiesIncluded: false,
  };
}

export function dailyClarityRollup(secretaryRootValue, { mode = "morning" } = {}) {
  const rollup = portfolioRollup(secretaryRootValue);
  const top = rollup.attention.top;
  if (mode === "morning") {
    return {
      mode,
      section: "今日の要確認",
      conclusion: rollup.attention.activeCount ? `今日確認したい項目は${rollup.attention.activeCount}件です` : "現在判断不要です",
      items: top,
      otherCount: rollup.attention.otherCount,
      unverifiedSources: rollup.unverifiedSources,
      connectorReads: 0,
      itemBodiesIncluded: false,
    };
  }
  if (mode !== "evening") throw new ClarityError("mode-invalid", "daily Clarity modeはmorningまたはeveningです。");
  const separated = { decisions: [], execution: [], candidates: [], drift: [], carriedAttention: top };
  for (const project of rollup.projects) {
    if (!project.top) continue;
    const row = { project: project.name, itemId: project.top.itemId, title: project.top.title };
    const labels = project.top.reasons || [];
    if (labels.some((value) => value.includes("決定") && value.includes("実装"))) separated.drift.push(row);
    else if (labels.some((value) => value.includes("決定済み"))) separated.execution.push(row);
    else separated.candidates.push(row);
  }
  return { mode, section: "Clarityの振り返り", ...separated, unverifiedSources: rollup.unverifiedSources, connectorReads: 0, itemBodiesIncluded: false };
}

export function weeklyClarityRollup(secretaryRootValue, previous = null) {
  const rollup = portfolioRollup(secretaryRootValue);
  let resolvedAttention = 0;
  let resolvedDrift = 0;
  for (const project of listProjectRecords(workingRoot(secretaryRootValue))) {
    if (project.error) continue;
    try {
      const clarity = readProjectClarity(project);
      if (!clarity) continue;
      resolvedAttention += clarity.history.resolvedAttention.length;
      resolvedDrift += clarity.history.resolvedAttention.filter((event) => ["decision_implementation_drift", "possible_drift"].includes(event.reason)).length;
    } catch { /* source failure is already exposed by Portfolio. */ }
  }
  const before = Number.isInteger(previous?.attention?.activeCount) ? previous.attention.activeCount : null;
  const lag = rollup.projects
    .filter((project) => project.top)
    .map((project) => ({ project: project.name, itemId: project.top.itemId, days: project.top.lagDays }))
    .sort((a, b) => b.days - a.days || a.project.localeCompare(b.project, "ja"))
    .slice(0, DISPLAY_LIMIT);
  return {
    section: "Project Clarity",
    attention: { activeCount: rollup.attention.activeCount, change: before === null ? null : rollup.attention.activeCount - before, comparison: before === null ? "前回集計なし" : "比較済み" },
    resolvedAttention,
    resolvedDrift,
    lag,
    longRunning: lag.filter((item) => item.days >= 7),
    unverifiedSources: rollup.unverifiedSources,
    connectorReads: 0,
    itemBodiesIncluded: false,
  };
}

export function routeClarityTask(secretaryRootValue, rawName, { itemId, target = "local-todo", explicit = false } = {}) {
  const record = resolveSecretaryProject(secretaryRootValue, rawName);
  const clarity = readProjectClarity(record);
  if (!clarity) throw new ClarityError("clarity-not-initialized", "このProjectにはClarityがありません。");
  const selected = findCanonicalItem(clarity.root, itemId);
  if (!selected) throw new ClarityError("item-missing", "指定されたClarity Itemを確認できません。");
  if (!explicit) return { status: "not-routed", changed: false, reason: "explicit-task-request-required", taskWrites: 0 };
  if (target === "local-todo") {
    return { status: "delegation-required", changed: false, route: "project-tools:add-todo", confirmationBoundary: "existing", taskWrites: 0, project: record.name, itemId };
  }
  if (target === "downstream-task") {
    return { status: "fixed-handoff-required", changed: false, route: "downstream-task-adapter", confirmationBoundary: "existing", taskWrites: 0, project: record.name, itemId };
  }
  throw new ClarityError("task-target-invalid", "未対応のtask委譲先です。");
}

export function decideSecretaryProject(secretaryRootValue, rawName, options = {}) {
  const record = resolveSecretaryProject(secretaryRootValue, rawName);
  if (record.scope !== "open") throw new ClarityError("project-scope-read-only", "Decision確定はopen Projectだけが対象です。");
  const root = clarityRoot(record);
  if (!existsSync(root)) throw new ClarityError("clarity-not-initialized", "このProjectにはClarityがありません。");
  return decideGenericProject(root, { ...options, secretaryRoot: record.root, projectName: record.name });
}
