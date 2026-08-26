#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const editionIndex = process.argv.indexOf("--edition");
const edition = editionIndex >= 0 ? process.argv[editionIndex + 1] : null;
if (!edition) throw new Error("--edition is required");
const handoff = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-040/downstream-handoff.json"), "utf8"));
const declared = handoff.editions.find((item) => item.id === edition);
if (!declared) throw new Error(`unknown edition:${edition}`);
const sha = (path) => createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
let pass = 0;
const check = (label, fn) => { fn(); pass += 1; console.log(`PASS ${label}`); };

check("edition protected surfaces retain fixed-base bytes", () => {
  for (const item of declared.protected ?? []) assert.equal(sha(item.path), item.sha256, item.path);
});

check("edition common memory seam is executable and current", () => {
  for (const path of [
    "plugins/secretary/scripts/lib/conversation-contract.mjs",
    "plugins/secretary/skills/memory-care/scripts/memory-tools.mjs",
    "scripts/sprint-040-test.mjs",
  ]) assert.equal(existsSync(join(root, path)), true, path);
  const memory = readFileSync(join(root, "plugins/secretary/skills/memory-care/SKILL.md"), "utf8");
  for (const marker of handoff.requiredMarkers) assert.ok(memory.includes(marker), marker);
});

if (edition === "yasashii") check("Yasashii identity copy and style remain active", () => {
  assert.equal(JSON.parse(readFileSync(join(root, "plugins/secretary/edition.json"))).edition, "yasashii-secretary");
  assert.match(readFileSync(join(root, "plugins/secretary/skills/secretary/SKILL.md"), "utf8"), /^# yasashii-secretary/mu);
  assert.equal(existsSync(join(root, "plugins/secretary/rules/styles/yasashii.md")), true);
  assert.equal(existsSync(join(root, "plugins/secretary/rules/copy/yasashii.json")), true);
});

if (edition === "private-my-vault") check("private Notion vault routing and root guidance remain active", () => {
  const privateEdition = JSON.parse(readFileSync(join(root, "plugins/secretary/edition.json")));
  assert.equal(privateEdition.edition, "agentic-secretary");
  assert.equal(privateEdition.distribution.repository, "https://github.com/mtaiseeei/agentic-secretary-my-vault");
  for (const path of ["plugins/secretary/skills/notion-tasks/SKILL.md", "plugins/secretary/skills/vault-search/SKILL.md", "AGENTS.md"]) assert.equal(existsSync(join(root, path)), true, path);
  assert.match(readFileSync(join(root, "plugins/secretary/skills/secretary/SKILL.md"), "utf8"), /canonical my-vault/u);
});

console.log(`SPRINT040_EDITION_${edition.toUpperCase().replaceAll("-", "_")}_PASS=${pass} FAIL=0`);
