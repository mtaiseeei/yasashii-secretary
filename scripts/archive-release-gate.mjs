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
const codexMarketPath = join(root, ".agents", "plugins", "marketplace.json");
const codexPluginPath = join(root, "plugins", "secretary", ".codex-plugin", "plugin.json");
const supportedMigrationPath = join(root, "plugins", "secretary", "migrations", "supported.json");
try {
  const market = JSON.parse(readFileSync(marketPath, "utf8"));
  const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
  const codexMarket = JSON.parse(readFileSync(codexMarketPath, "utf8"));
  const codexPlugin = JSON.parse(readFileSync(codexPluginPath, "utf8"));
  const supportedMigration = JSON.parse(readFileSync(supportedMigrationPath, "utf8"));
  const entry = market.plugins?.[0] || {};
  const codexEntry = codexMarket.plugins?.[0] || {};
  check("current Claude and Codex candidate version is 0.13.2", entry.version === "0.13.2" && plugin.version === "0.13.2" && codexPlugin.version === "0.13.2");
  check("author and MIT are present", JSON.stringify(entry.author) === JSON.stringify({ name: "mtaiseeei" }) && JSON.stringify(plugin.author) === JSON.stringify({ name: "mtaiseeei" }) && entry.license === "MIT" && plugin.license === "MIT");
  check("forkedFrom uses the single credit", entry.forkedFrom === "https://github.com/Shin-sibainu/cc-company");
  check("plugin source is present", entry.source === "./plugins/secretary" && existsSync(join(root, entry.source.slice(2))));
  check("Codex marketplace uses the formal local source", codexMarket.name === "yasashii-secretary" && codexEntry.name === "yasashii-secretary" && codexEntry.source?.source === "local" && codexEntry.source?.path === "./plugins/secretary");
  check("Codex manifest uses the 17 shared skills and common Hook", codexPlugin.name === "yasashii-secretary" && codexPlugin.skills === "./skills/" && codexPlugin.hooks === "./hooks/hooks.json" && readdirSync(join(root, "plugins/secretary/skills")).filter((name) => existsSync(join(root, "plugins/secretary/skills", name, "SKILL.md"))).length === 17);
  check("all published update sources are declared for migration reachability", JSON.stringify(supportedMigration.supportedFrom) === JSON.stringify(["0.8.0", "0.9.0", "0.9.1", "0.9.2", "0.10.0", "0.10.1", "0.10.2", "0.10.3", "0.12.0", "0.13.0", "0.13.1"]));
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
check("0.8.0 to 0.9.0 migration is included", existsSync(join(root, "plugins", "secretary", "migrations", "0.8.0-to-0.9.0.json")));
process.stdout.write(`ARCHIVE_RELEASE_PASS=${pass} ARCHIVE_RELEASE_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
