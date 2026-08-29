#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const mode = (path) => (lstatSync(join(root, path)).mode & 0o777).toString(8);
const claude = readJson("plugins/secretary/.claude-plugin/plugin.json");
const codex = readJson("plugins/secretary/.codex-plugin/plugin.json");
let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
  } catch (error) {
    fail += 1;
    process.stdout.write(`FAIL ${label}: ${error?.stack || error}\n`);
  }
}

check("Claude manifest keeps identity/version/skills and omits duplicate hooks declaration", () => {
  assert.deepEqual(claude, {
    name: "yasashii-secretary",
    description: "あなた専属のAI秘書。記憶、通常のプロジェクト、選択したChatwork／Google Chat履歴を1つのprivate GitHub repoで管理する。",
    version: "0.11.0",
    author: { name: "mtaiseeei" },
    homepage: "https://github.com/mtaiseeei/yasashii-secretary",
    repository: "https://github.com/mtaiseeei/yasashii-secretary",
    license: "MIT",
    skills: "./skills/",
  });
  assert.equal(Object.hasOwn(claude, "hooks"), false);
});

check("Codex manifest keeps the common Hook reference", () => {
  assert.equal(codex.name, "yasashii-secretary");
  assert.equal(codex.version, "0.11.0");
  assert.equal(codex.skills, "./skills/");
  assert.equal(Object.hasOwn(codex, "hooks"), true);
  assert.equal(codex.hooks, "./hooks/hooks.json");
});

check("Hook and Project Clarity router bytes/modes remain unchanged", () => {
  const expected = [
    ["plugins/secretary/hooks/hooks.json", "7ac60c7f280c965321ced1658dd7fcdad1b481f09bd6eee5cf8153278b5bc40b", 1768, "644"],
    ["plugins/secretary/scripts/clarity-hook.mjs", "8cf657ae6a9f1c0fdbd2ce96aa73c1917c3105e3d5488cebc92e80db385ceea3", 1087, "644"],
    ["plugins/secretary/scripts/lib/clarity-hook.mjs", "c85137b5b5b0abce9fc1da454218c205e090aa086daaa26cdcb17b924165aa48", 22573, "644"],
  ];
  for (const [path, expectedDigest, expectedSize, expectedMode] of expected) {
    const bytes = readFileSync(join(root, path));
    assert.equal(digest(bytes), expectedDigest, path);
    assert.equal(bytes.length, expectedSize, path);
    assert.equal(mode(path), expectedMode, path);
  }
});

check("Yasashii copy/style/identity and overlay definitions remain unchanged", () => {
  const expected = [
    ["plugins/secretary/edition.json", "663c14cc51b92a936a1dbaf34d5ab4f7ded65f20d57ad0ed645dfd3e8d9bf7b7"],
    ["plugins/secretary/rules/copy/yasashii.json", "b730ece91753ab562da363b6b085adbffbbe9c3958c3983abef31098a6224e7a"],
    ["plugins/secretary/rules/styles/yasashii.md", "50c9df0ff79fb43d5e051eb0c42070e31393b210a7fb78076c6e7e6996b1699c"],
    ["plugins/secretary/templates/identity.json", "1d64c072506547b986f21e76c02206095c5dcebec2c5385e748b3aa31634d2eb"],
    ["plugins/secretary/rules/rule-manifest.json", "61d91fb17a8086d3ae1243f985ff577a0a9527fa4efa8e482b9c9f6d59b41a07"],
    ["secretary-overlay/README.md", "69a12287fee1c0f1c160f8248e0e416b3b92a7628204f6aabe241c5d706c1855"],
    ["secretary-overlay/anchors.json", "3eca14a8bd30cfb0ea5171c7ba503bf17134fae0826f01067d35c61dc3613b48"],
    ["secretary-overlay/downstream-files.json", "cc089a6221a7e115ce977491f37294a31c6f80a81ef58c1ebdc5e8326393ad94"],
    ["secretary-overlay/downstream-owned.json", "e574e7d9c558e3b9ad38528b0c879bce17d1b932fbef95804e8cfc99dffdfe4c"],
    ["secretary-overlay/mapping.json", "b7dce32c60d3951628037b53a6f58d10efc863cf6a60b5f68a47c3ac50f1a688"],
    ["secretary-overlay/metadata-overrides.json", "b3e0aab402fc76a19436cf528c836636b3d00b8f53c59b1b902eb3a76354cf8b"],
    ["secretary-overlay/upstream-base.json", "ed93a34666d5ff25d1f7665f638be19426513af97de37831f1bd26d7534ac404"],
    ["secretary-overlay/upstream-tree.json", "eccd6ea72a3df4c2ab3c8209075dd12d5a7bce68b553fcc34eeb9a0a0c1a9448"],
  ];
  for (const [path, expectedDigest] of expected) assert.equal(digest(readFileSync(join(root, path))), expectedDigest, path);
});

process.stdout.write(`SPRINT043_PATCH001_PASS=${pass} SPRINT043_PATCH001_FAIL=${fail} TOTAL=${pass + fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
