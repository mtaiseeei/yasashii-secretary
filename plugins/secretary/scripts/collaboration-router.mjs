#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { routeSecretaryIntent } from "./lib/collaboration-router.mjs";

function usage() {
  process.stderr.write("使い方: collaboration-router <自然言語の用件> [--json]\n");
  process.exit(2);
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const positional = args.filter((value) => value !== "--json");
let input = positional.join(" ").trim();
if (!input && !process.stdin.isTTY) input = readFileSync(0, "utf8").trim();
if (!input) usage();

const routed = routeSecretaryIntent(input);
if (asJson) process.stdout.write(`${JSON.stringify({ ok: true, input, ...routed }, null, 2)}\n`);
else process.stdout.write(`${routed.selectedSkill}\t${routed.route}\n`);
