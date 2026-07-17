#!/usr/bin/env node

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = mkdtempSync(join(tmpdir(), "yasashii-s020-eval-time-"));
const bin = join(root, "bin");
mkdirSync(bin, { recursive: true });
mkdirSync(join(root, "google-chat", "history", "fixture--AAA"), { recursive: true });
const fakeGit = join(bin, "git");
const fakeGh = join(bin, "gh");

writeFileSync(fakeGit, `#!/bin/sh
if [ "$1" = "pull" ]; then
  count=0
  [ -f "$FAKE_ROOT/pull-count" ] && count=$(cat "$FAKE_ROOT/pull-count")
  count=$((count + 1)); printf '%s' "$count" > "$FAKE_ROOT/pull-count"
  if [ "$count" -ge 2 ]; then printf '# fixture\n\n時刻不明runで見つかった語\n' > "$FAKE_ROOT/google-chat/history/fixture--AAA/2026-07-17.md"; fi
fi
exit 0
`);
writeFileSync(fakeGh, `#!/bin/sh
if [ "$1 $2" = "workflow run" ]; then printf '1' > "$FAKE_ROOT/dispatched"; exit 0; fi
if [ "$1 $2" = "run list" ]; then
  if [ -f "$FAKE_ROOT/dispatched" ]; then
    echo '[{"databaseId":7,"createdAt":"2020-01-01T00:00:00Z"},{"databaseId":8,"status":"queued"}]'
  else
    echo '[{"databaseId":7,"createdAt":"2020-01-01T00:00:00Z"}]'
  fi
  exit 0
fi
if [ "$1 $2" = "run watch" ] && [ "$3" = "8" ]; then exit 0; fi
exit 1
`);
chmodSync(fakeGit, 0o755);
chmodSync(fakeGh, 0o755);

try {
  const flow = resolve("plugins/yasashii-secretary/skills/google-chat/scripts/search-flow.mjs");
  let stdout = "";
  try {
    stdout = execFileSync(process.execPath, [flow, "--root", root, "--query", "時刻不明runで見つかった語", "--choice", "sync", "--timeout-ms", "500", "--run-discovery-timeout-ms", "250", "--run-poll-ms", "50"], {
      encoding: "utf8",
      env: { ...process.env, YASASHII_GIT_BIN: fakeGit, YASASHII_GH_BIN: fakeGh, FAKE_ROOT: root },
    });
  } catch (error) {
    stdout = String(error.stdout || "");
  }
  const result = JSON.parse(stdout);
  const pulls = Number(readFileSync(join(root, "pull-count"), "utf8"));
  const passed = result.status === "sync-failed" && result.error === "timeout" && pulls === 1 && !result.events.includes("success-confirmed") && !result.events.includes("pull-after-sync");
  process.stdout.write(`${passed ? "PASS" : "FAIL"} createdAtのない新規IDを今回runと断定しない: ${result.status}; pulls=${pulls}; ${result.events.join(",")}\n`);
  process.exitCode = passed ? 0 : 1;
} finally {
  rmSync(root, { recursive: true, force: true });
}
