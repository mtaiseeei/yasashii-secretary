#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
}

function run(command, args, options = {}) {
  const encoding = Object.hasOwn(options, "encoding") ? options.encoding : "utf8";
  const result = spawnSync(command, args, { encoding, cwd: options.cwd, input: options.input, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${String(result.error?.message || result.stderr || "").trim()}`);
  return options.encoding === null ? result.stdout : String(result.stdout).trim();
}

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function bytes(root, path) { return readFileSync(join(root, path)); }
function digest(root, path) { return sha(bytes(root, path)); }

function normalizeManifestRoot(publicRoot, definition) {
  if (!definition || typeof definition.root !== "string" || !definition.root.trim()) throw new Error("invalid-public-whole-tree-root");
  if (!Array.isArray(definition.exclusions) || definition.exclusions.length === 0) throw new Error("invalid-public-whole-tree-exclusions:empty");
  const root = definition.root.replaceAll("\\", "/");
  if (root.startsWith("/") || root.split("/").includes("..")) throw new Error(`invalid-public-whole-tree-root:${root}`);
  const absolute = resolve(publicRoot, root);
  if (relative(publicRoot, absolute).startsWith("..") || !existsSync(absolute) || !lstatSync(absolute).isDirectory()) {
    throw new Error(`public-whole-tree-root-not-found:${root}`);
  }
  const exclusions = definition.exclusions.map((pattern) => {
    if (typeof pattern !== "string" || !pattern || pattern.startsWith("/") || pattern.split("/").includes("..")) {
      throw new Error(`invalid-public-whole-tree-exclusion:${String(pattern)}`);
    }
    const normalized = pattern.replaceAll("\\", "/");
    const wildcard = normalized.endsWith("/**");
    const stem = wildcard ? normalized.slice(0, -3) : normalized;
    if (!stem || stem.includes("*") || stem.includes("?")) throw new Error(`invalid-public-whole-tree-exclusion:${pattern}`);
    return { pattern: normalized, stem, wildcard };
  });
  return { root, absolute, exclusions };
}

function publicTreePaths(publicRoot, definition) {
  const config = normalizeManifestRoot(publicRoot, definition);
  const paths = [];
  const excluded = (path) => config.exclusions.some((item) => item.wildcard
    ? path === item.stem || path.startsWith(`${item.stem}/`)
    : path === item.stem);
  function visit(current) {
    for (const name of readdirSync(current).sort((a, b) => a.localeCompare(b, "en"))) {
      const absolute = join(current, name);
      const rel = relative(config.absolute, absolute).replaceAll("\\", "/");
      if (excluded(rel)) continue;
      const stat = lstatSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile()) paths.push(rel);
      else throw new Error(`unsupported-public-tree-entry:${rel}`);
    }
  }
  visit(config.absolute);
  const protectedControlPaths = paths.filter((path) => path === ".git" || path.startsWith(".git/")
    || path === "docs/sprints/state.md" || path.startsWith("docs/progress/") || path.startsWith("docs/feedback/"));
  if (protectedControlPaths.length) throw new Error(`public-whole-tree-control-path-included:${protectedControlPaths.join(",")}`);
  return { ...config, paths: sorted(paths) };
}

function candidateDigest(root, treeDefinition) {
  const hash = createHash("sha256");
  const paths = publicTreePaths(root, { ...treeDefinition, root: "." }).paths;
  for (const path of paths) {
    const mode = lstatSync(join(root, path)).mode & 0o111 ? "100755" : "100644";
    hash.update(path).update("\0").update(mode).update("\0").update(bytes(root, path)).update("\0");
  }
  return { algorithm: "sorted-relative-path-NUL-mode-NUL-bytes-NUL", files: paths.length, sha256: hash.digest("hex") };
}

function copyPublicTree(source, destination, paths) {
  mkdirSync(destination, { recursive: false });
  for (const path of paths) {
    const target = join(destination, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(source, path), target, { force: true, dereference: false, preserveTimestamps: false });
    chmodSync(target, lstatSync(join(source, path)).mode & 0o111 ? 0o755 : 0o644);
  }
}

function materializeFixedBase(source, head, destination) {
  mkdirSync(destination, { recursive: false });
  const archive = run("git", ["-C", source, "archive", "--format=tar", head], { encoding: null });
  run("tar", ["-xf", "-", "-C", destination], { input: archive });
  return new Set(run("git", ["-C", source, "ls-tree", "-r", "--name-only", head]).split("\n").filter(Boolean));
}

function mode(root, path) { return lstatSync(join(root, path)).mode & 0o111 ? "100755" : "100644"; }

function treeEntries(root, treeDefinition) {
  return new Map(publicTreePaths(root, { ...treeDefinition, root: "." }).paths.map((path) => [path, { path, mode: mode(root, path), sha256: digest(root, path) }]));
}

function changedEntries(before, after) {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  return paths.filter((path) => JSON.stringify(before.get(path) ?? null) !== JSON.stringify(after.get(path) ?? null)).map((path) => ({
    path,
    before: before.get(path) ?? null,
    after: after.get(path) ?? null,
  }));
}

function sorted(values) { return [...new Set(values)].sort((a, b) => Buffer.from(a).compare(Buffer.from(b))); }

function intersection(left, right) {
  const rightSet = new Set(right);
  return sorted(left.filter((item) => rightSet.has(item)));
}

function roleSets(handoff, edition) {
  if (edition.id === "agentic") return { parity: [], adapted: [], supporting: [] };
  const adapted = sorted(edition.roles.adapted ?? []);
  const adaptedSet = new Set(adapted);
  return {
    parity: sorted([...(handoff.sharedParity ?? []).filter((path) => !adaptedSet.has(path)), ...(edition.roles.parity ?? [])]),
    adapted,
    supporting: sorted(edition.roles.supporting ?? []),
  };
}

function validateRoleDeclaration(publicRoot, baseRoot, handoff, edition, roles) {
  const overlaps = {
    parityAdapted: intersection(roles.parity, roles.adapted),
    paritySupporting: intersection(roles.parity, roles.supporting),
    adaptedSupporting: intersection(roles.adapted, roles.supporting),
  };
  if (Object.values(overlaps).some((items) => items.length)) throw new Error(`${edition.id}:role-overlap:${JSON.stringify(overlaps)}`);
  for (const path of roles.parity) if (!existsSync(join(publicRoot, path))) throw new Error(`${edition.id}:stale-path:parity:${path}`);
  for (const path of [...roles.adapted, ...roles.supporting]) if (!existsSync(join(baseRoot, path))) throw new Error(`${edition.id}:stale-path:base:${path}`);
  const protectedPaths = sorted((edition.protected ?? []).map((item) => item.path));
  const unusedSupporting = roles.supporting.filter((path) => !protectedPaths.includes(path));
  const undeclaredProtected = protectedPaths.filter((path) => !roles.supporting.includes(path));
  if (unusedSupporting.length) throw new Error(`${edition.id}:unused-declaration:${unusedSupporting.join(",")}`);
  if (undeclaredProtected.length) throw new Error(`${edition.id}:undeclared-protect:${undeclaredProtected.join(",")}`);
  const transformationPaths = sorted(Object.keys(edition.transformations ?? {}));
  const missingTransformations = roles.adapted.filter((path) => !transformationPaths.includes(path));
  const unusedTransformations = transformationPaths.filter((path) => !roles.adapted.includes(path));
  if (missingTransformations.length) throw new Error(`${edition.id}:missing-transformation:${missingTransformations.join(",")}`);
  if (unusedTransformations.length) throw new Error(`${edition.id}:unused-transformation:${unusedTransformations.join(",")}`);
  for (const [path, definition] of Object.entries(edition.transformations ?? {})) {
    if (!definition.input || !definition.transformer || !Array.isArray(definition.anchors) || definition.anchors.length === 0) throw new Error(`${edition.id}:invalid-transformation:${path}`);
  }
  return overlaps;
}

function countOccurrences(body, anchor) {
  if (typeof anchor !== "string" || !anchor) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = body.indexOf(anchor, offset)) >= 0) {
    count += 1;
    offset += anchor.length;
  }
  return count;
}

const transformationAnchors = {
  "yasashii-secretary-identity": ["# agentic-secretary —", "開発の入口（Agentic Harness）"],
  "yasashii-style-and-copy": ["styles/agentic.md", "copy/agentic.json"],
  "schema2-runtime-input": [
    "assert.equal(fixture.schemaVersion, 1);",
    '"quote", "hearsay", "hypothetical", "correction"',
    '["caseId", "edition", "input", "precondition", "expected", "requiredResponseElements", "forbiddenPhrases", "meaning", "beforeSnapshot", "afterSnapshot"]',
    "// exclusively on this oracle side of the comparison.\n    const observed = runConversationScenario({ input: item.input, precondition: item.precondition });",
  ],
  "private-daily-memory-boundary": ["3. 当日のdecisionが0件なら", "この内容を決定として残しますね:", "次の別ターンで明示的な了承を得た後だけ記録する。"],
  "private-memory-sections": ["## 1. 記憶の追加・更新", "## 3. 節目プロトコル", "確認済みの相談要点を案件メモへ追加"],
  "private-project-memory-boundary": ["判断は原文を示して確認した後だけ"],
  "private-secretary-checkpoint-section": ["## 会話中の節目（全モード共通）", "## 成果物を保存するとき（出力規約）"],
  "private-settings-memory-boundary": ["`pref-note-add` は末尾追記だけに使い"],
};

function beginTransformation(publicRoot, candidateRoot, edition, path, expectedTransformer) {
  const definition = edition.transformations?.[path];
  if (!definition) return null;
  if (definition.transformer !== expectedTransformer) {
    throw new Error(`${edition.id}:transformation-mismatch:${path}:${definition.transformer}:${expectedTransformer}`);
  }
  const inputRoot = definition.input === "public-source" ? publicRoot : candidateRoot;
  if (!["public-source", "fixed-base", "fixed-base-and-public-source"].includes(definition.input)) {
    throw new Error(`${edition.id}:invalid-transformation-input:${path}:${definition.input}`);
  }
  const body = readFileSync(join(inputRoot, path), "utf8");
  const anchorEvidence = definition.anchors.map((anchor) => ({
    anchor,
    input: definition.input === "public-source" ? "public-source" : "fixed-base",
    occurrenceCount: countOccurrences(body, anchor),
    applicationCount: 0,
  }));
  for (const evidence of anchorEvidence) {
    if (evidence.occurrenceCount !== 1) {
      throw new Error(`${edition.id}:transformation-anchor-count:${path}:${JSON.stringify(evidence.anchor)}:${evidence.occurrenceCount}`);
    }
  }
  if (JSON.stringify(definition.anchors) !== JSON.stringify(transformationAnchors[expectedTransformer])) {
    throw new Error(`${edition.id}:transformation-anchor-mismatch:${path}`);
  }
  return { path, input: definition.input, transformer: definition.transformer, anchors: [...definition.anchors], anchorEvidence, applicationCount: 0 };
}

function completeTransformation(record, before, after) {
  if (!record) return null;
  if (Buffer.compare(before, after) === 0) throw new Error(`transformation-produced-no-change:${record.path}`);
  record.applicationCount += 1;
  for (const evidence of record.anchorEvidence) evidence.applicationCount += 1;
  if (record.applicationCount !== 1 || record.anchorEvidence.some((item) => item.applicationCount !== 1)) {
    throw new Error(`transformation-application-count:${record.path}:${record.applicationCount}`);
  }
  return record;
}

function copyFile(sourceRoot, candidateRoot, path) {
  const source = join(sourceRoot, path);
  if (!existsSync(source) || !lstatSync(source).isFile()) throw new Error(`common-path-missing:${path}`);
  const target = join(candidateRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { force: true, dereference: false, preserveTimestamps: false });
  chmodSync(target, lstatSync(source).mode & 0o111 ? 0o755 : 0o644);
}

function markdownSection(body, heading, nextHeading) {
  const start = body.indexOf(heading);
  const end = body.indexOf(nextHeading, start + heading.length);
  if (start < 0 || end < 0) throw new Error(`section-not-found:${heading}`);
  return body.slice(start, end);
}

function replaceSection(body, heading, nextHeading, replacement) {
  const start = body.indexOf(heading);
  const end = body.indexOf(nextHeading, start + heading.length);
  if (start < 0 || end < 0) throw new Error(`candidate-section-not-found:${heading}`);
  return `${body.slice(0, start)}${replacement.trimEnd()}\n\n${body.slice(end)}`;
}

function adaptPrivate(publicRoot, candidateRoot, edition) {
  const transformerByPath = {
    "plugins/secretary/skills/daily/SKILL.md": "private-daily-memory-boundary",
    "plugins/secretary/skills/memory-care/SKILL.md": "private-memory-sections",
    "plugins/secretary/skills/projects/SKILL.md": "private-project-memory-boundary",
    "plugins/secretary/skills/secretary/SKILL.md": "private-secretary-checkpoint-section",
    "plugins/secretary/skills/settings/SKILL.md": "private-settings-memory-boundary",
    "scripts/sprint-038-test.mjs": "schema2-runtime-input",
  };
  const transformationRecords = Object.fromEntries(Object.entries(transformerByPath).map(([path, transformer]) => [
    path,
    beginTransformation(publicRoot, candidateRoot, edition, path, transformer),
  ]));
  const before = Object.fromEntries(Object.keys(transformerByPath).map((path) => [path, bytes(candidateRoot, path)]));
  const publicMemory = readFileSync(join(publicRoot, "plugins/secretary/skills/memory-care/SKILL.md"), "utf8");
  const memoryPath = join(candidateRoot, "plugins/secretary/skills/memory-care/SKILL.md");
  let memory = readFileSync(memoryPath, "utf8");
  memory = replaceSection(memory, "## 1. 記憶の追加・更新", "## 2.", markdownSection(publicMemory, "## 1. 記憶の追加・更新", "## 2."));
  memory = replaceSection(memory, "## 3. 節目プロトコル", "## 4.", markdownSection(publicMemory, "## 3. 節目プロトコル", "## 4."));
  if (!memory.includes("save-memory <secretary>")) {
    memory = memory.replace(
      /\| 確認済みの相談要点を案件メモへ追加[^\n]*\n/u,
      (line) => `${line}| 明示memory依頼を保存しlocal checkpoint | \`node "\${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs" save-memory <secretary> <decision\\|topic> <YYYY-MM-DD> "<題名>" '<意味tuple JSON>' "<表示要点>" [--checkpoint]\` |\n`,
    );
  }
  for (const marker of [
    "explicit-memory-request=run-once",
    "content-uncertainty=preserve",
    "retry-after-checkpoint-failure=commit-only",
  ]) {
    if (!memory.includes(marker)) memory = `${memory.trimEnd()}\n\n<!-- ${marker} -->\n`;
  }
  writeFileSync(memoryPath, memory);

  const publicSecretary = readFileSync(join(publicRoot, "plugins/secretary/skills/secretary/SKILL.md"), "utf8");
  const secretaryPath = join(candidateRoot, "plugins/secretary/skills/secretary/SKILL.md");
  let secretary = readFileSync(secretaryPath, "utf8");
  let section = markdownSection(publicSecretary, "## 会話中の節目（全モード共通）", "## 成果物を保存するとき（出力規約）");
  section = section.replaceAll("secretary/memory/preferences.md", "vault/05_secretary/memory/preferences.md");
  secretary = replaceSection(secretary, "## 会話中の節目（全モード共通）", "## 成果物を保存するとき（出力規約）", section);
  writeFileSync(secretaryPath, secretary);

  const insertions = [
    ["plugins/secretary/skills/settings/SKILL.md", "`pref-note-add` は末尾追記だけに使い", "この確認は自発提案だけに適用する。利用者が「この好みを覚えて」と明示した場合は、memory scopeの許可を\n内部分類のために取り直さず、同じturnで正規シームを1回実行する。推量や留保は内容属性として残す。\n"],
    ["plugins/secretary/skills/projects/SKILL.md", "判断は原文を示して確認した後だけ", "一般memoryへの明示保存を内部分類の確認へ戻さない。ただしPJ固有であることが明示済みの判断はこのPJ正本へ1回だけ保存し、\n一般memoryへ重複させない。秘書からPJメモ保存を提案する場合だけ内容を示して確認する。\n\n"],
  ];
  for (const [path, anchor, insertion] of insertions) {
    const absolute = join(candidateRoot, path);
    let body = readFileSync(absolute, "utf8");
    if (!body.includes(insertion.trim())) {
      const at = body.indexOf(anchor);
      if (at < 0) throw new Error(`private-adaptation-anchor-missing:${path}`);
      body = `${body.slice(0, at)}${insertion}${body.slice(at)}`;
      writeFileSync(absolute, body);
    }
  }

  const dailyPath = join(candidateRoot, "plugins/secretary/skills/daily/SKILL.md");
  let daily = readFileSync(dailyPath, "utf8");
  daily = daily.replace(/^.*この内容を決定として残しますね.*\r?\n/mu, "")
    .replace(/^.*次の別ターンで.*\r?\n/mu, "");
  if (!daily.includes("伝聞・推量・訂正は内容属性として保持")) {
    daily = daily.replace(/(3\. 当日のdecisionが0件なら[^\n]*\n)([\s\S]*?)(    候補も無ければ)/u,
      "$1   利用者が「覚えて」と明示した決定はmemoryへの許可済み依頼として同じturnで1回記録し、保存するか自体が曖昧な候補だけ副作用0で1問確認する。\n   伝聞・推量・訂正は内容属性として保持し、明示保存を取り消す理由にしない。\n$3");
    writeFileSync(dailyPath, daily);
  }

  const sprint038Path = join(candidateRoot, "scripts/sprint-038-test.mjs");
  let sprint038 = readFileSync(sprint038Path, "utf8");
  const schemaAssertion = "assert.equal(fixture.schemaVersion, 1);";
  const oldBoundaries = '"quote", "hearsay", "hypothetical", "correction"';
  const oldEvidenceKeys = '["caseId", "edition", "input", "precondition", "expected", "requiredResponseElements", "forbiddenPhrases", "meaning", "beforeSnapshot", "afterSnapshot"]';
  if (!sprint038.includes(schemaAssertion) || !sprint038.includes(oldBoundaries)) {
    throw new Error("private-adaptation-anchor-missing:scripts/sprint-038-test.mjs");
  }
  const oldRunnerCall = "const observed = runConversationScenario({ input: item.input, precondition: item.precondition });";
  if (!sprint038.includes(oldEvidenceKeys) || !sprint038.includes(oldRunnerCall)) throw new Error("private-adaptation-anchor-missing:scripts/sprint-038-test.mjs:runtime-input");
  sprint038 = sprint038.replace(schemaAssertion, "assert.equal(fixture.schemaVersion, 2);")
    .replace(oldBoundaries, '"quote", "hearsay", "hypothetical", "request-hedge", "content-speculation", "content-hearsay", "correction"')
    .replace(oldEvidenceKeys, '["caseId", "edition", "input", "precondition", "classifierInput", "expected", "requiredResponseElements", "forbiddenPhrases", "meaning", "beforeSnapshot", "afterSnapshot"]')
    .replace(oldRunnerCall, "const observed = runConversationScenario({ input: item.input, precondition: item.precondition, classifierInput: item.classifierInput, execution: item.execution });");
  writeFileSync(sprint038Path, sprint038);
  const mutated = [
    "plugins/secretary/skills/daily/SKILL.md",
    "plugins/secretary/skills/memory-care/SKILL.md",
    "plugins/secretary/skills/projects/SKILL.md",
    "plugins/secretary/skills/secretary/SKILL.md",
    "plugins/secretary/skills/settings/SKILL.md",
    "scripts/sprint-038-test.mjs",
  ];
  return {
    mutated,
    copied: [],
    transformations: Object.fromEntries(mutated.map((path) => [
      path,
      completeTransformation(transformationRecords[path], before[path], bytes(candidateRoot, path)),
    ]).filter(([, evidence]) => evidence)),
  };
}

function adaptYasashii(publicRoot, candidateRoot, edition) {
  const transformerByPath = {
    "plugins/secretary/skills/secretary/SKILL.md": "yasashii-secretary-identity",
    "scripts/sprint-010-regression.sh": "yasashii-style-and-copy",
    "scripts/sprint-038-test.mjs": "schema2-runtime-input",
  };
  const transformationRecords = Object.fromEntries(Object.entries(transformerByPath).map(([path, transformer]) => [
    path,
    beginTransformation(publicRoot, candidateRoot, edition, path, transformer),
  ]));
  const copied = [];
  const secretaryRelative = "plugins/secretary/skills/secretary/SKILL.md";
  copyFile(publicRoot, candidateRoot, secretaryRelative);
  copied.push(secretaryRelative);
  const secretaryPath = join(candidateRoot, secretaryRelative);
  const secretaryBefore = bytes(candidateRoot, secretaryRelative);
  let secretary = readFileSync(secretaryPath, "utf8");
  secretary = secretary.replace("# agentic-secretary —", "# yasashii-secretary —")
    .replace("開発の入口（Agentic Harness）", "開発の入口（やさしいハーネス）");
  writeFileSync(secretaryPath, secretary);
  const regressionPath = join(candidateRoot, "scripts/sprint-010-regression.sh");
  copyFile(publicRoot, candidateRoot, "scripts/sprint-010-regression.sh");
  copied.push("scripts/sprint-010-regression.sh");
  const regressionBefore = bytes(candidateRoot, "scripts/sprint-010-regression.sh");
  let regression = readFileSync(regressionPath, "utf8");
  regression = regression.replaceAll("styles/agentic.md", "styles/yasashii.md")
    .replaceAll("copy/agentic.json", "copy/yasashii.json");
  writeFileSync(regressionPath, regression);

  const sprint038Path = join(candidateRoot, "scripts/sprint-038-test.mjs");
  const sprint038Before = bytes(candidateRoot, "scripts/sprint-038-test.mjs");
  let sprint038 = readFileSync(sprint038Path, "utf8");
  const schemaAssertion = "assert.equal(fixture.schemaVersion, 1);";
  const oldBoundaries = '"quote", "hearsay", "hypothetical", "correction"';
  const oldEvidenceKeys = '["caseId", "edition", "input", "precondition", "expected", "requiredResponseElements", "forbiddenPhrases", "meaning", "beforeSnapshot", "afterSnapshot"]';
  if (!sprint038.includes(schemaAssertion) || !sprint038.includes(oldBoundaries)) {
    throw new Error("yasashii-adaptation-anchor-missing:scripts/sprint-038-test.mjs");
  }
  const oldRunnerCall = "const observed = runConversationScenario({ input: item.input, precondition: item.precondition });";
  if (!sprint038.includes(oldEvidenceKeys) || !sprint038.includes(oldRunnerCall)) throw new Error("yasashii-adaptation-anchor-missing:scripts/sprint-038-test.mjs:runtime-input");
  sprint038 = sprint038.replace(schemaAssertion, "assert.equal(fixture.schemaVersion, 2);")
    .replace(oldBoundaries, '"quote", "hearsay", "hypothetical", "request-hedge", "content-speculation", "content-hearsay", "correction"')
    .replace(oldEvidenceKeys, '["caseId", "edition", "input", "precondition", "classifierInput", "expected", "requiredResponseElements", "forbiddenPhrases", "meaning", "beforeSnapshot", "afterSnapshot"]')
    .replace(oldRunnerCall, "const observed = runConversationScenario({ input: item.input, precondition: item.precondition, classifierInput: item.classifierInput, execution: item.execution });");
  writeFileSync(sprint038Path, sprint038);
  const mutated = [
    secretaryRelative,
    "scripts/sprint-010-regression.sh",
    "scripts/sprint-038-test.mjs",
  ];
  const before = {
    [secretaryRelative]: secretaryBefore,
    "scripts/sprint-010-regression.sh": regressionBefore,
    "scripts/sprint-038-test.mjs": sprint038Before,
  };
  return {
    mutated,
    copied,
    transformations: Object.fromEntries(mutated.map((path) => [
      path,
      completeTransformation(transformationRecords[path], before[path], bytes(candidateRoot, path)),
    ]).filter(([, evidence]) => evidence)),
  };
}

function markerCounts(root, inventory) {
  const bodies = inventory.surfaces.map((item) => existsSync(join(root, item.path)) ? readFileSync(join(root, item.path), "utf8") : "");
  return Object.fromEntries(inventory.requiredMarkers.map((marker) => [marker, bodies.filter((body) => body.includes(marker)).length]));
}

function candidateInventory(root, sourceInventory, tracked, editionId) {
  return sourceInventory.surfaces.map((item) => ({
    ...item,
    appliesToEdition: item.editions.includes(editionId),
    requiredMarkers: item.requiredMarkers ?? [],
    candidateSha256: digest(root, item.path),
    tracked: tracked.has(item.path),
  }));
}

function main() {
  const publicRoot = option("--public-root", scriptRoot);
  const output = option("--output");
  const yasashiiSource = option("--yasashii-source", resolve(publicRoot, "../yasashii-secretary"));
  const privateSource = option("--private-source", resolve(publicRoot, "../agentic-secretary-my-vault"));
  const manifestPath = option("--manifest", join(publicRoot, "scripts/fixtures/sprint-040/downstream-handoff.json"));
  const skipExecute = process.argv.includes("--skip-execute");
  if (!output) throw new Error("--output is required");
  if (existsSync(output)) throw new Error("candidate-output-already-exists");

  const handoff = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (handoff.schemaVersion !== 3) throw new Error(`unsupported-handoff-schema:${handoff.schemaVersion}`);
  const inventory = JSON.parse(readFileSync(join(publicRoot, handoff.inventory), "utf8"));
  const publicTree = publicTreePaths(publicRoot, handoff.publicWholeTree);
  mkdirSync(output, { recursive: false });
  const reports = [];

  for (const edition of handoff.editions) {
    const candidate = join(output, edition.id);
    let tracked;
    let baseMarkerCounts;
    let baseEntries = new Map();
    let roles;
    let actualDiff = [];
    let transformationEvidence = {};
    let overlaps = { parityAdapted: [], paritySupporting: [], adaptedSupporting: [] };
    const trace = { read: [handoff.inventory, "scripts/fixtures/sprint-040/downstream-handoff.json"], copy: [], write: [], execute: [], protect: [] };
    if (edition.id === "agentic") {
      copyPublicTree(publicTree.absolute, candidate, publicTree.paths);
      tracked = existsSync(join(publicRoot, ".git"))
        ? new Set(run("git", ["-C", publicRoot, "ls-files"]).split("\n").filter(Boolean))
        : new Set(publicTree.paths);
      baseMarkerCounts = markerCounts(candidate, inventory);
      roles = { parity: publicTree.paths, adapted: [], supporting: [] };
      trace.read.push(...roles.parity);
      trace.copy.push(...roles.parity);
      trace.write.push(...roles.parity);
    } else {
      const source = edition.sourceKey === "yasashii" ? yasashiiSource : privateSource;
      tracked = materializeFixedBase(source, edition.baseHead, candidate);
      baseMarkerCounts = markerCounts(candidate, inventory);
      baseEntries = treeEntries(candidate, handoff.publicWholeTree);
      roles = roleSets(handoff, edition);
      overlaps = validateRoleDeclaration(publicRoot, candidate, handoff, edition, roles);
      for (const path of roles.parity) {
        copyFile(publicRoot, candidate, path);
        tracked.add(path);
        trace.read.push(path);
        trace.copy.push(path);
        trace.write.push(path);
      }
      const adaptation = edition.id === "yasashii" ? adaptYasashii(publicRoot, candidate, edition) : adaptPrivate(publicRoot, candidate, edition);
      transformationEvidence = adaptation.transformations;
      trace.read.push(...adaptation.mutated);
      trace.copy.push(...adaptation.copied);
      trace.write.push(...adaptation.mutated);
      for (const path of adaptation.mutated) tracked.add(path);
      const undeclaredMutations = sorted(adaptation.mutated.filter((path) => !roles.adapted.includes(path)));
      const unusedAdapted = sorted(roles.adapted.filter((path) => !adaptation.mutated.includes(path)));
      if (undeclaredMutations.length) throw new Error(`${edition.id}:undeclared-mutation:${undeclaredMutations.join(",")}`);
      if (unusedAdapted.length) throw new Error(`${edition.id}:unused-declaration:${unusedAdapted.join(",")}`);
      actualDiff = changedEntries(baseEntries, treeEntries(candidate, handoff.publicWholeTree));
      const classifiedChanges = new Set([...roles.parity, ...roles.adapted]);
      const unclassified = actualDiff.map((item) => item.path).filter((path) => !classifiedChanges.has(path));
      if (unclassified.length) throw new Error(`${edition.id}:actual-diff-unclassified:${unclassified.join(",")}`);
      for (const path of roles.parity) {
        if (digest(candidate, path) !== digest(publicRoot, path) || mode(candidate, path) !== mode(publicRoot, path)) throw new Error(`${edition.id}:parity-mismatch:${path}`);
      }
      for (const path of roles.adapted) {
        if (!actualDiff.some((item) => item.path === path)) throw new Error(`${edition.id}:adapted-not-changed:${path}`);
      }
    }
    const protectedBefore = Object.fromEntries((edition.protected ?? []).map((item) => [item.path, item.sha256]));
    const protectedAfter = Object.fromEntries((edition.protected ?? []).map((item) => [item.path, digest(candidate, item.path)]));
    for (const item of edition.protected ?? []) {
      trace.read.push(item.path);
      trace.protect.push(item.path);
      if (protectedAfter[item.path] !== item.sha256) throw new Error(`${edition.id}:protected-changed:${item.path}`);
      if (actualDiff.some((entry) => entry.path === item.path)) throw new Error(`${edition.id}:supporting-changed:${item.path}`);
    }
    if (!skipExecute) {
      const suitePath = join(candidate, edition.suite);
      const suiteOutput = run("bash", [suitePath, edition.id], { cwd: candidate });
      process.stdout.write(`${suiteOutput}\n`);
      trace.execute.push(edition.suite);
    }
    const actualInventory = candidateInventory(candidate, inventory, tracked, edition.id);
    const identity = candidateDigest(candidate, handoff.publicWholeTree);
    const declaredUnion = sorted([...roles.parity, ...roles.adapted, ...roles.supporting]);
    const roleRecords = Object.fromEntries(Object.entries(roles).map(([role, paths]) => [role, paths.map((path) => {
      const transformation = edition.transformations?.[path] ?? null;
      const evidence = transformationEvidence[path] ?? null;
      return {
        path,
        input: transformation?.input ?? (role === "parity" ? "public-source" : "fixed-base"),
        actions: Object.entries(trace).filter(([, actionPaths]) => actionPaths.includes(path)).map(([action]) => action),
        reason: role === "supporting" ? "protected-digest" : undefined,
        transformer: evidence?.transformer,
        anchors: evidence?.anchors,
        anchorEvidence: evidence?.anchorEvidence,
        applicationCount: evidence?.applicationCount,
        finalSha256: digest(candidate, path),
      };
    })]));
    reports.push({
      id: edition.id,
      candidateRoot: edition.id,
      baseHead: edition.baseHead,
      previousCandidateId: handoff.previousCandidateIds[edition.id],
      baseMarkerCounts,
      candidateMarkerCounts: markerCounts(candidate, inventory),
      protectedBefore,
      protectedAfter,
      roles: roleRecords,
      roleCounts: Object.fromEntries(Object.entries(roles).map(([role, paths]) => [role, paths.length])),
      roleIntersections: overlaps,
      declaredInputUnion: declaredUnion,
      actualCandidateDiff: actualDiff,
      actualCandidateDiffPaths: actualDiff.map((item) => item.path),
      trace: Object.fromEntries(Object.entries(trace).map(([action, paths]) => [action, sorted(paths)])),
      inventory: actualInventory,
      candidate: identity,
      suite: edition.suite,
    });
  }

  const report = {
    schemaVersion: 3,
    publicationStatus: handoff.publicationStatus,
    notExecuted: handoff.notExecuted,
    manifestSha256: sha(readFileSync(manifestPath)),
    sourceInventorySha256: digest(publicRoot, handoff.inventory),
    publicWholeTree: {
      root: handoff.publicWholeTree.root,
      exclusions: handoff.publicWholeTree.exclusions,
      paths: publicTree.paths,
      pathCount: publicTree.paths.length,
    },
    candidates: reports,
  };
  writeFileSync(join(output, "candidate-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  for (const item of reports) console.log(`SPRINT040_${item.id.toUpperCase().replaceAll("-", "_")}_CANDIDATE=${item.candidate.sha256} FILES=${item.candidate.files}`);
  console.log(`SPRINT040_CANDIDATE_BUILD_PASS=${reports.length} FAIL=0`);
}

try { main(); } catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
