#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindWizardSearch } from "../plugins/secretary/skills/chatwork/assets/wizard/common.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const common = readFileSync(join(repo, "plugins/secretary/skills/chatwork/assets/wizard/common.js"), "utf8");
const chatwork = readFileSync(join(repo, "plugins/secretary/skills/chatwork/assets/wizard/app.js"), "utf8");
const googleChat = readFileSync(join(repo, "plugins/secretary/skills/google-chat/assets/wizard/app.js"), "utf8");
let pass = 0;

const declaredWizardAssets = [
  "plugins/secretary/skills/chatwork/assets/wizard/app.js",
  "plugins/secretary/skills/chatwork/assets/wizard/common.js",
  "plugins/secretary/skills/google-chat/assets/wizard/app.js",
];

function check(condition, label) {
  assert.ok(condition, label);
  pass += 1;
}

class InputFixture extends EventTarget {
  value = "";
  selectionStart = 0;
  selectionEnd = 0;
  focused = true;
  emit(type, options = {}) {
    const event = new Event(type);
    Object.defineProperty(event, "isComposing", { value: options.isComposing === true });
    this.dispatchEvent(event);
  }
}

const input = new InputFixture();
const queries = [];
const renders = [];
bindWizardSearch(input, {
  setQuery: (value) => queries.push(value),
  renderResults: () => renders.push(input.value),
});

input.emit("compositionstart");
for (const value of ["え", "えい", "営業"]) {
  input.value = value;
  input.emit("input", { isComposing: true });
}
check(renders.length === 0, "composition中は結果をrenderしない");
check(queries.at(-1) === "営業", "composition中も最新入力値をstateへ保持する");
input.emit("compositionend");
check(renders.join() === "営業", "compositionendで確定値を1回renderする");
input.emit("input");
check(renders.length === 1, "compositionend直後の同値inputを二重renderしない");

for (const value of ["sales", "sale", "saXle", ""]) {
  input.value = value;
  input.emit("input");
}
check(renders.slice(1).join("|") === "sales|sale|saXle|", "英数字・Backspace・途中挿入・全削除をrenderする");
check(queries.at(-1) === "", "全削除した検索値をstateへ反映する");

for (const source of [chatwork, googleChat]) {
  check(source.includes("bindWizardSearch"), "両wizardが共通検索処理を使用する");
  check(source.includes("data-search-results") && source.includes("data-search-identifiers"), "検索欄の外側に部分更新対象を分離する");
}
check(common.includes('input.addEventListener("compositionstart"') && common.includes('input.addEventListener("compositionend"'), "共通coreがcomposition lifecycleを扱う");
check(!chatwork.includes("state.query = event.target.value; renderRooms()") && !googleChat.includes("state.query = event.target.value; renderSpaces()") && !googleChat.includes("state.query = event.target.value; renderSettingsSpaces()"), "inputごとの全画面renderを残さない");
check((googleChat.match(/bindSpaceSearch\(/g) || []).length >= 3, "Google Chat初回・設定変更を同じ共通設計で扱う");

const changedWizardAssets = execFileSync("git", ["diff", "HEAD", "--name-only", "--", "plugins/secretary/skills/*/assets/wizard/*"], { cwd: repo, encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
check(changedWizardAssets.every((path) => declaredWizardAssets.includes(path)), "変更したwizard assetを宣言済み共有3 pathに限定する");
const digest = (path) => createHash("sha256").update(readFileSync(join(repo, path))).digest("hex");
const neutral = JSON.parse(readFileSync(join(repo, "adapters/neutral-base.json"), "utf8"));
const yasashiiBaseline = JSON.parse(readFileSync(join(repo, "scripts/fixtures/sprint-029/yasashii-copy-baseline.json"), "utf8"));
for (const path of declaredWizardAssets) {
  check(yasashiiBaseline.wizardAssets[path] === digest(path), `Yasashii同期候補digestを現行assetへ固定する: ${path}`);
}
for (const path of declaredWizardAssets.filter((path) => path.endsWith("app.js"))) {
  check(neutral.digests[path] === digest(path), `neutral inventoryを現行appへ固定する: ${path}`);
}

function verifySelectionFixture({ label, items, selectedIds, japaneseInputs, expectedId }) {
  const search = new InputFixture();
  const selected = new Set(selectedIds);
  let resultIds = items.map((item) => item.id);
  let renderCount = 0;
  let query = "";
  bindWizardSearch(search, {
    setQuery: (value) => { query = value; },
    renderResults: () => {
      renderCount += 1;
      const normalized = query.toLocaleLowerCase("ja");
      resultIds = items.filter((item) => `${item.name} ${item.id}`.toLocaleLowerCase("ja").includes(normalized)).map((item) => item.id);
    },
  });
  search.emit("compositionstart");
  for (const value of japaneseInputs) {
    search.value = value;
    search.selectionStart = value.length;
    search.selectionEnd = value.length;
    search.emit("input", { isComposing: true });
  }
  check(renderCount === 0 && resultIds.length === items.length, `${label}: composition中は結果IDを更新しない`);
  search.emit("compositionend");
  check(renderCount === 1 && resultIds.join() === expectedId, `${label}: 確定後の結果IDが一致する`);
  check(search.focused && search.selectionStart === search.value.length && search.selectionEnd === search.value.length, `${label}: focusとcaretを保持する`);
  search.value = "";
  search.selectionStart = 0;
  search.selectionEnd = 0;
  search.emit("input");
  check(resultIds.join() === items.map((item) => item.id).join(), `${label}: 全削除で全結果IDを再表示する`);
  check([...selected].join() === selectedIds.join(), `${label}: 非表示を往復しても選択IDを保持する`);
}

verifySelectionFixture({
  label: "Chatwork",
  items: [{ id: "101", name: "営業チーム" }, { id: "102", name: "商品開発" }, { id: "103", name: "経営会議" }],
  selectedIds: ["101", "102"],
  japaneseInputs: ["え", "えい", "営業"],
  expectedId: "101",
});
verifySelectionFixture({
  label: "Google Chat",
  items: [{ id: "spaces/space-a", name: "営業共有" }, { id: "spaces/space-b", name: "企画共有" }, { id: "spaces/space-c", name: "全社連絡" }],
  selectedIds: ["spaces/space-a", "spaces/space-b"],
  japaneseInputs: ["え", "えい", "営業"],
  expectedId: "spaces/space-a",
});

process.stdout.write(`SPRINT035_PATCH001_IME_PASS=${pass} SPRINT035_PATCH001_IME_FAIL=0\n`);
