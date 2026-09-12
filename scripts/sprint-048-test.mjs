#!/usr/bin/env node

// Sprint 048: instruction routing and conditional-loading scenarios.
// This test exercises the Yasashii Secretary source only; it does not call a
// host connector or mutate a workspace.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { routeSecretaryIntent } from "../plugins/secretary/scripts/lib/collaboration-router.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");
const skillNames = readdirSync(join(root, "plugins/secretary/skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const skills = Object.fromEntries(skillNames.map((name) => [name, read(`plugins/secretary/skills/${name}/SKILL.md`)]));
const pass = [];
function check(label, fn) {
  fn(); pass.push(label); process.stdout.write(`PASS ${label}\n`);
}
function route(input, selectedSkill, routeName, delegation) {
  const observed = routeSecretaryIntent(input);
  assert.equal(observed.selectedSkill, selectedSkill, input);
  assert.equal(observed.route, routeName, input);
  if (delegation) assert.equal(observed.delegation, delegation, input);
  assert.deepEqual(observed.sideEffect, { performed: false, fileWrites: 0, adapterCalls: 0, commandCalls: 0, externalCalls: 0 }, input);
}

check("current request precedes optional resume", () => {
  const body = skills.secretary;
  assert(body.indexOf("現在の依頼") < body.indexOf("再起動しおり"));
  assert.match(body, /現在の依頼.*?先に|現在の用件.*?先/u);
  assert.match(body, /selectedSkill.*route.*delegation/su);
  assert.match(body, /secretary.*再帰.*読み込まず/su);
});

check("read routes use host connector while setup remains connection-only", () => {
  route("Gmailを検索して", "secretary", "google-read-only-handoff", "host-connector-read");
  route("Outlookの予定を確認して", "secretary", "microsoft-read-only-handoff", "host-connector-read");
  route("Googleにつなぎたい", "setup-google", "google-explicit-entry", "existing-explicit-connector-entry");
  route("Microsoft 365を設定して", "setup-microsoft", "microsoft-explicit-entry", "existing-explicit-connector-entry");
  route("Chatwork履歴を検索して", "chatwork", "chatwork-explicit-entry", "existing-explicit-connector-entry");
  route("Google Chatの履歴を検索して", "google-chat", "google-chat-explicit-entry", "existing-explicit-connector-entry");
  route("Googleの接続を診断して", "connections", "connections-read-only-diagnosis");
  route("Googleの接続状態を確認して", "connections", "connections-read-only-diagnosis");
  route("Microsoftの接続状態を確認して", "connections", "connections-read-only-diagnosis");

  const googleSetupRead = routeSecretaryIntent("Googleを接続して、予定を見て");
  assert.equal(googleSetupRead.selectedSkill, "setup-google");
  assert.equal(googleSetupRead.route, "google-explicit-entry");
  assert.deepEqual(googleSetupRead.followUp, {
    selectedSkill: "secretary",
    route: "google-read-only-handoff",
    delegation: "host-connector-read",
    confirmationBoundary: "external-read-only",
    order: "after-setup",
  });
  assert.deepEqual(googleSetupRead.sideEffect, { performed: false, fileWrites: 0, adapterCalls: 0, commandCalls: 0, externalCalls: 0 });

  const microsoftSetupRead = routeSecretaryIntent("Microsoftを接続してOutlookメールを読んで");
  assert.equal(microsoftSetupRead.selectedSkill, "setup-microsoft");
  assert.equal(microsoftSetupRead.route, "microsoft-explicit-entry");
  assert.deepEqual(microsoftSetupRead.followUp, {
    selectedSkill: "secretary",
    route: "microsoft-read-only-handoff",
    delegation: "host-connector-read",
    confirmationBoundary: "external-read-only",
    order: "after-setup",
  });
  assert.deepEqual(microsoftSetupRead.sideEffect, { performed: false, fileWrites: 0, adapterCalls: 0, commandCalls: 0, externalCalls: 0 });
  assert.match(skills.secretary, /接続状態.*connections.*先|connections.*接続状態.*先/u);
  assert.match(skills.secretary, /followUp.*setup.*read|setup.*followUp.*read/u);
  route("このClarity ItemをNotionタスクにして", "notion-tasks", "downstream-notion-task-handoff", "fixed-downstream-task-adapter");
  assert.match(skills.secretary, /selectedSkill=notion-tasks[\s\S]*private downstream[\s\S]*(?:存在|利用可能)/u);
  assert.doesNotMatch(skills.secretary, /vault-search/u);
});

check("setup bookmark is conditional and preserves unrelated work", () => {
  for (const name of ["setup-google", "setup-microsoft", "setup-notion"]) {
    const body = skills[name];
    assert(body.indexOf("connector／Appが利用可能か") < body.indexOf("resume-write"), name);
    assert.match(body, /任意のしおり|しおり作成だけ.*見送る/u);
    assert.match(body, /既存のしおり.*別の作業.*残し.*(?:上書き|消去).*しない/u);
    assert.match(body, /workspace.*初期化.*しない/u);
  }
});

check("unavailable is distinct from not-connected and local work continues", () => {
  const body = skills.daily;
  assert.match(body, /利用不可|未確認/u);
  assert.match(body, /未接続.*(?:推測|書|扱)|(?:推測|書|扱).*未接続/u);
  assert.match(body, /local TODO|ローカル TODO/u);
  assert.match(body, /最初のprobe|最初.*照会|指定.*照会/u);
});

check("explicit low-risk settings and partial persistence have one execution seam", () => {
  const body = skills.settings;
  assert.match(body, /明示.*同じturn.*1回|同じturn.*1回.*明示/su);
  assert.match(body, /saved.*journal|journal.*saved/su);
  assert.match(body, /partial/iu);
  assert.match(body, /未完了|再開対象/);
  assert.match(body, /推量|未選択.*例文|追加.*例文/u);
  assert.doesNotMatch(body, /好みを覚えて.*memory-careへ.*確認/u);
});

check("shared context and progress are conditional", () => {
  const common = read("plugins/secretary/rules/common-language.md");
  assert.match(common, /短いRead.*途中.*出さず|短い.*routing.*途中/u);
  assert.match(common, /長い[\s\S]*read-only[\s\S]*節目/u);
  for (const path of [
    "plugins/secretary/rules/plain-language.md",
    "plugins/secretary/rules/styles/yasashii.md",
    "plugins/secretary/templates/AGENTS.md",
    "plugins/secretary/templates/CLAUDE.md",
  ]) {
    const body = read(path);
    assert.match(body, /plain-language\.md|common-language\.md/u, path);
  }
  assert.match(read("plugins/secretary/rules/plain-language.md"), /条件付き|必要.*だけ|該当節/u);
  assert.match(read("plugins/secretary/rules/styles/yasashii.md"), /read-only.*節目|節目.*read-only/u);
});

check("all public leaves resolve roots without a Bash-only assumption", () => {
  assert.equal(skillNames.length, 17);
  for (const [name, body] of Object.entries(skills)) {
    assert.match(body, /path\.dirname\(SECRETARY_SKILL_FILE\)/u, name);
    assert.match(body, /--skill-file.*SECRETARY_SKILL_FILE/u, name);
    assert.doesNotMatch(body, /case "\$SECRETARY_SKILL_FILE"|dirname "\$SECRETARY_SKILL_FILE"/u, name);
  }
  for (const path of ["plugins/secretary/skills/secretary/SKILL.md", "plugins/secretary/skills/memory-care/SKILL.md"]) {
    assert.doesNotMatch(read(path), /3\. 再起動しおり/u, path);
    assert.match(read(path), /再起動しおり/u, path);
  }
});

check("edition and verification claims stay honest", () => {
  const body = skills.build;
  assert.match(body, /互換基準.*0\.5\.1|基準.*0\.5\.1/u);
  assert.match(body, /実際に利用できるversion.*別途確認/u);
  assert.doesNotMatch(body, /Harness.*installed.*0\.5\.1|supported version.*0\.5\.1/u);
  const edition = JSON.parse(read("plugins/secretary/edition.json"));
  assert.equal(edition.harness.version, "0.5.1");
  assert.match(read("plugins/secretary/.claude-plugin/plugin.json"), /0\.13\.2/u);
});

process.stdout.write(`SPRINT048_PASS=${pass.length} FAIL=0 ROUTE_SIDE_EFFECT_VIOLATIONS=0\n`);
