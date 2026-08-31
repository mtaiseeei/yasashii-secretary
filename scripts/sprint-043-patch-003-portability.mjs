#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT = JSON.parse(readFileSync(join(ROOT, "scripts/fixtures/sprint-043-patch-003/actual-action-report.json"), "utf8"));
const COMMANDS = [
  ["target", ["scripts/sprint-043-patch-003-test.mjs"], "YASASHII_SPRINT043_PATCH003_PASS=12 FAIL=0 SKIP=0 NOT_RUN=4"],
  ["classification", ["scripts/sprint-043-patch-003-classification.mjs"], "UNKNOWN=0 OVERLAP=0 MISSING=0 EXTRA=0 STALE=0 UNUSED=0 UNCLASSIFIED=0"],
  ["patch001", ["scripts/sprint-043-patch-001-test.mjs"], "SPRINT043_PATCH001_PASS=4 SPRINT043_PATCH001_FAIL=0"],
  ["patch002", ["scripts/sprint-043-patch-002-test.mjs"], "SPRINT043_PATCH002_TARGET_PASS=21 FAIL=0"],
  ["sprint042-core", ["scripts/sprint-042-core-test.mjs"], "SPRINT041_CASE_PASS=43 FAIL=0"],
  ["sprint043-e2e", ["scripts/sprint-043-e2e.mjs"], "SPRINT043_E2E PASS=4 FAIL=0"],
  ["collaboration", ["scripts/sprint-042-collaboration-test.mjs"], "SPRINT049_PASS=20 FAIL=0"],
  ["overlay", ["scripts/sprint-043-patch-002-overlay-test.mjs"], "secondChanged=0"],
  ["windows-092-portable", ["scripts/sprint-038-patch-002-windows-test.mjs"], "SPRINT038_PATCH002_WINDOWS_PASS=12 FAIL=0"],
];
function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8", shell: false, timeout: 180_000, maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" } });
}
function must(result, label, marker) {
  assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`);
  assert(result.stdout.includes(marker), `${label}: missing ${marker}\n${result.stdout}`);
}
function portableMode(base, path) {
  if (process.platform !== "win32") return (lstatSync(join(base, path)).mode & 0o111) ? "100755" : "100644";
  const result = run("git", ["-C", base, "ls-files", "--stage", "--", path], base);
  return result.status === 0 ? result.stdout.trim().split(/\s+/u)[0] : "100644";
}
function candidateDigest(base) {
  const hash = createHash("sha256");
  for (const row of [...REPORT.rows].sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)))) {
    const bytes = Buffer.from(readFileSync(join(base, row.path), "utf8").replaceAll("\r\n", "\n"));
    hash.update(row.path).update("\0").update(portableMode(base, row.path)).update("\0").update(bytes).update("\0");
  }
  return hash.digest("hex");
}
function inventory(base) {
  const source = "import {validateCollaborationInventory as v} from './scripts/lib/sprint-049-inventory.mjs'; const r=v(process.cwd()); console.log(JSON.stringify(r));";
  const result = run(process.execPath, ["--input-type=module", "-e", source], base);
  must(result, "inventory", '"surfaceCount":20');
  assert(result.stdout.includes('"caseCount":57'));
}
function verify(base, label) {
  for (const [name, args, marker] of COMMANDS) must(run(process.execPath, args, base), `${label}:${name}`, marker);
  inventory(base);
  return { label, digest: candidateDigest(base), gates: COMMANDS.length + 1 };
}

const source = verify(ROOT, "source");
if (!process.argv.includes("--three-surfaces")) {
  console.log(`YASASHII_SPRINT043_PATCH003_PORTABLE source=PASS digest=${source.digest} gates=${source.gates} windows_native=NOT-RUN network=0`);
  process.exit(0);
}
const work = mkdtempSync(join(tmpdir(), "yasashii-s043p003-"));
try {
  const clean = join(work, "clean"); const archive = join(work, "archive"); mkdirSync(clean); mkdirSync(archive);
  const filter = (sourcePath) => {
    const relative = sourcePath.slice(ROOT.length).replaceAll("\\", "/");
    return relative !== "/.git" && !relative.startsWith("/.git/");
  };
  cpSync(ROOT, clean, { recursive: true, filter }); cpSync(ROOT, archive, { recursive: true, filter });
  must(run("git", ["init", "-q"], clean), "clean:init", "");
  must(run("git", ["add", "-A"], clean), "clean:add", "");
  must(run("git", ["-c", "user.name=Clarity Fixture", "-c", "user.email=clarity@example.invalid", "commit", "-qm", "candidate"], clean), "clean:commit", "");
  assert.equal(run("git", ["status", "--porcelain=v1"], clean).stdout.trim(), "");
  assert.equal(existsSync(join(archive, ".git")), false);
  const cleanResult = verify(clean, "clean"); const archiveResult = verify(archive, "git-free");
  assert.equal(source.digest, cleanResult.digest); assert.equal(source.digest, archiveResult.digest);
  console.log(`YASASHII_SPRINT043_PATCH003_SURFACES source=PASS clean=PASS archive=PASS digest=${source.digest} gates=${source.gates}x3 target=12+4-NOT-RUN patch001=4 patch002=21 sprint042=43 sprint043_e2e=4 inventory=20/57 overlay=secondChanged0 windows_092_portable=12 archive_git=0 git_required_archive=NOT-CLAIMED windows_native=NOT-RUN clone=0 fetch=0 checkout=0 network=0 external_write=0`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
