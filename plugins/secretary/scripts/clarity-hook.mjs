#!/usr/bin/env node

import { readFileSync } from "node:fs";
import {
  findClarityRoot,
  normalizeHookInput,
  parseHookPayload,
  semanticHookResult,
  serializeHookFailure,
  serializeHookResult,
} from "./lib/clarity-hook.mjs";
import { withClarityRootRequest } from "./lib/clarity-root.mjs";

let normalized = { host: process.env.PLUGIN_ROOT ? "codex" : "claudeCode", event: "unknown" };

try {
  const input = parseHookPayload(readFileSync(0, "utf8"));
  normalized = normalizeHookInput(input);
  if (process.env.CLARITY_HOOK_DISABLED === "1") process.exit(0);
  withClarityRootRequest(() => {
  const root = findClarityRoot(normalized.cwd);
  if (!root) {
    if (normalized.event === "Stop") process.stdout.write("{}\n");
    return;
  }
  if (process.env.CLARITY_HOOK_FAIL === "1") throw new Error("fixture failure");
  const semantic = semanticHookResult(root, normalized);
  const output = serializeHookResult(normalized.host, normalized.event, semantic);
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
  });
} catch {
  const output = serializeHookFailure(normalized.host, normalized.event);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
