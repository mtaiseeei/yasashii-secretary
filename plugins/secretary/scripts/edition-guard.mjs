#!/usr/bin/env node

import { resolve } from "node:path";
import { defaultPluginRoot, loadEditionConfig, inspectWorkspaceEdition, entryDecision, refusalMessage } from "./lib/edition-guard.mjs";
import { safeWritePath, writeFileAtomicSafe } from "./lib/safe-fs.mjs";

function args(argv) {
  const values = new Map();
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--json", "--prepare-new"].includes(token)) { flags.add(token); continue; }
    const value = argv[index + 1];
    if (!token.startsWith("--") || !value || value.startsWith("--")) throw new Error(`引数が不正です: ${token}`);
    values.set(token, value);
    index += 1;
  }
  return { values, flags };
}

try {
  const parsed = args(process.argv.slice(2));
  const pluginRoot = resolve(parsed.values.get("--plugin-root") ?? defaultPluginRoot());
  const config = loadEditionConfig(pluginRoot, parsed.values.get("--config") ?? null);
  const entry = parsed.values.get("--entry") ?? "diagnose";
  if (!["onboarding", "diagnose", "update", "migration"].includes(entry)) throw new Error("--entry は onboarding / diagnose / update / migration から選んでください。");
  const result = inspectWorkspaceEdition(parsed.values.get("--workspace") ?? ".", config);
  const decision = entryDecision(result, entry);
  if (parsed.flags.has("--prepare-new")) {
    if (entry !== "onboarding" || !decision.allowed || result.state !== "new") throw new Error(refusalMessage(result, entry));
    const marker = safeWritePath(result.workspace, config.workspaceProtection.canonicalMarker);
    writeFileAtomicSafe(result.workspace, marker, `${JSON.stringify({ schemaVersion: config.workspaceProtection.markerSchemaVersion, edition: config.edition }, null, 2)}\n`, { encoding: "utf8" });
  }
  const output = { ...result, entry, ...decision, markerPrepared: parsed.flags.has("--prepare-new"), stopped: !decision.allowed };
  process.stdout.write(`${JSON.stringify(output, null, parsed.flags.has("--json") ? 2 : 0)}\n`);
  if (!decision.allowed) {
    process.stderr.write(`${refusalMessage(result, entry)}\n`);
    process.exitCode = 3;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 3;
}
