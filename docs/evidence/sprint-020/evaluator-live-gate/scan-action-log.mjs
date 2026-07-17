#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  process.stderr.write("usage: scan-action-log.mjs <private-test-workspace>\n");
  process.exit(2);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}

const config = JSON.parse(readFileSync(join(root, "google-chat/config.json"), "utf8"));
const historyFiles = walk(join(root, "google-chat/history")).filter((path) => path.endsWith(".md"));
const history = historyFiles.map((path) => readFileSync(path, "utf8")).join("\n");
const protectedValues = new Set();

for (const space of config.selectedSpaces || []) {
  if (space?.name) protectedValues.add(space.name);
  if (space?.displayName) protectedValues.add(space.displayName);
}
for (const line of history.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("# ") || trimmed.startsWith("- ") || trimmed.startsWith("<!--")) continue;
  if (trimmed.startsWith("## ")) {
    const sender = trimmed.replace(/^##\s+\[[^\]]+\]\s*/, "").trim();
    if (sender) protectedValues.add(sender);
    continue;
  }
  protectedValues.add(trimmed);
}

let input = "";
for await (const chunk of process.stdin) input += chunk;

const hits = {
  selectedResourceOrName: [...protectedValues].filter((value) => value.length >= 4 && input.includes(value)).length,
  googleClientId: (input.match(/\b\d{6,}-[a-z0-9_-]+\.apps\.googleusercontent\.com\b/gi) || []).length,
  googleClientSecret: (input.match(/\bGOCSPX-[A-Za-z0-9_-]+\b/g) || []).length,
  oauthAccessToken: (input.match(/\bya29\.[A-Za-z0-9._-]+\b/g) || []).length,
  oauthRefreshToken: (input.match(/\b1\/\/[A-Za-z0-9._-]+\b/g) || []).length,
  oauthAuthorizationUrl: (input.match(/https?:\/\/accounts\.google\.com\/[^\s]+/gi) || []).length,
  oauthCallbackWithCode: (input.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/[^\s]*[?&]code=/gi) || []).length,
};

const total = Object.values(hits).reduce((sum, count) => sum + count, 0);
process.stdout.write(`${JSON.stringify({ total, hits })}\n`);
if (total !== 0) process.exitCode = 1;
