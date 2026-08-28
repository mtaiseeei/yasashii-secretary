#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyTreeNoFollow } from "../plugins/secretary/scripts/lib/safe-fs.mjs";
import {
  ACTOR_TYPE, authorMetadata, createIdentity, readIdentity, suggestSecretaryName, validateSecretaryName, writeNewIdentity,
} from "../plugins/secretary/scripts/lib/secretary-identity.mjs";
import { classifyNameRouting } from "../plugins/secretary/scripts/lib/name-router.mjs";
import { applyRename, previewRename } from "../plugins/secretary/scripts/lib/secretary-rename.mjs";
import { composeManagedBlock, inspectUserScopeRouting, updateUserScopeRouting } from "../plugins/secretary/scripts/lib/user-scope-routing.mjs";
import { readRegistry, registerWorkspace, registryContainsOnlyAllowedMetadata, resolveCanonicalWorkspace } from "../plugins/secretary/scripts/lib/workspace-registry.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = mkdtempSync(join(tmpdir(), "sprint-039-"));
let pass = 0;
let fail = 0;

function sha(path) { return existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null; }
function treeSnapshot(root) {
  if (!existsSync(root)) return [];
  const rows = [];
  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const target = join(path, entry.name);
      const rel = target.slice(root.length + 1);
      if (entry.isSymbolicLink()) rows.push([rel, "symlink"]);
      else if (entry.isDirectory()) walk(target);
      else rows.push([rel, sha(target)]);
    }
  }
  walk(root); return rows;
}
function check(label, fn) {
  try { fn(); pass += 1; process.stdout.write(`PASS ${label}\n`); }
  catch (error) { fail += 1; process.stdout.write(`FAIL ${label}: ${error?.stack || error}\n`); }
}
function throwsNoMutation(label, root, fn, pattern) {
  check(label, () => { const before = treeSnapshot(root); assert.throws(fn, pattern); assert.deepEqual(treeSnapshot(root), before); });
}
function makeHome(name) { const home = join(sandbox, name); mkdirSync(home, { recursive: true }); return home; }
function commitFixture(workspace, message = "fixture baseline") {
  execFileSync("git", ["add", "-A"], { cwd: workspace, stdio: "ignore" });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: workspace, stdio: "ignore" });
}
function makeWorkspace(name, { edition = "yasashii-secretary", secretaryId = randomUUID(), displayName = "Alex" } = {}) {
  const workspace = join(sandbox, name);
  const secretary = join(workspace, "secretary");
  mkdirSync(join(secretary, "memory", "journal"), { recursive: true });
  mkdirSync(join(secretary, "memory", "decisions"), { recursive: true });
  mkdirSync(join(secretary, "docs"), { recursive: true });
  mkdirSync(join(secretary, "projects"), { recursive: true });
  mkdirSync(join(secretary, "inbox"), { recursive: true });
  mkdirSync(join(workspace, ".secretary"), { recursive: true });
  writeFileSync(join(workspace, ".secretary", "workspace-edition.json"), `${JSON.stringify({ schemaVersion: 1, edition })}\n`);
  writeFileSync(join(secretary, "AGENTS.md"), `# Secretary\n\n- owner-call-name: Taisei\n- 表示名: ${displayName} (AI Secretary)\n`);
  writeFileSync(join(secretary, "memory", "MEMORY.md"), "# Memory\n\n- owner-call-name: Taisei\n");
  writeFileSync(join(secretary, "identity.json"), `${JSON.stringify(createIdentity({ displayName, secretaryId, createdAt: "2026-08-14T00:00:00.000Z" }), null, 2)}\n`);
  execFileSync("git", ["init", "-q"], { cwd: workspace });
  execFileSync("git", ["config", "user.name", "Fixture User"], { cwd: workspace });
  execFileSync("git", ["config", "user.email", "fixture@example.invalid"], { cwd: workspace });
  commitFixture(workspace);
  return { workspace, secretary, secretaryId };
}

const realHomeTargets = [join(homedir(), ".codex", "AGENTS.md"), join(homedir(), ".codex", "AGENTS.override.md"), join(homedir(), ".claude", "CLAUDE.md")];
const realHomeBefore = realHomeTargets.map((path) => [path, sha(path)]);

try {
  check("英語名Alexを受理", () => assert.deepEqual(validateSecretaryName("Alex"), { accepted: true, reason: null, normalized: "Alex" }));
  for (const [label, value] of [["空", ""], ["日本語", "あれっくす"], ["email", "a@example.com"], ["path", "../Alex"], ["command", "sudo rm"], ["generic", "Bot"], ["control", "Al\u0007ex"]]) {
    check(`不適格名を拒否: ${label}`, () => assert.equal(validateSecretaryName(value).accepted, false));
  }
  check("おまかせ候補は英語名と理由を返す", () => { const item = suggestSecretaryName({ seed: "fixture" }); assert.equal(validateSecretaryName(item.name).accepted, true); assert.ok(item.reason.length > 5); });

  const initRoot = join(sandbox, "init", "secretary");
  mkdirSync(join(initRoot, "memory"), { recursive: true });
  writeFileSync(join(initRoot, "AGENTS.md"), "- owner-call-name: Taisei\n");
  writeFileSync(join(initRoot, "memory", "MEMORY.md"), "- owner-call-name: Taisei\n");
  throwsNoMutation("初回identityは確認前write 0", initRoot, () => writeNewIdentity(initRoot, { displayName: "Alex" }), /確認前/u);
  check("確認後だけstable identityを作成", () => { const result = writeNewIdentity(initRoot, { displayName: "Alex", secretaryId: "11111111-1111-4111-8111-111111111111", now: "2026-08-14T00:00:00.000Z", confirm: true }); assert.equal(result.identity.actor_type, ACTOR_TYPE); assert.match(result.identity.secretary_id, /^[0-9a-f-]{36}$/u); assert.match(readFileSync(join(initRoot, "AGENTS.md"), "utf8"), /Taisei/u); });
  check("同じ初回identityの再実行は差分0", () => { const before = treeSnapshot(initRoot); assert.equal(writeNewIdentity(initRoot, { displayName: "Alex", confirm: true }).status, "unchanged"); assert.deepEqual(treeSnapshot(initRoot), before); });
  check("AI author metadataはhumanと識別可能", () => assert.deepEqual(authorMetadata(readIdentity(initRoot)), { author: "Alex (AI Secretary)", author_id: "11111111-1111-4111-8111-111111111111", author_type: "ai-secretary" }));

  const home = makeHome("home-normal"); mkdirSync(join(home, ".codex")); mkdirSync(join(home, ".claude"));
  writeFileSync(join(home, ".codex", "AGENTS.md"), "USER-CONTENT\r\n\r\n<!-- other:block:start -->\r\nKEEP\r\n<!-- other:block:end -->\r\n");
  writeFileSync(join(home, ".claude", "CLAUDE.md"), "CLAUDE-KEEP\n");
  const identity = readIdentity(initRoot);
  throwsNoMutation("user-scopeは確認前write 0", home, () => updateUserScopeRouting({ home, identity }), /明示確認前/u);
  check("Codex通常AGENTSとClaude CLAUDEへmanaged blockを作成", () => { const result = updateUserScopeRouting({ home, identity, confirm: true }); assert.equal(result.status, "enabled"); assert.match(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8"), /USER-CONTENT\r\n/u); assert.match(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8"), /other:block/u); assert.match(readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8"), /CLAUDE-KEEP/u); });
  check("managed block再実行は差分0", () => { const before = treeSnapshot(home); assert.equal(updateUserScopeRouting({ home, identity, confirm: true }).status, "unchanged"); assert.deepEqual(treeSnapshot(home), before); });
  check("routing無効化はidentityを消さず他blockを保持", () => { const idBefore = sha(join(initRoot, "identity.json")); updateUserScopeRouting({ home, identity, operation: "disable", confirm: true }); assert.doesNotMatch(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8"), /name-routing/u); assert.match(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8"), /other:block/u); assert.equal(sha(join(initRoot, "identity.json")), idBefore); });

  const overrideHome = makeHome("home-override"); mkdirSync(join(overrideHome, ".codex")); mkdirSync(join(overrideHome, ".claude"));
  writeFileSync(join(overrideHome, ".codex", "AGENTS.md"), "REGULAR\n"); writeFileSync(join(overrideHome, ".codex", "AGENTS.override.md"), "OVERRIDE\n");
  check("Codex overrideがあればoverrideだけを更新", () => { updateUserScopeRouting({ home: overrideHome, identity, hosts: ["codex"], confirm: true }); assert.equal(readFileSync(join(overrideHome, ".codex", "AGENTS.md"), "utf8"), "REGULAR\n"); assert.match(readFileSync(join(overrideHome, ".codex", "AGENTS.override.md"), "utf8"), /name-routing/u); });
  const duplicateHome = makeHome("home-duplicate"); mkdirSync(join(duplicateHome, ".codex")); const block = composeManagedBlock("", identity).content; writeFileSync(join(duplicateHome, ".codex", "AGENTS.md"), `${block}${block}`);
  throwsNoMutation("重複managed blockは変更せず停止", duplicateHome, () => updateUserScopeRouting({ home: duplicateHome, identity, hosts: ["codex"], confirm: true }), /重複/u);
  const rollbackHome = makeHome("home-rollback"); mkdirSync(join(rollbackHome, ".codex")); mkdirSync(join(rollbackHome, ".claude")); writeFileSync(join(rollbackHome, ".codex", "AGENTS.md"), "A\n"); writeFileSync(join(rollbackHome, ".claude", "CLAUDE.md"), "B\n");
  throwsNoMutation("user-scope部分失敗は全file rollback", rollbackHome, () => updateUserScopeRouting({ home: rollbackHome, identity, confirm: true, failAt: "before-write-2" }), /部分書込み/u);
  const symlinkHome = makeHome("home-symlink"); const outside = join(sandbox, "outside-agents"); writeFileSync(outside, "OUTSIDE\n"); mkdirSync(join(symlinkHome, ".codex")); symlinkSync(outside, join(symlinkHome, ".codex", "AGENTS.md"));
  throwsNoMutation("user-scope symlink境界を拒否", symlinkHome, () => updateUserScopeRouting({ home: symlinkHome, identity, hosts: ["codex"], confirm: true }), /symlink/u);
  const readonlyHome = makeHome("home-readonly"); mkdirSync(join(readonlyHome, ".codex")); writeFileSync(join(readonlyHome, ".codex", "AGENTS.md"), "READONLY\n"); chmodSync(join(readonlyHome, ".codex", "AGENTS.md"), 0o444);
  throwsNoMutation("read-only user-scope fileを拒否", readonlyHome, () => updateUserScopeRouting({ home: readonlyHome, identity, hosts: ["codex"], confirm: true }), /read-only/u); chmodSync(join(readonlyHome, ".codex", "AGENTS.md"), 0o644);

  const canonical = makeWorkspace("canonical"); const registryHome = makeHome("registry-home");
  throwsNoMutation("registryは確認前write 0", registryHome, () => registerWorkspace({ home: registryHome, workspace: canonical.workspace, edition: "yasashii-secretary" }), /明示確認前/u);
  check("registryは最小metadataだけを保存", () => { registerWorkspace({ home: registryHome, workspace: canonical.workspace, edition: "yasashii-secretary", confirm: true }); const registry = readRegistry(registryHome); assert.equal(registryContainsOnlyAllowedMetadata(registry), true); const text = JSON.stringify(registry); for (const forbidden of ["memory_body", "conversation_body", "customer_name", "api_token", "Alex"]) assert.doesNotMatch(text, new RegExp(forbidden, "iu")); });
  const foreign = join(sandbox, "foreign-repo"); mkdirSync(foreign); const foreignBefore = treeSnapshot(foreign);
  check("別repo cwdからcanonical workspaceを副作用0で解決", () => { const result = resolveCanonicalWorkspace({ home: registryHome, edition: "yasashii-secretary" }); assert.equal(result.status, "resolved"); assert.equal(result.workspace, realpathSync(canonical.workspace)); assert.deepEqual(treeSnapshot(foreign), foreignBefore); assert.equal(existsSync(join(foreign, "secretary")), false); });
  check("registry再登録は差分0", () => { const before = treeSnapshot(registryHome); assert.equal(registerWorkspace({ home: registryHome, workspace: canonical.workspace, edition: "yasashii-secretary", confirm: true }).status, "unchanged"); assert.deepEqual(treeSnapshot(registryHome), before); });
  const missingHome = makeHome("registry-missing"); check("registry欠落はsafe stop", () => assert.equal(resolveCanonicalWorkspace({ home: missingHome }).status, "registry-missing"));
  const opposite = makeWorkspace("opposite", { edition: "agentic-secretary" }); check("反対edition登録を拒否", () => assert.throws(() => registerWorkspace({ home: makeHome("opposite-home"), workspace: opposite.workspace, edition: "yasashii-secretary", confirm: true }), /opposite-edition/u));
  const symlinkWorkspace = join(sandbox, "canonical-link"); symlinkSync(canonical.workspace, symlinkWorkspace); check("workspace symlinkを安全停止", () => assert.throws(() => registerWorkspace({ home: makeHome("link-home"), workspace: symlinkWorkspace, edition: "yasashii-secretary", confirm: true }), /unsafe-workspace/u));
  const moved = join(sandbox, "canonical-moved"); renameSync(canonical.workspace, moved); check("移動前registryはmissingを返す", () => assert.equal(resolveCanonicalWorkspace({ home: registryHome }).status, "missing")); check("同じstable IDの移動先を再登録", () => { assert.equal(registerWorkspace({ home: registryHome, workspace: moved, edition: "yasashii-secretary", confirm: true }).status, "moved"); assert.equal(resolveCanonicalWorkspace({ home: registryHome }).workspace, realpathSync(moved)); });
  const duplicateRegistry = readRegistry(registryHome); duplicateRegistry.workspaces.push({ ...duplicateRegistry.workspaces[0] }); writeFileSync(join(registryHome, ".agentic-secretary", "workspaces.json"), `${JSON.stringify(duplicateRegistry)}\n`); check("registry重複はresolveを停止", () => assert.equal(resolveCanonicalWorkspace({ home: registryHome }).status, "duplicate"));

  for (const text of ["Alex、今日の予定を整理して", "Alexに聞いて、結果をまとめて"]) check(`名前routing正case: ${text}`, () => assert.equal(classifyNameRouting(text, identity).action, "route"));
  for (const text of ["取引先のAlexさんにメールして", "著者Alexの本", "author: Alex", "「Alexに聞いて」引用です", "`Alexに聞いて`", "ファイル本文にAlexとあります", "顧客Alexの契約"]) check(`名前routing negative: ${text}`, () => assert.equal(classifyNameRouting(text, identity).action, "none"));
  const morganIdentity = { ...identity, display_name: "Morgan", aliases: ["Alex"] };
  for (const text of ["Morgan、顧客への提案書を作って", "Morgan、取引先の予定を整理して", "Morgan、著者Alexの本を調べて", "Morgan、「Q3」の文言を直して"]) {
    check(`直接呼びかけ後の依頼本文はroutingを抑止しない: ${text}`, () => assert.equal(classifyNameRouting(text, morganIdentity).action, "route"));
  }
  for (const text of ["Morganさんに聞いて", "取引先Morganに聞いて", "author Morganに聞いて", "「Morgan、顧客への提案書を作って」", "`Morgan、顧客への提案書を作って`"]) {
    check(`人間・引用・code内だけの同名はroutingしない: ${text}`, () => assert.equal(classifyNameRouting(text, morganIdentity).action, "none"));
  }
  check("曖昧caseは一度だけ確認", () => { assert.equal(classifyNameRouting("Alex", identity).action, "confirm"); assert.equal(classifyNameRouting("Alex", identity, { alreadyAsked: true }).action, "none"); });

  const neverEnabledRename = makeWorkspace("rename-never-enabled"); const neverEnabledHome = makeHome("rename-never-enabled-home"); mkdirSync(join(neverEnabledHome, ".codex")); mkdirSync(join(neverEnabledHome, ".claude")); writeFileSync(join(neverEnabledHome, ".codex", "AGENTS.md"), "利用者メモ Alex は人間です。\n"); writeFileSync(join(neverEnabledHome, ".claude", "CLAUDE.md"), "CLAUDE KEEP Alex\n");
  check("renameは未作成routingを有効化せずuser-scope本文も変更しない", () => { const before = treeSnapshot(neverEnabledHome); const previewResult = previewRename({ secretaryRoot: neverEnabledRename.secretary, newName: "Morgan", home: neverEnabledHome }); assert.equal(previewResult.matches.some((item) => item.scope === "user"), false); applyRename({ secretaryRoot: neverEnabledRename.secretary, newName: "Morgan", home: neverEnabledHome, confirm: true, confirmedClasses: ["current-config"] }); assert.deepEqual(treeSnapshot(neverEnabledHome), before); assert.ok(inspectUserScopeRouting({ home: neverEnabledHome }).every((item) => !item.enabled)); });
  const disabledRename = makeWorkspace("rename-disabled"); const disabledHome = makeHome("rename-disabled-home"); mkdirSync(join(disabledHome, ".codex")); mkdirSync(join(disabledHome, ".claude")); updateUserScopeRouting({ home: disabledHome, identity: readIdentity(disabledRename.secretary), confirm: true }); updateUserScopeRouting({ home: disabledHome, identity: readIdentity(disabledRename.secretary), operation: "disable", confirm: true });
  check("renameは明示disable済みroutingをdisabledのまま保つ", () => { const before = treeSnapshot(disabledHome); applyRename({ secretaryRoot: disabledRename.secretary, newName: "Morgan", home: disabledHome, confirm: true, confirmedClasses: ["current-config"] }); assert.deepEqual(treeSnapshot(disabledHome), before); assert.ok(inspectUserScopeRouting({ home: disabledHome }).every((item) => !item.enabled)); });

  const renameFixture = makeWorkspace("rename"); const renameHome = makeHome("rename-home"); mkdirSync(join(renameHome, ".codex")); mkdirSync(join(renameHome, ".claude")); updateUserScopeRouting({ home: renameHome, identity: readIdentity(renameFixture.secretary), confirm: true });
  const agentsTemplate = readFileSync(join(ROOT, "plugins/secretary/templates/AGENTS.md"), "utf8")
    .replaceAll("{{SECRETARY_NAME}}", "Alex")
    .replaceAll("{{SECRETARY_ID}}", renameFixture.secretaryId);
  writeFileSync(join(renameFixture.secretary, "AGENTS.md"), `${agentsTemplate}\n- 顧客Alexの案件は変更しない\n`);
  writeFileSync(join(renameFixture.secretary, "docs", "note.md"), "Alexが作った現在の案です。\n");
  writeFileSync(join(renameFixture.secretary, "memory", "journal", "2026-08-14.md"), "author: Alex (AI Secretary)\nauthor_id: stable\n");
  writeFileSync(join(renameFixture.secretary, "misc.txt"), "所有不明 Alex\n");
  commitFixture(renameFixture.workspace, "rename fixture content");
  const previewBefore = treeSnapshot(renameFixture.workspace); const homePreviewBefore = treeSnapshot(renameHome); const preview = previewRename({ secretaryRoot: renameFixture.secretary, newName: "Morgan", home: renameHome });
  check("rename previewはA-D分類とrollbackを示す", () => { assert.equal(preview.readOnly, true); for (const key of ["current-config", "user-content", "historical-author", "unknown-or-conflict"]) assert.ok(preview.counts[key] >= 1); assert.ok(preview.rollback); });
  check("rename preview前後snapshot一致", () => { assert.deepEqual(treeSnapshot(renameFixture.workspace), previewBefore); assert.deepEqual(treeSnapshot(renameHome), homePreviewBefore); });
  throwsNoMutation("rename apply確認前write 0", renameFixture.workspace, () => applyRename({ secretaryRoot: renameFixture.secretary, newName: "Morgan", home: renameHome }), /明示確認前/u);
  const historicalBefore = readFileSync(join(renameFixture.secretary, "memory", "journal", "2026-08-14.md")); const unknownBefore = readFileSync(join(renameFixture.secretary, "misc.txt"));
  check("renameはtemplateのidentity fieldだけを構造更新しcustom本文を保持", () => { assert.ok(preview.matches.some((item) => item.path === "AGENTS.md" && item.classification === "current-config" && item.ownedField === "identity-managed-section")); assert.ok(preview.matches.some((item) => item.path === "AGENTS.md" && item.classification === "unknown-or-conflict")); const result = applyRename({ secretaryRoot: renameFixture.secretary, newName: "Morgan", home: renameHome, confirm: true, confirmedClasses: ["current-config", "user-content"], selectedUserContent: ["docs/note.md"] }); const after = readIdentity(renameFixture.secretary); const agentsAfter = readFileSync(join(renameFixture.secretary, "AGENTS.md"), "utf8"); assert.equal(after.secretary_id, renameFixture.secretaryId); assert.deepEqual(after.aliases, ["Alex"]); assert.match(agentsAfter, /- 表示名: Morgan \(AI Secretary\)/u); assert.match(agentsAfter, /顧客Alexの案件は変更しない/u); assert.doesNotMatch(agentsAfter, /顧客Morgan/u); assert.match(readFileSync(join(renameFixture.secretary, "docs", "note.md"), "utf8"), /Morgan/u); assert.deepEqual(readFileSync(join(renameFixture.secretary, "memory", "journal", "2026-08-14.md")), historicalBefore); assert.deepEqual(readFileSync(join(renameFixture.secretary, "misc.txt")), unknownBefore); assert.match(readFileSync(join(renameHome, ".codex", "AGENTS.md"), "utf8"), /Morgan/u); assert.equal(result.preservedHistorical >= 1, true); });
  check("成功後の同名renameは差分と追加commit 0", () => { const beforeTree = treeSnapshot(renameFixture.workspace); const beforeHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: renameFixture.workspace, encoding: "utf8" }); const result = applyRename({ secretaryRoot: renameFixture.secretary, newName: "Morgan", confirm: true, confirmedClasses: ["current-config"] }); assert.equal(result.status, "unchanged"); assert.equal(result.checkpoint.status, "not-applicable"); assert.deepEqual(treeSnapshot(renameFixture.workspace), beforeTree); assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: renameFixture.workspace, encoding: "utf8" }), beforeHead); });
  throwsNoMutation("alias衝突renameは安全停止", renameFixture.workspace, () => applyRename({ secretaryRoot: renameFixture.secretary, newName: "Alex", confirm: true, confirmedClasses: ["current-config"] }), /alias/u);
  const rollbackRename = makeWorkspace("rename-rollback"); const rollbackRenameHome = makeHome("rename-rollback-home"); mkdirSync(join(rollbackRenameHome, ".codex")); mkdirSync(join(rollbackRenameHome, ".claude")); updateUserScopeRouting({ home: rollbackRenameHome, identity: readIdentity(rollbackRename.secretary), confirm: true }); writeFileSync(join(rollbackRename.secretary, "docs", "b.md"), "Alex text\n"); commitFixture(rollbackRename.workspace, "rollback fixture content"); const rrBefore = treeSnapshot(rollbackRename.workspace); const rrhBefore = treeSnapshot(rollbackRenameHome);
  check("rename途中失敗はworkspaceとuser-scopeをrollback", () => { assert.throws(() => applyRename({ secretaryRoot: rollbackRename.secretary, newName: "Taylor", home: rollbackRenameHome, confirm: true, confirmedClasses: ["current-config", "user-content"], selectedUserContent: ["docs/b.md"], failAt: "before-write-3" }), /部分書込み/u); assert.deepEqual(treeSnapshot(rollbackRename.workspace), rrBefore); assert.deepEqual(treeSnapshot(rollbackRenameHome), rrhBefore); });

  const authorWorkspace = makeWorkspace("author-workspace"); const body = "本文です。\n"; execFileSync(process.execPath, [join(ROOT, "plugins/secretary/scripts/workspace-tools.mjs"), "save-deliverable", authorWorkspace.secretary, "2026-08-14", "テスト成果物", "test"], { input: body, encoding: "utf8", env: { ...process.env, CC_SECRETARY_NOW: "2026-08-14T10:00:00+09:00" } });
  check("成果物frontmatterにAI author構造化metadata", () => { const text = readFileSync(join(authorWorkspace.secretary, "docs", "2026", "08", "2026-08-14_テスト成果物.md"), "utf8"); assert.match(text, /author: Alex \(AI Secretary\)/u); assert.match(text, /author_id: [0-9a-f-]{36}/u); assert.match(text, /author_type: ai-secretary/u); });

  check("固定Agentic handoffとoverlay snapshotを宣言", () => { const base = JSON.parse(readFileSync(join(ROOT, "secretary-overlay/upstream-base.json"), "utf8")); const snapshot = JSON.parse(readFileSync(join(ROOT, "secretary-overlay/upstream-tree.json"), "utf8")); assert.equal(base.baseCommit, "3ef792819a4a445df089f70aa74ca09176762e5e"); assert.equal(base.identityHandoff.commonTreeSha256, "a7d74a7a9bb42ea67815a75132acf588fe312314f98b7f9685cef97fdfca59c9"); assert.equal(snapshot.baseCommit, base.baseCommit); for (const path of ["plugins/secretary/skills/name/SKILL.md", "plugins/secretary/skills/secretary/SKILL.md", "plugins/secretary/skills/settings/SKILL.md", "plugins/secretary/skills/update/SKILL.md"]) { const entry = snapshot.files.find((item) => item.path === path); assert.ok(entry); assert.equal(entry.classification, "anchor-overlay"); } assert.match(readFileSync(join(ROOT, "plugins/secretary/skills/name/SKILL.md"), "utf8"), /--edition yasashii-secretary/u); assert.equal(snapshot.files.some((item) => item.path.startsWith("docs/progress/") && item.classification !== "repo-owned"), false); });
  check("実HOME・cache・実下流・remoteへwrite 0", () => assert.deepEqual(realHomeTargets.map((path) => [path, sha(path)]), realHomeBefore));
  check("name Skillはowner呼び方とidentityを分離", () => { const skill = readFileSync(join(ROOT, "plugins/secretary/skills/name/SKILL.md"), "utf8"); assert.match(skill, /利用者の「呼び方」と秘書自身の名前は別設定/u); assert.match(skill, /無条件grep置換/u); });
  check("onboardingは英語名確認前write 0を明記", () => { const skill = readFileSync(join(ROOT, "plugins/secretary/skills/onboarding/SKILL.md"), "utf8"); assert.match(skill, /明示了承までdirectory、identity、marker、registry、user-scope file、journal、commitを変更しない/u); });
  check("report-schemaはClarity Skillを含む正式22面を受理", () => { const output = execFileSync("python3", [join(ROOT, "scripts/check-report-schema.py"), "--plugin-root", join(ROOT, "plugins/secretary")], { encoding: "utf8" }); assert.match(output, /surfaces=22/u); });
  check("report-schemaは未知surfaceを件数一致でも拒否", () => { const copiedPlugin = join(sandbox, "schema-plugin"); copyTreeNoFollow(join(ROOT, "plugins/secretary"), copiedPlugin); rmSync(join(copiedPlugin, "skills", "name"), { recursive: true }); mkdirSync(join(copiedPlugin, "skills", "unknown")); writeFileSync(join(copiedPlugin, "skills", "unknown", "SKILL.md"), "# unknown\n\nrules/plain-language.md の最終応答serializerを使う。\n"); let observed = ""; try { execFileSync("python3", [join(ROOT, "scripts/check-report-schema.py"), "--plugin-root", copiedPlugin], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (error) { observed = `${error.stdout || ""}${error.stderr || ""}`; } assert.match(observed, /unexpected user-facing surface: skills\/unknown\/SKILL\.md/u); assert.match(observed, /expected user-facing surface missing from inventory: skills\/name\/SKILL\.md/u); });
  check("Claude/Codex共通CLIは構文上portable", () => execFileSync(process.execPath, ["--check", join(ROOT, "plugins/secretary/scripts/secretary-name.mjs")], { stdio: "ignore" }));
  check("routing状態検査はtargetごとにmanaged block 1件", () => { const state = inspectUserScopeRouting({ home: renameHome }); assert.equal(state.length, 2); assert.ok(state.every((item) => item.managedBlocks === 1)); });
} finally {
  try { chmodSync(join(sandbox, "home-readonly", ".codex", "AGENTS.md"), 0o644); } catch { /* fixtureなし */ }
  rmSync(sandbox, { recursive: true, force: true });
}

process.stdout.write(`SPRINT039_PASS=${pass} SPRINT039_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
