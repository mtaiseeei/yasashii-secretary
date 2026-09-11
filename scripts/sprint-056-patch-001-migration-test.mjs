#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const sourcePlugin = resolve(option("--plugin-root") || join(root, "plugins/secretary"));
const cli = join(sourcePlugin, "scripts/update-apply.mjs");
const fixtureRoot = realpathSync(mkdtempSync(join(process.env.TMPDIR || tmpdir(), "sprint056-patch001-")));
const historicalSupported = ["0.8.0", "0.9.0", "0.9.1", "0.9.2", "0.10.0", "0.10.1", "0.10.2", "0.10.3", "0.12.0"];
const currentSupported = [...historicalSupported, "0.13.0"];
const config = JSON.parse(readFileSync(join(sourcePlugin, "edition.json"), "utf8"));
let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`); }
}
function json(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function sha(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function fileSha(path) { return sha(readFileSync(path)); }
function git(cwd, args) { return execFileSync("git", args, { cwd, encoding: "utf8" }).trim(); }
function templateAt(version, name) {
  const releasedFixture = currentSupported.includes(version) ? version : "0.8.0";
  return execFileSync("git", ["show", `v${releasedFixture}:plugins/secretary/templates/${name}`], { cwd: root, encoding: "utf8" });
}
function configurePlugin(name, version) {
  const target = join(fixtureRoot, name);
  cpSync(sourcePlugin, target, { recursive: true });
  const manifestPath = join(target, ".claude-plugin/plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  json(manifestPath, manifest);
  return target;
}
function inspectTree(pluginRoot) {
  const entries = [];
  const walk = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = join(directory, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(absolute, rel);
      else entries.push({ rel, mode: lstatSync(absolute).mode & 0o777, hash: fileSha(absolute) });
    }
  };
  walk(pluginRoot);
  return { treeHash: sha(JSON.stringify(entries)), fileCount: entries.length };
}
function makeWorkspace(name, fromVersion, { oldTarget = "0.13.0", crlf = false, partial = false, agentsExtra = "" } = {}) {
  const workspace = join(fixtureRoot, name);
  mkdirSync(join(workspace, "secretary"), { recursive: true });
  let agents = `USER-PREFIX\n${templateAt(fromVersion, "AGENTS.md")}${agentsExtra}USER-SUFFIX\n`;
  let claude = `USER-PREFIX\n${templateAt(fromVersion, "CLAUDE.md")}USER-SUFFIX\n`;
  if (crlf) { agents = agents.replace(/\n/gu, "\r\n"); claude = claude.replace(/\n/gu, "\r\n"); }
  writeFileSync(join(workspace, "secretary/AGENTS.md"), agents);
  writeFileSync(join(workspace, "secretary/CLAUDE.md"), claude);
  chmodSync(join(workspace, "secretary/AGENTS.md"), 0o640);
  chmodSync(join(workspace, "secretary/CLAUDE.md"), 0o600);
  json(join(workspace, config.workspaceProtection.canonicalMarker), { schemaVersion: config.workspaceProtection.markerSchemaVersion, edition: config.edition });
  const records = ["secretary/AGENTS.md", "secretary/CLAUDE.md"].map((path) => ({ path, installedVersion: fromVersion, baselineHash: fileSha(join(workspace, path)), templateVariables: {} }));
  json(join(workspace, config.update.ledgerPath), { schemaVersion: 2, edition: config.edition, records });
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: workspace });
  git(workspace, ["config", "core.autocrlf", "false"]);
  git(workspace, ["config", "user.name", "Migration Fixture"]);
  git(workspace, ["config", "user.email", "migration@example.invalid"]);
  git(workspace, ["add", "."]); git(workspace, ["commit", "-qm", "initial"]);
  git(workspace, ["commit", "--allow-empty", "-qm", `protection ${fromVersion}->${oldTarget}`]);
  const protectionCommit = git(workspace, ["rev-parse", "HEAD"]);
  const sessionDirectory = join(workspace, ".git", config.update.sessionDirectory);
  const backupRoot = join(sessionDirectory, "plugin-backup");
  mkdirSync(sessionDirectory, { recursive: true });
  cpSync(sourcePlugin, backupRoot, { recursive: true });
  const backupManifestPath = join(backupRoot, ".claude-plugin/plugin.json");
  const backupManifest = JSON.parse(readFileSync(backupManifestPath, "utf8"));
  backupManifest.version = fromVersion;
  json(backupManifestPath, backupManifest);
  const backup = inspectTree(backupRoot);
  const session = {
    schemaVersion: 1, edition: config.edition, pluginId: config.distribution.pluginId,
    phase: partial ? "migration-partial" : "awaiting-reload", fromVersion, toVersion: oldTarget,
    protectionCommit, scope: "project", workspaceEditionBefore: "same-edition",
    managed: ["secretary/AGENTS.md", "secretary/CLAUDE.md"].map((path) => ({ path, status: "clean", currentHash: fileSha(join(workspace, path)) })),
    selections: { "secretary/AGENTS.md": "replace", "secretary/CLAUDE.md": "replace" },
    pluginBackup: { directory: "plugin-backup", version: fromVersion, scope: "project", ...backup, requiredSkills: ["secretary", "update"] },
    plugin: { updated: true, requiresReload: true },
    migration: { changedPaths: partial ? ["secretary/AGENTS.md"] : [], appliedHashes: {}, appliedOperationIds: [], contentWriteCount: 0, ledgerChanged: false, ledgerHash: null, markerChanged: false, markerHash: null },
  };
  json(join(sessionDirectory, "session.json"), session);
  return { workspace, sessionPath: join(sessionDirectory, "session.json"), protectionCommit, beforeAgents: agents, beforeClaude: claude, backupTree: backup.treeHash };
}
function invoke(command, workspace, pluginRoot, extra = []) {
  return spawnSync(process.execPath, [cli, command, "--host", "claude-code", "--workspace", workspace, "--plugin-root", pluginRoot, "--json", ...extra], { cwd: workspace, encoding: "utf8", env: { ...process.env, YASASHII_UPDATE_TEST_MODE: "fixture" } });
}
function parsed(result) { try { return JSON.parse(result.stdout); } catch { return {}; } }
function mutateSession(fixture, change) { const value = JSON.parse(readFileSync(fixture.sessionPath, "utf8")); change(value); json(fixture.sessionPath, value); }

try {
  for (const fromVersion of historicalSupported) {
    const plugin = configurePlugin(`target-${fromVersion}`, "0.13.0");
    const fixture = makeWorkspace(`workspace-${fromVersion}`, fromVersion, { crlf: fromVersion === "0.10.1" });
    const beforeManagedBytes = readFileSync(join(fixture.workspace, "secretary/AGENTS.md"));
    const beforeManagedMtime = lstatSync(join(fixture.workspace, "secretary/AGENTS.md")).mtimeMs;
    const beforeModes = [lstatSync(join(fixture.workspace, "secretary/AGENTS.md")).mode & 0o777, lstatSync(join(fixture.workspace, "secretary/CLAUDE.md")).mode & 0o777];
    const dry = invoke("resume", fixture.workspace, plugin);
    const dryData = parsed(dry);
    const applied = invoke("resume", fixture.workspace, plugin, ["--apply", "--plan-hash", dryData.plan?.planHash ?? "missing"]);
    const appliedData = parsed(applied);
    const again = invoke("resume", fixture.workspace, plugin);
    check(`${fromVersion}->0.13.0 dry-run/apply/idempotent`, dry.status === 0 && applied.status === 0 && again.status === 0 && parsed(again).migrationCount === 0, `${dry.stderr}${applied.stderr}${again.stderr}`);
    check(`${fromVersion}->0.13.0 path and content counts`, dryData.plan?.fromVersion === fromVersion && dryData.plan?.toVersion === "0.13.0" && dryData.plan?.versionPath?.[0] === fromVersion && dryData.plan?.versionPath?.at(-1) === "0.13.0" && dryData.plan?.items.every((item) => !item.conflict) && appliedData.contentWriteCount === dryData.plan?.contentWriteCount);
    process.stdout.write(`ROUTE ${fromVersion}->0.13.0 change=${dryData.plan?.change.length ?? -1} keep=${dryData.plan?.keep.length ?? -1} conflicts=${dryData.plan?.items.filter((item) => item.conflict).map((item) => item.id).join(",") || "none"} contentWrites=${appliedData.contentWriteCount ?? -1}\n`);
    check(`${fromVersion}->0.13.0 user bytes/mode preserved`, readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8").startsWith("USER-PREFIX") && readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8").endsWith("USER-SUFFIX\r\n".replace("\r\n", fromVersion === "0.10.1" ? "\r\n" : "\n")) && beforeModes[0] === (lstatSync(join(fixture.workspace, "secretary/AGENTS.md")).mode & 0o777) && beforeModes[1] === (lstatSync(join(fixture.workspace, "secretary/CLAUDE.md")).mode & 0o777));
    if (fromVersion === "0.10.1") {
      const finalAgents = readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8");
      check("0.10.1 management sections reach current meaning", finalAgents.includes("request hedgeとcontent hedgeを分ける") && finalAgents.includes("Project Clarityは任意です") && !finalAgents.includes("推測、曖昧、引用、伝聞、仮定、訂正、取り消し"));
    }
    check(`${fromVersion}->0.13.0 keeps the Yasashii Clarity marker`, readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8").includes("yasashii-secretary:clarity-collaboration:workspace-template:v1") && !readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8").includes("agentic-secretary:clarity-collaboration:workspace-template:v1"));
    if (fromVersion === "0.12.0") check("0.12.0 empty hop has zero content writes", dryData.plan?.contentWriteCount === 0 && appliedData.contentWriteCount === 0 && readFileSync(join(fixture.workspace, "secretary/AGENTS.md")).equals(beforeManagedBytes) && lstatSync(join(fixture.workspace, "secretary/AGENTS.md")).mtimeMs === beforeManagedMtime);
  }

  for (const fromVersion of currentSupported) {
    const plugin = configurePlugin(`current-target-${fromVersion}`, "0.13.1");
    const fixture = makeWorkspace(`current-workspace-${fromVersion}`, fromVersion, { oldTarget: "0.13.1", crlf: fromVersion === "0.10.1" });
    const beforeManaged = ["secretary/AGENTS.md", "secretary/CLAUDE.md"].map((path) => ({
      path,
      bytes: readFileSync(join(fixture.workspace, path)),
      mtime: lstatSync(join(fixture.workspace, path)).mtimeMs,
    }));
    const firstDry = invoke("resume", fixture.workspace, plugin);
    const firstPlan = parsed(firstDry).plan;
    const secondDry = invoke("resume", fixture.workspace, plugin);
    const secondPlan = parsed(secondDry).plan;
    const applied = invoke("resume", fixture.workspace, plugin, ["--apply", "--plan-hash", firstPlan?.planHash ?? "missing"]);
    const appliedSession = JSON.parse(readFileSync(fixture.sessionPath, "utf8"));
    const again = invoke("resume", fixture.workspace, plugin);
    check(`${fromVersion}->0.13.1 real distribution path is finite and deterministic`, firstDry.status === 0 && secondDry.status === 0 && firstPlan?.fromVersion === fromVersion && firstPlan?.toVersion === "0.13.1" && firstPlan?.versionPath?.[0] === fromVersion && firstPlan?.versionPath?.at(-1) === "0.13.1" && JSON.stringify(firstPlan?.versionPath) === JSON.stringify(secondPlan?.versionPath));
    check(`${fromVersion}->0.13.1 dry-run/apply/idempotent`, applied.status === 0 && again.status === 0 && parsed(again).migrationCount === 0, `${firstDry.stderr}${applied.stderr}${again.stderr}`);
    if (fromVersion === "0.13.0") {
      check("0.13.0->0.13.1 empty hop has zero workspace content writes", firstPlan?.contentWriteCount === 0 && parsed(applied).contentWriteCount === 0 && appliedSession.migration?.changedPaths?.length === 0 && beforeManaged.every(({ path, bytes, mtime }) => readFileSync(join(fixture.workspace, path)).equals(bytes) && lstatSync(join(fixture.workspace, path)).mtimeMs === mtime));
    }
    check(`${fromVersion}->0.13.1 preserves the Yasashii edition marker`, readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8").includes("yasashii-secretary:clarity-collaboration:workspace-template:v1") && !readFileSync(join(fixture.workspace, "secretary/AGENTS.md"), "utf8").includes("agentic-secretary:clarity-collaboration:workspace-template:v1"));
  }

  const negativePlugin = configurePlugin("negative-target", "0.13.0");
  const keep = makeWorkspace("keep-customized", "0.10.1");
  mutateSession(keep, (session) => { session.selections["secretary/AGENTS.md"] = "keep"; });
  const keepDry = parsed(invoke("resume", keep.workspace, negativePlugin));
  const keepApplied = invoke("resume", keep.workspace, negativePlugin, ["--apply", "--plan-hash", keepDry.plan.planHash]);
  check("explicit keep preserves a customized managed file", keepApplied.status === 0 && readFileSync(join(keep.workspace, "secretary/AGENTS.md"), "utf8") === keep.beforeAgents && keepDry.plan.keep.includes("secretary/AGENTS.md"));

  const markerConflict = makeWorkspace("marker-conflict", "0.10.1", { agentsExtra: "request hedgeとcontent hedgeを分ける\n" });
  const markerDry = invoke("resume", markerConflict.workspace, negativePlugin);
  const markerData = parsed(markerDry);
  check("unexpected or one-sided marker content is kept as conflict", markerDry.status === 0 && markerData.plan.items.some((item) => item.path === "secretary/AGENTS.md" && item.conflict) && markerData.plan.items.filter((item) => item.path === "secretary/AGENTS.md").every((item) => item.action !== "change"));

  const stale = makeWorkspace("stale-plan", "0.10.1");
  const staleDry = parsed(invoke("resume", stale.workspace, negativePlugin));
  writeFileSync(join(stale.workspace, "secretary/AGENTS.md"), `${stale.beforeAgents}later user edit\n`);
  const staleApply = invoke("resume", stale.workspace, negativePlugin, ["--apply", "--plan-hash", staleDry.plan.planHash]);
  check("stale plan refuses before migration write", staleApply.status === 3 && readFileSync(join(stale.workspace, "secretary/CLAUDE.md"), "utf8") === stale.beforeClaude);

  const secret = makeWorkspace("secret-content", "0.10.1", { agentsExtra: "password = supersecret123\n" });
  const secretDry = parsed(invoke("resume", secret.workspace, negativePlugin));
  const secretApply = invoke("resume", secret.workspace, negativePlugin, ["--apply", "--plan-hash", secretDry.plan.planHash]);
  check("Secret-like managed content refuses before write", secretApply.status === 3 && readFileSync(join(secret.workspace, "secretary/AGENTS.md"), "utf8") === secret.beforeAgents);

  const readOnly = makeWorkspace("read-only", "0.10.1");
  chmodSync(join(readOnly.workspace, "secretary/AGENTS.md"), 0o444);
  const readOnlyResult = invoke("resume", readOnly.workspace, negativePlugin);
  check("read-only managed file is refused", readOnlyResult.status === 3 && /read-only/u.test(readOnlyResult.stderr));

  const badScope = makeWorkspace("bad-scope", "0.10.1");
  mutateSession(badScope, (session) => { session.scope = "mystery"; });
  const badScopeResult = invoke("resume", badScope.workspace, negativePlugin);
  check("invalid saved scope is refused without session rewrite", badScopeResult.status === 3);

  const badBackup = makeWorkspace("bad-backup", "0.10.1");
  writeFileSync(join(dirname(badBackup.sessionPath), "plugin-backup/skills/update/SKILL.md"), "tampered\n");
  const badBackupResult = invoke("resume", badBackup.workspace, negativePlugin);
  check("modified plugin backup is refused", badBackupResult.status === 3 && /退避物/u.test(badBackupResult.stderr));

  const badHead = makeWorkspace("bad-head", "0.10.1");
  git(badHead.workspace, ["commit", "--allow-empty", "-qm", "unexpected head"]);
  const badHeadDry = parsed(invoke("resume", badHead.workspace, negativePlugin));
  const badHeadApply = invoke("resume", badHead.workspace, negativePlugin, ["--apply", "--plan-hash", badHeadDry.plan.planHash]);
  check("HEAD mismatch is refused before migration write", badHeadApply.status === 3 && readFileSync(join(badHead.workspace, "secretary/AGENTS.md"), "utf8") === badHead.beforeAgents);

  const wrongEdition = makeWorkspace("wrong-edition", "0.10.1");
  json(join(wrongEdition.workspace, config.workspaceProtection.canonicalMarker), { schemaVersion: config.workspaceProtection.markerSchemaVersion, edition: "other-edition" });
  const wrongEditionResult = invoke("resume", wrongEdition.workspace, negativePlugin);
  check("edition mismatch is refused before migration", wrongEditionResult.status === 3);

  const linked = makeWorkspace("linked-managed", "0.10.1");
  const outside = join(fixtureRoot, "outside-agents.md");
  writeFileSync(outside, "outside unchanged\n");
  unlinkSync(join(linked.workspace, "secretary/AGENTS.md"));
  symlinkSync(outside, join(linked.workspace, "secretary/AGENTS.md"));
  const linkedResult = invoke("resume", linked.workspace, negativePlugin);
  check("managed symlink is refused without outside write", linkedResult.status === 3 && readFileSync(outside, "utf8") === "outside unchanged\n");

  const partialResumePlugin = configurePlugin("partial-resume-target", "0.13.0");
  const partialResume = makeWorkspace("partial-resume", "0.10.1");
  const partialDry = parsed(invoke("resume", partialResume.workspace, partialResumePlugin));
  const interrupted = invoke("resume", partialResume.workspace, partialResumePlugin, ["--apply", "--plan-hash", partialDry.plan.planHash, "--test-fail-after", "ledger-write"]);
  const interruptedSession = JSON.parse(readFileSync(partialResume.sessionPath, "utf8"));
  const resumed = invoke("resume", partialResume.workspace, partialResumePlugin, ["--apply", "--plan-hash", partialDry.plan.planHash]);
  const resumedSession = JSON.parse(readFileSync(partialResume.sessionPath, "utf8"));
  const partialRolled = invoke("rollback", partialResume.workspace, partialResumePlugin);
  check("partial ledger interruption resumes without duplicate content writes", interrupted.status === 4 && interruptedSession.migration.ledgerChanged === true && resumed.status === 0 && resumedSession.migration.contentWriteCount === partialDry.plan.contentWriteCount);
  check("partial resume keeps rollback ownership for ledger and managed files", partialRolled.status === 0 && readFileSync(join(partialResume.workspace, "secretary/AGENTS.md"), "utf8") === partialResume.beforeAgents);

  const futurePlugin = configurePlugin("target-0.13.1", "0.13.1");
  const recovery = makeWorkspace("pending-recovery", "0.10.1", { oldTarget: "0.13.0" });
  const recoveredDry = invoke("resume", recovery.workspace, futurePlugin);
  const recoveredData = parsed(recoveredDry);
  const recoveredSession = JSON.parse(readFileSync(recovery.sessionPath, "utf8"));
  const recoveredApply = invoke("resume", recovery.workspace, futurePlugin, ["--apply", "--plan-hash", recoveredData.plan?.planHash ?? "missing"]);
  const rolled = invoke("rollback", recovery.workspace, futurePlugin);
  const rolledData = parsed(rolled);
  check("pending 0.13.0 session recovers only with a new plan", recoveredDry.status === 0 && recoveredData.plan?.toVersion === "0.13.1" && recoveredData.plan?.targetRecovery?.fromTarget === "0.13.0" && recoveredData.plan?.targetRecovery?.toTarget === "0.13.1" && recoveredSession.originalTargetVersion === "0.13.0" && recoveredSession.targetRecovery?.workspaceWritesBeforeRecovery === 0);
  process.stdout.write(`RECOVERY 0.10.1->0.13.0=>0.13.1 phase=${recoveredSession.phase} protection=${recoveredSession.protectionCommit === recovery.protectionCommit} backupTree=${recoveredSession.pluginBackup.treeHash === recovery.backupTree} contentWrites=${parsed(recoveredApply).contentWriteCount ?? -1}\n`);
  check("recovered session applies then restores original workspace/plugin", recoveredApply.status === 0 && rolled.status === 0 && rolledData.workspaceRestored === true && rolledData.pluginRestored === true && readFileSync(join(recovery.workspace, "secretary/AGENTS.md"), "utf8") === recovery.beforeAgents && JSON.parse(readFileSync(join(futurePlugin, ".claude-plugin/plugin.json"), "utf8")).version === "0.10.1");

  const partialPlugin = configurePlugin("partial-target", "0.13.1");
  const partial = makeWorkspace("partial-recovery", "0.10.1", { oldTarget: "0.13.0", partial: true });
  const partialBefore = readFileSync(partial.sessionPath);
  const refusedPartial = invoke("resume", partial.workspace, partialPlugin);
  check("partial session refuses target substitution without session write", refusedPartial.status === 3 && readFileSync(partial.sessionPath).equals(partialBefore));

  for (const unsupported of ["0.7.0", "0.11.0", "9.9.9"]) {
    const plugin = configurePlugin(`unsupported-target-${unsupported}`, "0.13.0");
    const fixture = makeWorkspace(`unsupported-${unsupported}`, unsupported);
    const before = readFileSync(join(fixture.workspace, "secretary/AGENTS.md"));
    const result = invoke("resume", fixture.workspace, plugin);
    check(`unsupported ${unsupported} refuses with zero workspace writes`, result.status === 3 && readFileSync(join(fixture.workspace, "secretary/AGENTS.md")).equals(before) && /対応版ではありません|対応するversion別migration|downgrade/u.test(result.stderr));
  }

  const crlfPlugin = configurePlugin("crlf-distribution-target", "0.13.0");
  const crlfAsset = join(crlfPlugin, "migrations/assets/memory-request-v1.md");
  writeFileSync(crlfAsset, readFileSync(crlfAsset, "utf8").replace(/(?<!\r)\n/gu, "\r\n"));
  const crlfDistribution = makeWorkspace("crlf-distribution", "0.10.1");
  const crlfDry = invoke("resume", crlfDistribution.workspace, crlfPlugin);
  check("CRLF distribution asset matches the LF fingerprint", crlfDry.status === 0 && parsed(crlfDry).plan?.items.some((item) => item.id === "memory-request-v2"), crlfDry.stderr);

  const tamperedPlugin = configurePlugin("tampered-distribution-target", "0.13.0");
  const tamperedAsset = join(tamperedPlugin, "migrations/assets/memory-request-v1.md");
  writeFileSync(tamperedAsset, readFileSync(tamperedAsset, "utf8").replace("記憶", "改ざん"));
  const tampered = makeWorkspace("tampered-distribution", "0.10.1");
  const tamperedBefore = readFileSync(tampered.sessionPath);
  const tamperedWorkspaceBefore = inspectTree(tampered.workspace).treeHash;
  const tamperedHeadBefore = git(tampered.workspace, ["rev-parse", "HEAD"]);
  const tamperedResult = invoke("resume", tampered.workspace, tamperedPlugin);
  check("non-line-ending distribution tampering is refused before writes", tamperedResult.status === 3 && /fingerprint/u.test(tamperedResult.stderr) && readFileSync(tampered.sessionPath).equals(tamperedBefore) && inspectTree(tampered.workspace).treeHash === tamperedWorkspaceBefore && git(tampered.workspace, ["rev-parse", "HEAD"]) === tamperedHeadBefore);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write(`SPRINT056_PATCH001_PASS=${pass} SPRINT056_PATCH001_FAIL=${fail}\n`);
process.exitCode = fail ? 1 : 0;
