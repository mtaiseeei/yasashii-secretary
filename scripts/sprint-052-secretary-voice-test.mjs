#!/usr/bin/env node

// Sprint 052: shared voice references and inventory integrity.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");
const sha = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
const inventory = JSON.parse(read("plugins/secretary/conversation-core-inventory.json"));
const contract = read("plugins/secretary/rules/conversation-contract.md");
let pass = 0; let fail = 0;
const check = (label, fn) => { try { fn(); pass += 1; console.log(`PASS ${label}`); } catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.message}`); } };

check("共通話者契約は既定値・4場面・状態境界を参照", () => {
  for (const marker of ["一人称の既定は「私」", "初回設定完了", "rename直後", "routing反復は0回", "保存済み・完了と書かず", "人間の身体、感情、体験、対人関係"]) assert.ok(contract.includes(marker), marker);
});
check("inventoryは実ファイルのhashと共通entrypointを追跡", () => {
  for (const entry of inventory.surfaces) {
    assert.ok(existsSync(join(root, entry.path)), entry.path);
    assert.equal(sha(entry.path), entry.sha256, `stale hash: ${entry.path}`);
    for (const marker of entry.requiredMarkers ?? []) assert.ok(read(entry.path).includes(marker), `${entry.path}: ${marker}`);
    if (entry.path.endsWith("/SKILL.md")) assert.ok(read(entry.path).includes("rules/plain-language.md"), entry.path);
  }
  assert.deepEqual(inventory.surfaces.filter((entry) => entry.path.endsWith("/SKILL.md")).map((entry) => entry.path).sort(), readdirSync(join(root, "plugins/secretary/skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => `plugins/secretary/skills/${name}/SKILL.md`).filter((path) => existsSync(join(root, path))).sort(), "inventoryのSKILL集合が実体と一致しません"); assert.equal(inventory.surfaces.filter((entry) => entry.path.endsWith("/SKILL.md")).length, 17, "現行SKILL数"); assert.equal(inventory.voiceContract.defaultFirstPerson, "私");
});
check("Yasashii editionは共通契約を読み、専用会話copyを使う", () => {
  assert.match(read("plugins/secretary/rules/styles/yasashii.md"), /conversation-contract\.md/u);
  const copy = JSON.parse(read("plugins/secretary/rules/copy/yasashii.json"));
  assert.ok(copy.surfaces.conversation.voice, "yasashii voice copy");
  assert.equal(existsSync(join(root, "plugins/secretary/rules/styles/agentic.md")), false);
});

console.log(`SPRINT052_VOICE_PASS=${pass} SPRINT052_VOICE_FAIL=${fail}`);
if (fail) process.exitCode = 1;
