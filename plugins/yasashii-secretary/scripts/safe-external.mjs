#!/usr/bin/env node

import { runExternal } from "./lib/external-ops.mjs";

const separator = process.argv.indexOf("--", 2);
if (separator < 0 || separator === process.argv.length - 1) {
  process.stderr.write("使い方: safe-external.mjs --cwd <dir> --label <name> --timeout-ms <ms> -- <command> [args...]\n");
  process.exit(2);
}
const options = new Map();
for (let index = 2; index < separator; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!["--cwd", "--label", "--timeout-ms"].includes(key) || value === undefined) process.exit(2);
  options.set(key, value);
}
const [binary, ...args] = process.argv.slice(separator + 1);
try {
  const result = await runExternal(binary, args, {
    cwd: options.get("--cwd") || process.cwd(),
    label: options.get("--label") || binary,
    timeoutMs: Number(options.get("--timeout-ms") || process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
} catch (error) {
  if (error.stdout) process.stdout.write(String(error.stdout));
  if (error.stderr) process.stderr.write(String(error.stderr));
  if (!error.stderr && error.message) process.stderr.write(`${error.message}\n`);
  process.exit(error.code === "timeout" ? 124 : error.code === "max-buffer" ? 125 : Number.isInteger(error.status) && error.status > 0 ? error.status : 1);
}
