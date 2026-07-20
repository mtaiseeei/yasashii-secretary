#!/usr/bin/env node

// Small archive-only assertions.  It intentionally has no Git dependency so
// it can be shipped and executed from a source archive.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const rootIndex = argv.indexOf("--root");
const root = resolve(rootIndex >= 0 ? argv[rootIndex + 1] : process.cwd());
const validatorPath = join(root, "scripts", "check-release-integrity.py");
let pass = 0;
let fail = 0;
function check(label, condition) {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stdout.write(`FAIL ${label}\n`); }
}

check("archive root has no .git", !existsSync(join(root, ".git")));
const marketPath = join(root, ".claude-plugin", "marketplace.json");
const pluginPath = join(root, "plugins", "secretary", ".claude-plugin", "plugin.json");
try {
  const market = JSON.parse(readFileSync(marketPath, "utf8"));
  const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
  const entry = market.plugins?.[0] || {};
  check("marketplace/plugin version is 0.8.0", entry.version === "0.8.0" && plugin.version === "0.8.0");
  check("author and MIT are present", JSON.stringify(entry.author) === JSON.stringify({ name: "mtaiseeei" }) && JSON.stringify(plugin.author) === JSON.stringify({ name: "mtaiseeei" }) && entry.license === "MIT" && plugin.license === "MIT");
  check("forkedFrom uses the single credit", entry.forkedFrom === "https://github.com/Shin-sibainu/cc-company");
  check("plugin source is present", entry.source === "./plugins/secretary" && existsSync(join(root, entry.source.slice(2))));
} catch (error) {
  check(`distribution manifests parse (${error.message})`, false);
}
const validatorIncluded = existsSync(validatorPath);
check("release validator is included", validatorIncluded);
if (validatorIncluded) {
  const validator = spawnSync("python3", [validatorPath, "--root", root], {
    cwd: root,
    encoding: "utf8",
  });
  const validatorOutput = `${validator.stdout || ""}${validator.stderr || ""}`.trim();
  if (validatorOutput) process.stdout.write(`${validatorOutput}\n`);
  check(
    "release validator passes",
    validator.status === 0 && !validator.error,
    validator.error?.message || `exit=${validator.status}`,
  );
}
const canonicalChangelog = join(root, "plugins", "secretary", "CHANGELOG.md");
const legacyRoot = join(root, "plugins", "yasashii-secretary");
const legacyChangelog = join(legacyRoot, "CHANGELOG.md");
check("canonical CHANGELOG is included", existsSync(canonicalChangelog));
check("legacy path contains only CHANGELOG", existsSync(legacyChangelog) && readdirSync(legacyRoot).join("\0") === "CHANGELOG.md");
check("canonical and legacy CHANGELOG bytes match", existsSync(canonicalChangelog) && existsSync(legacyChangelog) && readFileSync(canonicalChangelog).equals(readFileSync(legacyChangelog)));
check("0.7.0 to 0.8.0 migration is included", existsSync(join(root, "plugins", "secretary", "migrations", "0.7.0-to-0.8.0.json")));
process.stdout.write(`ARCHIVE_RELEASE_PASS=${pass} ARCHIVE_RELEASE_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
