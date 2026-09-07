#!/usr/bin/env node

import { readFileSync } from "node:fs";
import {
  findClarityHookRootCandidate,
  findClarityRoot,
  hookEventNeedsClarityCore,
  normalizeHookInput,
  parseHookPayload,
  semanticHookResult,
  serializeHookFailure,
  serializeHookResult,
} from "./lib/clarity-hook.mjs";
import { withClarityHookGitProbe, withClarityRootRequest } from "./lib/clarity-root.mjs";

let normalized = { host: process.env.PLUGIN_ROOT ? "codex" : "claudeCode", event: "unknown" };

try {
  const input = parseHookPayload(readFileSync(0, "utf8"));
  normalized = normalizeHookInput(input);
  if (process.env.CLARITY_HOOK_DISABLED === "1") process.exit(0);
  const diagnostic = process.env.CLARITY_HOOK_DIAGNOSTIC === "1";
  const candidate = findClarityHookRootCandidate(normalized.cwd, { reportResolutionFailure: diagnostic });
  if (!candidate) {
    if (normalized.event === "Stop") process.stdout.write("{}\n");
  } else {
    // Heavy semantic modules are loaded only for events that use attention or
    // history, before the async Git probe installs its request-local runner.
    const semanticDependencies = hookEventNeedsClarityCore(normalized)
      ? await import("./lib/clarity-core.mjs")
      : {};
    const execution = await withClarityHookGitProbe(candidate.probeRoots, () => withClarityRootRequest(() => {
      const root = findClarityRoot(normalized.cwd, { reportResolutionFailure: diagnostic });
      if (!root) {
        if (normalized.event === "Stop") process.stdout.write("{}\n");
        return;
      }
      if (process.env.CLARITY_HOOK_FAIL === "1") throw new Error("fixture failure");
      const semantic = semanticHookResult(root, normalized, semanticDependencies);
      const output = serializeHookResult(normalized.host, normalized.event, semantic);
      if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
    }), { reportResolutionFailure: diagnostic });
    if (!execution.executed && normalized.event === "Stop") process.stdout.write("{}\n");
  }
} catch (error) {
  const output = serializeHookFailure(normalized.host, normalized.event, error);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
