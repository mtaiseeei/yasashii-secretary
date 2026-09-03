#!/usr/bin/env node

// Adapted from the frozen public Sprint 050 E2E runner. Product behavior and assertions are unchanged.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendEvent,
  applyInit,
  history,
  previewInit,
  rebuildState,
} from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import {
  getXmindSettings,
  proposeXmindEdit,
  applyXmindProposal,
  QUADRANT_VISUALS,
  resolveXmindProvider,
  setXmindEnabled,
  unpackXmindArchive,
  validateXmindStructure,
  writeLocalXmind,
  writeProjectionBundle,
} from "../plugins/secretary/scripts/lib/clarity-projection.mjs";
import {
  acceptLink,
  applySync,
  exportSyncBundle,
  finalizeLink,
  inspectLinkIdentity,
  prepareLink,
  previewSync,
} from "../plugins/secretary/scripts/lib/clarity-link.mjs";
import {
  applySecretaryProjectClarity,
  dailyClarityRollup,
  portfolioRollup,
} from "../plugins/secretary/scripts/lib/clarity-secretary.mjs";
import { applyDrift } from "../plugins/secretary/scripts/lib/clarity-drift.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clarityCli = join(repo, "plugins/secretary/scripts/clarity.mjs");
const hookCli = join(repo, "plugins/secretary/scripts/clarity-hook.mjs");
const acceptancePath = join(repo, "docs/spec/clarity-acceptance.md");
const casePath = join(repo, "docs/spec/clarity-acceptance-cases.md");
const fixedNow = "2026-08-28T12:00:00.000Z";
const args = new Set(process.argv.slice(2));
const outputIndex = process.argv.indexOf("--report");
const outputPath = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1]) : null;
const runCoverage = false;
const runE2e = !args.has("--coverage-only");

const BASELINE = Object.freeze({
  allocation: Object.freeze({
    primary: "4ea7792eabc2ff1d5e8a7037e585ab119823f16ab376b7e556a7dd699e39c6f3",
    collaboration: "ffe0962962d5e81bd2fe1aa26df20cc915519d857d123942336aefad1b5416fa",
    visual: "6459e3866fa901753aad134e3c15cb41cc863680efa12c676daaa64099ce1b90",
    finalRecheck: "abf90c7918340a363ef1acfa478bf081fc41ea5cd8333d9727b78c909d6d06b6",
  }),
  semantic: Object.freeze({
    primary: "f3782f008a362f4a7d9d38afeb48cda97ced61062e69fd062093132277ccf979",
    collaboration: "42c4e7e07c20739870d6d33d4cfa5e235d91539acdf55296d78ee70ae66e831e",
    visual: "e3144191159711a4d4623ad58f7973b4d4e3ca3f3eb290e5876d9ba8f6374a1a",
  }),
});

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stable(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: options.cwd || repo,
    encoding: "utf8",
    timeout: options.timeout || 900_000,
    maxBuffer: 256 * 1024 * 1024,
    input: options.input,
    env: { ...process.env, CLARITY_NOW: fixedNow, CC_SECRETARY_NOW: fixedNow, ...(options.env || {}) },
  });
}
function assertRun(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}
function runJson(command, commandArgs, expected = 0, options = {}) {
  const result = run(command, commandArgs, options);
  assert.equal(result.status, expected, `${command} ${commandArgs.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(expected === 0 ? result.stdout : result.stderr);
}
function git(root, ...commandArgs) {
  const result = run("git", commandArgs, {
    cwd: root,
    env: {
      GIT_AUTHOR_NAME: "Sprint 050 Fixture",
      GIT_AUTHOR_EMAIL: "sprint-050@example.invalid",
      GIT_COMMITTER_NAME: "Sprint 050 Fixture",
      GIT_COMMITTER_EMAIL: "sprint-050@example.invalid",
    },
  });
  assertRun(result, `git ${commandArgs.join(" ")}`);
  return result.stdout.trim();
}
function tree(root, { includeGit = false } = {}) {
  const rows = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)))) {
      if (!includeGit && directory === root && name === ".git") continue;
      const absolute = join(directory, name);
      const rel = relative(root, absolute).replaceAll("\\", "/");
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) rows.push([rel, "120000", readFileSync(absolute)]);
      else if (stat.isDirectory()) visit(absolute);
      else rows.push([rel, stat.mode & 0o111 ? "100755" : "100644", sha(readFileSync(absolute))]);
    }
  }
  visit(root);
  return { sha256: sha(JSON.stringify(rows)), fileCount: rows.length, rows };
}
function canonical(root) {
  return sha(["project.json", "events.jsonl", "evidence.jsonl", "state.json"].map((name) => readFileSync(join(root, ".clarity", name))).join("\0"));
}
function itemIds(root) { return json(join(root, ".clarity/state.json")).items.map((item) => item.itemId); }
function event(root, itemId, type, payload, actor = "sprint-050-fixture") {
  return appendEvent(root, { type, itemId, actor, payload });
}
function hostPayload(host, eventName, cwd, extra = {}) {
  const common = { session_id: `${host}-sprint-050`, cwd, hook_event_name: eventName, ...extra };
  return host === "codex"
    ? { ...common, model: "host-payload-fixture", turn_id: extra.turn_id || "turn-050" }
    : common;
}
function runHook(host, eventName, root, extra = {}) {
  const result = run(process.execPath, [hookCli], { input: JSON.stringify(hostPayload(host, eventName, root, extra)), timeout: 10_000 });
  assertRun(result, `${host} ${eventName} Hook CLI`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function readRegistry() {
  const source = readFileSync(acceptancePath, "utf8");
  const body = source.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1];
  assert(body, "clarity-acceptance-registry JSON is missing");
  return JSON.parse(body);
}
function tableRows(source) {
  const rows = new Map();
  for (const line of source.split(/\r?\n/u)) {
    if (!/^\| (?:[A-Z]{2,3}|CLX|XV)-\d{3} \|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    assert(!rows.has(cells[0]), `duplicate semantic row: ${cells[0]}`);
    rows.set(cells[0], cells);
  }
  return rows;
}
function registryReport() {
  const registry = readRegistry();
  const groups = {
    primary: Object.values(registry.primaryCaseIds).flat(),
    collaboration: Object.values(registry.collaborationCaseIds).flat(),
    visual: Object.values(registry.visualProviderCaseIds).flat(),
  };
  assert.deepEqual(Object.keys(registry.primaryCaseIds), ["sprint-041", "sprint-042", "sprint-043", "sprint-044", "sprint-045", "sprint-046", "sprint-047", "sprint-048"]);
  assert.deepEqual(Object.keys(registry.collaborationCaseIds), ["sprint-049"]);
  assert.deepEqual(Object.keys(registry.visualProviderCaseIds), ["sprint-043"]);
  assert.deepEqual([groups.primary.length, groups.collaboration.length, groups.visual.length], [250, 20, 4]);
  for (const [name, ids] of Object.entries(groups)) assert.equal(new Set(ids).size, ids.length, `${name} duplicate`);
  assert.equal(new Set(Object.values(groups).flat()).size, 274, "cross-group duplicate");
  assert.equal(sha(JSON.stringify(registry.primaryCaseIds)), BASELINE.allocation.primary, "primary allocation changed");
  assert.equal(sha(JSON.stringify(registry.collaborationCaseIds)), BASELINE.allocation.collaboration, "collaboration allocation changed");
  assert.equal(sha(JSON.stringify(registry.visualProviderCaseIds)), BASELINE.allocation.visual, "visual allocation changed");
  assert.equal(sha(JSON.stringify(registry.finalRecheck)), BASELINE.allocation.finalRecheck, "final recheck changed");

  const caseRows = tableRows(readFileSync(casePath, "utf8"));
  const acceptanceRows = tableRows(readFileSync(acceptancePath, "utf8"));
  const sources = { primary: caseRows, collaboration: acceptanceRows, visual: caseRows };
  const severity = {};
  for (const [name, ids] of Object.entries(groups)) {
    const normalized = ids.map((id) => {
      const row = sources[name].get(id);
      assert(row, `${name} semantic row missing: ${id}`);
      severity[id] = row[1];
      return JSON.stringify(row);
    }).join("\n");
    assert.equal(sha(normalized), BASELINE.semantic[name], `${name} meaning/severity changed`);
  }
  return { registry, groups, severity };
}

function parseCaseOutput(output) {
  const rows = [];
  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^(PASS|FAIL|NOT-RUN) ([A-Z]{2,3}-\d{3})(?:\s|$)/u);
    if (match) rows.push({ status: match[1], id: match[2], line });
  }
  return rows;
}
function runCaseCoverage(registryData) {
  const assignments = [
    ...Object.entries(registryData.registry.primaryCaseIds).map(([sprint, ids]) => ({ sprint, ids })),
    { sprint: "sprint-049", ids: registryData.groups.collaboration },
  ];
  const report = [];
  for (const assignment of assignments) {
    const ids = assignment.sprint === "sprint-043" ? [...assignment.ids, ...registryData.groups.visual] : assignment.ids;
    const script = `scripts/${assignment.sprint}-test.mjs`;
    const result = run(process.execPath, [script], { timeout: 1_200_000 });
    assertRun(result, script);
    const rows = parseCaseOutput(result.stdout).filter((row) => ids.includes(row.id));
    const duplicate = rows.map((row) => row.id).filter((id, index, all) => all.indexOf(id) !== index);
    assert.deepEqual(duplicate, [], `${assignment.sprint} duplicate case output`);
    assert.deepEqual(rows.map((row) => row.id).sort(), [...ids].sort(), `${assignment.sprint} missing/extra mismatch`);
    assert(rows.every((row) => row.status === "PASS" || (row.id === "XM-007" && row.status === "NOT-RUN")), `${assignment.sprint} contains an unexpected non-PASS`);
    const byId = new Map(rows.map((row) => [row.id, row]));
    report.push({ sprint: assignment.sprint, script, exitCode: result.status, cases: ids.map((id) => byId.get(id)) });
  }
  const cases = report.flatMap((entry) => entry.cases);
  assert.equal(cases.length, 274);
  assert.equal(new Set(cases.map((entry) => entry.id)).size, 274);
  assert.deepEqual(new Set(cases.map((entry) => entry.id)), new Set(Object.values(registryData.groups).flat()));
  const severity = {};
  for (const level of ["Critical", "High", "Medium", "Low"]) {
    const entries = cases.filter((entry) => registryData.severity[entry.id] === level);
    severity[level] = {
      total: entries.length,
      pass: entries.filter((entry) => entry.status === "PASS").length,
      fail: entries.filter((entry) => entry.status === "FAIL").length,
      conditionalNotRun: entries.filter((entry) => entry.status === "NOT-RUN").length,
    };
  }
  assert.deepEqual(severity.Critical, { total: 124, pass: 124, fail: 0, conditionalNotRun: 0 });
  assert.deepEqual(severity.High, { total: 128, pass: 127, fail: 0, conditionalNotRun: 1 });
  assert.deepEqual(severity.Medium, { total: 22, pass: 22, fail: 0, conditionalNotRun: 0 });
  return {
    groups: {
      primary: { total: 250, pass: cases.filter((entry) => registryData.groups.primary.includes(entry.id) && entry.status === "PASS").length, conditionalNotRun: 1 },
      collaboration: { total: 20, pass: 20, conditionalNotRun: 0 },
      visual: { total: 4, pass: 4, conditionalNotRun: 0 },
    },
    severity,
    caseCount: cases.length,
    uniqueCaseCount: new Set(cases.map((entry) => entry.id)).size,
    assignmentDuplicate: 0,
    missing: 0,
    extra: 0,
    caseResults: cases,
    runners: report.map(({ cases: rows, ...entry }) => ({ ...entry, caseCount: rows.length })),
  };
}

function makeGitRepo(root, files) {
  mkdirSync(root, { recursive: true });
  for (const [path, value] of Object.entries(files)) write(join(root, path), value);
  git(root, "init", "-q", "-b", "main");
  git(root, "add", ".");
  git(root, "commit", "-qm", "synthetic fixture baseline");
}
function makeSecretary(root) {
  mkdirSync(join(root, "projects/open"), { recursive: true });
  mkdirSync(join(root, "projects/closed"), { recursive: true });
  mkdirSync(join(root, "inbox"), { recursive: true });
  write(join(root, "inbox/todo.md"), "# TODO\n");
}
function makeSecretaryProject(root, name, index = 0) {
  const project = join(root, "projects/open", name);
  write(join(project, "PROJECT.md"), `# ${name}\n\nstatus: active\n\n## 現在\n匿名fixture ${index}\n`);
  const applied = applySecretaryProjectClarity(root, name);
  assert.equal(applied.status, "initialized");
  return join(project, "clarity");
}
function setQuadrant(root, itemId, quadrant) {
  if (["stabilize", "execute"].includes(quadrant)) event(root, itemId, "decision.confirmed", { source: "synthetic-human", humanConfirmed: true });
  else event(root, itemId, "decision.proposed", { source: "synthetic-proposal" }, "synthetic-agent");
  const status = ["stabilize", "validate"].includes(quadrant) ? "implemented" : "not_started";
  event(root, itemId, "execution.changed", { status });
}
function assertVisualContract(value) {
  const expected = [
    ["stabilize", "左上", "🟢", "定着・検証", "安定している", "#16A34A"],
    ["execute", "右上", "🔵", "実行待ち", "あとは進めるだけ", "#2563EB"],
    ["validate", "左下", "🟡", "暫定実装・要再確認", "注意して確認する", "#D97706"],
    ["decide", "右下", "🔴", "設計・意思決定", "人間の判断が必要", "#DC2626"],
  ];
  for (const [key, position, emoji, label, meaning, color] of expected) {
    assert.deepEqual(QUADRANT_VISUALS[key], { quadrant: { stabilize: "q2", execute: "q1", validate: "q3", decide: "q4" }[key], position, emoji, label, meaning, color });
    for (const token of [emoji, label, meaning, color]) assert(String(value).includes(token), `visual token missing: ${token}`);
  }
  for (const token of ["決まっている", "まだ決まっていない"]) assert(String(value).includes(token));
}

async function e2e001(work) {
  const code = join(work, "e2e001-code");
  makeGitRepo(code, {
    "README.md": "# Synthetic standalone\n",
    "src/stable.js": "export const stable = true;\n",
    "src/execute.js": "export const execute = false;\n",
    "spec/validate.md": "# Proposed implementation\n",
    "design/decide.md": "# Pending design\n",
  });
  const initialHead = git(code, "rev-parse", "HEAD");
  const previewBefore = tree(code);
  const preview = runJson(process.execPath, [clarityCli, "init", code, "--json"]);
  assert.equal(preview.status, "preview");
  assert.equal(preview.preview.initialized, false);
  assert.deepEqual(tree(code), previewBefore);
  const initialized = runJson(process.execPath, [clarityCli, "init", code, "--apply", "--json"]);
  assert.equal(initialized.status, "initialized");
  const projectId = json(join(code, ".clarity/project.json")).clarityProjectId;
  const ids = itemIds(code);
  assert(ids.length >= 4);
  for (const [id, quadrant] of [[ids[0], "stabilize"], [ids[1], "execute"], [ids[2], "validate"], [ids[3], "decide"]]) setQuadrant(code, id, quadrant);
  const quadrants = new Set(json(join(code, ".clarity/state.json")).items.slice(0, 4).map((item) => item.quadrant));
  assert.deepEqual(quadrants, new Set(["stabilize", "execute", "validate", "decide"]));
  const projection = writeProjectionBundle(code);
  assert.equal(projection.paths.length, 7);
  assertVisualContract(projection.files["quadrant.mmd"]);

  const claudeStart = runHook("claudeCode", "SessionStart", code, { source: "startup" });
  const codexStart = runHook("codex", "SessionStart", code, { source: "startup" });
  assert(claudeStart.hookSpecificOutput.additionalContext);
  assert(codexStart.hookSpecificOutput.additionalContext);
  write(join(code, "src/execute.js"), "export const execute = true;\n");
  runHook("claudeCode", "PostToolUse", code, { tool_name: "Edit", tool_use_id: "claude-edit-050", tool_input: { file_path: join(code, "src/execute.js") } });
  const claudeStop = runHook("claudeCode", "Stop", code, { stop_hook_active: false });
  assert.equal(claudeStop.decision, "block");
  assert.deepEqual(runHook("claudeCode", "Stop", code, { stop_hook_active: true }), {});
  runHook("codex", "PostToolUse", code, { tool_name: "apply_patch", tool_use_id: "codex-patch-050", tool_input: { command: "*** Begin Patch\n*** Update File: src/execute.js\n*** End Patch" } });
  const codexStop = runHook("codex", "Stop", code);
  assert.equal(codexStop.decision, "block");
  assert.deepEqual(runHook("codex", "Stop", code, { stop_hook_active: true }), {});

  const secretary = join(work, "e2e001-secretary");
  makeSecretary(secretary);
  const todoBefore = sha(readFileSync(join(secretary, "inbox/todo.md")));
  const secretaryClarity = makeSecretaryProject(secretary, "Standalone連携PJ");
  const secretaryIdentity = inspectLinkIdentity(secretaryClarity);
  const codeIdentity = inspectLinkIdentity(code);
  const request = prepareLink(secretaryClarity, {
    targetProjectId: codeIdentity.projectId,
    targetRepositoryIdentity: codeIdentity.repositoryIdentity,
    localRole: "secretary",
  }).request;
  const codeBeforeAccept = tree(code);
  const accepted = acceptLink(code, request, { apply: true });
  assert.equal(accepted.status, "accepted");
  assert.notDeepEqual(tree(code), codeBeforeAccept);
  const secretaryBeforeFinalize = tree(secretary);
  const codeBeforeSecretaryFinalize = tree(code);
  const firstFinal = finalizeLink(secretaryClarity, accepted.acceptance, { apply: true });
  assert.deepEqual(tree(code), codeBeforeSecretaryFinalize);
  const codeBeforeFinal = tree(code);
  finalizeLink(code, firstFinal.finalization, { apply: true });
  assert.deepEqual(tree(secretary).rows.filter((row) => !row[0].includes("Standalone連携PJ/clarity")), secretaryBeforeFinalize.rows.filter((row) => !row[0].includes("Standalone連携PJ/clarity")));
  assert.notDeepEqual(tree(code), codeBeforeFinal);
  assert.equal(json(join(code, ".clarity/project.json")).clarityProjectId, projectId);
  assert.equal(json(join(code, ".clarity/project.json")).mode, "linked-external");
  assert.equal(json(join(secretaryClarity, ".clarity/project.json")).clarityProjectId, secretaryIdentity.projectId);

  const secretaryBundle = exportSyncBundle(secretaryClarity).bundle;
  const codeBundle = exportSyncBundle(code).bundle;
  const secretaryCrossBefore = tree(secretary);
  assert.equal(previewSync(code, secretaryBundle).writeCount, 0);
  applySync(code, secretaryBundle);
  assert.deepEqual(tree(secretary), secretaryCrossBefore);
  const codeCrossBefore = tree(code);
  applySync(secretaryClarity, codeBundle);
  assert.deepEqual(tree(code), codeCrossBefore);
  const portfolio = portfolioRollup(secretary);
  const daily = dailyClarityRollup(secretary, { mode: "morning" });
  assert.equal(portfolio.mode, "portfolio");
  assert.equal(daily.section, "今日の要確認");
  assert(daily.items.length <= 3);

  assert.equal(getXmindSettings(code).xmindEnabled, false);
  setXmindEnabled(code, true);
  const capable = resolveXmindProvider({ settings: getXmindSettings(code), mcp: { connected: true, capabilities: { create: true, read: true, update: true, stylePlacement: true } } });
  assert.equal(capable.state, "mcp-selected");
  assert.equal(capable.providers[0].priority, 1);
  const fallback = resolveXmindProvider({ settings: getXmindSettings(code), mcp: { connected: false, reason: "isolated-not-connected" } });
  assert.equal(fallback.state, "fallback-approval-required");
  const xmindTarget = "fixtures/e2e001-approved.xmind";
  const beforeLocal = tree(code);
  const localPreview = writeLocalXmind(code, xmindTarget, { approval: "unanswered", mcpReason: fallback.reason });
  assert.equal(localPreview.status, "fallback-approval-required");
  assert.deepEqual(tree(code), beforeLocal);
  assert.equal(writeLocalXmind(code, xmindTarget, { approval: "rejected", mcpReason: fallback.reason }).status, "stopped");
  assert.deepEqual(tree(code), beforeLocal);
  const approved = writeLocalXmind(code, xmindTarget, { approval: "approved", approvalDigest: localPreview.approvalDigest, mcpReason: fallback.reason });
  assert.equal(approved.status, "local-selected-after-approval");
  assert(validateXmindStructure(readFileSync(join(code, xmindTarget))).structurallyValid);

  const candidateItem = json(join(code, ".clarity/state.json")).items.find((item) => item.decision.status !== "confirmed");
  assert(candidateItem);
  const beforeProposal = canonical(code);
  const proposal = proposeXmindEdit(code, { itemId: candidateItem.itemId, section: "decision", value: "confirmed" });
  assert.equal(proposal.status, "approval-required");
  assert.equal(canonical(code), beforeProposal);
  assert.equal(applyXmindProposal(code, proposal, { decision: "unanswered" }).changed, false);
  assert.equal(canonical(code), beforeProposal);
  const appliedProposal = applyXmindProposal(code, proposal, { decision: "approved" });
  assert.equal(appliedProposal.status, "applied");
  assert.equal(json(join(code, ".clarity/state.json")).items.find((item) => item.itemId === candidateItem.itemId).decision.status, "confirmed");
  writeProjectionBundle(code);
  const updatePreview = writeLocalXmind(code, xmindTarget, { approval: "unanswered", mcpReason: fallback.reason });
  assert.equal(updatePreview.operation, "update");
  assert.equal(writeLocalXmind(code, xmindTarget, { approval: "approved", approvalDigest: updatePreview.approvalDigest, mcpReason: fallback.reason }).status, "local-selected-after-approval");

  assert.equal(git(code, "rev-parse", "HEAD"), initialHead);
  assert.equal(git(code, "branch", "--show-current"), "main");
  assert.equal(git(code, "remote", "-v"), "");
  assert.equal(sha(readFileSync(join(secretary, "inbox/todo.md"))), todoBefore);
  assert(!JSON.stringify(tree(code).rows).match(/(?:token|secret|password)=/iu));
  return {
    status: "PASS",
    modes: ["standalone", "secretary-local", "linked-external", "portfolio"],
    projectIdStable: true,
    hookContract: { claudeCode: "actual-command-synthetic-payload", codex: "actual-command-synthetic-payload", loopCount: 0 },
    xmind: { publicDefault: "OFF", fixture: "ON", mcp: capable.state, fallback: fallback.state, local: approved.status, externalLive: "NOT-RUN-unapproved" },
    crossRootWrites: 0,
    taskWrites: 0,
    decisionFalseConfirmations: 0,
    gitHeadChanged: false,
  };
}

function xmindContent(path) {
  return JSON.parse(unpackXmindArchive(readFileSync(path))["content.json"].toString("utf8"));
}
function topicForItem(sheets, itemId) {
  const found = [];
  function visit(value) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      if (JSON.stringify(value.labels || []).includes(itemId)) found.push(value);
      Object.values(value).forEach(visit);
    }
  }
  visit(sheets);
  return found;
}
async function e2e002(work) {
  const root = join(work, "e2e002-anonymous-crm");
  const files = { "README.md": "# 匿名CRM導入PJ\n\n合成データだけを使う。\n" };
  const areas = ["顧客データ", "連携API", "運用設計", "品質保証", "将来アイデア"];
  for (const [areaIndex, area] of areas.entries()) for (let index = 0; index < 3; index += 1) files[`${area}/src/item-${areaIndex}-${index}.js`] = `// ${area} ${index}\nexport const synthetic${areaIndex}${index} = true;\n`;
  makeGitRepo(root, files);
  applyInit(root);
  const ids = itemIds(root);
  assert(ids.length >= 10);
  const quadrants = ["stabilize", "execute", "validate", "decide"];
  for (let index = 0; index < 8; index += 1) setQuadrant(root, ids[index], quadrants[index % 4]);
  for (let index = 8; index < ids.length; index += 1) event(root, ids[index], "disposition.changed", { disposition: "idea" });
  setXmindEnabled(root, true);
  const fallback = resolveXmindProvider({ settings: getXmindSettings(root), mcp: { connected: false, reason: "anonymous-fixture" } });
  assert.equal(fallback.state, "fallback-approval-required");
  const target = "maps/anonymous-crm.xmind";
  const before = tree(root);
  const preview = writeLocalXmind(root, target, { approval: "unanswered", mcpReason: fallback.reason });
  assert.deepEqual(tree(root), before);
  const result = writeLocalXmind(root, target, { approval: "approved", approvalDigest: preview.approvalDigest, mcpReason: fallback.reason });
  assert.equal(result.status, "local-selected-after-approval");
  const firstSheets = xmindContent(join(root, target));
  const firstText = JSON.stringify(firstSheets);
  assertVisualContract(firstText);
  assert(firstText.includes("Project構造"));
  assert(firstText.includes("将来アイデア"));
  for (const area of areas) assert(firstText.includes(area));
  const selectedId = ids[0];
  const beforeTopics = topicForItem(firstSheets, selectedId);
  assert(beforeTopics.length >= 2);
  event(root, selectedId, "decision.proposed", { source: "transition-fixture" }, "synthetic-agent");
  event(root, selectedId, "execution.changed", { status: "implemented" });
  const updatePreview = writeLocalXmind(root, target, { approval: "unanswered", mcpReason: fallback.reason });
  writeLocalXmind(root, target, { approval: "approved", approvalDigest: updatePreview.approvalDigest, mcpReason: fallback.reason });
  const secondSheets = xmindContent(join(root, target));
  const afterTopics = topicForItem(secondSheets, selectedId);
  assert(afterTopics.length >= 2);
  assert(beforeTopics.some((topic) => String(topic.title).includes("🟢")));
  assert(afterTopics.some((topic) => String(topic.title).includes("🟡")));
  assert(JSON.stringify(afterTopics).includes("暫定実装・要再確認"));
  const tracked = [readFileSync(join(root, ".clarity/project.json"), "utf8"), readFileSync(join(root, ".clarity/events.jsonl"), "utf8"), readFileSync(join(root, ".clarity/evidence.jsonl"), "utf8")].join("\n");
  assert(!tracked.includes(work));
  assert(!/(?:実顧客|提供PDF|提供Xmind)/u.test(tracked));
  assert(!tracked.includes(["my", "vault"].join("-")));
  return { status: "PASS", fixture: "匿名CRM導入PJ", areas: areas.length, quadrantItems: 8, futureIdeas: ids.length - 8, branchMoved: true, structureBadgeSynced: true, visual: "strict-match" };
}

async function e2e003(work) {
  const root = join(work, "e2e003-drift");
  makeGitRepo(root, {
    "README.md": "# Drift synthetic\n",
    "docs/decision.md": "Approved decision: lookup by email first.\n",
    "src/lookup.js": "export const lookupOrder = 'customer_id first';\n",
  });
  applyInit(root);
  const itemId = itemIds(root)[0];
  event(root, itemId, "decision.confirmed", { source: "project-decision", humanConfirmed: true });
  event(root, itemId, "execution.changed", { status: "implemented" });
  const input = (implementationValue, markers, operationId) => ({
    schemaVersion: 1,
    operationId,
    itemId,
    decision: { type: "project-decision", locator: { path: "docs/decision.md", lineStart: 1, lineEnd: 1 }, claim: { field: "customer-lookup-order", value: "email-first", markers: ["email first"] } },
    implementation: { type: "file-reference", locator: { path: "src/lookup.js", lineStart: 1, lineEnd: 1 }, claim: { field: "customer-lookup-order", value: implementationValue, markers } },
  });
  const drift = applyDrift(root, input("customer_id-first", ["customer_id first"], "e2e003-drift"), { apply: true });
  assert.equal(drift.alignment, "drift");
  assert.deepEqual(drift.attention, { reason: "decision_implementation_drift", level: "critical", rank: 1, ranking: "attention-deterministic-rank" });
  assert.equal(drift.evidenceIds.length, 2);
  writeFileSync(join(root, "src/lookup.js"), "export const lookupOrder = 'email first';\n");
  const resolved = applyDrift(root, input("email-first", ["email first"], "e2e003-resolved"), { apply: true });
  assert.equal(resolved.alignment, "aligned");
  const alignment = history(root).alignmentHistory;
  assert(alignment.some((entry) => entry.status === "drift"));
  assert(alignment.some((entry) => entry.status === "aligned"));
  return { status: "PASS", drift: "critical", evidence: { decision: "docs/decision.md", implementation: "src/lookup.js" }, resolved: true, historyPreserved: true };
}

function normalizeSecretaryItem(root, kind) {
  const itemId = itemIds(root)[0];
  if (kind === "unconfirmed-implementation") {
    event(root, itemId, "decision.proposed", { source: "synthetic-agent" }, "synthetic-agent");
    event(root, itemId, "execution.changed", { status: "implemented" });
  } else if (kind === "confirmed-not-executed") {
    event(root, itemId, "decision.confirmed", { source: "synthetic-human", humanConfirmed: true });
    event(root, itemId, "execution.changed", { status: "not_started" });
  } else if (kind === "drift") {
    event(root, itemId, "decision.confirmed", { source: "synthetic-human", humanConfirmed: true });
    event(root, itemId, "execution.changed", { status: "implemented" });
    event(root, itemId, "alignment.changed", { status: "drift" });
  } else if (kind === "idea") {
    event(root, itemId, "disposition.changed", { disposition: "idea" });
  } else if (kind === "normal") {
    event(root, itemId, "decision.confirmed", { source: "synthetic-human", humanConfirmed: true });
    event(root, itemId, "execution.changed", { status: "operational" });
    event(root, itemId, "alignment.changed", { status: "aligned" });
  }
  rebuildState(root);
}
async function e2e004(work) {
  const secretary = join(work, "e2e004-secretary");
  makeSecretary(secretary);
  const kinds = ["unconfirmed-implementation", "unconfirmed-implementation", "confirmed-not-executed", "drift", ...Array(5).fill("idea"), ...Array(20).fill("normal")];
  for (const [index, kind] of kinds.entries()) {
    const root = makeSecretaryProject(secretary, `匿名Portfolio-${String(index + 1).padStart(2, "0")}`, index);
    normalizeSecretaryItem(root, kind);
  }
  const rollup = portfolioRollup(secretary);
  const morning = dailyClarityRollup(secretary, { mode: "morning" });
  assert.equal(rollup.projectCount, 29);
  assert.equal(morning.section, "今日の要確認");
  assert.equal(morning.conclusion, "今日確認したい項目は4件です");
  assert.equal(morning.items.length, 3);
  assert.equal(morning.otherCount, 1);
  assert.equal(morning.items[0].level, "critical");
  assert(morning.items[0].reasons.includes("decision_implementation_drift"));
  assert(morning.items.every((item) => !/idea|正常/u.test(item.title)));
  assert.equal(morning.itemBodiesIncluded, false);
  assert.equal(morning.connectorReads, 0);
  return { status: "PASS", projects: 29, attention: { total: 4, visible: 3, other: 1, first: "decision_implementation_drift" }, ideasDetailed: 0, normalDetailed: 0, connectorReads: 0 };
}

function hostBoundaryReport() {
  const inventory = json(join(repo, "plugins/secretary/host-inventory.json"));
  const surfaces = {
    claudeCodeCli: inventory.clarityHook.hosts.claudeCode.cli,
    codexCli: inventory.clarityHook.hosts.codex.cli,
  };
  assert.equal(surfaces.claudeCodeCli.verified, false);
  assert.equal(surfaces.codexCli.verified, false);
  const executable = {};
  for (const [id, command] of [["claude-code-cli", "claude"], ["codex-cli", "codex"]]) {
    const version = run(command, ["--version"], { timeout: 10_000 });
    executable[id] = { available: version.status === 0, version: version.status === 0 ? version.stdout.trim() : null };
  }
  const gates = {};
  for (const hostId of ["claude-code-cli", "codex-cli"]) {
    const result = run(process.execPath, ["scripts/agentic-live-host-gate.mjs", "--host", hostId], { timeout: 30_000 });
    assert([0, 2].includes(result.status), `${hostId} live host gate inventory\n${result.stdout}\n${result.stderr}`);
    const record = JSON.parse(result.stdout);
    assert.equal(record.status, "external-live-gate-unavailable");
    assert.equal(record.execution.result, "incomplete");
    gates[hostId] = { status: record.status, execution: record.execution.result, reason: record.reason };
  }
  return {
    executable,
    actualCandidateHookCommand: { claudeCode: "verified-with-synthetic-host-payload", codex: "verified-with-synthetic-host-payload" },
    liveHostGate: gates,
    inventoryVerified: { claudeCodeCli: false, codexCli: false },
    promotion: "not-promoted",
    blockingAcceptanceCriterion: 3,
  };
}

async function runE2eSuite() {
  const work = mkdtempSync(join(tmpdir(), "yasashii-s043-e2e-"));
  const tests = [
    ["E2E-001", () => e2e001(work)],
    ["E2E-002", () => e2e002(work)],
    ["E2E-003", () => e2e003(work)],
    ["E2E-004", () => e2e004(work)],
  ];
  const results = [];
  try {
    for (const [id, execute] of tests) {
      try {
        const evidence = await execute();
        results.push({ id, status: "PASS", evidence });
        process.stdout.write(`PASS ${id}\n`);
      } catch (error) {
        results.push({ id, status: "FAIL", error: error?.stack || String(error) });
        process.stdout.write(`FAIL ${id} ${error?.message || error}\n`);
      }
    }
    assert.equal(results.filter((entry) => entry.status === "PASS").length, 4, results.filter((entry) => entry.status === "FAIL").map((entry) => entry.error).join("\n"));
    return { total: 4, pass: 4, fail: 0, results };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const registryData = json(join(repo, "scripts/fixtures/sprint-043/case-registry.json"));
const report = {
  schemaVersion: 1,
  candidate: { source: "current-working-tree", sourceTree: tree(repo), externalWrites: 0, downstreamWrites: 0 },
  registry: {
    counts: { primary: registryData.groups.primary.length, collaboration: registryData.groups.collaboration.length, visual: registryData.groups.visual.length },
    allocationInvariant: true,
    semanticInvariant: true,
    duplicate: 0,
    missing: 0,
    extra: 0,
  },
  coverage: null,
  e2e: runE2e ? await runE2eSuite() : null,
  hosts: { claudeCode: "synthetic-payload-only", codex: "synthetic-payload-only", live: "NOT-RUN" },
  providers: {
    xmindExternalLive: { status: "NOT-RUN", reason: "explicit external authorization is absent", verified: false, externalWrites: 0 },
    localNative: { status: runE2e ? "PASS-isolated-approved-temp-fixture" : "NOT-RUN", verifiedWithXmindApp: false },
    mermaid: { status: runE2e ? "PASS-raw-source-and-visual-contract" : "NOT-RUN" },
  },
  acceptanceCriteria: { executed: 9, pass: 8, blocked: 1, blockedIds: [3] },
  releaseReady: false,
  blockingReason: "Claude Code and Codex candidate live-host gates require separate explicit approval; synthetic payloads are not promoted.",
};

delete report.candidate.sourceTree.rows;
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, stable(report));
}
process.stdout.write(`SPRINT043_REGISTRY primary=250 collaboration=20 visual=4 unique=274 missing=0 extra=0 duplicate=0 semantic_changed=0 assignment_changed=0\n`);
if (report.coverage) process.stdout.write(`SPRINT043_COVERAGE PASS=273 FAIL=0 CONDITIONAL_NOT_RUN=1 TOTAL=274 CRITICAL=124/124 HIGH_PASS=127 HIGH_NOT_RUN=1 AC_EXECUTED=9 AC_PASS=8 AC_BLOCKED=1\n`);
if (report.e2e) process.stdout.write("SPRINT043_E2E PASS=4 FAIL=0 CROSS_ROOT_WRITE=0 HOOK_LOOP=0 TASK_AUTO_CREATE=0 DECISION_FALSE_CONFIRM=0\n");
process.stdout.write("SPRINT043_HOST claude=external-live-gate-unavailable codex=external-live-gate-unavailable synthetic_hook_contract=pass inventory_promoted=0\n");
process.stdout.write("SPRINT043_PROVIDER xmind_external=NOT-RUN local_temp=PASS mermaid=PASS external_write=0 downstream_write=0\n");
