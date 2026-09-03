#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitReceipt, FIXED, inspectPrewrite, PrewriteError, verifyReceipt } from "./lib/sprint-041-prewrite.mjs";

const argv = process.argv.slice(2);
const rootDefault = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const knownFlags = new Set(["--check", "--emit-receipt", "--verify-receipt"]);
const knownValues = new Set(["--root", "--base-root", "--handoff", "--private-receipt", "--private-feedback-commit", "--output", "--receipt"]);
const values = {};
let mode = null;
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (knownFlags.has(arg)) {
    if (mode) throw new Error(`multiple modes: ${mode}, ${arg}`);
    mode = arg;
  } else if (knownValues.has(arg)) {
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`missing value: ${arg}`);
    values[arg] = argv[index + 1]; index += 1;
  } else throw new Error(`unknown option: ${arg}`);
}

if (!mode) {
  console.error("usage: sprint-041-prewrite.mjs (--check|--emit-receipt|--verify-receipt) [--root PATH] [--base-root PATH] --handoff PATH --private-receipt PATH [--private-feedback-commit SHA] [--output PATH|--receipt PATH]");
  process.exit(64);
}

const root = resolve(values["--root"] || rootDefault);
const options = {
  root,
  baseRoot: values["--base-root"] ? resolve(values["--base-root"]) : null,
  handoffPath: resolve(values["--handoff"] || FIXED.publicHandoffPath),
  privateReceiptPath: resolve(values["--private-receipt"] || FIXED.privateReceiptPath),
  privateFeedbackCommit: values["--private-feedback-commit"] || FIXED.privateFeedbackCommit,
};

try {
  let result;
  if (mode === "--check") result = inspectPrewrite(options);
  else if (mode === "--emit-receipt") result = emitReceipt({ ...options, outputPath: resolve(values["--output"] || join(root, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json")) });
  else result = verifyReceipt({ ...options, receiptPath: resolve(values["--receipt"] || join(root, "scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json")) });
  console.log(`SPRINT041_PREWRITE_PASS mode=${mode.slice(2)} summary=${JSON.stringify(result.summary)}`);
} catch (error) {
  const code = error instanceof PrewriteError ? error.code : "unexpected";
  console.error(`SPRINT041_PREWRITE_FAIL code=${code} message=${error.message} details=${JSON.stringify(error.details || {})}`);
  process.exitCode = 1;
}
