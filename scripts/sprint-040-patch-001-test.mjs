#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const projectPath = "plugins/secretary/skills/projects/SKILL.md";
const edition = json("plugins/secretary/edition.json");
const mapping = json("secretary-overlay/mapping.json");
const snapshot = json("secretary-overlay/upstream-tree.json");
const anchors = json("secretary-overlay/anchors.json");
const projectSkill = readFileSync(join(root, projectPath), "utf8");
const projectsAnchors = anchors.anchors.filter((entry) => entry.path === projectPath);
const expectedInstallId = "harness@yasashii-harness";
const expectedGuidance =
  "Yasashii版ではClaude Codeが `harness@yasashii-harness` の `/harness`、Codexも\n" +
  "`harness@yasashii-harness` の `$using-harness` または `$harness-loop` を使う。";

let pass = 0;
const check = (label, fn) => {
  try {
    fn();
    pass += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    console.error(`FAIL ${label}: ${error.message}`);
    process.exitCode = 1;
  }
};

check("edition declares the same Yasashii Harness ID for Claude Code and Codex", () => {
  assert.equal(edition.harness.hosts.claudeCode.installId, expectedInstallId);
  assert.equal(edition.harness.hosts.codex.installId, expectedInstallId);
});

check("development project guidance uses Yasashii IDs and the existing host entries", () => {
  assert.equal(projectSkill.includes(expectedGuidance), true);
  assert.equal(projectSkill.includes("harness@agentic-harness"), false);
  assert.equal(projectSkill.includes("harness@agentic-harness-local"), false);
});

check("projects Skill is classified only as an anchor overlay", () => {
  assert.equal(mapping.anchorOverlay.filter((path) => path === projectPath).length, 1);
  assert.equal(mapping.common.includes(projectPath), false);
  assert.equal(mapping.metadataOverlay.includes(projectPath), false);
  assert.equal(snapshot.files.filter((entry) => entry.path === projectPath).length, 1);
  assert.equal(snapshot.files.find((entry) => entry.path === projectPath).classification, "anchor-overlay");
});

check("projects-harness anchor is unique and applied exactly once", () => {
  assert.equal(projectsAnchors.length, 1);
  assert.equal(projectsAnchors[0].id, "projects-harness");
  assert.equal(projectsAnchors[0].replacement, expectedGuidance);
  assert.equal(projectSkill.split(expectedGuidance).length - 1, 1);
  assert.equal(projectSkill.includes(projectsAnchors[0].match), false);
});

console.log(`SPRINT040_PATCH001_PASS=${pass} SPRINT040_PATCH001_FAIL=${process.exitCode ? 1 : 0}`);
