#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rulesRoot = join(repo, "plugins", "secretary", "rules");
const manifestPath = join(rulesRoot, "rule-manifest.json");
const copyPath = join(rulesRoot, "copy", "yasashii.json");
const baselinePath = join(repo, "scripts", "fixtures", "sprint-029", "yasashii-copy-baseline.json");
const expectedSurfaces = ["conversation", "developerHandoff", "diagnosis", "report"];
const protectedContracts = [
  "memoryProtection",
  "secretHandling",
  "evidenceRequirements",
  "confirmationBoundary",
  "pushBoundary",
];

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function validateRuleGraph(manifest, root = rulesRoot) {
  const errors = [];
  const rules = manifest?.rules || {};
  const names = Object.keys(rules);
  if (manifest?.schemaVersion !== 1) errors.push("manifest schemaVersionが1ではありません");
  if (manifest?.entrypoint !== "plain-language.md") errors.push("互換entrypointがplain-language.mdではありません");
  if (!names.length) errors.push("ruleがありません");
  if (new Set(manifest?.priority || []).size !== names.length || !names.every((name) => manifest.priority?.includes(name))) {
    errors.push("priorityが全ruleを一度ずつ含みません");
  }
  for (const [name, rule] of Object.entries(rules)) {
    if (!rule.path || !existsSync(join(root, rule.path))) errors.push(`${name}: 参照先がありません`);
    if (!rule.owner) errors.push(`${name}: ownerがありません`);
    for (const dependency of rule.dependencies || []) {
      if (!rules[dependency]) errors.push(`${name}: 依存先${dependency}がありません`);
    }
    if (rule.protected && rule.owner !== "common-core") errors.push(`${name}: protected ruleのownerがcommon-coreではありません`);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(name) {
    if (visiting.has(name)) { errors.push(`循環参照があります: ${name}`); return; }
    if (visited.has(name) || !rules[name]) return;
    visiting.add(name);
    for (const dependency of rules[name].dependencies || []) visit(dependency);
    visiting.delete(name);
    visited.add(name);
  }
  names.forEach(visit);

  const style = rules["yasashii-style"];
  const protectedNames = names.filter((name) => rules[name].protected);
  if (!style) errors.push("yasashii-styleがありません");
  else {
    for (const name of protectedNames) {
      if (!style.dependencies?.includes(name)) errors.push(`yasashii-styleがprotected rule ${name}を先に読みません`);
      if (rules[name].dependencies?.includes("yasashii-style")) errors.push(`${name}がstyleへ依存しています`);
    }
    if ((style.overrides || []).length) errors.push("styleからruleをoverrideしようとしています");
    if (style.copy !== "copy/yasashii.json") errors.push("yasashii copyの参照先が不正です");
    const declared = [...(style.copySurfaces || [])].sort();
    if (JSON.stringify(declared) !== JSON.stringify(expectedSurfaces)) errors.push("edition可変copyが4面に限定されていません");
  }
  for (const contract of protectedContracts) {
    if (!manifest.forbiddenStyleOverrides?.includes(contract)) errors.push(`style override禁止契約がありません: ${contract}`);
  }
  return errors;
}

function validateCopy(copy) {
  const errors = [];
  if (copy?.schemaVersion !== 1) errors.push("copy schemaVersionが1ではありません");
  const surfaces = Object.keys(copy?.surfaces || {}).sort();
  if (JSON.stringify(surfaces) !== JSON.stringify(expectedSurfaces)) errors.push("copyが4面だけではありません");
  const serialized = JSON.stringify(copy);
  const wizardTerms = ["Chatwork", "Google Chat", "wizard", "heading", "body", "label", "CTA", "OAuth", "scope", "schedule", "room", "space"];
  for (const term of wizardTerms) if (serialized.includes(term)) errors.push(`wizard copyが混入しています: ${term}`);
  const report = copy?.surfaces?.report;
  if (!Array.isArray(report?.shortLines) || report.shortLines.length !== 3) errors.push("yasashii報告が3項目ではありません");
  if (report?.shortLines?.[0]?.startsWith("やったこと:") !== true || report?.shortLines?.[1]?.startsWith("結果:") !== true || report?.shortLines?.[2]?.startsWith("次に何が起きるか:") !== true) errors.push("報告prefixまたは順序が変わっています");
  if (report?.detailedSuffix?.startsWith("補足:") !== true) errors.push("詳細報告prefixが変わっています");
  return errors;
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const manifest = json(manifestPath);
const copy = json(copyPath);
const baseline = json(baselinePath);
const entrypoint = readFileSync(join(rulesRoot, "plain-language.md"), "utf8");
const safety = readFileSync(join(rulesRoot, "safety.md"), "utf8");
const evidence = readFileSync(join(rulesRoot, "evidence.md"), "utf8");
const common = readFileSync(join(rulesRoot, "common-language.md"), "utf8");
const style = readFileSync(join(rulesRoot, "styles", "yasashii.md"), "utf8");

assert.deepEqual(validateRuleGraph(manifest), [], "rule graphが不正です");
assert.deepEqual(validateCopy(copy), [], "copy境界が不正です");
assert.deepEqual(copy.surfaces, baseline.surfaces, "Sprint着手前copyから意味・順序が変わっています");

for (const rule of Object.values(manifest.rules)) assert(entrypoint.includes(rule.path), `entrypointが${rule.path}を参照していません`);
assert(entrypoint.includes("rule-manifest.json"), "entrypointがmanifestを参照していません");
assert(style.includes("../copy/yasashii.json"), "styleが宣言的copyを参照していません");
for (const phrase of ["空または実質空", "secret", "明示確認", "push", "Repository Secret"]) assert(safety.includes(phrase), `安全契約が不足しています: ${phrase}`);
for (const phrase of ["実コネクタ", "接続状態は未確認", "根拠", "推測で断定しません"]) assert(evidence.includes(phrase), `証拠契約が不足しています: ${phrase}`);
for (const phrase of ["一般に通じる技術用語", "初出時", "幼稚なメタファー", "計画 → 道具 → 確認 → 結果", "common by design"]) assert(common.includes(phrase), `共通表現が不足しています: ${phrase}`);
for (const phrase of ["最終応答serializer（通常報告の唯一の正本）", "無言で完了", "Markdown箇条書きとして物理的に分けます", "口調・専門用語・役割は項目数を変えません", "developer handoff"]) assert(style.includes(phrase), `yasashii styleが不足しています: ${phrase}`);

for (const [relative, expected] of Object.entries(baseline.wizardAssets)) {
  assert.equal(digest(join(repo, relative)), expected, `wizard copy／DOM assetが変わっています: ${relative}`);
}

for (const contract of protectedContracts) {
  const broken = structuredClone(manifest);
  broken.rules["yasashii-style"].overrides = [contract];
  assert(validateRuleGraph(broken).some((error) => error.includes("override")), `${contract}をstyleから弱める負fixtureを検出できません`);
}
const cyclic = structuredClone(manifest);
cyclic.rules.evidence.dependencies = ["yasashii-style"];
assert(validateRuleGraph(cyclic).some((error) => error.includes("循環")), "循環する負fixtureを検出できません");
const missing = structuredClone(manifest);
missing.rules.safety.path = "missing-safety.md";
assert(validateRuleGraph(missing).some((error) => error.includes("参照先")), "欠落ruleの負fixtureを検出できません");
const wizardCopy = structuredClone(copy);
wizardCopy.surfaces.wizard = { cta: "次へ" };
assert(validateCopy(wizardCopy).length > 0, "wizard copy混入の負fixtureを検出できません");

process.stdout.write(`SPRINT029_RULE_PASS=${15 + Object.keys(baseline.wizardAssets).length + protectedContracts.length} SPRINT029_RULE_FAIL=0 WIZARD_DIGESTS=${Object.keys(baseline.wizardAssets).length}\n`);

export { validateCopy, validateRuleGraph };
