#!/usr/bin/env node

import {
  ClarityError,
  applyMigration,
  applyRuntimeCleanup,
  appendEvidence,
  appendEvent,
  applyInit,
  attention as attentionReport,
  checkpoint,
  decideGenericProject,
  doctor,
  history,
  previewMigration,
  previewRuntimeCleanup,
  previewInit,
  rebuildState,
  setAttentionOverride,
  status,
} from "./lib/clarity-core.mjs";
import {
  applyXmindProposal,
  buildProjectionBundle,
  getXmindSettings,
  previewLocalXmind,
  proposeXmindEdit,
  resolveXmindProvider,
  setXmindEnabled,
  validateXmindStructure,
  writeLocalXmind,
  writeProjectionBundle,
} from "./lib/clarity-projection.mjs";
import {
  DEFAULT_AUTHORITY_PROFILE,
  acceptLink,
  applySync,
  exportSyncBundle,
  finalizeLink,
  inspectLinkIdentity,
  linkDoctor,
  prepareLink,
  previewSync,
  readOnlyGitHubAdapter,
  resolveSyncConflict,
  setLocalLinkMapping,
} from "./lib/clarity-link.mjs";
import { applyDrift, commitClarityOwned, recordDriftWaiver } from "./lib/clarity-drift.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { safeWritePath } from "./lib/safe-fs.mjs";

function usage(message = "") {
  const prefix = message ? `${message}\n\n` : "";
  throw new ClarityError("usage", `${prefix}使い方:
  clarity init <repo> [--apply|--cancel] [--json]
  clarity status <repo> [--json]
  clarity attention <repo> [--limit 3] [--json]
  clarity review <repo> [--limit 3] [--json]
  clarity attention-override <repo> --item-id <id> --level <level> --reason <text> [--rank <number>] [--operation-id <id>] [--json]
  clarity history <repo> [--json]
  clarity checkpoint <repo> [--operation-id <id>] [--summary <text>] [--json]
  clarity rebuild <repo> [--json]
  clarity doctor <repo> [--host <codex|claudeCode>] [--hook-state <state>] [--json]
  clarity migrate <repo> [--apply] [--json]
  clarity cleanup <repo> [--apply] [--json]
  clarity project <repo> [--apply] [--mindmap-failure] [--json]
  clarity xmind-setting <repo> --enabled <on|off> [--json]
  clarity xmind-resolve <repo> [--capabilities-json '<JSON>'] [--local-decision <value>] [--provider <auto|local>] [--json]
  clarity xmind-local <repo> --target <relative.xmind> [--apply --approval-digest <sha256>] [--json]
  clarity xmind-validate <repo> --target <relative.xmind> [--json]
  clarity xmind-propose <repo> --item-id <id> --section <decision|execution|validation> --value <status> [--json]
  clarity xmind-proposal-apply <repo> --proposal-json '<JSON>' --decision <approved|rejected|canceled> [--json]
  clarity link-prepare <repo> --target-project-id <id> --target-repo-identity-json '<JSON>' --role <secretary|repo> [--authority-json '<JSON>'] [--json]
  clarity link-identity <repo> [--json]
  clarity link-accept <repo> --input-file <bundle.json> [--apply] [--json]
  clarity link-finalize <repo> --input-file <bundle.json> [--apply] [--json]
  clarity link-map <repo> --link-id <id> --peer-root <path> [--apply] [--json]
  clarity link-export <repo> [--link-id <id>] [--json]
  clarity sync-preview <repo> --input-file <bundle.json> [--json]
  clarity sync-apply <repo> --input-file <bundle.json> --apply [--json]
  clarity sync-resolve <repo> --link-id <id> --conflict-id <id> --choice <secretary|repo|new-decision|split|defer|unlink> [--note <text>] [--apply] [--json]
  clarity link-doctor <repo> [--link-id <id>] [--json]
  clarity github-read-adapter <repo> [--allow-read] --input-file <bundle.json> [--json]
  clarity drift <repo> --input-file <comparison.json> [--apply] [--json]
  clarity drift-waiver <repo> --item-id <id> --reason <text> --scope <text> [--expires-at <ISO-8601>] [--status <active|revoked>] [--operation-id <id>] [--apply] [--json]
  clarity commit <repo> [--message <text>] [--apply] [--json]
  clarity event <repo> --event-json '<JSON>' [--json]
  clarity evidence <repo> --evidence-json '<JSON>' [--json]
  clarity decide-project <project-root> --secretary-root <secretary> --project <name> --decision <text> --current <text> --next <text> [--item-id <id>] [--operation-id <id>] [--json]`, 2);
}
function parse(argv) {
  const positional = [];
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) { positional.push(value); continue; }
    if (["--apply", "--cancel", "--json", "--mindmap-failure", "--allow-read"].includes(value)) { options.set(value, true); continue; }
    if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) usage(`${value} の値がありません。`);
    options.set(value, argv[index + 1]);
    index += 1;
  }
  return { positional, options };
}

function parseJson(value, label) {
  if (!value) usage(`${label} を指定してください。`);
  try { return JSON.parse(value); }
  catch { usage(`${label} がJSONではありません。`); }
}

function inputJson(options, { optional = false } = {}) {
  if (options.get("--input-json")) return parseJson(options.get("--input-json"), "--input-json");
  if (options.get("--input-file")) {
    try { return JSON.parse(readFileSync(resolve(options.get("--input-file")), "utf8")); }
    catch { usage("--input-fileをJSONとして読めません。"); }
  }
  if (optional) return null;
  usage("--input-fileまたは--input-jsonを指定してください。");
}

function render(command, result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: true, command, ...result }, null, 2)}\n`);
    return;
  }
  if (command === "init") {
    if (result.status === "preview") {
      const preview = result.preview;
      process.stdout.write(`Clarity init preview（read-only）\n`);
      process.stdout.write(`- Project: ${preview.project?.name || "初期化済み"}\n`);
      process.stdout.write(`- Mode: ${preview.project?.mode || "standalone"}\n`);
      process.stdout.write(`- Item候補: ${preview.candidates?.length ?? preview.itemCount ?? 0}件\n`);
      process.stdout.write(`- 作成予定: ${(preview.writes || []).join(", ") || "なし"}\n`);
      process.stdout.write(`- 競合: ${(preview.conflicts || []).length}件\n`);
      process.stdout.write(`- 除外: ${(preview.excluded || []).length}件 / 未確認: ${(preview.uninspected || []).length}件\n`);
      process.stdout.write("明示確認後だけ --apply を付けて実行します。\n");
    } else if (result.status === "canceled") {
      process.stdout.write("Clarity initを取り消しました。file、Git、journal、runtimeは変更していません。\n");
    } else {
      process.stdout.write(`Clarity init: ${result.status}\n`);
      if (result.clarityProjectId) process.stdout.write(`- Project ID: ${result.clarityProjectId}\n`);
      if (Number.isInteger(result.itemCount)) process.stdout.write(`- Item: ${result.itemCount}件\n`);
    }
    return;
  }
  if (["attention", "review", "status"].includes(command)) {
    const report = ["attention", "review"].includes(command) ? result : { conclusion: result.conclusion, ...(result.attention || {}), items: result.attention?.top || [] };
    process.stdout.write(`${report.conclusion}\n`);
    const items = report.items || report.top || [];
    for (const [index, item] of items.entries()) {
      process.stdout.write(`\n${index + 1}. ${item.conclusion}\n`);
      process.stdout.write(`   理由: ${item.reasonLabels.join("／")}\n`);
      process.stdout.write(`   根拠: ${item.evidence.map((row) => row.summary).join("／")}\n`);
      if (item.inference) process.stdout.write("   状態: 推定を含みます\n");
      if (item.unverified) process.stdout.write("   状態: 未検証です\n");
      process.stdout.write(`   選択: ${item.choices.join("／")}\n`);
    }
    if (report.otherCount > 0) process.stdout.write(`\nその他 ${report.otherCount}件。詳細: ${report.detailPath}\n`);
    if (command === "status") {
      process.stdout.write(`\n${result.matrixLabel}\n`);
      for (const row of Object.values(result.quadrants)) process.stdout.write(`- ${row.label}: ${row.count}件\n`);
    }
    return;
  }
  if (command === "doctor") {
    process.stdout.write(`クラリティ診断: ${result.ok ? "正常" : "確認が必要"}\n`);
    process.stdout.write(`- mode: ${result.mode}\n- schema: ${result.schemaVersion}（${result.schemaStatus}）\n`);
    process.stdout.write(`- projection: ${result.capabilities.projection.status}\n- Hook: ${result.capabilities.hook.status}\n- link: ${result.capabilities.link.status}\n- lock: ${result.capabilities.lock.status}\n`);
    process.stdout.write(`次の一手: ${result.nextAction}\n`);
    return;
  }
  if (["link-identity", "link-prepare", "link-accept", "link-finalize", "link-map", "link-export", "sync-preview", "sync-apply", "sync-resolve", "link-doctor", "github-read-adapter"].includes(command)) {
    process.stdout.write(`Project Clarity ${command}: ${result.status}\n`);
    process.stdout.write(`- 変更: ${result.changed ? "あり" : "なし"}\n`);
    if (result.linkId) process.stdout.write(`- link ID: ${result.linkId}\n`);
    if (result.networkCalls !== undefined) process.stdout.write(`- network: ${result.networkCalls}件\n`);
    if (result.externalWrites !== undefined) process.stdout.write(`- 外部write: ${result.externalWrites}件\n`);
    if (result.status === "conflict") process.stdout.write(`- conflict: ${result.conflicts.length}件（last-write-winsは行いません）\n`);
    if (result.nextAction) process.stdout.write(`次の一手: ${result.nextAction}\n`);
    return;
  }
  if (command === "drift") {
    process.stdout.write(`Drift比較: ${result.status}\n- alignment: ${result.alignment}\n- 理由: ${result.reason}\n- 変更: ${result.changed ? "あり" : "なし"}\n`);
    if (result.decision && result.implementation) process.stdout.write(`- 根拠: Decision ${result.decision.locator.path}／実装 ${result.implementation.locator?.path || "source authority未確認"}\n`);
    if (result.attention) process.stdout.write(`- Attention: ${result.attention.reason}／${result.attention.level}／rank ${result.attention.rank}\n`);
    if (result.nextAction) process.stdout.write(`次の一手: ${result.nextAction}\n`);
    return;
  }
  if (command === "drift-waiver") {
    process.stdout.write(`Drift例外: ${result.status}\n- 変更: ${result.changed ? "あり" : "なし"}\n- 状態: ${result.waiver.status}\n- 理由: ${result.waiver.reason}\n- 範囲: ${result.waiver.scope}\n- 期限: ${result.waiver.expiresAt || "期限なし"}\n`);
    if (result.nextAction && result.status === "preview") process.stdout.write(`次の一手: ${result.nextAction}\n`);
    return;
  }
  if (command === "commit") {
    process.stdout.write(`Clarity commit: ${result.status}\n- 変更: ${result.changed ? "あり" : "なし"}\n- 対象: ${(result.paths || []).join("、") || "なし"}\n- push: 0件\n`);
    if (result.commit) process.stdout.write(`- commit: ${result.commit}\n`);
    if (result.nextAction && result.status === "preview") process.stdout.write(`次の一手: ${result.nextAction}\n`);
    return;
  }
  if (["migrate", "cleanup"].includes(command)) {
    process.stdout.write(`${command === "migrate" ? "schema migration" : "runtime cleanup"}: ${result.status}\n`);
    process.stdout.write(`- 変更: ${result.changed ? "あり" : "なし"}\n`);
    if (result.writes?.length) process.stdout.write(`- 対象path: ${result.writes.join("、")}\n`);
    if (result.candidates?.length) process.stdout.write(`- 削除候補: ${result.candidates.map((row) => row.path).join("、")}\n`);
    process.stdout.write(`次の一手: ${result.nextAction}\n`);
    return;
  }
  if (command === "project") {
    process.stdout.write(`Clarity projection: ${result.status}\n- digest: ${result.digest}\n- Mermaid renderer: ${result.renderer.reason}\n`);
    if (result.paths) process.stdout.write(`- 出力: ${result.paths.join("、")}\n`);
    return;
  }
  if (command.startsWith("xmind")) {
    process.stdout.write(`${command}: ${result.status || result.state}\n`);
    process.stdout.write(`- 変更: ${result.changed ? "あり" : "なし"}\n`);
    if (result.reason) process.stdout.write(`- 理由: ${result.reason}\n`);
    if (result.target) process.stdout.write(`- 対象: ${result.target}\n`);
    return;
  }
  if (command === "attention-override") {
    process.stdout.write(`Attention優先度: ${result.status}\n- Item: ${result.itemId}\n- level: ${result.level}\n- 理由: ${result.reason}\n`);
    return;
  }
  if (command === "checkpoint") {
    process.stdout.write(`checkpoint: ${result.status}\n- operation: ${result.operationId}\n- 解消履歴: ${result.resolvedCount || 0}件\n`);
    return;
  }
  if (command === "history") {
    process.stdout.write(`履歴: Event ${result.events.length}件、Evidence ${result.evidence.length}件\n`);
    process.stdout.write(`解消済みAttention: ${result.resolvedAttention.length}件\n`);
    for (const row of result.events.slice(-10)) process.stdout.write(`- ${row.occurredAt} ${row.type} ${row.itemId || "project"}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const [command, ...rawArgs] = process.argv.slice(2);
try {
  if (!command) usage();
  const { positional, options } = parse(rawArgs);
  const root = positional[0];
  if (!root) usage("repo／project rootを指定してください。");
  let result;
  if (command === "init") {
    if (options.get("--apply") && options.get("--cancel")) usage("--apply と --cancel は同時に指定できません。");
    if (options.get("--cancel")) result = { status: "canceled", preview: previewInit(root) };
    else if (options.get("--apply")) result = applyInit(root);
    else result = { status: "preview", preview: previewInit(root) };
  } else if (command === "status") result = status(root);
  else if (command === "attention" || command === "review") {
    const limit = options.get("--limit") === undefined ? 3 : Number(options.get("--limit"));
    result = attentionReport(root, { limit });
  }
  else if (command === "attention-override") result = setAttentionOverride(root, {
    itemId: options.get("--item-id"), level: options.get("--level"), reason: options.get("--reason"), rank: Number(options.get("--rank") || 0), operationId: options.get("--operation-id"),
  });
  else if (command === "history") result = history(root);
  else if (command === "checkpoint") result = checkpoint(root, { operationId: options.get("--operation-id"), summary: options.get("--summary") });
  else if (command === "rebuild") result = rebuildState(root, { write: true });
  else if (command === "doctor") result = doctor(root, { host: options.get("--host"), hookState: options.get("--hook-state") });
  else if (command === "migrate") result = options.get("--apply") ? applyMigration(root) : previewMigration(root);
  else if (command === "cleanup") result = options.get("--apply") ? applyRuntimeCleanup(root) : previewRuntimeCleanup(root);
  else if (command === "project") result = options.get("--apply") ? writeProjectionBundle(root, { mindmapSyntaxAccepted: !options.get("--mindmap-failure") }) : buildProjectionBundle(root, { mindmapSyntaxAccepted: !options.get("--mindmap-failure") });
  else if (command === "xmind-setting") {
    const enabled = options.get("--enabled");
    if (!["on", "off"].includes(enabled)) usage("--enabled は on または off を指定してください。");
    result = setXmindEnabled(root, enabled === "on");
  }
  else if (command === "xmind-resolve") {
    const capabilities = options.get("--capabilities-json") ? parseJson(options.get("--capabilities-json"), "--capabilities-json") : {};
    result = resolveXmindProvider({ settings: getXmindSettings(root), mcp: capabilities.mcp || {}, local: capabilities.local || {}, localDecision: options.get("--local-decision") || "unanswered", requestedProvider: options.get("--provider") || "auto" });
  }
  else if (command === "xmind-local") {
    const settings = getXmindSettings(root); if (!settings.xmindEnabled) throw new ClarityError("xmind-disabled", "Xmind設定はOFFです。先に明示的にONへ変更してください。", 3, { changed: false });
    const target = options.get("--target"); if (!target) usage("--target を指定してください。");
    if (options.get("--apply")) result = writeLocalXmind(root, target, { approval: "approved", approvalDigest: options.get("--approval-digest"), requestedProvider: "local" });
    else { const { archive: _archive, ...preview } = previewLocalXmind(root, target, { requestedProvider: "local" }); result = preview; }
  }
  else if (command === "xmind-validate") {
    const target = options.get("--target"); if (!target) usage("--target を指定してください。"); result = { status: "inspected", changed: false, ...validateXmindStructure(readFileSync(safeWritePath(root, resolve(root, target)))) };
  }
  else if (command === "xmind-propose") result = proposeXmindEdit(root, { itemId: options.get("--item-id"), section: options.get("--section"), value: options.get("--value") });
  else if (command === "xmind-proposal-apply") result = applyXmindProposal(root, parseJson(options.get("--proposal-json"), "--proposal-json"), { decision: options.get("--decision") || "unanswered" });
  else if (command === "link-identity") result = inspectLinkIdentity(root);
  else if (command === "link-prepare") result = prepareLink(root, {
    targetProjectId: options.get("--target-project-id"),
    targetRepositoryIdentity: parseJson(options.get("--target-repo-identity-json"), "--target-repo-identity-json"),
    localRole: options.get("--role") || "secretary",
    authorityProfile: options.get("--authority-json") ? parseJson(options.get("--authority-json"), "--authority-json") : DEFAULT_AUTHORITY_PROFILE,
  });
  else if (command === "link-accept") result = acceptLink(root, inputJson(options), { apply: Boolean(options.get("--apply")) });
  else if (command === "link-finalize") result = finalizeLink(root, inputJson(options), { apply: Boolean(options.get("--apply")) });
  else if (command === "link-map") result = setLocalLinkMapping(root, { linkId: options.get("--link-id"), peerRoot: options.get("--peer-root"), apply: Boolean(options.get("--apply")) });
  else if (command === "link-export") result = exportSyncBundle(root, { linkId: options.get("--link-id") || null });
  else if (command === "sync-preview") result = previewSync(root, inputJson(options));
  else if (command === "sync-apply") {
    if (!options.get("--apply")) usage("sync applyはpreview確認後に--applyを指定してください。");
    result = applySync(root, inputJson(options));
  }
  else if (command === "sync-resolve") result = resolveSyncConflict(root, { linkId: options.get("--link-id"), conflictId: options.get("--conflict-id"), choice: options.get("--choice"), note: options.get("--note"), apply: Boolean(options.get("--apply")) });
  else if (command === "link-doctor") result = linkDoctor(root, { linkId: options.get("--link-id") || null });
  else if (command === "github-read-adapter") result = readOnlyGitHubAdapter({ allowed: Boolean(options.get("--allow-read")), bundle: inputJson(options, { optional: !options.get("--allow-read") }) });
  else if (command === "drift") result = applyDrift(root, inputJson(options), { apply: Boolean(options.get("--apply")) });
  else if (command === "drift-waiver") result = recordDriftWaiver(root, {
    itemId: options.get("--item-id"),
    reason: options.get("--reason"),
    scope: options.get("--scope"),
    expiresAt: options.get("--expires-at") || null,
    status: options.get("--status") || "active",
    operationId: options.get("--operation-id") || null,
  }, { apply: Boolean(options.get("--apply")) });
  else if (command === "commit") result = commitClarityOwned(root, { message: options.get("--message") || "Project Clarity checkpoint", apply: Boolean(options.get("--apply")) });
  else if (command === "event") result = appendEvent(root, parseJson(options.get("--event-json"), "--event-json"));
  else if (command === "evidence") result = appendEvidence(root, parseJson(options.get("--evidence-json"), "--evidence-json"));
  else if (command === "decide-project") {
    result = decideGenericProject(root, {
      secretaryRoot: options.get("--secretary-root"),
      projectName: options.get("--project"),
      itemId: options.get("--item-id"),
      operationId: options.get("--operation-id"),
      decision: options.get("--decision"),
      current: options.get("--current"),
      next: options.get("--next"),
    });
  } else usage(`不明なcommandです: ${command}`);
  render(command, result, Boolean(options.get("--json")));
} catch (error) {
  const known = error instanceof ClarityError;
  const output = {
    ok: false,
    code: known ? error.code : "unexpected-error",
    message: error instanceof Error ? error.message : String(error),
    changed: error?.details?.changed ?? false,
    nextAction: error?.details?.nextAction || "原因を確認し、変更前の状態を保ったまま再実行してください",
    ...(known && Object.keys(error.details || {}).length ? { details: error.details } : {}),
  };
  process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exit(known ? error.exitCode : 3);
}
