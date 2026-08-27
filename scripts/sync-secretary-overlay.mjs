#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(valueAfter("--root") || defaultRoot);
const overlayRoot = join(root, "secretary-overlay");
const mode = args.find((arg) => ["--check", "--apply", "--reapply", "--record"].includes(arg));
const candidateValue = valueAfter("--candidate");
const observedCommit = valueAfter("--observed-commit");

if (!mode || !candidateValue) {
  console.error("usage: sync-secretary-overlay.mjs (--check|--apply|--reapply|--record) --candidate <read-only-tree> [--observed-commit <sha>]");
  process.exit(64);
}

const candidateRoot = resolve(candidateValue);
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const base = json(join(overlayRoot, "upstream-base.json"));
const mapping = json(join(overlayRoot, "mapping.json"));
const downstreamOwned = json(join(overlayRoot, "downstream-owned.json"));
const downstreamFiles = json(join(overlayRoot, "downstream-files.json"));
const metadata = json(join(overlayRoot, "metadata-overrides.json"));
const anchors = json(join(overlayRoot, "anchors.json"));
const snapshotPath = join(overlayRoot, "upstream-tree.json");
const overlayDefinitionPaths = [
  "anchors.json",
  "downstream-files.json",
  "downstream-owned.json",
  "mapping.json",
  "metadata-overrides.json",
  "upstream-base.json",
  "upstream-tree.json",
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slash = (path) => path.split(sep).join("/");
const readBytes = (basePath, path) => readFileSync(join(basePath, path));

function globRegex(pattern) {
  let output = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      output += ".*";
      index += 1;
    } else if (char === "*") {
      output += "[^/]*";
    } else {
      output += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`${output}$`);
}

const matchesAny = (path, patterns) => patterns.some((pattern) => globRegex(pattern).test(path));

function classify(path) {
  if (matchesAny(path, downstreamOwned.patterns)) return "repo-owned";
  if ((mapping.common || []).includes(path)) return "common";
  if (mapping.metadataOverlay.includes(path)) return "metadata-overlay";
  if (mapping.anchorOverlay.includes(path)) return "anchor-overlay";
  if (matchesAny(path, mapping.upstreamOnly)) return "upstream-only";
  if (mapping.defaultUpstreamClassification === "common") return "common";
  throw new Error(`unclassified upstream path: ${path}`);
}

function runGit(cwd, commandArgs, { allowFailure = false } = {}) {
  const result = spawnSync("git", ["-C", cwd, ...commandArgs], { encoding: "utf8" });
  if (result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`git ${commandArgs.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function walkFiles(directory, basePath = directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolute = join(directory, entry.name);
    const path = slash(relative(basePath, absolute));
    if (entry.isSymbolicLink()) throw new Error(`symbolic link is not accepted in overlay trees: ${path}`);
    if (entry.isDirectory()) output.push(...walkFiles(absolute, basePath));
    else if (entry.isFile()) output.push(path);
  }
  return output.sort();
}

function candidateFiles() {
  const tracked = runGit(candidateRoot, ["ls-files", "-z"], { allowFailure: true });
  if (tracked !== null) return tracked.split("\0").filter(Boolean).sort();
  return walkFiles(candidateRoot);
}

function currentCandidateCommit() {
  if (observedCommit) return observedCommit;
  return runGit(candidateRoot, ["rev-parse", "HEAD"], { allowFailure: true });
}

function recordSnapshot() {
  const commit = currentCandidateCommit();
  if (commit !== base.baseCommit) {
    throw new Error(`recorded base mismatch: expected ${base.baseCommit}, observed ${commit || "unavailable"}`);
  }
  const files = candidateFiles().map((path) => ({
    path,
    classification: classify(path),
    sha256: sha256(readBytes(candidateRoot, path)),
  }));
  const document = { schemaVersion: 1, baseCommit: base.baseCommit, files };
  writeFileSync(snapshotPath, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`RECORDED upstream=${base.baseCommit} files=${files.length}`);
}

function verifySnapshot() {
  const snapshot = json(snapshotPath);
  if (snapshot.baseCommit !== base.baseCommit || !Array.isArray(snapshot.files) || snapshot.files.length === 0) {
    throw new Error("upstream-tree.json is not recorded for the declared base");
  }
  const commit = currentCandidateCommit();
  if (commit && commit !== base.baseCommit) {
    console.error(`UPSTREAM_ADVANCE expected=${base.baseCommit} observed=${commit}`);
    const error = new Error("upstream advance requires a new reviewed base record");
    error.exitCode = 2;
    throw error;
  }
  const expected = new Map(snapshot.files.map((entry) => [entry.path, entry]));
  const observedPaths = candidateFiles();
  const observed = new Set(observedPaths);
  const added = observedPaths.filter((path) => !expected.has(path));
  const deleted = [...expected.keys()].filter((path) => !observed.has(path));
  if (added.length || deleted.length) {
    throw new Error(`upstream tree changed; added=[${added.join(", ")}] deleted=[${deleted.join(", ")}]`);
  }
  for (const entry of snapshot.files) {
    const actualClass = classify(entry.path);
    if (actualClass !== entry.classification) {
      throw new Error(`mapping classification changed: ${entry.path} ${entry.classification} -> ${actualClass}`);
    }
    const actualHash = sha256(readBytes(candidateRoot, entry.path));
    if (actualHash !== entry.sha256) throw new Error(`upstream allowlisted bytes changed: ${entry.path}`);
  }
  return snapshot;
}

function decodePointer(pointer) {
  if (!pointer.startsWith("/")) throw new Error(`invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function applyJsonOperations(path, bytes) {
  const document = JSON.parse(bytes.toString("utf8"));
  const operations = metadata.files[path];
  if (!Array.isArray(operations) || operations.length === 0) throw new Error(`metadata allowlist is missing: ${path}`);
  for (const operation of operations) {
    const parts = decodePointer(operation.pointer);
    const leaf = parts.pop();
    let cursor = document;
    for (const part of parts) {
      if (cursor === null || typeof cursor !== "object" || !(part in cursor)) {
        throw new Error(`metadata pointer anchor is missing: ${path} ${operation.pointer}`);
      }
      cursor = cursor[part];
    }
    if (operation.op === "set") cursor[leaf] = operation.value;
    else if (operation.op === "delete") {
      if (!(leaf in cursor)) throw new Error(`metadata delete anchor is missing: ${path} ${operation.pointer}`);
      delete cursor[leaf];
    } else throw new Error(`unsupported metadata operation: ${operation.op}`);
  }
  return Buffer.from(`${JSON.stringify(document, null, 2)}\n`);
}

function countOccurrences(source, match) {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = source.indexOf(match, offset);
    if (found < 0) return count;
    count += 1;
    offset = found + match.length;
  }
}

function applyAnchors(path, bytes) {
  let source = bytes.toString("utf8");
  const pathAnchors = anchors.anchors.filter((entry) => entry.path === path);
  if (pathAnchors.length === 0) throw new Error(`anchor overlay is missing: ${path}`);
  for (const anchor of pathAnchors) {
    const count = countOccurrences(source, anchor.match);
    if (count !== 1) throw new Error(`anchor ${anchor.id} expected once, found ${count}`);
    source = source.replace(anchor.match, anchor.replacement);
  }
  return Buffer.from(source);
}

function expectedManaged(snapshot) {
  const output = new Map();
  for (const entry of snapshot.files) {
    const source = readBytes(candidateRoot, entry.path);
    if (entry.classification === "common") output.set(entry.path, source);
    else if (entry.classification === "metadata-overlay") output.set(entry.path, applyJsonOperations(entry.path, source));
    else if (entry.classification === "anchor-overlay") output.set(entry.path, applyAnchors(entry.path, source));
  }
  return output;
}

function digestEntries(entries) {
  const hash = createHash("sha256");
  for (const [path, bytes] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(path).update("\0").update(bytes).update("\0");
  }
  return hash.digest("hex");
}

function ownedDigest() {
  const entries = [];
  for (const path of walkFiles(root)) {
    if (matchesAny(path, downstreamOwned.patterns)) entries.push([path, readBytes(root, path)]);
  }
  return digestEntries(entries);
}

function overlayDefinitionDigest() {
  return digestEntries(overlayDefinitionPaths.map((path) => [path, readBytes(overlayRoot, path)]));
}

function verifyIdentityHandoff() {
  const declared = base.identityHandoff;
  if (!declared?.manifest || !declared?.commonTreeSha256) {
    throw new Error("identity handoff declaration is missing");
  }
  const manifest = json(join(candidateRoot, declared.manifest));
  if (!Array.isArray(manifest.commonPaths) || manifest.commonPaths.length === 0) {
    throw new Error("identity handoff commonPaths is empty");
  }
  const hash = createHash("sha256");
  for (const path of [...manifest.commonPaths].sort()) {
    if (!existsSync(join(candidateRoot, path))) throw new Error(`identity handoff path is missing: ${path}`);
    const classification = classify(path);
    if (!["common", "anchor-overlay", "metadata-overlay"].includes(classification)) {
      throw new Error(`identity handoff path is not managed: ${path} (${classification})`);
    }
    hash.update(`${path}\0`).update(readBytes(candidateRoot, path)).update("\0");
  }
  const digest = hash.digest("hex");
  if (digest !== declared.commonTreeSha256) {
    throw new Error(`identity handoff digest mismatch: expected ${declared.commonTreeSha256}, observed ${digest}`);
  }
  return { digest, paths: manifest.commonPaths };
}

function expectedJson(expected, path) {
  const bytes = expected.get(path);
  if (!bytes) throw new Error(`required Yasashii identity surface is unmanaged: ${path}`);
  return JSON.parse(bytes.toString("utf8"));
}

function verifyYasashiiExpected(expected) {
  const claudeMarket = expectedJson(expected, ".claude-plugin/marketplace.json");
  const codexMarket = expectedJson(expected, ".agents/plugins/marketplace.json");
  const claudePlugin = expectedJson(expected, "plugins/secretary/.claude-plugin/plugin.json");
  const codexPlugin = expectedJson(expected, "plugins/secretary/.codex-plugin/plugin.json");
  const edition = expectedJson(expected, "plugins/secretary/edition.json");
  const ruleManifest = expectedJson(expected, "plugins/secretary/rules/rule-manifest.json");
  const failures = [];
  const requireValue = (condition, label) => { if (!condition) failures.push(label); };
  requireValue(claudeMarket.name === "yasashii-secretary" && claudeMarket.plugins?.[0]?.name === "yasashii-secretary", "Claude marketplace identity");
  requireValue(codexMarket.name === "yasashii-secretary" && codexMarket.plugins?.[0]?.name === "yasashii-secretary", "Codex marketplace identity");
  requireValue(claudePlugin.name === "yasashii-secretary" && claudePlugin.repository === "https://github.com/mtaiseeei/yasashii-secretary", "Claude manifest identity");
  requireValue(codexPlugin.name === "yasashii-secretary" && codexPlugin.repository === "https://github.com/mtaiseeei/yasashii-secretary", "Codex manifest identity");
  requireValue(edition.edition === "yasashii-secretary", "edition identity");
  requireValue(edition.distribution?.pluginId === "yasashii-secretary@yasashii-secretary", "install identity");
  requireValue(edition.distribution?.repository === "https://github.com/mtaiseeei/yasashii-secretary", "distribution repository");
  requireValue(edition.copy?.path === "rules/copy/yasashii.json", "Yasashii copy route");
  requireValue(edition.harness?.repository === "https://github.com/mtaiseeei/yasashii-harness", "Yasashii Harness repository");
  requireValue(edition.harness?.hosts?.claudeCode?.installId === "harness@yasashii-harness" && edition.harness?.hosts?.codex?.installId === "harness@yasashii-harness", "Yasashii Harness install identity");
  requireValue(Boolean(ruleManifest.rules?.["yasashii-style"]) && !ruleManifest.rules?.["agentic-style"], "Yasashii style rule");
  if (failures.length) throw new Error(`Yasashii protected surface changed: ${failures.join(", ")}`);

  const canonical = expected.get("plugins/secretary/CHANGELOG.md");
  const legacy = expected.get("plugins/yasashii-secretary/CHANGELOG.md");
  requireValue(Boolean(canonical) && Boolean(legacy) && canonical.equals(legacy), "canonical/legacy CHANGELOG parity");
  requireValue(Boolean(canonical) && canonical.toString("utf8").startsWith("# 変更履歴\n\n## [0.10.3]"), "0.10.3 CHANGELOG head");
  if (failures.length) throw new Error(`Yasashii protected surface changed: ${failures.join(", ")}`);
}

function verifyNeutralizationAncestor() {
  for (const [label, directory] of [["downstream", root], ["upstream", candidateRoot]]) {
    const inside = runGit(directory, ["rev-parse", "--is-inside-work-tree"], { allowFailure: true });
    if (inside !== "true") continue;
    const result = spawnSync("git", ["-C", directory, "merge-base", "--is-ancestor", base.neutralizationCommit, "HEAD"]);
    if (result.status !== 0) throw new Error(`${label} does not descend from neutralization commit ${base.neutralizationCommit}`);
  }
}

function verifyDownstreamInventory(snapshot) {
  const snapshotByPath = new Map(snapshot.files.map((entry) => [entry.path, entry]));
  const declaredDownstream = new Set(downstreamFiles.files);
  const unknown = [];
  const leaked = [];
  for (const path of walkFiles(root)) {
    if (matchesAny(path, downstreamOwned.patterns) || declaredDownstream.has(path)) continue;
    const upstream = snapshotByPath.get(path);
    if (!upstream) unknown.push(path);
    else if (upstream.classification === "upstream-only") leaked.push(path);
  }
  const missingDownstream = [...declaredDownstream].filter((path) => !existsSync(join(root, path)));
  if (unknown.length || leaked.length || missingDownstream.length) {
    throw new Error(`downstream inventory mismatch; unclassified=[${unknown.join(", ")}] upstream-only=[${leaked.join(", ")}] missing=[${missingDownstream.join(", ")}]`);
  }
}

function compareExpected(expected) {
  const mismatches = [];
  for (const [path, bytes] of expected) {
    const target = join(root, path);
    if (!existsSync(target)) mismatches.push(`${path}:missing`);
    else if (sha256(readFileSync(target)) !== sha256(bytes)) mismatches.push(`${path}:bytes`);
  }
  if (mismatches.length) throw new Error(`overlay check failed: ${mismatches.join(", ")}`);
}

function writeExpected(expected) {
  let changed = 0;
  for (const [path, bytes] of expected) {
    const sourcePath = join(candidateRoot, path);
    const target = join(root, path);
    const same = existsSync(target) && sha256(readFileSync(target)) === sha256(bytes);
    if (same) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    const modeBits = lstatSync(sourcePath).mode & 0o777;
    chmodSync(target, modeBits);
    changed += 1;
  }
  return changed;
}

function prepare() {
  if (!existsSync(candidateRoot) || !lstatSync(candidateRoot).isDirectory()) throw new Error(`candidate directory is missing: ${candidateRoot}`);
  const snapshot = verifySnapshot();
  const handoff = verifyIdentityHandoff();
  verifyNeutralizationAncestor();
  const expected = expectedManaged(snapshot);
  verifyYasashiiExpected(expected);
  return { snapshot, expected, handoff };
}

function applyOnce() {
  const { snapshot, expected } = prepare();
  verifyDownstreamInventory(snapshot);
  const beforeOwned = ownedDigest();
  const beforeOverlay = overlayDefinitionDigest();
  const changed = writeExpected(expected);
  const afterOwned = ownedDigest();
  const afterOverlay = overlayDefinitionDigest();
  if (beforeOwned !== afterOwned) throw new Error("repo-owned files changed during overlay apply");
  if (beforeOverlay !== afterOverlay) throw new Error("overlay definitions changed during overlay apply");
  verifyDownstreamInventory(snapshot);
  compareExpected(expected);
  verifyYasashiiExpected(expected);
  return { snapshot, expected, changed, ownedDigest: afterOwned, overlayDigest: afterOverlay };
}

try {
  if (mode === "--record") {
    recordSnapshot();
  } else if (mode === "--check") {
    const { snapshot, expected, handoff } = prepare();
    verifyDownstreamInventory(snapshot);
    compareExpected(expected);
    console.log(`OVERLAY_CHECK_PASS base=${base.baseCommit} managed=${expected.size} handoffPaths=${handoff.paths.length} handoffDigest=${handoff.digest} repoOwnedDigest=${ownedDigest()} overlayDigest=${overlayDefinitionDigest()}`);
    console.log(`REMOTE_GATE ${base.externalLiveGate} origin=${base.remoteContract.originRepository} upstreamFetch=${base.remoteContract.upstreamFetchRepository} upstreamPush=${base.remoteContract.upstreamPush}`);
  } else if (mode === "--apply") {
    const result = applyOnce();
    console.log(`OVERLAY_APPLY_PASS base=${base.baseCommit} changed=${result.changed} managed=${result.expected.size} repoOwnedDigest=${result.ownedDigest} overlayDigest=${result.overlayDigest}`);
  } else if (mode === "--reapply") {
    const first = applyOnce();
    const firstDigest = digestEntries(first.expected);
    const second = applyOnce();
    const secondDigest = digestEntries(second.expected);
    if (firstDigest !== secondDigest || second.changed !== 0 || first.ownedDigest !== second.ownedDigest || first.overlayDigest !== second.overlayDigest) {
      throw new Error("overlay reapply is not idempotent");
    }
    console.log(`OVERLAY_REAPPLY_PASS digest=${secondDigest} secondChanged=${second.changed} repoOwnedDigest=${second.ownedDigest} overlayDigest=${second.overlayDigest}`);
  }
} catch (error) {
  console.error(`OVERLAY_FAIL ${error.message}`);
  process.exit(error.exitCode || 1);
}
