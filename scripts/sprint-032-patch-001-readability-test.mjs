#!/usr/bin/env node

// Sprint 032 Patch 001: 会話可読性の回帰テスト。
// 層A: 配布されるrules／styles／skills／templatesの静的な契約検査。
// 層B: 実際のplugin指示経路（rule-manifest → rules → copy）から導出した契約で、
//      会話fixtureのMarkdown構造を検査する。模範Markdownをテスト内で生成しない。
// 層C（実pluginセッション）は scripts/sprint-032-patch-001-conversation-smoke.mjs が担う。

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadConversationContract,
  scenarioScene,
  usesFixedThreeSchema,
  validateScenario,
} from "./lib/sprint-032-patch-001-conversation.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(repo, "plugins", "secretary");
const fixtureRoot = join(repo, "scripts", "fixtures", "sprint-032-patch-001");
const read = (path) => readFileSync(path, "utf8");
const readRelative = (path) => read(join(repo, path));

function walk(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function conversationSurfaces() {
  const rules = walk(join(plugin, "rules")).filter((path) => /\.(?:md|json)$/.test(path));
  const skills = walk(join(plugin, "skills")).filter((path) => path.endsWith("/SKILL.md"));
  const templates = [
    join(plugin, "templates", "AGENTS.md"),
    join(plugin, "templates", "CLAUDE.md"),
    ...walk(join(plugin, "templates", "tones")).filter((path) => path.endsWith(".md")),
  ];
  const wizard = [
    join(plugin, "skills", "chatwork", "assets", "wizard", "index.html"),
    ...walk(join(plugin, "skills", "chatwork", "assets", "wizard")).filter((path) => path.endsWith(".js")),
    ...walk(join(plugin, "skills", "google-chat", "assets", "wizard")).filter((path) => path.endsWith(".js")),
  ];
  return [...new Set([...rules, ...skills, ...templates, ...wizard])].sort();
}

const compressionPatterns = [
  /改行(?:を)?(?:入れない|せず|しないで)/,
  /(?:1|一)行(?:だけ|で|に)(?:返す|表示する|まとめる|連結する)/,
  /平文(?:だけ|のみ|で)(?:返す|表示する|まとめる)/,
  /箇条書き(?:を)?(?:使わない|禁止する)/,
  /空行(?:を)?(?:入れない|禁止する)/,
  /(?:2|二)行目(?:を)?足さない/,
];

// 一般回答をserializer／固定3項目へ結合する指示の再混入を検出する。
const generalAnswerForcingPatterns = [
  /作業後の提案・回答.{0,80}serializer/s,
  /完了・状態報告と作業後の提案・回答/,
  /(?:一般(?:的な)?(?:質問|回答)|提案・回答).{0,40}(?:3項目|shortLines)へ(?:まとめる|押し込む|変換する)/s,
];

function forbiddenInstructions(text) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    const hits = compressionPatterns.filter((pattern) => pattern.test(line));
    return hits.map((pattern) => ({ line: index + 1, pattern: pattern.source, text: line.trim() }));
  });
}

let pass = 0;
function check(label, test) {
  test();
  pass += 1;
  process.stdout.write(`PASS ${label}\n`);
}

const inventory = JSON.parse(read(join(fixtureRoot, "conversation-surface-inventory.json")));
const surfaces = conversationSurfaces();
const contract = loadConversationContract(repo);

// ----- 層A: 配布物の静的な契約検査 -----

check("A: inventory covers the four required user-facing categories", () => {
  assert.equal(inventory.schemaVersion, 1);
  assert.deepEqual(inventory.userFacing.map((entry) => entry.category), [
    "rules-and-edition-copy", "skills-and-commands", "workspace-guidance", "wizard",
  ]);
  assert(inventory.machineReadableExclusions.every((entry) => entry.reason.length > 20));
  assert.equal(surfaces.filter((path) => path.endsWith("/SKILL.md")).length, 15);
  assert(surfaces.some((path) => path.endsWith("rules/copy/yasashii.json")));
  assert(surfaces.some((path) => path.endsWith("templates/AGENTS.md")));
  assert(surfaces.some((path) => path.endsWith("chatwork/assets/wizard/app.js")));
  assert(surfaces.some((path) => path.endsWith("google-chat/assets/wizard/app.js")));
});

check("A: distributed conversation surfaces have zero compression instructions", () => {
  const failures = surfaces.flatMap((path) => forbiddenInstructions(read(path)).map((hit) => ({ path: relative(repo, path), ...hit })));
  assert.deepEqual(failures, []);
});

check("A: negative fixture catches one-line compression regression", () => {
  const failures = forbiddenInstructions(read(join(fixtureRoot, "bad-compression.md")));
  assert(failures.length >= 1);
});

check("A: serializer scope is limited to completion/status/handoff reports", () => {
  for (const scene of ["作業完了報告", "状態報告", "実行結果の短いhandoff"]) {
    assert(contract.applyScenes.some((entry) => entry.includes(scene)), `apply scene missing: ${scene}`);
  }
  for (const scene of [
    "一般的な質問への回答", "複雑な説明", "設計相談", "複数原因の診断", "検索結果",
    "比較", "選択肢の提示", "部分失敗", "developer handoff",
  ]) {
    assert(contract.generalScenes.some((entry) => entry.includes(scene)), `general scene missing: ${scene}`);
  }
  const style = contract.ruleText["yasashii-style"];
  assert(style.includes("serializerを適用しない場面"), "non-application section missing");
  assert(style.includes("common-language.md"), "general answers must defer to common-language");
});

check("A: no surface couples general answers to the fixed three-item schema", () => {
  const failures = surfaces.flatMap((path) => {
    const text = read(path);
    return generalAnswerForcingPatterns.filter((pattern) => pattern.test(text)).map((pattern) => ({
      path: relative(repo, path), pattern: pattern.source,
    }));
  });
  assert.deepEqual(failures, []);
});

check("A: shared rule keeps readable Markdown without a preference toggle", () => {
  const common = contract.ruleText["common-language"];
  for (const phrase of ["短い1要点", "空行で分けた段落", "ネストした箇条書き", "好みとして質問せず", "無効にしません", "内部recordとの境界"]) {
    assert(common.includes(phrase), `missing common readability phrase: ${phrase}`);
  }
  assert(!readRelative("plugins/secretary/templates/memory/preferences.md").includes("改行"));
  const style = contract.ruleText["yasashii-style"];
  assert(style.includes("くわしく"), "preference may only switch 3<->4 items");
  assert(!/preferences.{0,40}(?:1行|一行|平文)/s.test(style));
});

check("A: machine-readable internal records stay out of scope", () => {
  assert(contract.ruleText["common-language"].includes("内部形式を複数行へ変えず"));
});

// ----- 層B: 実plugin指示経路から導出した契約での会話構造検査 -----

const SCENARIOS = [
  "short-answer",
  "complex-question",
  "diagnosis",
  "search-results",
  "partial-failure",
  "completion-report",
];

check("B: copy schema provides three physically separate report items", () => {
  assert.equal(contract.labels.length, 3);
  assert.deepEqual(contract.labels, ["やったこと", "結果", "次に何が起きるか"]);
  assert.equal(contract.detailLabel, "補足");
  for (const line of contract.copy.surfaces.report.shortLines) assert(!line.includes("\n"));
});

check("B: one short confirmation copy remains one natural paragraph", () => {
  const confirmation = contract.copy.surfaces.conversation.decisionConfirmation;
  assert(!confirmation.includes("\n"));
  assert(!confirmation.startsWith("- "));
});

check("B: every scenario is classified by the actual rule text", () => {
  for (const kind of SCENARIOS) {
    const need = scenarioScene(kind);
    const pool = need.scope === "apply" ? contract.applyScenes : contract.generalScenes;
    assert(pool.some((entry) => entry.includes(need.scene)), `${kind}: scene "${need.scene}" not in ${need.scope} list`);
  }
});

for (const kind of SCENARIOS) {
  check(`B: scenario ${kind} — conforming conversation passes the derived contract`, () => {
    const good = read(join(fixtureRoot, "conversations", `${kind}.good.md`));
    const verdict = validateScenario(kind, good, contract);
    assert.deepEqual(verdict.problems, [], `${kind} good fixture rejected`);
  });
  check(`B: scenario ${kind} — compressed conversation is rejected`, () => {
    const bad = read(join(fixtureRoot, "conversations", `${kind}.bad.md`));
    const verdict = validateScenario(kind, bad, contract);
    assert(verdict.problems.length >= 1, `${kind} bad fixture was not rejected`);
  });
}

check("B: completion report without fixed labels is rejected (fixed === false)", () => {
  const bad = read(join(fixtureRoot, "conversations", "completion-report.unlabeled.bad.md"));
  assert.equal(usesFixedThreeSchema(bad, contract.labels), false, "unlabeled fixture must not count as fixed schema");
  const verdict = validateScenario("completion-report", bad, contract);
  assert(verdict.problems.some((problem) => problem.includes("固定3項目schema")), "missing fixed-schema rejection");
});

check("B: completion report with out-of-order labels is rejected", () => {
  const bad = read(join(fixtureRoot, "conversations", "completion-report.out-of-order.bad.md"));
  const verdict = validateScenario("completion-report", bad, contract);
  assert(verdict.problems.some((problem) => problem.includes("順序")), "missing label-order rejection");
});

check("B: general answers are not required to use the fixed three-item schema", () => {
  const good = read(join(fixtureRoot, "conversations", "complex-question.good.md"));
  assert.equal(usesFixedThreeSchema(good, contract.labels), false);
  assert.deepEqual(validateScenario("complex-question", good, contract).problems, []);
});

check("B: agentic and yasashii keep distinct audiences while sharing structure", () => {
  const editions = readRelative("docs/spec/editions.md");
  for (const phrase of ["技術的に直接的", "何が起きたか、影響、次にすること", "developer handoff"]) assert(editions.includes(phrase));
  const style = contract.ruleText["yasashii-style"];
  assert(style.includes("Markdown箇条書きとして物理的に分けます"));
  assert(style.includes("何が起きているか、利用者への影響、次に何をすればよいか"));
});

// ----- Chatwork Secret案内の無回帰 -----

const chatwork = readRelative("plugins/secretary/skills/chatwork/assets/wizard/app.js");
const chatworkSkill = readRelative("plugins/secretary/skills/chatwork/SKILL.md");

check("Chatwork wizard gives exact Name and Secret field guidance", () => {
  for (const phrase of [
    "<code>Name</code> 欄", "<code>CHATWORK_API_TOKEN</code>", "<code>Secret</code> 欄",
    "Chatwork公式画面でご本人が取得したAPI Token", "GitHubの登録画面にだけ入力します",
    "このwizard、AIとの会話、リポジトリ、ログには貼り付けないでください",
  ]) assert(chatwork.includes(phrase), `missing Chatwork wizard guidance: ${phrase}`);
  for (const phrase of ["`Name` 欄: `CHATWORK_API_TOKEN`", "`Secret` 欄: Chatwork公式画面で本人が取得したAPI Token"]) {
    assert(chatworkSkill.includes(phrase), `missing Chatwork skill guidance: ${phrase}`);
  }
});

check("Chatwork wizard never receives or displays a Token value", () => {
  assert(!/<input[^>]*type=["'](?:text|password)["'][^>]*(?:token|secret)|<textarea[^>]*(?:token|secret)/i.test(chatwork));
  assert(!/(?:1234567890abcdef|cw_[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/.test(chatwork));
  assert(!chatwork.includes("value=\"CHATWORK_API_TOKEN\""));
  assert(chatwork.includes("Tokenの値は読み戻しません"));
});

process.stdout.write(`SPRINT032_PATCH001_READABILITY_PASS=${pass} SPRINT032_PATCH001_READABILITY_FAIL=0 SURFACES=${surfaces.length}\n`);

export { conversationSurfaces, forbiddenInstructions };
