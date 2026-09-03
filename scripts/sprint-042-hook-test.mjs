#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyInit, doctor } from "../plugins/secretary/scripts/lib/clarity-core.mjs";
import { findClarityRoot, normalizeHookInput, resolvePluginRoot, serializeHookResult, writeRuntimeEvent } from "../plugins/secretary/scripts/lib/clarity-hook.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(repo, "plugins/secretary");
const router = join(plugin, "scripts/clarity-hook.mjs");
const cli = join(plugin, "scripts/clarity.mjs");
const work = mkdtempSync(join(tmpdir(), "agentic-s044-"));
const fixedNow = "2026-08-28T10:30:00.000Z";
const expected = [
  ...Array.from({ length: 17 }, (_, index) => `HC-${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 14 }, (_, index) => `HX-${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 7 }, (_, index) => `HP-${String(index + 1).padStart(3, "0")}`),
  "AT-015", "IM-012",
];
const results = [];

function write(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function initialized(name, count = 6) {
  const root = join(work, name); mkdirSync(root, { recursive: true });
  write(join(root, "README.md"), `# ${name}\n`);
  for (let index = 0; index < count; index += 1) write(join(root, "src", `feature-${index}.mjs`), `export const value${index} = ${index};\n`);
  applyInit(root); return root;
}
function canonicalDigest(root) {
  return sha(["project.json", "events.jsonl", "evidence.jsonl", "state.json"].map((name) => readFileSync(join(root, ".clarity", name))).join("|"));
}
function treeSnapshot(root) {
  const rows = [];
  function visit(directory, prefix = "") {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name); const rel = prefix ? `${prefix}/${name}` : name; const stat = lstatSync(path);
      if (stat.isSymbolicLink()) rows.push([rel, "symlink"]);
      else if (stat.isDirectory()) { rows.push([rel, "directory"]); visit(path, rel); }
      else if (stat.isFile()) rows.push([rel, "file", sha(readFileSync(path))]);
      else rows.push([rel, "other"]);
    }
  }
  visit(root); return JSON.stringify(rows);
}
function runtimeFiles(root) {
  const base = join(root, ".clarity/runtime/hooks/events"); if (!existsSync(base)) return [];
  const rows = []; for (const session of readdirSync(base)) { const dir = join(base, session); if (!lstatSync(dir).isDirectory()) continue; for (const name of readdirSync(dir)) rows.push(join(dir, name)); } return rows;
}
function payload(host, event, cwd, extra = {}) {
  const common = { session_id: `${host}-session`, cwd, hook_event_name: event, ...extra };
  return host === "codex" ? { ...common, model: "fixture-model", turn_id: extra.turn_id || "turn-1" } : common;
}
function runHook(input, env = {}) {
  const result = spawnSync(process.execPath, [router], { input: JSON.stringify(input), encoding: "utf8", timeout: 5_000, env: { ...process.env, CLARITY_NOW: fixedNow, ...env } });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
function runCli(args, env = {}) { return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", timeout: 10_000, env: { ...process.env, CLARITY_NOW: fixedNow, ...env } }); }
function runMany(inputs) {
  return Promise.all(inputs.map((input) => new Promise((accept, reject) => {
    const child = spawn(process.execPath, [router], { env: { ...process.env, CLARITY_NOW: fixedNow } }); let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject); child.on("close", (code) => code === 0 ? accept({ stdout, stderr }) : reject(new Error(`hook exit ${code}: ${stderr}`)));
    child.stdin.end(JSON.stringify(input));
  })));
}
function observationSemantic(root, host = "codex", sessionId = `${host}-path-guard`, toolUseId = `${host}-write`) {
  const normalized = normalizeHookInput(payload(host, "PostToolUse", root, { session_id: sessionId, tool_name: "Write", tool_use_id: toolUseId, tool_input: { file_path: join(root, "src/feature-0.mjs") } }));
  return { normalized, semantic: { kind: "observation", tool: "Write", touchedPaths: ["src/feature-0.mjs"], testCandidate: false, material: true, resultSummary: "unknown" } };
}
function assertRouterRejectsExternalSymlink(label, relativeComponent, { eventFileName = null } = {}) {
  const target = initialized(label, 1); const outside = join(work, `${label}-outside`); mkdirSync(outside);
  writeFileSync(join(outside, "sentinel.txt"), `outside-${label}\n`);
  const beforeOutside = treeSnapshot(outside); const beforeCanonical = canonicalDigest(target);
  const component = join(target, relativeComponent, ...(eventFileName ? [eventFileName] : []));
  mkdirSync(dirname(component), { recursive: true });
  symlinkSync(eventFileName ? join(outside, "sentinel.txt") : outside, component, eventFileName ? "file" : "dir");
  const output = runHook(payload("codex", "PostToolUse", target, { session_id: "symlink-session", turn_id: "symlink-turn", tool_name: "Write", tool_use_id: "symlink-write", tool_input: { file_path: join(target, "src/feature-0.mjs") } }));
  assert(output === null || /degraded/u.test(output.systemMessage || ""), `${label}: unsafe path must no-op or degrade`);
  assert.equal(canonicalDigest(target), beforeCanonical, `${label}: canonical data changed`);
  assert.equal(treeSnapshot(outside), beforeOutside, `${label}: outside target changed`);
}
async function test(id, title, fn) {
  assert(expected.includes(id), `unknown case ${id}`); assert(!results.some((row) => row.id === id), `duplicate ${id}`);
  try { await fn(); results.push({ id, ok: true }); process.stdout.write(`PASS ${id} ${title}\n`); }
  catch (error) { results.push({ id, ok: false }); process.stdout.write(`FAIL ${id} ${title}: ${error?.stack || error}\n`); }
}

try {
  process.env.CLARITY_NOW = fixedNow;
  const root = initialized("common"); const subdir = join(root, "src");
  const hooks = JSON.parse(readFileSync(join(plugin, "hooks/hooks.json"), "utf8"));
  const manifestText = readFileSync(join(plugin, "hooks/hooks.json"), "utf8");

  await test("HC-001", "Claude plugin common Hook inventory", () => { assert(hooks.hooks.SessionStart && hooks.hooks.Stop); assert(existsSync(join(plugin, "skills/clarity/SKILL.md"))); });
  await test("HC-002", "Claude SessionStart bounded brief", () => { const out = runHook(payload("claudeCode", "SessionStart", root, { source: "startup" }), { CLAUDE_PLUGIN_ROOT: plugin, PLUGIN_ROOT: "" }); assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart"); assert.match(out.hookSpecificOutput.additionalContext, /Project Clarity Session Brief/u); });
  await test("HC-003", "Claude resume reloads current projection", () => { const out = runHook(payload("claudeCode", "SessionStart", root, { source: "resume" })); assert.match(out.hookSpecificOutput.additionalContext, /理由:/u); });
  await test("HC-004", "Claude compact SessionStart reinjection", () => { const out = runHook(payload("claudeCode", "SessionStart", root, { source: "compact" })); assert.match(out.hookSpecificOutput.additionalContext, /手動/u); assert(runtimeFiles(root).some((path) => JSON.parse(readFileSync(path)).kind === "compact-resume")); });
  await test("HC-005", "Claude concurrent PostToolUse parse 100% and retry collision safety", async () => {
    const target = initialized("claude-concurrent", 1); const inputs = Array.from({ length: 50 }, (_, index) => payload("claudeCode", "PostToolUse", target, { session_id: "claude-concurrent", tool_name: "Write", tool_use_id: `write-${index}`, tool_input: { file_path: join(target, "src", `p-${index}.mjs`) } }));
    await runMany(inputs); const files = runtimeFiles(target); assert.equal(files.length, 50); for (const path of files) JSON.parse(readFileSync(path, "utf8"));
    const retryRoot = initialized("hook-retry-collision", 1); const { normalized, semantic } = observationSemantic(retryRoot, "claudeCode", "retry-session", "retry-write");
    const first = writeRuntimeEvent(retryRoot, normalized, semantic); const retry = writeRuntimeEvent(retryRoot, normalized, semantic);
    assert.equal(first.changed, true); assert.equal(retry.changed, false); assert.equal(first.target, retry.target); assert.deepEqual(retry.record, first.record);
    writeFileSync(first.target, "{partial"); assert.throws(() => writeRuntimeEvent(retryRoot, normalized, semantic)); assert.equal(readFileSync(first.target, "utf8"), "{partial");
    writeFileSync(first.target, `${JSON.stringify({ ...first.record, owner: "unowned-fixture" })}\n`); assert.throws(() => writeRuntimeEvent(retryRoot, normalized, semantic)); assert.match(readFileSync(first.target, "utf8"), /unowned-fixture/u);
  });
  await test("HC-006", "Claude Edit observes touched path only", () => { const target = initialized("claude-edit", 1); runHook(payload("claudeCode", "PostToolUse", target, { tool_name: "Edit", tool_use_id: "edit-1", tool_input: { file_path: join(target, "src/feature-0.mjs"), new_string: "SECRET_BODY_NOT_STORED" } })); const row = JSON.parse(readFileSync(runtimeFiles(target)[0])); assert.deepEqual(row.touchedPaths, ["src/feature-0.mjs"]); assert(!JSON.stringify(row).includes("SECRET_BODY")); });
  await test("HC-007", "Claude Bash test candidate observation", () => { const target = initialized("claude-test", 1); runHook(payload("claudeCode", "PostToolUse", target, { tool_name: "Bash", tool_use_id: "bash-1", tool_input: { command: "npm run test" } })); assert.equal(JSON.parse(readFileSync(runtimeFiles(target)[0])).testCandidate, true); });
  await test("HC-008", "Claude Stop requests one checkpoint", () => { const target = initialized("claude-stop", 1); runHook(payload("claudeCode", "PostToolUse", target, { session_id: "stop-session", tool_name: "Write", tool_use_id: "write-1", tool_input: { file_path: join(target, "src/feature-0.mjs") } })); const out = runHook(payload("claudeCode", "Stop", target, { session_id: "stop-session", stop_hook_active: false })); assert.equal(out.decision, "block"); assert.match(out.reason, /checkpoint/u); });
  await test("HC-009", "Claude second Stop does not loop", () => { const out = runHook(payload("claudeCode", "Stop", root, { stop_hook_active: true })); assert.deepEqual(out, {}); });
  await test("HC-010", "Claude no material change and uninitialized no-op", () => { const out = runHook(payload("claudeCode", "Stop", root, { session_id: "no-material" })); assert.deepEqual(out, {}); const uninitialized = join(work, "uninitialized"); mkdirSync(uninitialized); const start = performance.now(); assert.equal(runHook(payload("claudeCode", "SessionStart", uninitialized)), null); assert(performance.now() - start < 3000); assert(!existsSync(join(uninitialized, ".clarity"))); assert.deepEqual(runHook(payload("claudeCode", "Stop", uninitialized)), {}); });
  await test("HC-011", "Claude PreCompact flush and resume record", () => { const target = initialized("claude-compact", 1); runHook(payload("claudeCode", "PostToolUse", target, { session_id: "compact-session", tool_name: "Write", tool_use_id: "compact-write", tool_input: { file_path: join(target, "src/feature-0.mjs") } })); runHook(payload("claudeCode", "PreCompact", target, { session_id: "compact-session", trigger: "auto" })); const row = runtimeFiles(target).map((path) => JSON.parse(readFileSync(path))).find((item) => item.kind === "pre-compact"); assert.equal(row.pendingCheckpoint, true); assert.match(row.resumeContextDigest, /^[a-f0-9]{64}$/u); });
  await test("HC-012", "Claude SessionEnd bounded flush", () => { const target = initialized("claude-end", 1); const start = performance.now(); runHook(payload("claudeCode", "SessionEnd", target, { reason: "other" })); assert(performance.now() - start < 3000); assert.equal(JSON.parse(readFileSync(runtimeFiles(target)[0])).kind, "session-end-flush"); });
  await test("HC-013", "Claude Hook failure preserves canonical", () => { const target = initialized("claude-failure", 1); const before = canonicalDigest(target); const out = runHook(payload("claudeCode", "SessionStart", target), { CLARITY_HOOK_FAIL: "1" }); assert.match(out.systemMessage, /degraded/u); assert.equal(canonicalDigest(target), before); });
  await test("HC-014", "Claude disabled has zero writes and manual fallback", () => { const target = initialized("claude-disabled", 1); const before = canonicalDigest(target); const out = runHook(payload("claudeCode", "SessionStart", target), { CLARITY_HOOK_DISABLED: "1" }); assert.equal(out, null); assert.equal(runtimeFiles(target).length, 0); assert.equal(canonicalDigest(target), before); assert.equal(runCli(["status", target, "--json"]).status, 0); assert.equal(runCli(["review", target, "--json"]).status, 0); });
  await test("HC-015", "Claude subdirectory and spaced plugin root", () => { assert.equal(findClarityRoot(subdir), realpathSync(root)); const spaced = join(work, "plugin root with spaces"); cpSync(plugin, spaced, { recursive: true }); const command = hooks.hooks.SessionStart[0].hooks[0].command; const result = spawnSync(command, { shell: true, input: JSON.stringify(payload("claudeCode", "SessionStart", subdir)), encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_ROOT: spaced, PLUGIN_ROOT: "", CLARITY_NOW: fixedNow } }); assert.equal(result.status, 0, result.stderr); assert(JSON.parse(result.stdout).hookSpecificOutput.additionalContext); });
  await test("HC-016", "Hook contains no network or external process", () => { const source = [readFileSync(router, "utf8"), readFileSync(join(plugin, "scripts/lib/clarity-hook.mjs"), "utf8")].join("\n"); assert(!/node:child_process|https?:|fetch\s*\(|runExternal|xmind|connector|update-apply|memory-care/iu.test(source)); });
  await test("HC-017", "Claude large Attention output bounded", () => { const out = runHook(payload("claudeCode", "SessionStart", root, { source: "startup" })); assert(out.hookSpecificOutput.additionalContext.length <= 3600); assert((out.hookSpecificOutput.additionalContext.match(/^\d+\./gmu) || []).length <= 3); });

  await test("HX-001", "Codex plugin common Hook inventory", () => { assert(existsSync(join(plugin, ".codex-plugin/plugin.json"))); assert.equal(hooks.hooks.SessionStart[0].hooks[0].type, "command"); });
  await test("HX-002", "Codex trust-before state is degraded and manual works", () => { const target = initialized("codex-untrusted", 1); const before = canonicalDigest(target); const report = doctor(target, { host: "codex", hookState: "untrusted" }); assert.equal(report.capabilities.hook.status, "degraded"); assert.match(report.nextAction, /\/hooks/u); assert.equal(runtimeFiles(target).length, 0); assert.equal(canonicalDigest(target), before); assert.equal(runCli(["status", target, "--json"]).status, 0); });
  await test("HX-003", "Codex trusted-equivalent SessionStart context", () => { const out = runHook(payload("codex", "SessionStart", root, { source: "startup" }), { PLUGIN_ROOT: plugin }); assert(out.hookSpecificOutput.additionalContext); });
  await test("HX-004", "Codex source compact immediate context", () => { const out = runHook(payload("codex", "SessionStart", root, { source: "compact" })); assert.match(out.hookSpecificOutput.additionalContext, /Session Brief/u); });
  await test("HX-005", "Codex command-only manifest", () => { for (const groups of Object.values(hooks.hooks)) for (const group of groups) for (const hook of group.hooks) assert.equal(hook.type, "command"); assert(!/"type"\s*:\s*"(?:prompt|agent|mcp_tool)"/u.test(manifestText)); });
  await test("HX-006", "Codex concurrent PostToolUse and runtime path guard", async () => {
    const target = initialized("codex-concurrent", 1); const inputs = Array.from({ length: 50 }, (_, index) => payload("codex", "PostToolUse", target, { session_id: "codex-concurrent", turn_id: `turn-${index}`, tool_name: "apply_patch", tool_use_id: `patch-${index}`, tool_input: { command: `*** Begin Patch\n*** Update File: src/f-${index}.mjs\n*** End Patch` } }));
    await runMany(inputs); const files = runtimeFiles(target); assert.equal(files.length, 50); for (const path of files) JSON.parse(readFileSync(path));
    const stress = initialized("codex-concurrent-128", 1); const stressInputs = Array.from({ length: 128 }, (_, index) => payload("codex", "PostToolUse", stress, { session_id: "codex-concurrent-128", turn_id: `turn-${index}`, tool_name: "Write", tool_use_id: `write-${index}`, tool_input: { file_path: join(stress, "src", `p-${index}.mjs`) } }));
    await runMany(stressInputs); const stressFiles = runtimeFiles(stress); assert.equal(stressFiles.length, 128); for (const path of stressFiles) JSON.parse(readFileSync(path));

    for (const [label, component] of [
      ["runtime-symlink", ".clarity/runtime"],
      ["hooks-symlink", ".clarity/runtime/hooks"],
      ["events-symlink", ".clarity/runtime/hooks/events"],
      ["session-symlink", ".clarity/runtime/hooks/events/symlink-session"],
    ]) assertRouterRejectsExternalSymlink(label, component);

    const nonDirectory = initialized("runtime-nondirectory", 1); const nonDirectoryCanonical = canonicalDigest(nonDirectory); writeFileSync(join(nonDirectory, ".clarity/runtime"), "not-a-directory\n");
    const nonDirectoryOutput = runHook(payload("codex", "PostToolUse", nonDirectory, { session_id: "nondirectory-session", tool_name: "Write", tool_use_id: "nondirectory-write", tool_input: { file_path: join(nonDirectory, "src/feature-0.mjs") } }));
    assert.match(nonDirectoryOutput.systemMessage, /degraded/u); assert.equal(canonicalDigest(nonDirectory), nonDirectoryCanonical);

    const canonicalRoot = initialized("canonical-root", 1); const rootAlias = join(work, "canonical-root-alias"); symlinkSync(canonicalRoot, rootAlias, "dir"); const rootCanonicalBefore = canonicalDigest(canonicalRoot); const aliasObservation = observationSemantic(canonicalRoot, "codex", "root-alias-session", "root-alias-write");
    assert.throws(() => writeRuntimeEvent(rootAlias, aliasObservation.normalized, aliasObservation.semantic)); assert.equal(canonicalDigest(canonicalRoot), rootCanonicalBefore); assert.equal(runtimeFiles(canonicalRoot).length, 0);

    const probe = initialized("event-symlink-probe", 1);
    runHook(payload("codex", "PostToolUse", probe, { session_id: "symlink-session", turn_id: "symlink-turn", tool_name: "Write", tool_use_id: "symlink-write", tool_input: { file_path: join(probe, "src/feature-0.mjs") } }));
    assertRouterRejectsExternalSymlink("event-file-symlink", ".clarity/runtime/hooks/events/symlink-session", { eventFileName: basename(runtimeFiles(probe)[0]) });

    const raceRoot = initialized("runtime-path-race", 1); const outside = join(work, "runtime-path-race-outside"); mkdirSync(outside); writeFileSync(join(outside, "sentinel.txt"), "outside-race\n");
    const outsideBefore = treeSnapshot(outside); const canonicalBefore = canonicalDigest(raceRoot); const race = observationSemantic(raceRoot, "codex", "race-session", "race-write"); let raced = false;
    assert.throws(() => writeRuntimeEvent(raceRoot, race.normalized, race.semantic, { beforeFileOpen({ eventsDirectory }) { raced = true; rmSync(eventsDirectory, { recursive: true }); symlinkSync(outside, eventsDirectory, "dir"); } }));
    assert.equal(raced, true); assert.equal(treeSnapshot(outside), outsideBefore); assert.equal(canonicalDigest(raceRoot), canonicalBefore);
  });
  await test("HX-007", "Codex Stop creates continuation", () => { const target = initialized("codex-stop", 1); runHook(payload("codex", "PostToolUse", target, { session_id: "codex-stop", tool_name: "apply_patch", tool_use_id: "p1", tool_input: { command: "*** Begin Patch\n*** Update File: src/feature-0.mjs\n*** End Patch" } })); const out = runHook(payload("codex", "Stop", target, { session_id: "codex-stop" })); assert.equal(out.decision, "block"); });
  await test("HX-008", "Codex stop_hook_active prevents second continuation", () => { assert.deepEqual(runHook(payload("codex", "Stop", root, { stop_hook_active: true })), {}); });
  await test("HX-009", "Codex SessionEnd within 3 seconds", () => { const target = initialized("codex-end", 1); const start = performance.now(); runHook(payload("codex", "SessionEnd", target)); assert(performance.now() - start < 3000); });
  await test("HX-010", "Codex subdirectory resolves Clarity root", () => assert.equal(findClarityRoot(subdir), realpathSync(root)));
  await test("HX-011", "Codex disabled keeps canonical and manual Skill", () => { const target = initialized("codex-disabled", 1); const before = canonicalDigest(target); runHook(payload("codex", "PostToolUse", target), { CLARITY_HOOK_DISABLED: "1" }); assert.equal(canonicalDigest(target), before); assert.equal(runtimeFiles(target).length, 0); assert.equal(runCli(["checkpoint", target, "--operation-id", "manual-disabled", "--json"]).status, 0); });
  await test("HX-012", "Codex PLUGIN_ROOT with spaces and compatibility roots", () => { const spaced = join(work, "codex plugin root with spaces"); cpSync(plugin, spaced, { recursive: true }); assert.equal(resolvePluginRoot({ PLUGIN_ROOT: spaced }), realpathSync(spaced)); assert.equal(resolvePluginRoot({ CLAUDE_PLUGIN_ROOT: plugin }), realpathSync(plugin)); assert.equal(resolvePluginRoot({ CODEX_PLUGIN_ROOT: plugin }), realpathSync(plugin)); assert.match(manifestText, /PLUGIN_ROOT:-\$\{CLAUDE_PLUGIN_ROOT/u); const command = hooks.hooks.SessionStart[0].hooks[0].command; const result = spawnSync(command, { shell: true, input: JSON.stringify(payload("codex", "SessionStart", subdir)), encoding: "utf8", env: { ...process.env, PLUGIN_ROOT: spaced, CLAUDE_PLUGIN_ROOT: "", CODEX_PLUGIN_ROOT: "", CLARITY_NOW: fixedNow } }); assert.equal(result.status, 0, result.stderr); assert(JSON.parse(result.stdout).hookSpecificOutput.additionalContext); });
  await test("HX-013", "transcript is not parsed", () => { const source = readFileSync(join(plugin, "scripts/lib/clarity-hook.mjs"), "utf8"); assert(!/transcript_path|transcriptPath/u.test(source)); });
  await test("HX-014", "Codex additionalContext bounded", () => { const out = runHook(payload("codex", "SessionStart", root)); assert(out.hookSpecificOutput.additionalContext.length <= 3600); assert.equal(hooks.hooks.SessionStart[0].hooks[0].additionalContextLimit, 1200); });

  await test("HP-001", "one common Clarity Skill semantic", () => { const inventory = JSON.parse(readFileSync(join(plugin, "host-inventory.json"), "utf8")); assert.equal(inventory.clarityHook.commonRouter, "scripts/clarity-hook.mjs"); assert(existsSync(join(plugin, "skills/clarity/SKILL.md"))); });
  await test("HP-002", "one hooks source and router", () => { assert.equal(readdirSync(join(plugin, "hooks")).filter((name) => name.endsWith(".json")).length, 1); assert.equal(readdirSync(join(plugin, "scripts")).filter((name) => name === "clarity-hook.mjs").length, 1); });
  await test("HP-003", "host payloads normalize to same semantic", () => { const a = normalizeHookInput(payload("claudeCode", "PostToolUse", root, { session_id: "s", tool_name: "Write", tool_use_id: "u", tool_input: { file_path: "src/a.mjs" } }), { CLAUDE_PLUGIN_ROOT: plugin }); const b = normalizeHookInput(payload("codex", "PostToolUse", root, { session_id: "s", turn_id: null, tool_name: "Write", tool_use_id: "u", tool_input: { file_path: "src/a.mjs" } }), { PLUGIN_ROOT: plugin }); assert.deepEqual({ ...a, host: null, turnId: null }, { ...b, host: null, turnId: null }); });
  await test("HP-004", "serializers preserve same meaning", () => { const semantic = { action: "continue", reason: "checkpoint" }; assert.deepEqual(serializeHookResult("claudeCode", "Stop", semantic), serializeHookResult("codex", "Stop", semantic)); });
  await test("HP-005", "one host evidence is not promoted", () => { const inventory = JSON.parse(readFileSync(join(plugin, "host-inventory.json"), "utf8")); inventory.clarityHook.hosts.codex.cli.verified = true; assert.equal(inventory.clarityHook.hosts.claudeCode.cli.verified, false); assert.match(inventory.clarityHook.promotionRule, /never promoted across hosts/u); });
  await test("HP-006", "Desktop CLI supported and verified separated", () => { const inventory = JSON.parse(readFileSync(join(plugin, "host-inventory.json"), "utf8")); for (const surface of [inventory.clarityHook.hosts.claudeCode.desktop, inventory.clarityHook.hosts.claudeCode.cli, inventory.clarityHook.hosts.codex.app, inventory.clarityHook.hosts.codex.cli]) { assert.equal(surface.status, "supported"); assert.equal(surface.verified, false); } });
  await test("HP-007", "natural language Skill description is host-neutral", () => { const skill = readFileSync(join(plugin, "skills/clarity/SKILL.md"), "utf8"); for (const phrase of ["クラリティを初期化", "今のClarity状態", "今考えること", "Clarityを診断"]) assert(skill.includes(phrase)); });
  await test("AT-015", "real SessionStart-equivalent payload returns top three", () => { const out = runHook(payload("codex", "SessionStart", root, { source: "startup" })); assert((out.hookSpecificOutput.additionalContext.match(/^\d+\./gmu) || []).length <= 3); assert(out.hookSpecificOutput.additionalContext.includes("その他")); });
  await test("IM-012", "doctor explains untrusted review", () => { const out = runCli(["doctor", root, "--host", "codex", "--hook-state", "untrusted", "--json"]); assert.equal(out.status, 0, out.stderr); const report = JSON.parse(out.stdout); assert.equal(report.capabilities.hook.status, "degraded"); assert.match(report.capabilities.hook.nextAction, /\/hooks/u); assert.equal(report.capabilities.hook.verified, false); });
} finally {
  delete process.env.CLARITY_NOW;
  rmSync(work, { recursive: true, force: true });
}

const registryText = readFileSync(join(repo, "scripts/fixtures/sprint-042/clarity-acceptance.md"), "utf8");
const registry = JSON.parse(registryText.match(/<!-- clarity-acceptance-registry:start -->\s*```json\s*([\s\S]*?)\s*```/u)?.[1] || "null");
assert.deepEqual(registry.primaryCaseIds["sprint-044"], expected, "Sprint 044 registry missing/extra/order mismatch");
assert.equal(new Set(expected).size, expected.length, "Sprint 044 registry duplicate");
assert.deepEqual(results.map((row) => row.id), expected, "Sprint 044 execution missing/extra/order mismatch");
const failed = results.filter((row) => !row.ok);
process.stdout.write("SPRINT044_REGISTRY_MISSING=0 DUPLICATE=0 EXTRA=0\n");
process.stdout.write(`SPRINT044_CASE_PASS=${results.length - failed.length} FAIL=${failed.length} TOTAL=${results.length}\n`);
if (failed.length) process.exit(1);
