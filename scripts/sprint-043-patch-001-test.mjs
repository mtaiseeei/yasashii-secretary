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
    version: "0.12.0",
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
  assert.equal(codex.version, "0.12.0");
  assert.equal(codex.skills, "./skills/");
  assert.equal(Object.hasOwn(codex, "hooks"), true);
  assert.equal(codex.hooks, "./hooks/hooks.json");
});

check("Hook manifest semantics and current Clarity router bytes/modes remain fixed", () => {
  const expected = [
    ["plugins/secretary/hooks/hooks.json", "c9ce232f8d6a77d713f9febb55cb56b7f135fe4e371a45e316101017b77279ca", 1740, "644"],
    ["plugins/secretary/scripts/clarity-hook.mjs", "e89f2186f731a586105bd6bf40c1e13b8ec110e3d2bd5456a88c55b38c76f325", 2156, "644"],
    ["plugins/secretary/scripts/lib/clarity-hook.mjs", "0165c0010a8dc4551ea4abf6bbc82afe504dd1742dd35fb2f35f22f03c465d2f", 27271, "644"],
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
    ["plugins/secretary/rules/copy/yasashii.json", "9601a3785f778be8183db6ea2bc92df11d53e487864a442abdbd85def1f8dde6"],
    ["plugins/secretary/rules/styles/yasashii.md", "785127b99aa8435d76fa9ae85587ef7719748c9254e058300c47b4aa1ad68a5e"],
    ["plugins/secretary/templates/identity.json", "1d64c072506547b986f21e76c02206095c5dcebec2c5385e748b3aa31634d2eb"],
    ["plugins/secretary/rules/rule-manifest.json", "61d91fb17a8086d3ae1243f985ff577a0a9527fa4efa8e482b9c9f6d59b41a07"],
    ["secretary-overlay/README.md", "69a12287fee1c0f1c160f8248e0e416b3b92a7628204f6aabe241c5d706c1855"],
    ["secretary-overlay/anchors.json", "a368013b1dbd9b7a25d4a9af40ba5aa5ca1cade6d9020f029a8733ce8383d775"],
    ["secretary-overlay/downstream-files.json", "cc089a6221a7e115ce977491f37294a31c6f80a81ef58c1ebdc5e8326393ad94"],
    ["secretary-overlay/downstream-owned.json", "9a47f6475e6c4fcc7a8034d64afe30eed5388491a14912cd2b84848c5fb52177"],
    ["secretary-overlay/mapping.json", "7383f8e70ddccaf93d57b9da338a7f24ae4af43a71756fb3bfe329e7a6725963"],
    ["secretary-overlay/metadata-overrides.json", "61b78c825908555850e79cbfb1c7108d1c7189eb1ee7bbf010bf9e5d0abfa52a"],
    ["secretary-overlay/upstream-base.json", "f4614597e83656c32fdadc9c5cff25aadc335aa47598f820053850ac1f86e6ee"],
    ["secretary-overlay/upstream-tree.json", "12775457d7b96be62012efdb75a9242ca095e44bc319e67a9fb869e2e6644abe"],
  ];
  for (const [path, expectedDigest] of expected) assert.equal(digest(readFileSync(join(root, path))), expectedDigest, path);
});

process.stdout.write(`SPRINT043_PATCH001_PASS=${pass} SPRINT043_PATCH001_FAIL=${fail} TOTAL=${pass + fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
