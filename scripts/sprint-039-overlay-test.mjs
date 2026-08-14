#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const candidate = resolve(process.argv[2] || "");
const FIXED_SHA = "3e08eb6d377392440e753bd5073c73d1d63399b6";
const FIXED_DIGEST = "7498d3550734ba63b689463f01e2a52e16d2ce3f8eb31cebead16aef2181f883";
if (!candidate || !existsSync(candidate)) throw new Error("fixed Agentic archive path is required");

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const handoff = json(join(candidate, "adapters/downstream-identity-handoff.json"));
const base = json(join(ROOT, "secretary-overlay/upstream-base.json"));
const snapshot = json(join(ROOT, "secretary-overlay/upstream-tree.json"));
const downstreamFiles = new Set(json(join(ROOT, "secretary-overlay/downstream-files.json")).files);
const byPath = new Map(snapshot.files.map((entry) => [entry.path, entry]));

let pass = 0;
const check = (label, fn) => { fn(); pass += 1; process.stdout.write(`PASS ${label}\n`); };

check("fixed Agentic product candidate", () => {
  assert.equal(base.baseCommit, FIXED_SHA);
  assert.equal(snapshot.baseCommit, FIXED_SHA);
});

check("handoff common digest", () => {
  const hash = createHash("sha256");
  for (const path of [...handoff.commonPaths].sort()) {
    hash.update(`${path}\0`).update(readFileSync(join(candidate, path))).update("\0");
  }
  assert.equal(hash.digest("hex"), FIXED_DIGEST);
  assert.equal(base.identityHandoff.commonTreeSha256, FIXED_DIGEST);
});

check("handoff paths are managed with declared edition anchors only", () => {
  const anchored = [];
  for (const path of handoff.commonPaths) {
    const classification = byPath.get(path)?.classification;
    assert.ok(["common", "anchor-overlay", "metadata-overlay"].includes(classification), `${path}:${classification}`);
    if (classification !== "common") anchored.push(path);
  }
  assert.deepEqual(anchored.sort(), [
    "plugins/secretary/skills/name/SKILL.md",
    "plugins/secretary/skills/secretary/SKILL.md",
    "plugins/secretary/skills/settings/SKILL.md",
  ]);
});

check("unoverlaid handoff common bytes match Agentic", () => {
  let exact = 0;
  for (const path of handoff.commonPaths) {
    if (byPath.get(path)?.classification !== "common") continue;
    assert.equal(sha(readFileSync(join(ROOT, path))), sha(readFileSync(join(candidate, path))), path);
    exact += 1;
  }
  assert.equal(exact, 11);
});

check("Agentic docs and Sprint 039 test assets are not synchronized", () => {
  assert.equal(snapshot.files.filter((entry) => entry.path.startsWith("docs/")).every((entry) => entry.classification === "repo-owned"), true);
  for (const path of ["scripts/sprint-039-test.mjs", "scripts/sprint-039-regression.sh"]) {
    assert.equal(byPath.get(path)?.classification, "upstream-only");
    assert.equal(downstreamFiles.has(path), true);
  }
});

check("Yasashii identity and style remain active", () => {
  assert.match(readFileSync(join(ROOT, "plugins/secretary/skills/secretary/SKILL.md"), "utf8"), /^# yasashii-secretary/mu);
  const edition = json(join(ROOT, "plugins/secretary/edition.json"));
  const rules = json(join(ROOT, "plugins/secretary/rules/rule-manifest.json"));
  assert.equal(edition.edition, "yasashii-secretary");
  assert.equal(edition.copy.path, "rules/copy/yasashii.json");
  assert.ok(rules.rules["yasashii-style"]);
  assert.equal(rules.rules["agentic-style"], undefined);
});

process.stdout.write(`SPRINT039_OVERLAY_PASS=${pass} SPRINT039_OVERLAY_FAIL=0\n`);
