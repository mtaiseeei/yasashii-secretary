#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rulesRoot = join(repo, "plugins", "secretary", "rules");
const manifestPath = join(rulesRoot, "rule-manifest.json");
const baselinePath = join(repo, "scripts", "fixtures", "sprint-029", "yasashii-copy-baseline.json");
const currentWizardBaselinePath = join(repo, "scripts", "fixtures", "sprint-038", "current-wizard-assets.json");
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

  const styleNames = names.filter((name) => typeof rules[name].copy === "string");
  const styleName = styleNames[0];
  const style = rules[styleName];
  const protectedNames = names.filter((name) => rules[name].protected);
  if (styleNames.length !== 1 || !style) errors.push("active styleが一意ではありません");
  else {
    for (const name of protectedNames) {
      if (!style.dependencies?.includes(name)) errors.push(`${styleName}がprotected rule ${name}を先に読みません`);
      if (rules[name].dependencies?.includes(styleName)) errors.push(`${name}がstyleへ依存しています`);
    }
    if ((style.overrides || []).length) errors.push("styleからruleをoverrideしようとしています");
    if (!/^copy\/(?:agentic|yasashii)\.json$/.test(style.copy)) errors.push("active copyの参照先が不正です");
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
  if (copy?.schemaVersion !== 2) errors.push("current copy schemaVersionが2ではありません");
  const surfaces = Object.keys(copy?.surfaces || {}).sort();
  if (JSON.stringify(surfaces) !== JSON.stringify(expectedSurfaces)) errors.push("copyが4面だけではありません");
  const serialized = JSON.stringify(copy);
  const wizardTerms = ["Chatwork", "Google Chat", "wizard", "heading", "body", "label", "CTA", "OAuth", "scope", "schedule", "room", "space"];
  for (const term of wizardTerms) if (serialized.includes(term)) errors.push(`wizard copyが混入しています: ${term}`);
  const report = copy?.surfaces?.report;
  if (JSON.stringify(Object.keys(report?.states || {}).sort()) !== JSON.stringify(["answered", "error", "partial", "question", "saved"])) errors.push("内容依存の5応答状態がありません");
  if (Object.hasOwn(report || {}, "shortLines")) errors.push("旧固定3項目がcurrent copyへ残っています");
  if (typeof report?.detailedSuffix !== "string" || !report.detailedSuffix.includes(":")) errors.push("必要時だけ使う詳細suffixがありません");
  return errors;
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const manifest = json(manifestPath);
const styleName = Object.keys(manifest.rules).find((name) => typeof manifest.rules[name].copy === "string");
const copyPath = join(rulesRoot, manifest.rules[styleName].copy);
const copy = json(copyPath);
const baseline = json(baselinePath);
const currentWizardBaseline = json(currentWizardBaselinePath);
const entrypoint = readFileSync(join(rulesRoot, "plain-language.md"), "utf8");
const safety = readFileSync(join(rulesRoot, "safety.md"), "utf8");
const evidence = readFileSync(join(rulesRoot, "evidence.md"), "utf8");
const common = readFileSync(join(rulesRoot, "common-language.md"), "utf8");
const style = readFileSync(join(rulesRoot, manifest.rules[styleName].path), "utf8");

assert.deepEqual(validateRuleGraph(manifest), [], "rule graphが不正です");
assert.deepEqual(validateCopy(copy), [], "copy境界が不正です");
assert.equal(baseline.schemaVersion, 1, "Sprint 029 historical baseline schemaを改変してはいけません");
assert.equal(baseline.surfaces.report.shortLines.length, 3, "Sprint 029 historical fixed shapeを履歴として保持します");

for (const rule of Object.values(manifest.rules)) assert(entrypoint.includes(rule.path), `entrypointが${rule.path}を参照していません`);
assert(entrypoint.includes("rule-manifest.json"), "entrypointがmanifestを参照していません");
assert(style.includes(`../${manifest.rules[styleName].copy}`), "styleが宣言的copyを参照していません");
for (const phrase of ["空または実質空", "secret", "明示確認", "push", "Repository Secret"]) assert(safety.includes(phrase), `安全契約が不足しています: ${phrase}`);
for (const phrase of ["実コネクタ", "edition.json", "4面copy", "根拠", "推測で断定しません"]) assert(evidence.includes(phrase), `証拠契約が不足しています: ${phrase}`);
for (const phrase of ["一般に通じる技術用語", "初出時", "幼稚なメタファー", "計画 → 道具 → 確認 → 結果", "common by design"]) assert(common.includes(phrase), `共通表現が不足しています: ${phrase}`);
for (const phrase of ["最終応答serializer（通常報告の唯一の正本）", "固定項目", "developer handoff"]) assert(style.includes(phrase), `active styleが不足しています: ${phrase}`);

assert.equal(currentWizardBaseline.schemaVersion, 1, "current wizard baseline schemaが不正です");
assert.deepEqual(Object.keys(currentWizardBaseline.assets).sort(), Object.keys(baseline.wizardAssets).sort(), "historical/current wizard inventoryが一致しません");
for (const [relative, expected] of Object.entries(baseline.wizardAssets)) {
  assert.match(expected, /^[a-f0-9]{64}$/, `Sprint 029 historical wizard digestが不正です: ${relative}`);
  const currentExpected = currentWizardBaseline.assets[relative];
  assert.match(currentExpected, /^[a-f0-9]{64}$/, `current wizard digestが不正です: ${relative}`);
  const bytes = readFileSync(join(repo, relative));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), currentExpected, `current wizard assetが受入済みbytesと一致しません: ${relative}`);
  const changed = Buffer.from(bytes);
  changed[0] ^= 1;
  assert.notEqual(createHash("sha256").update(changed).digest("hex"), currentExpected, `wizard assetの1byte変更を検出できません: ${relative}`);
}

for (const contract of protectedContracts) {
  const broken = structuredClone(manifest);
  broken.rules[styleName].overrides = [contract];
  assert(validateRuleGraph(broken).some((error) => error.includes("override")), `${contract}をstyleから弱める負fixtureを検出できません`);
}
const cyclic = structuredClone(manifest);
cyclic.rules.evidence.dependencies = [styleName];
assert(validateRuleGraph(cyclic).some((error) => error.includes("循環")), "循環する負fixtureを検出できません");
const missing = structuredClone(manifest);
missing.rules.safety.path = "missing-safety.md";
assert(validateRuleGraph(missing).some((error) => error.includes("参照先")), "欠落ruleの負fixtureを検出できません");
const wizardCopy = structuredClone(copy);
wizardCopy.surfaces.wizard = { cta: "次へ" };
assert(validateCopy(wizardCopy).length > 0, "wizard copy混入の負fixtureを検出できません");

process.stdout.write(`SPRINT029_RULE_PASS=${15 + Object.keys(baseline.wizardAssets).length + protectedContracts.length} SPRINT029_RULE_FAIL=0 WIZARD_DIGESTS=${Object.keys(baseline.wizardAssets).length}\n`);
process.stdout.write(`PASS=${15 + Object.keys(baseline.wizardAssets).length + protectedContracts.length} FAIL=0\n`);

export { validateCopy, validateRuleGraph };
