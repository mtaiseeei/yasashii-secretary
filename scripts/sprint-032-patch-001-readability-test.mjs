#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function forbiddenInstructions(text) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    const hits = compressionPatterns.filter((pattern) => pattern.test(line));
    return hits.map((pattern) => ({ line: index + 1, pattern: pattern.source, text: line.trim() }));
  });
}

function renderItems(items) {
  assert(items.length > 0);
  if (items.length === 1) return items[0];
  return items.map((item) => `- ${item}`).join("\n");
}

function assertStructured(label, output, count) {
  const lines = output.split("\n");
  assert.equal(lines.length, count, `${label}: physical item count`);
  assert(lines.every((line) => line.startsWith("- ")), `${label}: Markdown bullets`);
  assert(!lines.some((line) => /^#{1,6}\s/.test(line)), `${label}: decorative heading`);
}

let pass = 0;
function check(label, test) {
  test();
  pass += 1;
  process.stdout.write(`PASS ${label}\n`);
}

const inventory = JSON.parse(read(join(fixtureRoot, "conversation-surface-inventory.json")));
const surfaces = conversationSurfaces();

check("inventory covers the four required user-facing categories", () => {
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

check("distributed conversation surfaces have zero compression instructions", () => {
  const failures = surfaces.flatMap((path) => forbiddenInstructions(read(path)).map((hit) => ({ path: relative(repo, path), ...hit })));
  assert.deepEqual(failures, []);
});

check("negative fixture catches one-line compression regression", () => {
  const failures = forbiddenInstructions(read(join(fixtureRoot, "bad-compression.md")));
  assert(failures.length >= 1);
});

const common = readRelative("plugins/secretary/rules/common-language.md");
const style = readRelative("plugins/secretary/rules/styles/yasashii.md");
const yasashiiCopy = JSON.parse(readRelative("plugins/secretary/rules/copy/yasashii.json"));
const editions = readRelative("docs/spec/editions.md");

check("shared rule requires readable Markdown without a preference toggle", () => {
  for (const phrase of ["短い1要点", "空行で分けた段落", "箇条書き", "好みとして質問せず", "無効にしません", "内部recordとの境界"]) {
    assert(common.includes(phrase), `missing common readability phrase: ${phrase}`);
  }
  assert(!readRelative("plugins/secretary/templates/memory/preferences.md").includes("改行"));
});

check("one short confirmation remains one natural paragraph", () => {
  const output = renderItems([yasashiiCopy.surfaces.conversation.decisionConfirmation]);
  assert(!output.includes("\n"));
  assert(!output.startsWith("- "));
});

check("yasashii default report is three physical Markdown items", () => {
  const output = renderItems(yasashiiCopy.surfaces.report.shortLines);
  assertStructured("yasashii report", output, 3);
  assert(output.includes("やったこと:") && output.includes("結果:") && output.includes("次に何が起きるか:"));
  assert(style.includes("Markdown箇条書きとして物理的に分けます"));
});

check("multi-step, diagnosis, partial failure, completion, and handoff are structured", () => {
  const scenarios = [
    ["Chatwork公式画面でAPI Tokenを取得します", "GitHubのName欄を設定します", "Secret欄へ本人が直接入力します"],
    ["何が起きたか: 同期に失敗しました", "影響: 保存済み履歴は残っています", "次にすること: 接続を確認します"],
    ["完了: 2ルームを保存しました", "未完了: 1ルームはrate limitでした", "次にすること: 時間を置いて再実行します"],
    ["完了: 設定を保存しました", "結果: 次回から3時間ごとに取得します"],
    ["何が起きたか: update-apply.mjsがexit 3", "影響: workspaceは不変", "次にすること: path guardを確認", "正式名称: EXIT_REFUSED"],
  ];
  scenarios.forEach((items, index) => assertStructured(`scenario ${index + 1}`, renderItems(items), items.length));
});

check("agentic and yasashii keep distinct content while sharing structure", () => {
  const yasashii = renderItems([
    "何が起きたか: 更新を開始できませんでした",
    "影響: ファイルは変わっていません",
    "次にすること: 接続を確認します",
  ]);
  const agentic = renderItems([
    "error: EXIT_REFUSED",
    "command: node scripts/update-apply.mjs start",
    "path: .git/secretary-update",
    "evidence: workspace digest unchanged",
  ]);
  assertStructured("yasashii edition", yasashii, 3);
  assertStructured("agentic edition", agentic, 4);
  assert.notEqual(yasashii, agentic);
  for (const phrase of ["技術的に直接的", "何が起きたか、影響、次にすること", "developer handoff"]) assert(editions.includes(phrase));
});

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

export { conversationSurfaces, forbiddenInstructions, renderItems };
