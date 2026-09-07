#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;

function check(condition, label, detail = "") {
  if (condition) { passed += 1; process.stdout.write(`PASS ${label}\n`); }
  else { failed += 1; process.stderr.write(`FAIL ${label}${detail ? `: ${detail}` : ""}\n`); }
}

const callsites = [
  ["chatwork-wizard-sync", "plugins/secretary/skills/chatwork/scripts/wizard-server.mjs", 2],
  ["chatwork-search-flow", "plugins/secretary/skills/chatwork/scripts/search-flow.mjs", 1],
  ["google-chat-search", "plugins/secretary/skills/google-chat/scripts/search.mjs", 1],
  ["google-chat-search-flow", "plugins/secretary/skills/google-chat/scripts/search-flow.mjs", 1],
  ["google-chat-actions-discovery", "plugins/secretary/skills/google-chat/scripts/actions-discovery.mjs", 1],
];

let total = 0;
const production = callsites.map(([id, path, expected]) => {
  const source = readFileSync(join(root, path), "utf8");
  const count = (source.match(/ingestGit(?:Sync)?\(\{/g) || []).length;
  total += count;
  check(source.includes('../../../scripts/lib/git-ingest.mjs') && count === expected, `${id} は共通Git取り込みへ接続`, `count=${count}`);
  return source;
}).join("\n");

check(total === 6, "製品Git取り込みcallsiteは6件", `count=${total}`);
check(!production.includes('["pull", "--ff-only", "--no-rebase"]'), "未分類の直接pullは0件");
check(!/(?:spawn|exec)(?:Sync)?\([^\n]*shell:\s*true|\.cmd\b|\.bat\b/i.test(production), "shell:trueとcmd/bat shimは0件");

const regression = spawnSync(process.execPath, [join(root, "scripts/sprint-051-git-ingest-test.mjs"), ...(process.argv.includes("--require-windows") ? ["--require-windows"] : [])], {
  cwd: root,
  encoding: "utf8",
  shell: false,
  timeout: 120_000,
});
process.stdout.write(regression.stdout || "");
process.stderr.write(regression.stderr || "");
check(regression.status === 0 && /SPRINT051_PASS=\d+ SPRINT051_FAIL=0/.test(regression.stdout || ""), "共通helper・dirty保持・明示remote/ref・stage契約がgreen", `status=${regression.status}`);

process.stdout.write(`SPRINT035_PATCH002_CALLSITES=${total} SPRINT035_PATCH002_PASS=${passed} SPRINT035_PATCH002_FAIL=${failed}\n`);
if (failed) process.exit(1);
