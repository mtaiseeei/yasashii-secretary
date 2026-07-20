#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "plugins/secretary");
const guardCli = join(plugin, "scripts/edition-guard.mjs");
const diagnoseCli = join(plugin, "scripts/update-diagnose.mjs");
const applyCli = join(plugin, "scripts/update-apply.mjs");
const ledgerCli = join(plugin, "scripts/update-ledger.mjs");
const states = ["new", "same-edition", "legacy-yasashii", "opposite-edition", "mixed", "unknown"];
const entries = ["onboarding", "diagnose", "update", "migration"];
let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) { pass += 1; process.stdout.write(`PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`FAIL ${label}${detail ? ` (${detail})` : ""}\n`); }
}

function run(binary, args, cwd, env = {}) {
  return spawnSync(binary, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function files(directory, current = "") {
  const output = [];
  for (const entry of readdirSync(join(directory, current), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!current && entry.name === ".git") continue;
    const rel = join(current, entry.name);
    if (entry.isDirectory()) output.push(...files(directory, rel));
    else if (entry.isFile()) output.push(rel);
    else output.push(`${rel}:non-file`);
  }
  return output;
}

function digestDirectory(directory) {
  const hash = createHash("sha256");
  for (const rel of files(directory)) {
    hash.update(rel); hash.update("\0");
    if (!rel.endsWith(":non-file")) hash.update(readFileSync(join(directory, rel)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function snapshot(workspace) {
  return {
    files: digestDirectory(workspace),
    index: git(workspace, ["ls-files", "-s"]),
    worktree: git(workspace, ["status", "--porcelain=v1", "--untracked-files=all"]),
    history: git(workspace, ["log", "--format=%H%x00%P%x00%B"]),
    ledger: [".secretary/update-ledger.json", ".yasashii-secretary/update-ledger.json"].map((path) => {
      try { return `${path}:${createHash("sha256").update(readFileSync(join(workspace, path))).digest("hex")}`; } catch { return `${path}:missing`; }
    }),
    marker: (() => { try { return createHash("sha256").update(readFileSync(join(workspace, ".secretary/workspace-edition.json"))).digest("hex"); } catch { return "missing"; } })(),
    settings: createHash("sha256").update(readFileSync(join(workspace, "secretary/settings.json"))).digest("hex"),
    storedHistory: createHash("sha256").update(readFileSync(join(workspace, "secretary/history/2026-07-20.md"))).digest("hex"),
    plugin: digestDirectory(plugin),
  };
}

function seedState(state) {
  const workspace = mkdtempSync(join(process.env.TMPDIR || tmpdir(), `yasashii-s030-${state}-`));
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: workspace });
  git(workspace, ["config", "user.name", "Sprint 030 fixture"]);
  git(workspace, ["config", "user.email", "sprint030@example.invalid"]);
  mkdirSync(join(workspace, "secretary/history"), { recursive: true });
  writeFileSync(join(workspace, "README.md"), "Sprint 030 local fixture\n");
  writeFileSync(join(workspace, "secretary/settings.json"), "{\"schedule\":\"3h\",\"bot\":\"existing-secretary[bot]\"}\n");
  writeFileSync(join(workspace, "secretary/history/2026-07-20.md"), "既存履歴は変更しない\n");
  if (state === "same-edition") {
    writeJson(join(workspace, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "yasashii-secretary" });
    writeJson(join(workspace, ".secretary/update-ledger.json"), { schemaVersion: 2, edition: "yasashii-secretary", records: [] });
  } else if (state === "legacy-yasashii") {
    writeFileSync(join(workspace, "secretary/CLAUDE.md"), "<!-- yasashii-secretary:update-entry:v1:start -->\nlegacy\n");
    writeJson(join(workspace, ".yasashii-secretary/update-ledger.json"), []);
  } else if (state === "opposite-edition") {
    writeJson(join(workspace, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "agentic-secretary" });
    writeJson(join(workspace, ".secretary/update-ledger.json"), { schemaVersion: 2, edition: "agentic-secretary", records: [] });
  } else if (state === "mixed") {
    writeJson(join(workspace, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "yasashii-secretary" });
    writeJson(join(workspace, ".secretary/update-ledger.json"), { schemaVersion: 2, edition: "agentic-secretary", records: [] });
  } else if (state === "unknown") {
    writeJson(join(workspace, ".secretary/workspace-edition.json"), { schemaVersion: 1, edition: "future-secretary" });
  }
  git(workspace, ["add", "."]);
  git(workspace, ["commit", "-qm", `fixture ${state}`]);
  return workspace;
}

function parseLastJson(stdout) {
  try { return JSON.parse(stdout); } catch { return null; }
}

const temporaryRoots = [];
try {
  for (const state of states) {
    for (const entry of entries) {
      const workspace = seedState(state);
      temporaryRoots.push(workspace);
      const before = snapshot(workspace);
      let result;
      if (entry === "diagnose") {
        result = run(process.execPath, [diagnoseCli, "--workspace", workspace, "--plugin-root", plugin, "--no-network", "--json"], root);
        const output = parseLastJson(result.stdout);
        check(`${state} × diagnose が状態を返す`, result.status === 0 && output?.workspaceEdition?.state === state, result.stderr);
        check(`${state} × diagnose は完全なread-only`, JSON.stringify(snapshot(workspace)) === JSON.stringify(before));
        if (state === "legacy-yasashii") check("legacy診断は予定migrationを明示", /neutral markerとedition付きledger/.test(output?.workspaceEdition?.plannedMigration || ""));
        if (["new", "opposite-edition", "mixed", "unknown"].includes(state)) check(`${state} 診断は実更新を利用不可にする`, output?.choices?.find((item) => item.id === "proceed-update")?.available === false);
        continue;
      }
      if (entry === "onboarding") {
        result = run(process.execPath, [guardCli, "--workspace", workspace, "--plugin-root", plugin, "--entry", "onboarding", "--prepare-new", "--json"], root);
        if (state === "new") {
          const marker = JSON.parse(readFileSync(join(workspace, ".secretary/workspace-edition.json"), "utf8"));
          check("new × onboarding だけneutral markerを作る", result.status === 0 && marker.schemaVersion === 1 && marker.edition === "yasashii-secretary");
        } else {
          check(`${state} × onboarding は書込み前に停止`, result.status === 3 && JSON.stringify(snapshot(workspace)) === JSON.stringify(before), result.stderr);
        }
        continue;
      }
      if (entry === "update") {
        result = run(process.execPath, [applyCli, "start", "--workspace", workspace, "--current-plugin-root", plugin, "--no-network", "--json"], root);
        const blocked = ["new", "opposite-edition", "mixed", "unknown"].includes(state);
        check(`${state} × update のguard結果`, blocked ? result.status === 3 && /workspace edition guard/.test(result.stderr) : result.status === 0, result.stderr);
        check(`${state} × update は検査時点でbyte不変`, JSON.stringify(snapshot(workspace)) === JSON.stringify(before));
        continue;
      }
      result = run(process.execPath, [applyCli, "resume", "--workspace", workspace, "--plugin-root", plugin, "--json"], root);
      const blocked = ["new", "opposite-edition", "mixed", "unknown"].includes(state);
      check(`${state} × migration のguard結果`, blocked ? result.status === 3 && /workspace edition guard/.test(result.stderr) : result.status === 3 && !/workspace edition guard/.test(result.stderr), result.stderr);
      check(`${state} × migration はsession前検査でbyte不変`, JSON.stringify(snapshot(workspace)) === JSON.stringify(before));
    }
  }

  const fresh = seedState("new");
  temporaryRoots.push(fresh);
  const prepared = run(process.execPath, [guardCli, "--workspace", fresh, "--plugin-root", plugin, "--entry", "onboarding", "--prepare-new", "--json"], root);
  mkdirSync(join(fresh, "secretary"), { recursive: true });
  writeFileSync(join(fresh, "secretary/AGENTS.md"), "# 新規秘書\n");
  const ledger = run(process.execPath, [ledgerCli, "init", "--workspace", fresh, "--plugin-root", plugin, "--managed-path", "secretary/AGENTS.md", "--new-install", "--confirm"], root);
  const ledgerValue = JSON.parse(readFileSync(join(fresh, ".secretary/update-ledger.json"), "utf8"));
  check("new onboardingはedition付きledgerを作る", prepared.status === 0 && ledger.status === 0 && ledgerValue.schemaVersion === 2 && ledgerValue.edition === "yasashii-secretary" && ledgerValue.records.length === 1, ledger.stderr);

  const validConfig = JSON.parse(readFileSync(join(plugin, "edition.json"), "utf8"));
  for (const [name, mutate] of [
    ["missing", (value) => { delete value.update.ledgerPath; }],
    ["unknown", (value) => { value.edition = "future-secretary"; }],
  ]) {
    const workspace = seedState("new");
    temporaryRoots.push(workspace);
    const config = structuredClone(validConfig);
    mutate(config);
    const invalidPlugin = mkdtempSync(join(process.env.TMPDIR || tmpdir(), `yasashii-s030-invalid-plugin-${name}-`));
    temporaryRoots.push(invalidPlugin);
    writeJson(join(invalidPlugin, "edition.json"), config);
    mkdirSync(join(invalidPlugin, "rules/copy"), { recursive: true });
    writeFileSync(join(invalidPlugin, "rules/copy/yasashii.json"), readFileSync(join(plugin, "rules/copy/yasashii.json")));
    const before = snapshot(workspace);
    const result = run(process.execPath, [guardCli, "--workspace", workspace, "--plugin-root", invalidPlugin, "--entry", "onboarding", "--prepare-new", "--json"], root);
    check(`${name} EditionConfigはfallbackせず停止`, result.status === 3 && /fallback|未知|欠落/.test(result.stderr) && JSON.stringify(snapshot(workspace)) === JSON.stringify(before), result.stderr);
  }

  const unsafeLegacy = seedState("new");
  temporaryRoots.push(unsafeLegacy);
  symlinkSync(join(unsafeLegacy, "README.md"), join(unsafeLegacy, "secretary/CLAUDE.md"));
  const unsafeLegacyBefore = snapshot(unsafeLegacy);
  const unsafeLegacyResult = run(process.execPath, [guardCli, "--workspace", unsafeLegacy, "--plugin-root", plugin, "--entry", "onboarding", "--prepare-new", "--json"], root);
  const unsafeLegacyUnchanged = JSON.stringify(snapshot(unsafeLegacy)) === JSON.stringify(unsafeLegacyBefore);
  check("symlinkのlegacy markerはnew扱いせずunknownで停止", unsafeLegacyResult.status === 3
    && /workspace edition guard: unknown/.test(unsafeLegacyResult.stderr)
    && unsafeLegacyUnchanged, unsafeLegacyResult.stderr);

  const chatworkSchedule = await import(pathToFileURL(join(plugin, "skills/chatwork/scripts/schedule.mjs")));
  const googleSchedule = await import(pathToFileURL(join(plugin, "skills/google-chat/scripts/schedule.mjs")));
  const newChatwork = chatworkSchedule.renderWorkflow("3h", true);
  const newGoogle = googleSchedule.renderGoogleChatWorkflow("3h", true);
  const oldIdentity = { botName: "yasashii-secretary[bot]", botEmail: "yasashii-secretary[bot]@users.noreply.github.com" };
  check("新規workflowだけsecretary[bot]を使う", newChatwork.includes('user.name "secretary[bot]"') && newGoogle.includes('user.name "secretary[bot]"'));
  check("既存bot identityをrendererが保持できる", chatworkSchedule.renderWorkflow("6h", true, oldIdentity).includes('user.name "yasashii-secretary[bot]"') && googleSchedule.renderGoogleChatWorkflow("6h", true, oldIdentity).includes('user.name "yasashii-secretary[bot]"'));
  const chatworkTransaction = readFileSync(join(plugin, "skills/chatwork/scripts/config-transaction.mjs"), "utf8");
  const googleTransaction = readFileSync(join(plugin, "skills/google-chat/scripts/config-transaction.mjs"), "utf8");
  check("既存workflow更新はbot identityをrendererへ渡す", [chatworkTransaction, googleTransaction].every((source) => source.includes("existingBotIdentity") && source.includes("snapshots.get")));
} finally {
  for (const directory of temporaryRoots.reverse()) rmSync(directory, { recursive: true, force: true });
}

process.stdout.write(`SPRINT030_PASS=${pass} SPRINT030_FAIL=${fail}\n`);
process.exitCode = fail === 0 ? 0 : 1;
