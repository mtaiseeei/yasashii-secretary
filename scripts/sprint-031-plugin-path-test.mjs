#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { latestRelease } from "../plugins/secretary/scripts/update-diagnose.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "secretary");
const legacyRoot = join(root, "plugins", "yasashii-secretary");
const canonicalChangelog = join(pluginRoot, "CHANGELOG.md");
const legacyChangelog = join(legacyRoot, "CHANGELOG.md");
const validator = join(root, "scripts", "check-release-integrity.py");
const temporaryRoot = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "sprint031-plugin-path-"));
let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
  } else {
    fail += 1;
    process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`);
  }
}

function json(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runValidator(fixtureRoot) {
  return spawnSync("python3", [join(fixtureRoot, "scripts", "check-release-integrity.py"), "--root", fixtureRoot], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
}

function copyDistribution(target) {
  mkdirSync(join(target, "plugins"), { recursive: true });
  mkdirSync(join(target, "scripts"), { recursive: true });
  cpSync(join(root, ".claude-plugin"), join(target, ".claude-plugin"), { recursive: true });
  cpSync(pluginRoot, join(target, "plugins", "secretary"), { recursive: true });
  cpSync(legacyRoot, join(target, "plugins", "yasashii-secretary"), { recursive: true });
  cpSync(join(root, "scripts", "check-release-integrity.py"), join(target, "scripts", "check-release-integrity.py"));
  cpSync(join(root, "LICENSE"), join(target, "LICENSE"));
}

function treeDigest(directory) {
  const hash = createHash("sha256");
  function visit(current, relative = "") {
    for (const name of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, name.name);
      const rel = relative ? `${relative}/${name.name}` : name.name;
      hash.update(`${name.isDirectory() ? "d" : "f"}:${rel}\0`);
      if (name.isDirectory()) visit(path, rel);
      else hash.update(readFileSync(path));
    }
  }
  visit(directory);
  return hash.digest("hex");
}

function response(body, contentType) {
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

try {
  const market = JSON.parse(readFileSync(join(root, ".claude-plugin", "marketplace.json"), "utf8"));
  const entry = market.plugins?.[0] || {};
  const plugin = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"));
  const config = JSON.parse(readFileSync(join(pluginRoot, "edition.json"), "utf8"));
  const legacyEntries = readdirSync(legacyRoot).sort();
  const canonicalBytes = readFileSync(canonicalChangelog);
  const legacyBytes = readFileSync(legacyChangelog);
  const versionPattern = /^## \[(\d+\.\d+\.\d+)\](?: - \d{4}-\d{2}-\d{2})?$/gm;
  const canonicalVersions = [...canonicalBytes.toString("utf8").matchAll(versionPattern)].map((match) => match[1]);
  const legacyVersions = [...legacyBytes.toString("utf8").matchAll(versionPattern)].map((match) => match[1]);

  check("plugin implementation has one neutral root", existsSync(join(pluginRoot, "skills")) && entry.source === "./plugins/secretary");
  check("legacy path contains only complete CHANGELOG", legacyEntries.length === 1 && legacyEntries[0] === "CHANGELOG.md");
  check("canonical and legacy CHANGELOG bytes match", canonicalBytes.equals(legacyBytes));
  check("canonical and legacy CHANGELOG version entries match", canonicalVersions.length > 0 && JSON.stringify(canonicalVersions) === JSON.stringify(legacyVersions) && canonicalVersions[0] === entry.version);
  check(
    "external plugin identity is separate from internal path",
    config.distribution.pluginId === `${plugin.name}@${market.name}`
      && config.distribution.marketplaceId === market.name
      && !config.distribution.pluginId.includes("plugins/")
      && entry.source !== config.distribution.pluginId,
  );
  check(
    "legacy raw CHANGELOG URL remains configured",
    config.distribution.changelogUrl.endsWith("/plugins/yasashii-secretary/CHANGELOG.md")
      && !config.distribution.changelogUrl.endsWith("/plugins/secretary/CHANGELOG.md"),
  );

  const fetchedUrls = [];
  const release = await latestRelease(
    { values: new Map(), flags: new Set() },
    {
      config,
      fetchImpl: async (url) => {
        fetchedUrls.push(String(url));
        if (String(url) === config.distribution.marketplaceUrl) {
          return response(JSON.stringify(market), "application/json");
        }
        if (String(url) === config.distribution.changelogUrl) {
          return response(legacyBytes, "text/markdown; charset=utf-8");
        }
        return new Response("not found", { status: 404 });
      },
    },
  );
  check(
    "old raw URL fixture resolves latest release and impact",
    release.version === entry.version
      && release.sections?.["変わること"]?.length > 0
      && release.sections?.["設定・ファイルへの影響"]?.length > 0
      && fetchedUrls.includes(config.distribution.changelogUrl),
  );

  const legacyWorkspace = join(temporaryRoot, "legacy-workspace");
  mkdirSync(join(legacyWorkspace, "secretary"), { recursive: true });
  writeFileSync(join(legacyWorkspace, "secretary", "CLAUDE.md"), "<!-- yasashii-secretary:update-entry:v1:start -->\nlegacy fixture\n");
  const latestManifest = join(temporaryRoot, "legacy-marketplace.json");
  json(latestManifest, market);
  const beforeDiagnosis = treeDigest(legacyWorkspace);
  const diagnosis = spawnSync(process.execPath, [
    join(pluginRoot, "scripts", "update-diagnose.mjs"),
    "--plugin-root", pluginRoot,
    "--workspace", legacyWorkspace,
    "--latest-manifest", latestManifest,
    "--changelog", legacyChangelog,
    "--json",
  ], { cwd: root, encoding: "utf8" });
  let diagnosisJson = {};
  try { diagnosisJson = JSON.parse(diagnosis.stdout); } catch { /* assertion reports malformed output */ }
  check(
    "legacy raw URL style diagnose is read-only and complete",
    diagnosis.status === 0
      && diagnosisJson.mode === "diagnosis-read-only"
      && diagnosisJson.currentVersion === entry.version
      && diagnosisJson.latestVersion === entry.version
      && diagnosisJson.workspaceEdition?.state === "legacy-yasashii"
      && diagnosisJson.latest?.sections?.["変わること"]?.length > 0
      && diagnosisJson.latest?.sections?.["設定・ファイルへの影響"]?.length > 0
      && Object.values(diagnosisJson.sideEffects || {}).every((value) => value === 0)
      && treeDigest(legacyWorkspace) === beforeDiagnosis,
    `${diagnosis.stderr}${diagnosis.stdout}`,
  );

  const fixture = join(temporaryRoot, "distribution");
  copyDistribution(fixture);
  const baseline = runValidator(fixture);
  check("release validator accepts neutral path", baseline.status === 0, `${baseline.stdout}${baseline.stderr}`);

  const fixtureMarketPath = join(fixture, ".claude-plugin", "marketplace.json");
  const fixtureMarket = JSON.parse(readFileSync(fixtureMarketPath, "utf8"));
  fixtureMarket.plugins[0].source = "./plugins/yasashii-secretary";
  json(fixtureMarketPath, fixtureMarket);
  const oldSource = runValidator(fixture);
  check("validator rejects legacy implementation source", oldSource.status !== 0 && /plugin source/.test(oldSource.stdout));
  json(fixtureMarketPath, market);

  const canonicalFixture = join(fixture, "plugins", "secretary");
  const brokenCanonical = join(fixture, "plugins", "secretary-broken");
  renameSync(canonicalFixture, brokenCanonical);
  const missingCanonical = runValidator(fixture);
  check("validator rejects broken canonical path", missingCanonical.status !== 0 && /release surface unreadable|distributed plugin/.test(missingCanonical.stdout));
  renameSync(brokenCanonical, canonicalFixture);

  const legacyFixture = join(fixture, "plugins", "yasashii-secretary", "CHANGELOG.md");
  appendFileSync(legacyFixture, "\nlegacy mismatch\n");
  const mismatch = runValidator(fixture);
  check("validator rejects legacy CHANGELOG mismatch", mismatch.status !== 0 && /byte-for-byte/.test(mismatch.stdout));
  cpSync(join(fixture, "plugins", "secretary", "CHANGELOG.md"), legacyFixture);

  mkdirSync(join(fixture, "plugins", "yasashii-secretary", "skills"));
  writeFileSync(join(fixture, "plugins", "yasashii-secretary", "skills", "duplicate.md"), "duplicate implementation\n");
  const duplicate = runValidator(fixture);
  check("validator rejects implementation duplication under legacy path", duplicate.status !== 0 && /only CHANGELOG/.test(duplicate.stdout));
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.stdout.write(`SPRINT031_PATH_PASS=${pass} SPRINT031_PATH_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
