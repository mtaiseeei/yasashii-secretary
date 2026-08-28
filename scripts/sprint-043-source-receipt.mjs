#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReceipt, loadInputs, Sprint043ReceiptError, verifyReceipt } from "./lib/sprint-043-source-receipt.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const feedbackRelative = "docs/feedback/sprint-043.md";
try {
  if (args.includes("--check-pending")) {
    loadInputs(root);
    if (!existsSync(resolve(root, feedbackRelative))) throw new Sprint043ReceiptError("feedback-pending");
    buildReceipt({ root, feedbackBody: readFileSync(resolve(root, feedbackRelative), "utf8"), feedbackPath: feedbackRelative });
    throw new Sprint043ReceiptError("feedback-is-finalizable-use-orchestrator-finalize");
  }
  if (args.includes("--finalize")) {
    const output = value("--output");
    if (!output) throw new Sprint043ReceiptError("output-required");
    const body = readFileSync(resolve(root, feedbackRelative), "utf8");
    const receipt = buildReceipt({ root, feedbackBody: body, feedbackPath: feedbackRelative });
    const target = resolve(output); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`);
    process.stdout.write(`SPRINT043_RECEIPT_FINALIZED candidate=${receipt.candidate} feedback_sha=${receipt.feedback.sha256} internal_sha=${receipt.internalSha256} next_permission=${receipt.nextPermission}\n`);
  } else if (args.includes("--verify")) {
    const receiptPath = value("--verify");
    const receipt = JSON.parse(readFileSync(resolve(receiptPath), "utf8"));
    const body = readFileSync(resolve(root, feedbackRelative), "utf8");
    verifyReceipt(root, receipt, body);
    process.stdout.write(`SPRINT043_RECEIPT_VERIFIED candidate=${receipt.candidate} feedback_sha=${receipt.feedback.sha256}\n`);
  } else if (!args.includes("--check-pending")) {
    throw new Sprint043ReceiptError("mode-required");
  }
} catch (error) {
  process.stderr.write(`SPRINT043_RECEIPT_REJECT code=${error.code || "unexpected"} message=${error.message}\n`);
  process.exitCode = 1;
}
