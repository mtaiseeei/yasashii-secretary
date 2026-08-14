import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync,
  renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  createIdentity, identityPath, parseIdentity, validateSecretaryName,
} from "./secretary-identity.mjs";
import { inspectWorkspaceEdition, loadEditionConfig } from "./edition-guard.mjs";
import { commitOwnedChanges, inspectOwnedCheckpoint, restoreOwnedCommit } from "./safe-git.mjs";

export const IDENTITY_MIGRATION_VERSION = "0.10.1";
export const IDENTITY_BLOCK_START = "<!-- secretary:workspace-identity:v1:start -->";
export const IDENTITY_BLOCK_END = "<!-- secretary:workspace-identity:v1:end -->";
const TARGET_RELATIVE_PATHS = Object.freeze([
  "secretary/identity.json",
  "secretary/AGENTS.md",
  "secretary/CLAUDE.md",
  ".secretary/update-ledger.json",
]);
const LEDGER_IDENTITY_PATHS = Object.freeze(TARGET_RELATIVE_PATHS.slice(0, 3));

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function count(content, token) {
  return content.split(token).length - 1;
}

function inside(root, target) {
  const rel = relative(root, target);
  return Boolean(rel && rel !== ".." && !rel.startsWith(`..${sep}`));
}

function newlineOf(content) {
  if (content.includes("\r\n") && !/(^|[^\r])\n/u.test(content)) return "\r\n";
  return "\n";
}

function aliasesLabel(identity) {
  return identity.aliases.length ? identity.aliases.join(", ") : "なし";
}

function identityBlock(identity, kind, newline) {
  const lines = kind === "agents"
    ? [
      IDENTITY_BLOCK_START,
      "## 秘書identity",
      "",
      `- 表示名: ${identity.display_name} (AI Secretary)`,
      `- stable ID: ${identity.secretary_id}`,
      "- 種別: ai-secretary",
      `- 過去名: ${aliasesLabel(identity)}`,
      "",
      "表示名は利用者の「呼び方」と別の設定です。変更してもstable IDと過去のauthor記録は変えません。",
      "新しい成果物のAI author表示と構造化author metadataは `identity.json` を正本として参照します。",
      IDENTITY_BLOCK_END,
    ]
    : [
      IDENTITY_BLOCK_START,
      "## 秘書identity",
      "",
      `- 表示名: ${identity.display_name} (AI Secretary)`,
      `- stable ID: ${identity.secretary_id}`,
      "- 種別: ai-secretary",
      `- 過去名: ${aliasesLabel(identity)}`,
      "",
      "秘書自身のidentity正本は同じフォルダの `identity.json` です。新しい成果物のAI author表示と構造化metadataは、このidentityを参照します。",
      IDENTITY_BLOCK_END,
    ];
  return lines.join(newline);
}

export function updateIdentityManagedSection(content, { kind, currentIdentity, nextIdentity } = {}) {
  const current = parseIdentity(currentIdentity);
  const next = parseIdentity(nextIdentity);
  if (!["agents", "claude"].includes(kind)) throw new Error("identity管理節のfile種別が不明です。");
  const startCount = count(content, IDENTITY_BLOCK_START);
  const endCount = count(content, IDENTITY_BLOCK_END);
  if (startCount === 0 && endCount === 0) return { status: "missing", content, ownedCount: 0 };
  if (startCount !== 1 || endCount !== 1) throw new Error("identity管理markerが重複または閉じていません。");
  const newline = newlineOf(content);
  const start = content.indexOf(IDENTITY_BLOCK_START);
  const end = content.indexOf(IDENTITY_BLOCK_END, start) + IDENTITY_BLOCK_END.length;
  const existing = content.slice(start, end);
  if (existing !== identityBlock(current, kind, newline)) throw new Error("製品所有identity管理節に利用者編集または未知の内容があります。");
  const replacement = identityBlock(next, kind, newline);
  return {
    status: existing === replacement ? "unchanged" : "updated",
    content: `${content.slice(0, start)}${replacement}${content.slice(end)}`,
    ownedCount: 1,
  };
}

function legacyAgentsSection(identity, newline) {
  return [
    "## 秘書identity",
    "",
    `- 表示名: ${identity.display_name} (AI Secretary)`,
    `- stable ID: ${identity.secretary_id}`,
    "- 種別: ai-secretary",
    `- 過去名: ${aliasesLabel(identity)}`,
    "",
    "表示名は利用者の「呼び方」と別の設定です。変更してもstable IDと過去のauthor記録は変えません。",
  ].join(newline);
}

function appendBlock(content, block, newline) {
  if (!content) return `${block}${newline}`;
  const separator = content.endsWith(`${newline}${newline}`) ? "" : content.endsWith(newline) ? newline : `${newline}${newline}`;
  return `${content}${separator}${block}${newline}`;
}

function inspectGuidance(path, kind, identity) {
  const content = readFileSync(path, "utf8");
  const newline = newlineOf(content);
  const startCount = count(content, IDENTITY_BLOCK_START);
  const endCount = count(content, IDENTITY_BLOCK_END);
  if (startCount !== endCount || startCount > 1) {
    return { action: "conflict", reason: "identity管理markerが重複または閉じていません。", path };
  }
  if (startCount === 1) {
    if (!identity) return { action: "conflict", reason: "identity正本が無いのにidentity管理節があります。", path };
    const start = content.indexOf(IDENTITY_BLOCK_START);
    const end = content.indexOf(IDENTITY_BLOCK_END, start) + IDENTITY_BLOCK_END.length;
    const current = content.slice(start, end);
    const expected = identityBlock(identity, kind, newline);
    if (current !== expected) return { action: "conflict", reason: "製品所有identity管理節に利用者編集または未知の内容があります。", path };
    return { action: "maintain", reason: "identity管理節は現在版です。", path, proposed: content, newline };
  }

  const heading = "## 秘書identity";
  const headingIndex = content.indexOf(heading);
  if (headingIndex >= 0) {
    if (kind !== "agents" || !identity || (headingIndex > 0 && !content.slice(0, headingIndex).endsWith(newline))) {
      return { action: "conflict", reason: "marker外のidentity節は所有を確認できません。", path };
    }
    const nextHeading = content.indexOf(`${newline}## `, headingIndex + heading.length);
    const segmentEnd = nextHeading < 0 ? content.length : nextHeading;
    const segment = content.slice(headingIndex, segmentEnd).replace(/(?:\r?\n)+$/u, "");
    if (segment !== legacyAgentsSection(identity, newline)) {
      return { action: "conflict", reason: "0.10.0由来と証明できないidentity節は自動移行しません。", path };
    }
    const proposed = `${content.slice(0, headingIndex)}${identityBlock(identity, kind, newline)}${content.slice(segmentEnd)}`;
    return { action: "update", reason: "0.10.0のmarkerなしidentity節を製品所有節へ移行します。", path, proposed, newline };
  }

  if (!identity) return { action: "add", reason: "identity確定後に製品所有identity管理節を追加します。", path, proposed: null, newline };
  return {
    action: "add",
    reason: "製品所有identity管理節が未導入です。",
    path,
    proposed: appendBlock(content, identityBlock(identity, kind, newline), newline),
    newline,
  };
}

function parseLedger(path, edition) {
  if (!existsSync(path)) return { value: { schemaVersion: 2, edition, records: [] }, action: "add" };
  let value;
  try { value = JSON.parse(readFileSync(path, "utf8")); }
  catch { return { conflict: "最小台帳がJSONとして読めません。" }; }
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.schemaVersion !== 2 || value.edition !== edition || !Array.isArray(value.records)) {
    return { conflict: "最小台帳のschemaまたはeditionが一致しません。" };
  }
  const paths = [];
  for (const record of value.records) {
    if (!record || typeof record !== "object" || Array.isArray(record) || typeof record.path !== "string") {
      return { conflict: "最小台帳に所有不明のrecordがあります。" };
    }
    paths.push(record.path);
  }
  if (new Set(paths).size !== paths.length) return { conflict: "最小台帳の管理対象pathが重複しています。" };
  return { value, action: "update" };
}

function nextLedger(ledger, edition, finalBytes) {
  const expected = new Map(LEDGER_IDENTITY_PATHS.map((path) => [path, {
    path,
    installedVersion: IDENTITY_MIGRATION_VERSION,
    baselineHash: sha256(finalBytes.get(path)),
    templateVariables: {},
  }]));
  const records = ledger.records.map((record) => expected.has(record.path) ? expected.get(record.path) : record);
  const present = new Set(records.map((record) => record.path));
  for (const path of LEDGER_IDENTITY_PATHS) if (!present.has(path)) records.push(expected.get(path));
  return { schemaVersion: 2, edition, records };
}

function inspectFile(root, rel, { required = true } = {}) {
  const path = resolve(root, rel);
  if (!inside(root, path)) throw new Error(`workspace外のpathです: ${rel}`);
  let cursor = root;
  for (const part of rel.split("/")) {
    cursor = join(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error(`symlink／junctionを含むpathです: ${rel}`);
  }
  if (!existsSync(path)) {
    if (required) throw new Error(`必要な正本が見つかりません: ${rel}`);
    return { path, exists: false };
  }
  const stat = lstatSync(path);
  if (!stat.isFile()) throw new Error(`通常fileではありません: ${rel}`);
  if ((stat.mode & 0o222) === 0) throw new Error(`read-only fileのため自動移行しません: ${rel}`);
  return { path, exists: true, mode: stat.mode };
}

function inspectWorkspace(workspaceValue, pluginRootValue) {
  const requested = resolve(String(workspaceValue || ""));
  if (!existsSync(requested) || lstatSync(requested).isSymbolicLink() || !lstatSync(requested).isDirectory()) {
    throw new Error("canonical workspaceを安全に確認できません。");
  }
  const workspace = realpathSync(requested);
  const pluginRoot = realpathSync(resolve(pluginRootValue));
  const config = loadEditionConfig(pluginRoot);
  const editionState = inspectWorkspaceEdition(workspace, config);
  if (editionState.state !== "same-edition") throw new Error(`workspace editionを安全に確認できません: ${editionState.state}`);
  const secretary = join(workspace, "secretary");
  if (!existsSync(secretary) || lstatSync(secretary).isSymbolicLink() || !lstatSync(secretary).isDirectory()) {
    throw new Error("canonical secretary directoryを確認できません。");
  }
  if (realpathSync(secretary) !== secretary || !inside(workspace, secretary)) throw new Error("secretary pathがcanonical workspace外です。");
  inspectFile(workspace, "secretary/AGENTS.md");
  inspectFile(workspace, "secretary/CLAUDE.md");
  inspectFile(workspace, "secretary/memory/MEMORY.md");
  inspectFile(workspace, config.workspaceProtection.canonicalMarker);
  inspectFile(workspace, "secretary/identity.json", { required: false });
  inspectFile(workspace, config.update.ledgerPath, { required: false });
  return { workspace, secretary, pluginRoot, config, editionState };
}

function readOptionalIdentity(secretary) {
  const path = identityPath(secretary);
  if (!existsSync(path)) return { identity: null, action: "add" };
  try { return { identity: parseIdentity(JSON.parse(readFileSync(path, "utf8"))), action: "maintain" }; }
  catch (error) { return { conflict: error instanceof Error ? error.message : String(error), identity: null, action: "conflict" }; }
}

function migrationInspection({ workspace, pluginRoot, name = null } = {}) {
  let context;
  try { context = inspectWorkspace(workspace, pluginRoot); }
  catch (error) {
    return { status: "migration-conflict", readOnly: true, reason: error.message, sideEffects: 0 };
  }
  const { secretary, config } = context;
  const identityRead = readOptionalIdentity(secretary);
  const conflicts = [];
  if (identityRead.conflict) conflicts.push({ path: "secretary/identity.json", reason: identityRead.conflict });
  let identity = identityRead.identity;
  if (identity && name) {
    const checked = validateSecretaryName(name);
    if (!checked.accepted || checked.normalized !== identity.display_name) {
      conflicts.push({ path: "secretary/identity.json", reason: "既存identityと別名です。名前変更はrename previewから行ってください。" });
    }
  }
  if (!identity && name) {
    const checked = validateSecretaryName(name);
    if (!checked.accepted) conflicts.push({ path: "secretary/identity.json", reason: `英語名を保存できません: ${checked.reason}` });
  }

  const agents = inspectGuidance(join(secretary, "AGENTS.md"), "agents", identity);
  const claude = inspectGuidance(join(secretary, "CLAUDE.md"), "claude", identity);
  for (const item of [agents, claude]) if (item.action === "conflict") conflicts.push({ path: relative(context.workspace, item.path).split(sep).join("/"), reason: item.reason });
  const ledgerPath = join(context.workspace, config.update.ledgerPath);
  const ledger = parseLedger(ledgerPath, config.edition);
  if (ledger.conflict) conflicts.push({ path: config.update.ledgerPath, reason: ledger.conflict });

  const allowMissing = TARGET_RELATIVE_PATHS.filter((path) => !existsSync(join(context.workspace, path)));
  const allowUntracked = identity && existsSync(join(context.workspace, "secretary/identity.json"))
    ? ["secretary/identity.json"] : [];
  let gitState = null;
  try {
    gitState = inspectOwnedCheckpoint(context.workspace, TARGET_RELATIVE_PATHS, {
      allowMissingPaths: allowMissing,
      allowUntrackedPaths: allowUntracked,
    });
  } catch (error) {
    conflicts.push({ path: context.workspace, reason: error instanceof Error ? error.message : String(error) });
  }

  if (conflicts.length) {
    return {
      status: "migration-conflict", readOnly: true, sideEffects: 0,
      pluginState: "updated", localMigrationState: "conflict",
      workspace: context.workspace, edition: config.edition, conflicts,
      nonTargets: ["user-scope registry／routing", "rename", "利用者コンテンツ", "既存文書のgrep置換", "push／remote"],
    };
  }

  const pathItems = [
    { path: "secretary/identity.json", action: identity ? "maintain" : "add", reason: identity ? "正当なstable identityを保持します。" : "英語名の確認後、apply transaction内で作成します。" },
    { path: "secretary/AGENTS.md", action: agents.action, reason: agents.reason },
    { path: "secretary/CLAUDE.md", action: claude.action, reason: claude.reason },
  ];
  const ledgerCurrent = Boolean(identity && LEDGER_IDENTITY_PATHS.every((path) => {
    const record = ledger.value.records.find((item) => item.path === path);
    return record && Object.keys(record).sort().join(",") === "baselineHash,installedVersion,path,templateVariables"
      && record.installedVersion === IDENTITY_MIGRATION_VERSION
      && /^sha256:[0-9a-f]{64}$/u.test(record.baselineHash)
      && JSON.stringify(record.templateVariables) === "{}";
  }));
  pathItems.push({
    path: config.update.ledgerPath,
    action: ledger.action === "add" ? "add" : ledgerCurrent ? "maintain" : "update",
    reason: ledger.action === "add" ? "identity関連の最小台帳を追加します。" : ledgerCurrent ? "identity関連recordは現在版です。" : "identity関連recordだけを0.10.1基準へ更新します。",
  });
  const current = Boolean(identity && pathItems.every((item) => item.action === "maintain"));
  return {
    status: current ? "migration-current" : identity ? "identity-only" : "identity-missing",
    readOnly: true,
    sideEffects: 0,
    pluginState: "updated",
    localMigrationState: current ? "complete" : "pending",
    workspace: context.workspace,
    edition: config.edition,
    identity: identity ? {
      displayName: identity.display_name,
      actorType: identity.actor_type,
      createdAt: identity.created_at,
      stableIdentity: "preserve",
    } : { stableIdentity: "create-on-apply", needsEnglishName: !name },
    paths: pathItems,
    checkpoint: {
      status: current ? "not-applicable" : "required",
      workspaceRoot: context.workspace,
      gitTopLevel: gitState?.topLevel ?? null,
      ownedPaths: current ? [] : TARGET_RELATIVE_PATHS.filter((path) => pathItems.find((item) => item.path === path)?.action !== "maintain"),
      push: "not-run",
    },
    rollback: "identity、AGENTS／CLAUDE製品所有節、最小台帳、Git HEAD／index／working treeを開始前へ戻します。",
    nonTargets: ["user-scope registry／routing", "rename", "利用者コンテンツ", "記憶／project／chat", "既存文書のgrep置換", "push／fetch／remote／branch／tag"],
    _context: context,
    _identity: identity,
    _agents: agents,
    _claude: claude,
    _ledger: ledger,
    _gitState: gitState,
  };
}

function publicResult(result) {
  return Object.fromEntries(Object.entries(result).filter(([key]) => !key.startsWith("_")));
}

export function diagnoseIdentityMigration(options = {}) {
  return publicResult(migrationInspection(options));
}

export function previewIdentityMigration(options = {}) {
  const result = migrationInspection(options);
  if (result.status === "identity-missing" && !options.name) {
    return publicResult({ ...result, status: "identity-missing", next: "希望の英語名またはおまかせ候補を確認してから、同じpreviewを実行してください。" });
  }
  if (result.status === "migration-conflict" || result.status === "migration-current") return publicResult(result);
  return publicResult({
    ...result,
    status: "migration-ready",
    applyConfirmationRequired: true,
    nameConfirmationIsNotMigrationAuthorization: true,
  });
}

function snapshot(path) {
  if (!existsSync(path)) return { present: false, bytes: null, mode: 0o600 };
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`通常fileではない対象は変更しません: ${path}`);
  return { present: true, bytes: readFileSync(path), mode: stat.mode & 0o777 };
}

function restore(path, state) {
  if (!state.present) { rmSync(path, { force: true }); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, state.bytes, { mode: state.mode });
  chmodSync(path, state.mode);
}

function atomicReplace(path, bytes, mode) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${path.split(sep).at(-1)}.identity-migration-${process.pid}-${randomUUID()}`);
  try {
    writeFileSync(temp, bytes, { mode, flag: "wx" });
    renameSync(temp, path);
    chmodSync(path, mode);
  } finally {
    rmSync(temp, { force: true });
  }
}

function verifyApplied(context, identity, expectedFiles, expectedLedger) {
  const actualIdentity = parseIdentity(JSON.parse(readFileSync(join(context.secretary, "identity.json"), "utf8")));
  if (JSON.stringify(actualIdentity) !== JSON.stringify(identity)) throw new Error("identity整合確認に失敗しました。");
  for (const rel of ["secretary/AGENTS.md", "secretary/CLAUDE.md"]) {
    if (!readFileSync(join(context.workspace, rel)).equals(expectedFiles.get(rel))) throw new Error(`identity管理節の整合確認に失敗しました: ${rel}`);
  }
  const ledger = JSON.parse(readFileSync(join(context.workspace, context.config.update.ledgerPath), "utf8"));
  if (JSON.stringify(ledger) !== JSON.stringify(expectedLedger)) throw new Error("最小台帳の整合確認に失敗しました。");
  for (const rel of LEDGER_IDENTITY_PATHS) {
    const record = ledger.records.find((item) => item.path === rel);
    if (!record || record.installedVersion !== IDENTITY_MIGRATION_VERSION || record.baselineHash !== sha256(expectedFiles.get(rel))
      || JSON.stringify(record.templateVariables) !== "{}") throw new Error(`最小台帳recordが整合しません: ${rel}`);
  }
}

export function applyIdentityMigration({
  workspace, pluginRoot, name = null, secretaryId = null, now = null, confirm = false, failAt = null,
} = {}) {
  if (!confirm) throw new Error("migration applyは別の明示確認前のため変更しません。--confirm が必要です。");
  const inspection = migrationInspection({ workspace, pluginRoot, name });
  if (inspection.status === "migration-conflict") throw new Error(`identity migrationを安全に開始できません: ${inspection.conflicts.map((item) => `${item.path}: ${item.reason}`).join(" / ")}`);
  if (inspection.status === "migration-current") return { ...publicResult(inspection), status: "migration-current", updated: [], checkpoint: { ...inspection.checkpoint, commit: null } };
  if (!inspection._identity && !name) throw new Error("保存する英語名を確認してからmigration previewへ進んでください。");
  const allowedFailures = new Set(["ledger", "consistency", "stage", "commit", "post-commit"]);
  for (let index = 1; index <= 4; index += 1) allowedFailures.add(`before-write-${index}`);
  if (failAt && !allowedFailures.has(failAt)) throw new Error(`未知のidentity migration failure pointです: ${failAt}`);

  const context = inspection._context;
  const identity = inspection._identity ?? createIdentity({
    displayName: name,
    secretaryId: secretaryId || randomUUID(),
    createdAt: now || new Date().toISOString(),
  });
  const identityBytes = inspection._identity
    ? readFileSync(join(context.secretary, "identity.json"))
    : Buffer.from(`${JSON.stringify(identity, null, 2)}\n`);
  const agents = inspectGuidance(join(context.secretary, "AGENTS.md"), "agents", identity);
  const claude = inspectGuidance(join(context.secretary, "CLAUDE.md"), "claude", identity);
  if ([agents, claude].some((item) => item.action === "conflict" || !item.proposed)) throw new Error("identity管理節を安全に構成できません。");

  const finalFiles = new Map([
    ["secretary/identity.json", identityBytes],
    ["secretary/AGENTS.md", Buffer.from(agents.proposed)],
    ["secretary/CLAUDE.md", Buffer.from(claude.proposed)],
  ]);
  const expectedLedger = nextLedger(inspection._ledger.value, context.config.edition, finalFiles);
  finalFiles.set(context.config.update.ledgerPath, Buffer.from(`${JSON.stringify(expectedLedger, null, 2)}\n`));

  const targets = new Map();
  for (const [rel, bytes] of finalFiles) {
    const path = join(context.workspace, rel);
    if (!existsSync(path) || !readFileSync(path).equals(bytes)) targets.set(rel, bytes);
  }
  const checkpointOnly = inspection._gitState?.untrackedOwnedPaths?.filter((rel) => rel === "secretary/identity.json") ?? [];
  const ownedPaths = [...new Set([...targets.keys(), ...checkpointOnly])];
  if (!ownedPaths.length) return { status: "migration-current", updated: [], checkpoint: { status: "not-applicable", commit: null, push: "not-run" } };

  const allowMissing = ownedPaths.filter((rel) => !existsSync(join(context.workspace, rel)));
  const allowUntracked = checkpointOnly;
  const gitBefore = inspectOwnedCheckpoint(context.workspace, ownedPaths, { allowMissingPaths: allowMissing, allowUntrackedPaths: allowUntracked });
  const states = new Map(ownedPaths.map((rel) => [rel, snapshot(join(context.workspace, rel))]));
  let checkpoint = null;
  try {
    let index = 0;
    for (const [rel, bytes] of targets) {
      index += 1;
      if (failAt === `before-write-${index}`) throw new Error("テスト用のidentity migration file write失敗");
      if (failAt === "ledger" && rel === context.config.update.ledgerPath) throw new Error("テスト用の最小台帳更新失敗");
      atomicReplace(join(context.workspace, rel), bytes, states.get(rel).mode);
    }
    if (failAt === "consistency") throw new Error("テスト用のidentity整合確認失敗");
    verifyApplied(context, identity, finalFiles, expectedLedger);
    checkpoint = commitOwnedChanges({
      root: context.workspace,
      ownedPaths,
      message: "[secretary-name] Record local identity migration checkpoint",
      failAt: ["stage", "commit", "post-commit"].includes(failAt) ? failAt : null,
    });
    if (checkpoint.status !== "committed") throw new Error("required local checkpointを作成できませんでした。");
    const gitAfter = inspectOwnedCheckpoint(context.workspace, ownedPaths);
    if (gitAfter.head !== checkpoint.newHead || gitAfter.staged !== gitBefore.staged || gitAfter.branch !== gitBefore.branch
      || gitAfter.remotes !== gitBefore.remotes || gitAfter.tags !== gitBefore.tags) throw new Error("checkpoint後のGit状態が契約どおりではありません。");
    return {
      status: "migration-applied",
      workspace: context.workspace,
      edition: context.config.edition,
      identity: { displayName: identity.display_name, actorType: identity.actor_type, stableIdentity: inspection._identity ? "preserved" : "created" },
      updated: ownedPaths,
      checkpoint: { status: "required-completed", commit: checkpoint.newHead, ownedPaths, push: "not-run" },
      routing: "unchanged-separate-confirmation",
    };
  } catch (error) {
    let rollbackError = null;
    try {
      if (checkpoint?.status === "committed") restoreOwnedCommit({ root: context.workspace, oldHead: checkpoint.oldHead, newHead: checkpoint.newHead, ownedPaths });
      for (const [rel, state] of [...states.entries()].reverse()) restore(join(context.workspace, rel), state);
      const restored = inspectOwnedCheckpoint(context.workspace, ownedPaths, { allowMissingPaths: allowMissing, allowUntrackedPaths: allowUntracked });
      if (restored.head !== gitBefore.head || restored.status !== gitBefore.status || restored.staged !== gitBefore.staged
        || restored.branch !== gitBefore.branch || restored.remotes !== gitBefore.remotes || restored.tags !== gitBefore.tags) {
        throw new Error("Git rollback後の状態が開始前と一致しません。");
      }
    } catch (failedRollback) { rollbackError = failedRollback; }
    if (rollbackError) throw new Error(`identity migration rollbackを完了できませんでした。手動確認が必要です: ${context.workspace}; ${rollbackError.message}`);
    const wrapped = new Error(`identity migrationを完了できず、開始前へrollbackしました: ${error.message}`);
    wrapped.code = "migration-rolled-back";
    throw wrapped;
  }
}
