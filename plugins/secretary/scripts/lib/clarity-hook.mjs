import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { attention, history } from "./clarity-core.mjs";
import { FilesystemBoundaryError, safeWritePath } from "./safe-fs.mjs";
import {
  resolveClarityRoot,
  rootPolicyFor,
  withClarityRootObservation,
  withClarityRootRequest,
} from "./clarity-root.mjs";

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_CONTEXT_CHARS = 3600;
const MAX_RUNTIME_FILES = 240;
const MAX_PATHS = 12;
const TEST_COMMAND = /(?:^|[;&|]\s*)(?:npm|pnpm|yarn|bun|node|python\d*|pytest|cargo|go|bash|sh)\s+(?:run\s+)?(?:test|check|lint|build|verify|.*regression)|\b(?:vitest|jest|playwright|pytest)\b/iu;
const MATERIAL_TOOLS = /^(?:Edit|Write|MultiEdit|NotebookEdit|apply_patch|Bash)$/u;
const RUNTIME_OWNER = "agentic-secretary:clarity-hook";

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function cleanId(value, fallback) {
  const normalized = String(value || "").replace(/[^A-Za-z0-9._-]/gu, "-").slice(0, 96);
  return normalized || fallback;
}

function oneLine(value, max = 180) {
  return String(value ?? "").replace(/[\r\n\t]+/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
}

function eventName(input) {
  return oneLine(input.hook_event_name || input.hookEventName || input.event || input.event_name, 64);
}

export function detectHookHost(input, env = process.env) {
  const explicit = oneLine(input.host || env.CLARITY_HOOK_HOST, 32).toLowerCase();
  if (["codex", "claudecode"].includes(explicit)) return explicit;
  if (input.model !== undefined || input.turn_id !== undefined || env.PLUGIN_ROOT) return "codex";
  return "claudeCode";
}

export function normalizeHookInput(input, env = process.env) {
  const host = detectHookHost(input, env);
  const name = eventName(input);
  const toolInput = input.tool_input ?? input.toolInput ?? {};
  return {
    semanticVersion: 1,
    host,
    event: name,
    sessionId: oneLine(input.session_id || input.sessionId, 160) || "unknown-session",
    turnId: oneLine(input.turn_id || input.turnId, 160) || null,
    cwd: oneLine(input.cwd || env.PWD, 4096) || ".",
    source: oneLine(input.source || input.matcher || input.reason, 64) || null,
    trigger: oneLine(input.trigger, 64) || null,
    toolName: oneLine(input.tool_name || input.toolName, 128) || null,
    toolUseId: oneLine(input.tool_use_id || input.toolUseId, 160) || null,
    toolInput,
    toolResponse: input.tool_response ?? input.toolResponse ?? input.tool_result ?? null,
    stopHookActive: Boolean(input.stop_hook_active ?? input.stopHookActive),
  };
}

function isNormalDirectory(path) {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function isNormalFile(path) {
  try {
    const stat = lstatSync(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function lstatOptional(path) {
  try { return lstatSync(path); } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function runtimeBoundary(message, code = "hook-runtime-unsafe") {
  throw new FilesystemBoundaryError(message, code);
}

function samePath(root, target) {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function canonicalRuntimeRoot(rootValue) {
  const root = resolveClarityRoot(rootValue).root;
  const clarity = join(root, ".clarity");
  let guarded;
  try { guarded = safeWritePath(root, ".clarity"); } catch {
    return runtimeBoundary("Clarity rootの実体境界を安全に確認できませんでした。");
  }
  if (guarded !== clarity || !isNormalDirectory(clarity)) runtimeBoundary("Clarity rootが通常directoryではないためHook runtimeを書き込みません。");
  let real;
  try { real = realpathSync(clarity); } catch { return runtimeBoundary("Clarity rootの実体を確認できませんでした。"); }
  if (real !== clarity || !samePath(root, real)) runtimeBoundary("Clarity rootがworking root外を指すためHook runtimeを書き込みません。");
  return root;
}

function assertRuntimeDirectoryChain(rootValue, relativeDirectory, { allowMissing = false } = {}) {
  const root = canonicalRuntimeRoot(rootValue);
  const components = String(relativeDirectory).split(/[\\/]+/u).filter(Boolean);
  let current = root;
  for (const component of components) {
    current = join(current, component);
    let guarded;
    try { guarded = safeWritePath(root, relative(root, current)); } catch {
      return runtimeBoundary("Hook runtime pathの実体境界を安全に確認できませんでした。");
    }
    if (guarded !== current || !samePath(root, guarded)) runtimeBoundary("Hook runtime pathがworking root外へ解決されるため書き込みません。");
    const stat = lstatOptional(current);
    if (!stat) {
      if (allowMissing) return { root, directory: null, missing: current };
      runtimeBoundary("Hook runtime directoryが途中で欠落したため書き込みません。", "hook-runtime-changed");
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) runtimeBoundary("Hook runtime pathに通常directory以外があるため書き込みません。");
    let real;
    try { real = realpathSync(current); } catch { return runtimeBoundary("Hook runtime directoryの実体を確認できませんでした。"); }
    if (real !== current || !samePath(root, real)) runtimeBoundary("Hook runtime directoryがworking root外へ解決されるため書き込みません。");
  }
  return { root, directory: current, missing: null };
}

function inspectClarityHookRootImpl(cwdValue) {
  const requestedCwd = resolve(cwdValue || ".");
  let current;
  try {
    current = resolveClarityRoot(requestedCwd).root;
  } catch {
    return null;
  }
  if (!isNormalDirectory(current)) return null;
  for (let depth = 0; depth < 64; depth += 1) {
    const clarity = join(current, ".clarity");
    if (isNormalDirectory(clarity) && isNormalFile(join(clarity, "project.json")) && isNormalFile(join(clarity, "state.json"))) {
      const requestedRoot = resolve(requestedCwd, ...Array.from({ length: depth }, () => ".."));
      try {
        const resolved = resolveClarityRoot(requestedRoot);
        return { root: resolved.root, rootPolicy: rootPolicyFor(resolved.root) };
      } catch { return null; }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function findClarityRoot(cwdValue) {
  return inspectClarityHookRoot(cwdValue)?.root || null;
}

function safeRelative(root, value) {
  if (!value || typeof value !== "string") return null;
  let target = isAbsolute(value) ? resolve(value) : resolve(root, value);
  if (isAbsolute(value)) {
    try { target = realpathSync(target); }
    catch {
      try { target = resolve(realpathSync(dirname(target)), target.slice(dirname(target).length + 1)); } catch { return null; }
    }
  }
  const rel = relative(root, target).split(sep).join("/");
  if (!rel || rel === "." || rel === ".." || rel.startsWith("../")) return null;
  return rel.slice(0, 500);
}

function pathsFromPatch(command) {
  const paths = [];
  for (const match of String(command || "").matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+)$/gmu)) paths.push(match[1].trim());
  return paths;
}

function observedPaths(root, normalized) {
  const input = normalized.toolInput && typeof normalized.toolInput === "object" ? normalized.toolInput : {};
  const candidates = [input.file_path, input.path, input.notebook_path, input.target_file];
  if (normalized.toolName === "apply_patch" || normalized.toolName === "Edit" || normalized.toolName === "Write") candidates.push(...pathsFromPatch(input.command));
  return [...new Set(candidates.map((value) => safeRelative(root, value)).filter(Boolean))].slice(0, MAX_PATHS);
}

function isTestCandidate(normalized) {
  if (normalized.toolName !== "Bash") return false;
  const input = normalized.toolInput && typeof normalized.toolInput === "object" ? normalized.toolInput : {};
  return TEST_COMMAND.test(String(input.command || ""));
}

function resultSummary(normalized) {
  const response = normalized.toolResponse;
  if (response && typeof response === "object") {
    const code = response.exit_code ?? response.exitCode ?? response.status;
    if (typeof code === "number") return code === 0 ? "success" : "failed";
    if (response.isError === true || response.error) return "failed";
  }
  return response === null || response === undefined ? "unknown" : "completed";
}

function runtimeBase(root, sessionId) {
  return join(root, ".clarity", "runtime", "hooks", "events", cleanId(sessionId, "unknown-session"));
}

function ensureRuntimeDirectory(rootValue, sessionId) {
  const root = canonicalRuntimeRoot(rootValue);
  const relativeDirectories = [
    ".clarity/runtime",
    ".clarity/runtime/hooks",
    ".clarity/runtime/hooks/events",
    `.clarity/runtime/hooks/events/${cleanId(sessionId, "unknown-session")}`,
  ];
  assertRuntimeDirectoryChain(root, ".clarity");
  for (const relativeDirectory of relativeDirectories) {
    const parentRelative = relativeDirectory.split("/").slice(0, -1).join("/");
    assertRuntimeDirectoryChain(root, parentRelative);
    const target = join(root, ...relativeDirectory.split("/"));
    let guarded;
    try { guarded = safeWritePath(root, relativeDirectory); } catch {
      return runtimeBoundary("Hook runtime directoryを作成する前に安全境界を確認できませんでした。");
    }
    if (guarded !== target || !samePath(root, guarded)) runtimeBoundary("Hook runtime directoryがworking root外へ解決されるため作成しません。");
    const before = lstatOptional(target);
    if (!before) {
      // recursive mkdirは中間symlinkを先に辿るため使わず、検査済みの親から1階層だけ作る。
      assertRuntimeDirectoryChain(root, parentRelative);
      try { mkdirSync(target, { recursive: false, mode: 0o700 }); }
      catch (error) { if (error?.code !== "EEXIST") throw error; }
    } else if (!before.isDirectory() || before.isSymbolicLink()) {
      runtimeBoundary("Hook runtime pathに通常directory以外があるため作成しません。");
    }
    // 同時作成またはpath差替えを検出するため、各mkdirの直後にもrootから再検証する。
    assertRuntimeDirectoryChain(root, relativeDirectory);
  }
  return { root, directory: runtimeBase(root, sessionId), eventsDirectory: join(root, ".clarity", "runtime", "hooks", "events") };
}

function existingRuntimeDirectory(rootValue, sessionId) {
  const root = canonicalRuntimeRoot(rootValue);
  const relativeDirectories = [
    ".clarity/runtime",
    ".clarity/runtime/hooks",
    ".clarity/runtime/hooks/events",
    `.clarity/runtime/hooks/events/${cleanId(sessionId, "unknown-session")}`,
  ];
  for (const relativeDirectory of relativeDirectories) {
    const target = join(root, ...relativeDirectory.split("/"));
    const stat = lstatOptional(target);
    if (!stat) return null;
    assertRuntimeDirectoryChain(root, relativeDirectory);
  }
  return { root, directory: runtimeBase(root, sessionId), eventsDirectory: join(root, ".clarity", "runtime", "hooks", "events") };
}

function assertEventTarget(root, directory, eventId, { allowMissing = true } = {}) {
  const relativeTarget = `${relative(root, directory).split(sep).join("/")}/${eventId}.json`;
  const target = join(directory, `${eventId}.json`);
  assertRuntimeDirectoryChain(root, relative(root, directory).split(sep).join("/"));
  let guarded;
  try { guarded = safeWritePath(root, relativeTarget); } catch {
    return runtimeBoundary("Hook runtime eventの実体境界を安全に確認できませんでした。");
  }
  if (guarded !== target || !samePath(root, guarded)) runtimeBoundary("Hook runtime eventがworking root外へ解決されるため書き込みません。");
  const stat = lstatOptional(target);
  if (!stat) {
    if (allowMissing) return { target, stat: null };
    runtimeBoundary("Hook runtime eventが途中で欠落しました。", "hook-runtime-changed");
  }
  if (!stat.isFile() || stat.isSymbolicLink()) runtimeBoundary("Hook runtime eventが通常fileではないため読み書きしません。");
  let real;
  try { real = realpathSync(target); } catch { return runtimeBoundary("Hook runtime eventの実体を確認できませんでした。"); }
  if (real !== target || !samePath(root, real)) runtimeBoundary("Hook runtime eventがworking root外へ解決されるため読み書きしません。");
  return { target, stat };
}

function ownedRuntimeRecord(target, eventId) {
  const record = JSON.parse(readFileSync(target, "utf8"));
  if (record?.owner !== RUNTIME_OWNER || record?.eventId !== eventId) runtimeBoundary("既存Hook runtime eventの所有情報が一致しないため上書きしません。", "hook-runtime-collision");
  return record;
}

function removeCreatedEvent(root, target, eventId, descriptorStat) {
  try {
    const checked = assertEventTarget(root, dirname(target), eventId, { allowMissing: true });
    const stat = checked.stat;
    if (stat && stat.dev === descriptorStat.dev && stat.ino === descriptorStat.ino && stat.isFile() && !stat.isSymbolicLink()) unlinkSync(target);
  } catch { /* 元の境界errorを置き換えない。 */ }
}

function stableEventId(normalized, semantic) {
  const discriminator = normalized.toolUseId || normalized.turnId || normalized.source || normalized.trigger || semantic.kind;
  return `he_${sha256(`${normalized.host}:${normalized.sessionId}:${normalized.event}:${discriminator}:${JSON.stringify(semantic)}`).slice(0, 24)}`;
}

function writeRuntimeEventImpl(rootValue, normalized, semantic, options = {}) {
  const prepared = ensureRuntimeDirectory(rootValue, normalized.sessionId);
  const { root, directory, eventsDirectory } = prepared;
  const eventId = stableEventId(normalized, semantic);
  const record = {
    schemaVersion: 1,
    owner: RUNTIME_OWNER,
    eventId,
    host: normalized.host,
    sessionId: normalized.sessionId,
    turnId: normalized.turnId,
    hostEvent: normalized.event,
    kind: semantic.kind,
    tool: semantic.tool || null,
    touchedPaths: semantic.touchedPaths || [],
    testCandidate: Boolean(semantic.testCandidate),
    material: Boolean(semantic.material),
    resultSummary: semantic.resultSummary || null,
    pendingCheckpoint: Boolean(semantic.pendingCheckpoint),
    resumeContextDigest: semantic.resumeContextDigest || null,
    source: normalized.source || normalized.trigger || null,
    observedAt: process.env.CLARITY_NOW || new Date().toISOString(),
  };
  options.beforeFileOpen?.({ root, directory, eventsDirectory, eventId, target: join(directory, `${eventId}.json`) });
  // file open直前にcanonical root、全directory component、最終fileを再検証する。
  const currentRoot = canonicalRuntimeRoot(root);
  if (currentRoot !== root) runtimeBoundary("Hook runtime rootが途中で変わったため書き込みません。", "hook-runtime-changed");
  const checked = assertEventTarget(root, directory, eventId);
  const target = checked.target;
  if (checked.stat) return { changed: false, target, record: ownedRuntimeRecord(target, eventId) };

  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
  let descriptor = null;
  let descriptorStat = null;
  try {
    descriptor = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
    descriptorStat = fstatSync(descriptor);
    if (!descriptorStat.isFile()) runtimeBoundary("Hook runtime eventを通常fileとして作成できませんでした。");
    const afterOpen = assertEventTarget(root, directory, eventId, { allowMissing: false });
    if (afterOpen.stat.dev !== descriptorStat.dev || afterOpen.stat.ino !== descriptorStat.ino) runtimeBoundary("Hook runtime eventがopen直後に差し替えられたため書き込みません。", "hook-runtime-changed");
    writeFileSync(descriptor, `${JSON.stringify(record)}\n`, { encoding: "utf8" });
    return { changed: true, target, record };
  } catch (error) {
    if (error?.code === "EEXIST") {
      const collision = assertEventTarget(root, directory, eventId, { allowMissing: false });
      return { changed: false, target: collision.target, record: ownedRuntimeRecord(collision.target, eventId) };
    }
    if (descriptor !== null) { closeSync(descriptor); descriptor = null; }
    if (descriptorStat) removeCreatedEvent(root, target, eventId, descriptorStat);
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function listRuntimeEvents(rootValue, sessionId) {
  const prepared = existingRuntimeDirectory(rootValue, sessionId);
  if (!prepared) return [];
  const { root, directory } = prepared;
  const names = readdirSync(directory).filter((name) => /^he_[a-f0-9]{24}\.json$/u.test(name)).sort().slice(-MAX_RUNTIME_FILES);
  const events = [];
  for (const name of names) {
    const eventId = name.slice(0, -5);
    try {
      const checked = assertEventTarget(root, directory, eventId, { allowMissing: false });
      events.push(ownedRuntimeRecord(checked.target, eventId));
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
  return events;
}

function brief(root) {
  const report = attention(root, { limit: 3 });
  const rows = (report.items || []).slice(0, 3).map((item, index) => {
    const reason = oneLine((item.reasonLabels || []).join("／"), 180) || "理由を確認してください";
    const evidence = oneLine((item.evidence || []).map((row) => row.summary).join("／"), 180) || "根拠不足";
    const choice = oneLine((item.choices || []).join("／"), 160) || "statusを手動確認";
    return `${index + 1}. ${oneLine(item.conclusion, 180)}\n   理由: ${reason}\n   根拠: ${evidence}\n   選択: ${choice}`;
  });
  const extra = Number(report.otherCount || 0) > 0 ? `\nその他 ${report.otherCount}件。詳細は手動の clarity status で確認してください。` : "";
  return (`Project Clarity Session Brief\n${rows.length ? rows.join("\n") : "今すぐ人間の判断が必要なAttentionはありません。"}${extra}\nHookが未信頼・無効・失敗の場合も、clarity status / attention / checkpoint / doctorを手動実行できます。`).slice(0, MAX_CONTEXT_CHARS);
}

function hasCheckpointAfter(root, materialEvents) {
  if (!materialEvents.length) return true;
  let canonical;
  try { canonical = history(root); } catch { return false; }
  const lastMaterial = materialEvents.map((row) => Date.parse(row.observedAt) || 0).sort((a, b) => b - a)[0] || 0;
  return canonical.events.some((row) => row.type === "checkpoint.recorded" && (Date.parse(row.occurredAt) || 0) >= lastMaterial);
}

function semanticHookResultImpl(root, normalized) {
  if (normalized.event === "SessionStart") {
    const context = brief(root);
    writeRuntimeEvent(root, normalized, { kind: normalized.source === "compact" ? "compact-resume" : "session-start" });
    return { action: "context", context };
  }
  if (normalized.event === "PostToolUse") {
    const touchedPaths = observedPaths(root, normalized);
    const testCandidate = isTestCandidate(normalized);
    const material = MATERIAL_TOOLS.test(normalized.toolName || "") && (touchedPaths.length > 0 || testCandidate);
    writeRuntimeEvent(root, normalized, { kind: "observation", tool: normalized.toolName, touchedPaths, testCandidate, material, resultSummary: resultSummary(normalized) });
    return { action: "none" };
  }
  if (normalized.event === "PreCompact") {
    const events = listRuntimeEvents(root, normalized.sessionId);
    const material = events.filter((row) => row.kind === "observation" && row.material);
    const context = brief(root);
    writeRuntimeEvent(root, normalized, { kind: "pre-compact", pendingCheckpoint: !hasCheckpointAfter(root, material), resumeContextDigest: sha256(context) });
    return { action: "none" };
  }
  if (normalized.event === "Stop") {
    if (normalized.stopHookActive) return { action: "none" };
    const events = listRuntimeEvents(root, normalized.sessionId);
    const material = events.filter((row) => row.kind === "observation" && row.material);
    if (!material.length || hasCheckpointAfter(root, material)) return { action: "none" };
    writeRuntimeEvent(root, normalized, { kind: "checkpoint-request" });
    return { action: "continue", reason: "Project Clarity: materialな変更があり、まだcheckpointがありません。clarity checkpointを1回実行し、結果を確認してから終了してください。" };
  }
  if (normalized.event === "SessionEnd") {
    writeRuntimeEvent(root, normalized, { kind: "session-end-flush" });
    return { action: "none" };
  }
  return { action: "none" };
}

export function inspectClarityHookRoot(cwdValue) {
  return withClarityRootRequest(() => inspectClarityHookRootImpl(cwdValue));
}

export function writeRuntimeEvent(rootValue, normalized, semantic, options = {}) {
  return withClarityRootObservation(rootValue, (handle) => writeRuntimeEventImpl(handle.root, normalized, semantic, options));
}

export function semanticHookResult(rootValue, normalized) {
  return withClarityRootObservation(rootValue, (handle) => semanticHookResultImpl(handle.root, normalized));
}

export function serializeHookResult(host, event, result) {
  if (result.action === "context") {
    return {
      hookSpecificOutput: {
        hookEventName: event,
        additionalContext: result.context,
      },
    };
  }
  if (result.action === "continue") return { decision: "block", reason: result.reason };
  return event === "Stop" ? {} : null;
}

export function serializeHookFailure(host, event) {
  const message = "Project Clarity Hookはdegradedです。canonical dataは変更していません。manualの clarity status / review / checkpoint / doctorを使い、Codexでは /hooks でtrust／disabled状態を確認してください。";
  if (event === "SessionStart") return { systemMessage: message, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: message } };
  if (event === "Stop") return { systemMessage: message };
  return { systemMessage: message };
}

export function resolvePluginRoot(env = process.env) {
  for (const key of ["PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT", "CODEX_PLUGIN_ROOT"]) {
    const value = env[key];
    if (!value || !isAbsolute(value)) continue;
    try {
      const real = realpathSync(value);
      if (isNormalDirectory(real) && isNormalFile(join(real, "scripts", "clarity-hook.mjs"))) return real;
    } catch { /* try the next official compatibility variable */ }
  }
  return null;
}

export function parseHookPayload(text) {
  if (Buffer.byteLength(text || "", "utf8") > MAX_INPUT_BYTES) throw new Error("Hook payloadが上限を超えました。");
  const input = JSON.parse(text || "{}");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Hook payloadはJSON objectである必要があります。");
  return input;
}

export const HOOK_LIMITS = Object.freeze({ MAX_INPUT_BYTES, MAX_CONTEXT_CHARS, MAX_RUNTIME_FILES, MAX_PATHS });
