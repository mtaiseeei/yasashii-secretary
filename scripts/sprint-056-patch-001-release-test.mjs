#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = realpathSync(mkdtempSync(join(process.env.TMPDIR || tmpdir(), "sprint056-patch001-release-")));
let pass = 0;
let fail = 0;
function check(label, condition, detail = "") {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`); }
}
function run(binary, args, cwd) { return spawnSync(binary, args, { cwd, encoding: "utf8" }); }
function archive(name) {
  const target = join(temporaryRoot, name);
  for (const rel of [".claude-plugin", ".agents/plugins", "plugins/secretary", "plugins/yasashii-secretary", "scripts/check-release-integrity.py", "scripts/archive-release-gate.mjs", "LICENSE"]) {
    const source = join(root, rel);
    const destination = join(target, rel);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }
  return target;
}
function mutateManifest(target, rel, change) {
  const path = join(target, "plugins/secretary/migrations", rel);
  const value = JSON.parse(readFileSync(path, "utf8"));
  change(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
function rejected(label, mutate) {
  const target = archive(label.replace(/[^a-z0-9]+/giu, "-"));
  mutate(target);
  const result = run("python3", [join(target, "scripts/check-release-integrity.py"), "--root", target], target);
  check(label, result.status === 1 && /^FAIL /mu.test(result.stdout), `${result.stdout}${result.stderr}`);
}
function rejectedByCheckoutAndArchive(label, mutate) {
  const target = archive(label.replace(/[^a-z0-9]+/giu, "-"));
  mutate(target);
  const checkout = run("python3", [join(target, "scripts/check-release-integrity.py"), "--root", target], target);
  check(`${label} in checkout guard`, checkout.status !== 0 && /^FAIL /mu.test(checkout.stdout), `${checkout.stdout}${checkout.stderr}`);
  const archiveGate = run(process.execPath, [join(target, "scripts/archive-release-gate.mjs"), "--root", target], target);
  check(`${label} in Git-free archive guard`, archiveGate.status !== 0 && /ARCHIVE_RELEASE_FAIL=[1-9]\d*/u.test(archiveGate.stdout), `${archiveGate.stdout}${archiveGate.stderr}`);
}

try {
  const checkout = run("python3", [join(root, "scripts/check-release-integrity.py"), "--root", root], root);
  check("checkout release integrity validates all supported paths", checkout.status === 0, `${checkout.stdout}${checkout.stderr}`);
  const cleanArchive = archive("clean");
  const canonicalChangelog = join(cleanArchive, "plugins/secretary/CHANGELOG.md");
  const legacyChangelog = join(cleanArchive, "plugins/yasashii-secretary/CHANGELOG.md");
  const crlfChangelog = readFileSync(canonicalChangelog, "utf8").replace(/(?<!\r)\n/gu, "\r\n");
  writeFileSync(canonicalChangelog, crlfChangelog);
  writeFileSync(legacyChangelog, crlfChangelog);
  const archiveGate = run(process.execPath, [join(cleanArchive, "scripts/archive-release-gate.mjs"), "--root", cleanArchive], cleanArchive);
  check("Git-free archive validates CRLF CHANGELOG with identical canonical/legacy bytes", archiveGate.status === 0 && readFileSync(canonicalChangelog).equals(readFileSync(legacyChangelog)) && /ARCHIVE_RELEASE_FAIL=0/u.test(archiveGate.stdout), `${archiveGate.stdout}${archiveGate.stderr}`);

  rejected("missing Yasashii 0.10.3 edge is rejected", (target) => rmSync(join(target, "plugins/secretary/migrations/0.10.3-to-0.12.0.json")));
  rejected("cycle or downgrade edge is rejected", (target) => writeFileSync(join(target, "plugins/secretary/migrations/0.13.0-to-0.12.0.json"), `${JSON.stringify({ schemaVersion: 1, fromVersion: "0.13.0", toVersion: "0.12.0", contentChanged: false, operations: [] }, null, 2)}\n`));
  rejected("duplicate operation id is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => value.operations.push({ ...value.operations[0] })));
  rejectedByCheckoutAndArchive("missing required operation metadata is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => { delete value.operations[0].marker; }));
  rejectedByCheckoutAndArchive("cross-edge duplicate operation id is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => { value.operations[0].id = "memory-request-v1"; }));
  rejected("filename and manifest metadata mismatch is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => { value.toVersion = "0.12.0"; }));
  rejected("invalid or missing asset is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => { value.operations[0].asset = "assets/missing.md"; }));
  rejected("root-external asset is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => { value.operations[0].asset = "../../../../LICENSE"; }));
  rejected("managed content difference with empty operations is rejected", (target) => mutateManifest(target, "0.10.1-to-0.10.2.json", (value) => { value.operations = []; value.contentChanged = true; }));
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write(`SPRINT056_PATCH001_RELEASE_PASS=${pass} SPRINT056_PATCH001_RELEASE_FAIL=${fail}\n`);
process.exitCode = fail ? 1 : 0;
