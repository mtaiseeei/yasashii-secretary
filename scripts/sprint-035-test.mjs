#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expectedHarnessFromEdition, validateHarnessSnapshot } from "./lib/harness-compat.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins/secretary");
const resolver = join(plugin, "scripts/resolve-plugin-root.mjs");
const expectedSkills = [
  "build", "chatwork", "connections", "daily", "google-chat", "memory-care", "onboarding",
  "projects", "secretary", "settings", "setup-google", "setup-microsoft", "setup-notion", "update", "weekly",
];

let pass = 0;
let fail = 0;
function check(label, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    fail += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const section = (source, start, end) => {
  const from = source.indexOf(start);
  assert(from >= 0, `section start is missing: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert(to > from, `section end is missing: ${end}`);
  return source.slice(from, to);
};
const runResolver = (skillFile, cwd = tmpdir()) => spawnSync(
  process.execPath,
  [resolver, "--skill-file", skillFile],
  { cwd, encoding: "utf8", env: { PATH: process.env.PATH || "" } },
);

check("15 skills use one host-neutral root contract", () => {
  const actual = expectedSkills.filter((name) => existsSync(join(plugin, "skills", name, "SKILL.md")));
  assert.deepEqual(actual, expectedSkills);
  for (const name of actual) {
    const source = readFileSync(join(plugin, "skills", name, "SKILL.md"), "utf8");
    assert(source.includes("## plugin root（必須）"), name);
    assert(source.includes("scripts/resolve-plugin-root.mjs"), name);
    assert(source.includes("`${SECRETARY_PLUGIN_ROOT}`"), name);
    assert(!source.includes("${CLAUDE_PLUGIN_ROOT}"), name);
    assert(!source.includes("CLAUDE_PLUGIN_ROOT"), name);
  }
});

check("every bundled reference resolves from the selected SKILL path", () => {
  for (const name of expectedSkills) {
    const skillFile = join(plugin, "skills", name, "SKILL.md");
    const result = runResolver(skillFile, "/");
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), plugin);
    const source = readFileSync(skillFile, "utf8");
    for (const match of source.matchAll(/\$\{SECRETARY_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+)/g)) {
      assert(existsSync(join(plugin, match[1].replace(/\/$/, ""))), `${name}: ${match[1]}`);
    }
  }
});

const temp = mkdtempSync(join(tmpdir(), "secretary-sprint035-"));
try {
  check("arbitrary absolute install path works independently of cwd", () => {
    const fixturePlugin = join(temp, "arbitrary path", "cache", "plugins", "secretary");
    mkdirSync(dirname(fixturePlugin), { recursive: true });
    cpSync(plugin, fixturePlugin, { recursive: true });
    const fixtureResolver = join(fixturePlugin, "scripts/resolve-plugin-root.mjs");
    for (const name of expectedSkills) {
      const result = spawnSync(process.execPath, [fixtureResolver, "--skill-file", join(fixturePlugin, "skills", name, "SKILL.md")], {
        cwd: temp,
        encoding: "utf8",
        env: { PATH: process.env.PATH || "" },
      });
      assert.equal(result.status, 0, `${name}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), realpathSync(fixturePlugin));
    }
  });

  check("empty unresolved relative and wrong-root inputs fail without side effects", () => {
    const sentinel = join(temp, "sentinel.txt");
    writeFileSync(sentinel, "unchanged\n");
    const invalid = ["", "skills/build/SKILL.md", "${CLAUDE_PLUGIN_ROOT}/skills/build/SKILL.md", "<SKILL.md>"];
    for (const value of invalid) {
      const args = value ? [resolver, "--skill-file", value] : [resolver, "--skill-file"];
      const result = spawnSync(process.execPath, args, { cwd: temp, encoding: "utf8", env: { PATH: process.env.PATH || "" } });
      assert.equal(result.status, 2, value || "empty");
      assert.equal(result.stdout, "");
    }
    const wrong = join(temp, "wrong", "skills", "fake", "SKILL.md");
    mkdirSync(dirname(wrong), { recursive: true });
    writeFileSync(wrong, "# fake\n");
    assert.equal(runResolver(wrong, temp).status, 2);
    assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");
  });

  check("Codex update stops before Claude commands Git session and backup side effects", () => {
    const edition = json(join(plugin, "edition.json"));
    const workspace = join(temp, "codex-update-workspace");
    const marker = join(workspace, ".secretary/workspace-edition.json");
    const sentinel = join(workspace, "sentinel.txt");
    const fakeBin = join(temp, "fake-bin");
    const claudeLog = join(temp, "claude-command.log");
    const claudeFixture = join(fakeBin, "claude");
    mkdirSync(dirname(marker), { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(marker, `${JSON.stringify({ schemaVersion: 1, edition: edition.edition })}\n`);
    writeFileSync(sentinel, "unchanged\n");
    writeFileSync(claudeFixture, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${claudeLog}"\n`);
    chmodSync(claudeFixture, 0o755);
    for (const args of [
      ["init", "-q"],
      ["config", "user.email", "fixture@example.com"],
      ["config", "user.name", "Sprint 035 fixture"],
      ["add", "."],
      ["commit", "-qm", "fixture"],
    ]) {
      const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    const beforeHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).stdout.trim();
    const updateApply = join(plugin, "scripts/update-apply.mjs");
    const result = spawnSync(process.execPath, [
      updateApply, "start", "--host", "codex", "--workspace", workspace,
      "--current-plugin-root", plugin, "--consent", "update-approved", "--scope", "user",
    ], {
      cwd: workspace,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH || ""}` },
    });
    const afterHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).stdout.trim();
    const status = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: workspace, encoding: "utf8" });
    assert.equal(result.status, 3, result.stderr);
    assert(result.stderr.includes("CodexではClaude Code用のplugin updaterを実行しません"));
    assert.equal(afterHead, beforeHead);
    assert.equal(status.stdout, "");
    assert.equal(readFileSync(sentinel, "utf8"), "unchanged\n");
    assert(!existsSync(join(workspace, ".git", edition.update.sessionDirectory)));
    assert(!existsSync(claudeLog));

    const source = readFileSync(updateApply, "utf8");
    const startBody = section(source, "function start(args, scriptDir) {", "function retryPlugin(args) {");
    const retryBody = section(source, "function retryPlugin(args) {", "function migrationFiles(");
    assert(startBody.indexOf("requireClaudePluginUpdater(args)") < startBody.indexOf("safeWorkspace("));
    assert(retryBody.indexOf("requireClaudePluginUpdater(args)") < retryBody.indexOf("safeWorkspace("));
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

check("host-specific inventory covers all skills and distribution surfaces", () => {
  const inventory = json(join(plugin, "host-inventory.json"));
  assert.deepEqual(inventory.skills.map((entry) => entry.name).sort(), [...expectedSkills].sort());
  assert.equal(inventory.pluginRoot.strategy, "skill-file-realpath-v1");
  assert(inventory.claudeOnlyInventory.includes("slash commands"));
  assert(inventory.claudeOnlyInventory.some((value) => value.includes("SessionStart")));
  assert(inventory.codexOnlyInventory.some((value) => value.includes("$skill-name")));
  assert.equal(inventory.distributionSurfaces.claudeCode.manifest, ".claude-plugin/plugin.json");
  assert.equal(inventory.distributionSurfaces.codex.manifest, ".codex-plugin/plugin.json");
});

check("Codex and Claude formal manifests share the same 15 skills", () => {
  const edition = json(join(plugin, "edition.json"));
  const codex = json(join(plugin, ".codex-plugin/plugin.json"));
  const codexMarket = json(join(root, ".agents/plugins/marketplace.json"));
  const claude = json(join(plugin, ".claude-plugin/plugin.json"));
  assert.equal(codex.name, edition.edition);
  assert.equal(claude.name, edition.edition);
  assert.equal(codex.version, "0.8.0");
  assert.equal(codex.skills, "./skills/");
  assert.equal(codexMarket.plugins[0].source.path, "./plugins/secretary");
  assert.equal(codexMarket.name, edition.distribution.marketplaceId);
  assert(!existsSync(join(root, "adapters", "codex-app", "skills")));
  assert(!existsSync(join(root, "adapters", "codex-cli", "skills")));
});

check("update skill separates Codex official update surfaces from the Claude updater", () => {
  const edition = json(join(plugin, "edition.json"));
  const source = readFileSync(join(plugin, "skills/update/SKILL.md"), "utf8");
  const resumePhrase = edition.edition === "agentic-secretary"
    ? "「agentic-secretaryの更新を再開」"
    : "「やさしい秘書の更新を再開」";
  const codex = section(source, "### Codexでpluginを更新する", resumePhrase);
  for (const phrase of [
    "Plugins Directory",
    "codex plugin marketplace upgrade <marketplace-name>",
    "codex plugin remove <plugin@marketplace>",
    "codex plugin add <plugin@marketplace>",
    "workspaceの保護commit、session、backupを作る前に変更0件で安全停止",
    "未確認",
  ]) assert(codex.includes(phrase), phrase);
  assert(!codex.includes("claude plugin"));
  assert(!codex.includes("/reload-plugins"));
  assert(source.includes("start --host claude-code"));
  assert(source.includes("retry-plugin --host claude-code"));
});

check("three setup skills keep Codex authorization and read-only smoke free of Claude follow-up steps", () => {
  for (const name of ["setup-google", "setup-microsoft", "setup-notion"]) {
    const source = readFileSync(join(plugin, `skills/${name}/SKILL.md`), "utf8");
    const codex = section(source, "### Codex App／Codex CLI", "## ステップ2");
    for (const phrase of ["現在のhost", "公式", "connector", "認可", "未確認", "停止", "read-only smoke"]) {
      assert(codex.includes(phrase), `${name}: ${phrase}`);
    }
    assert(!codex.includes("Claude の**設定画面"), name);
    assert(!codex.includes("Claude Codeを再起動"), name);
    assert(!codex.includes("/reload-plugins"), name);
    const claude = section(source, "### Claude Code", "### Codex App／Codex CLI");
    assert(claude.includes("設定画面"), name);
    assert(claude.includes("コネクタ（Connectors）"), name);
  }
});

check("edition declares Harness 0.5.0 with distinct host IDs", () => {
  const edition = json(join(plugin, "edition.json"));
  const harness = edition.harness;
  assert.equal(harness.version, "0.5.0");
  if (edition.edition === "agentic-secretary") {
    assert.equal(harness.repository, "https://github.com/mtaiseeei/agentic-harness");
    assert.equal(harness.hosts.claudeCode.installId, "harness@agentic-harness");
    assert.equal(harness.hosts.codex.marketplace, "agentic-harness-local");
    assert.equal(harness.hosts.codex.installId, "harness@agentic-harness-local");
  } else {
    assert.equal(edition.edition, "yasashii-secretary");
    assert.equal(harness.repository, "https://github.com/mtaiseeei/yasashii-harness");
    assert.equal(harness.hosts.claudeCode.installId, "harness@yasashii-harness");
    assert.equal(harness.hosts.codex.installId, "harness@yasashii-harness");
  }
  assert.equal(harness.hosts.claudeCode.explicitEntry, "/harness");
  assert.deepEqual(harness.hosts.codex.explicitEntries, ["$using-harness", "$harness-loop"]);
});

check("README and build skill expose the edition's host-specific Harness route", () => {
  const edition = json(join(plugin, "edition.json"));
  const harness = edition.harness;
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const build = readFileSync(join(plugin, "skills/build/SKILL.md"), "utf8");
  for (const source of [readme, build]) {
    assert(source.includes(harness.repository));
    assert(source.includes(harness.hosts.claudeCode.installId));
    assert(source.includes(harness.hosts.codex.installId));
    assert(source.includes("/harness"));
    assert(source.includes("$using-harness"));
    assert(source.includes("$harness-loop"));
  }
  assert(readme.includes("${SECRETARY_PLUGIN_ROOT}"));
});

check("Harness compatibility validator rejects wrong version ID missing manifest and network", () => {
  const edition = json(join(plugin, "edition.json"));
  const expected = expectedHarnessFromEdition(edition);
  const good = {
    commit: expected.observedCommit,
    repo: { full_name: expected.repositorySlug, private: false, fork: false },
    claudeMarketplace: { name: expected.claudeMarketplace, metadata: { version: expected.version }, plugins: [{ name: "harness", version: expected.version }] },
    claudePlugin: { version: expected.version, repository: expected.repository, homepage: expected.repository },
    codexMarketplace: { name: expected.codexMarketplace, plugins: [{ name: "harness", source: { path: "./plugins/harness" } }] },
    codexPlugin: { version: expected.version, repository: expected.repository, homepage: expected.repository },
    readme: `${expected.claudeInstallCommand}\n${expected.codexMarketplaceCommand}\n${expected.codexInstallCommand}\n$using-harness $harness-loop /harness\n`,
  };
  assert.deepEqual(validateHarnessSnapshot(good, expected), []);
  const wrongVersion = structuredClone(good);
  wrongVersion.codexPlugin.version = "0.4.6";
  assert(validateHarnessSnapshot(wrongVersion, expected).some((value) => value.includes("Codex manifest version")));
  const wrongId = structuredClone(good);
  wrongId.codexMarketplace.name = "wrong-host-id";
  assert(validateHarnessSnapshot(wrongId, expected).some((value) => value.includes("Codex marketplace")));
  const missing = structuredClone(good);
  delete missing.claudePlugin.repository;
  assert(validateHarnessSnapshot(missing, expected).some((value) => value.includes("Claude manifest repository")));
  assert.deepEqual(validateHarnessSnapshot({ networkUnavailable: true }, expected), ["network unavailable is not a PASS"]);
});

check("Harness 0.5.0 limits and guidance preserve repository rules", () => {
  const config = readFileSync(join(root, ".harness/config.toml"), "utf8");
  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
  const guidance = readFileSync(join(root, "docs/harness-guidance.md"), "utf8");
  assert.match(config, /\[limits\][\s\S]*max_lineage_dispatches = 10[\s\S]*max_spec_issue_returns = 2/);
  for (const phrase of ["verification-scope-issue", "verification-infra", "safe harbor", "Spec-Issue Count", "Lineage Dispatches", "done-by-user-decision"]) {
    assert(agents.includes(phrase), `AGENTS: ${phrase}`);
  }
  for (const phrase of ["verification-scope-issue", "safe harbor", "same-candidate evidence", "done-by-user-decision"]) {
    assert(guidance.includes(phrase), `guidance: ${phrase}`);
  }
  assert(claude.includes("読み取りを含む全面接触禁止"));
  assert(claude.includes("Repository SecretのAPI Token"));
});

check("development pointer guidance reads host IDs from edition config", () => {
  const edition = json(join(plugin, "edition.json"));
  const tool = readFileSync(join(plugin, "scripts/project-tools.mjs"), "utf8");
  const projectSkill = readFileSync(join(plugin, "skills/projects/SKILL.md"), "utf8");
  assert(tool.includes('../edition.json'));
  assert(tool.includes("editionConfig.harness.hosts"));
  assert(!tool.includes("`harness@agentic-harness`"));
  assert(projectSkill.includes("Harnessの入口は `edition.json` のhost別設定に従う"));
  assert(projectSkill.includes(edition.harness.hosts.codex.installId));
});

check("Secretary distribution does not bundle Harness implementation", () => {
  for (const path of ["harness", "agents", "commands", "hooks"]) assert(!existsSync(join(plugin, path)), path);
  const manifests = [
    json(join(plugin, ".claude-plugin/plugin.json")),
    json(join(plugin, ".codex-plugin/plugin.json")),
  ];
  for (const manifest of manifests) assert.equal(Object.hasOwn(manifest, "dependencies"), false);
});

console.log(`SPRINT035_PASS=${pass} SPRINT035_FAIL=${fail}`);
process.exit(fail === 0 ? 0 : 1);
