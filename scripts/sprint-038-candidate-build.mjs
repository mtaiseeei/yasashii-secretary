#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { candidateDigest } from "./sprint-038-candidate-digest.mjs";

const BASE_COMMIT = "d9a62755ff78db12c435f225cdd40e95f86a8055";
const SNAPSHOT_RELATIVE = "scripts/fixtures/sprint-038/candidate-source-snapshot.json";
const INPUTS_RELATIVE = "scripts/fixtures/sprint-038/candidate-inputs.json";
const EXCLUDED_SOURCE_PATHS = new Set([
  "docs/sprints/state.md",
  "docs/progress/sprint-038.md",
  "docs/feedback/sprint-038.md",
  SNAPSHOT_RELATIVE,
  INPUTS_RELATIVE,
]);

function value(name, { optional = false } = {}) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    if (optional) return null;
    throw new Error(`missing ${name}`);
  }
  return resolve(process.argv[index + 1]);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout || "").trim()}`);
  return result.stdout.trim();
}

function git(root, args, options = {}) {
  return run("git", ["-C", root, ...args], options);
}

function overlayDigest(baseCommit, entries) {
  return createHash("sha256").update(JSON.stringify({ baseCommit, entries })).digest("hex");
}

function sourceChanges(source) {
  const changed = git(source, ["diff", "--name-status", "-z", BASE_COMMIT]).split("\0").filter(Boolean);
  const statuses = new Map();
  for (let index = 0; index < changed.length;) {
    const status = changed[index++];
    const path = changed[index++];
    if (status.startsWith("R") || status.startsWith("C")) throw new Error(`rename-copy-not-supported:${path}`);
    statuses.set(path, status[0]);
  }
  const untracked = git(source, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
  for (const path of untracked) statuses.set(path, "A");
  const entries = [];
  for (const [path, status] of [...statuses].sort(([a], [b]) => Buffer.from(a).compare(Buffer.from(b)))) {
    if (EXCLUDED_SOURCE_PATHS.has(path) || path.startsWith("docs/feedback/sprint-038") || path.startsWith("docs/progress/sprint-038")) continue;
    if (status === "D") entries.push({ path, status: "D" });
    else {
      const absolute = join(source, path);
      const stat = lstatSync(absolute);
      if (!stat.isFile()) throw new Error(`snapshot-entry-not-file:${path}`);
      entries.push({ path, status, mode: stat.mode & 0o111 ? "100755" : "100644", bytesBase64: readFileSync(absolute).toString("base64") });
    }
  }
  return entries;
}

function recordSource(source) {
  if (git(source, ["rev-parse", "HEAD"]) !== BASE_COMMIT) throw new Error("source-head-does-not-match-sprint-start");
  const entries = sourceChanges(source);
  const document = {
    schemaVersion: 1,
    baseCommit: BASE_COMMIT,
    exclusions: [...EXCLUDED_SOURCE_PATHS],
    algorithm: "sha256(JSON.stringify({baseCommit,entries}))",
    entries,
  };
  document.overlaySha256 = overlayDigest(document.baseCommit, document.entries);
  const target = join(source, SNAPSHOT_RELATIVE);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document)}\n`);
  console.log(JSON.stringify({ recorded: target, entries: entries.length, overlaySha256: document.overlaySha256 }));
}

function loadSnapshot(source) {
  const document = JSON.parse(readFileSync(join(source, SNAPSHOT_RELATIVE), "utf8"));
  if (document.schemaVersion !== 1 || document.baseCommit !== BASE_COMMIT || !Array.isArray(document.entries)) throw new Error("invalid-source-snapshot");
  if (overlayDigest(document.baseCommit, document.entries) !== document.overlaySha256) throw new Error("source-snapshot-digest-mismatch");
  return document;
}

function applySnapshot(root, snapshot) {
  for (const entry of snapshot.entries) {
    const target = join(root, entry.path);
    if (entry.status === "D") rmSync(target, { force: true, recursive: true });
    else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(entry.bytesBase64, "base64"));
      chmodSync(target, entry.mode === "100755" ? 0o755 : 0o644);
    }
  }
}

function cloneAgentic(source, destination, snapshot) {
  run("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", source, destination]);
  git(destination, ["checkout", "--quiet", snapshot.baseCommit]);
  applySnapshot(destination, snapshot);
  // The source snapshot cannot contain itself. Copy the already-verified
  // reconstruction metadata after applying its content-addressed entries so
  // the candidate still carries the exact inputs needed for an audit rebuild.
  for (const relative of [SNAPSHOT_RELATIVE, INPUTS_RELATIVE]) {
    const target = join(destination, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(source, relative), target, { force: true, dereference: false, preserveTimestamps: false });
    chmodSync(target, 0o644);
  }
  git(destination, ["add", "-A"]);
  run("git", ["-C", destination, "commit", "--quiet", "-m", "[sprint-038] retry2 content-addressed candidate"], {
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Sprint 038 Candidate",
      GIT_AUTHOR_EMAIL: "sprint038@example.invalid",
      GIT_COMMITTER_NAME: "Sprint 038 Candidate",
      GIT_COMMITTER_EMAIL: "sprint038@example.invalid",
      GIT_AUTHOR_DATE: "2026-07-31T12:00:00+09:00",
      GIT_COMMITTER_DATE: "2026-07-31T12:00:00+09:00",
    },
  });
  return { commit: git(destination, ["rev-parse", "HEAD"]), tree: git(destination, ["rev-parse", "HEAD^{tree}"]) };
}

function copyVerifiedSeed(seed, destination, expected) {
  const observed = candidateDigest(seed);
  if (observed.files !== expected.files || observed.sha256 !== expected.sha256) throw new Error(`seed-digest-mismatch:${expected.name}`);
  mkdirSync(destination, { recursive: false });
  for (const name of execFileSync("find", [seed, "-mindepth", "1", "-maxdepth", "1", "-print0"]).toString().split("\0").filter(Boolean)) {
    if (name.endsWith("/.git") || name.endsWith("/docs/progress/sprint-038.md") || name.endsWith("/docs/feedback/sprint-038.md") || name.endsWith("/docs/sprints/state.md")) continue;
    cpSync(name, join(destination, name.slice(seed.length + 1)), { recursive: true, dereference: false, preserveTimestamps: false });
  }
  return observed;
}

function updateYasashiiBase(yasashii, commit) {
  const path = join(yasashii, "secretary-overlay/upstream-base.json");
  const document = JSON.parse(readFileSync(path, "utf8"));
  document.baseCommit = commit;
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
}

function runYasashiiOverlay(yasashii, agentic, commit) {
  updateYasashiiBase(yasashii, commit);
  const script = join(yasashii, "scripts/sync-secretary-overlay.mjs");
  const common = [script, "--candidate", agentic, "--observed-commit", commit];
  const record = run(process.execPath, [common[0], "--record", ...common.slice(1)], { cwd: yasashii });
  const apply = run(process.execPath, [common[0], "--apply", ...common.slice(1)], { cwd: yasashii });
  const check = run(process.execPath, [common[0], "--check", ...common.slice(1)], { cwd: yasashii });
  return { record, apply, check };
}

function overlayPrivate(agentic, privateRoot) {
  const from = join(agentic, "scripts");
  const to = join(privateRoot, "scripts");
  cpSync(from, to, { recursive: true, force: true, dereference: false, preserveTimestamps: false });
  const commonFiles = [
    "plugins/secretary/scripts/lib/conversation-contract.mjs",
    "plugins/secretary/scripts/lib/conversation-migration.mjs",
    "plugins/secretary/scripts/update-apply.mjs",
    "plugins/secretary/rules/conversation-contract.md",
    "plugins/secretary/migrations/0.8.0-to-0.9.0.json",
    "plugins/secretary/migrations/assets/conversation-contract-v1.md",
    "plugins/secretary/migrations/assets/conversation-contract-v2.md",
  ];
  for (const relative of commonFiles) {
    const target = join(privateRoot, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(agentic, relative), target, { force: true, dereference: false, preserveTimestamps: false });
  }
}

function main() {
  const source = value("--source");
  if (process.argv.includes("--record-source")) { recordSource(source); return; }
  const yasashiiSeed = value("--yasashii-seed");
  const privateSeed = value("--private-seed");
  const output = value("--output");
  if (existsSync(output)) throw new Error("candidate-output-already-exists");
  const inputs = JSON.parse(readFileSync(join(source, INPUTS_RELATIVE), "utf8"));
  const snapshot = loadSnapshot(source);
  if (inputs.baseCommit !== snapshot.baseCommit || inputs.overlaySha256 !== snapshot.overlaySha256) throw new Error("candidate-input-metadata-mismatch");
  mkdirSync(output, { recursive: false });
  const agentic = join(output, "agentic");
  const yasashii = join(output, "yasashii");
  const privateRoot = join(output, "private");
  const identity = cloneAgentic(source, agentic, snapshot);
  const seedResults = {
    yasashii: copyVerifiedSeed(yasashiiSeed, yasashii, inputs.seeds.yasashii),
    private: copyVerifiedSeed(privateSeed, privateRoot, inputs.seeds.private),
  };
  const overlay = runYasashiiOverlay(yasashii, agentic, identity.commit);
  overlayPrivate(agentic, privateRoot);
  const candidates = {
    agentic: candidateDigest(agentic),
    yasashii: candidateDigest(yasashii),
    private: candidateDigest(privateRoot),
  };
  const report = { output, inputs: { baseCommit: snapshot.baseCommit, overlaySha256: snapshot.overlaySha256, seeds: seedResults }, identity, overlay, candidates };
  writeFileSync(join(output, "candidate-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
