#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [publicRoot, privateRoot, oauthJsonPath] = process.argv.slice(2);
if (!publicRoot || !privateRoot) {
  process.stderr.write("usage: scan-public-repo.mjs <public-root> <private-test-workspace> [oauth-json]\n");
  process.exit(2);
}

const config = JSON.parse(readFileSync(join(privateRoot, "google-chat/config.json"), "utf8"));
const protectedValues = new Set();
for (const space of config.selectedSpaces || []) {
  if (space?.name) protectedValues.add(space.name);
  if (space?.displayName) protectedValues.add(space.displayName);
}

if (oauthJsonPath && existsSync(oauthJsonPath)) {
  const oauth = JSON.parse(readFileSync(oauthJsonPath, "utf8"));
  for (const value of [oauth?.installed?.client_id, oauth?.installed?.client_secret]) {
    if (value) protectedValues.add(value);
  }
}

const historyPath = execFileSync("git", ["-C", privateRoot, "ls-files", "google-chat/history/*.md"], { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)[0];
if (historyPath) {
  const history = readFileSync(join(privateRoot, historyPath), "utf8");
  for (const line of history.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("# ") || trimmed.startsWith("- ") || trimmed.startsWith("<!--")) continue;
    if (trimmed.startsWith("## ")) {
      const sender = trimmed.replace(/^##\s+\[[^\]]+\]\s*/, "").trim();
      if (sender) protectedValues.add(sender);
    } else {
      protectedValues.add(trimmed);
    }
  }
}

const tracked = execFileSync("git", ["-C", publicRoot, "ls-files", "-z"])
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
let exactHits = 0;
for (const relative of tracked) {
  let source;
  try {
    source = readFileSync(join(publicRoot, relative), "utf8");
  } catch {
    continue;
  }
  for (const value of protectedValues) {
    if (value.length >= 4 && source.includes(value)) exactHits += 1;
  }
}

const rootLiveAssets = [
  "google-chat/config.json",
  "google-chat/spaces.json",
  "google-chat/state/sync.json",
  ".github/workflows/google-chat-sync.yml",
].filter((relative) => tracked.includes(relative)).length
  + tracked.filter((relative) => relative.startsWith("google-chat/history/")).length;

process.stdout.write(`${JSON.stringify({ trackedCount: tracked.length, exactProtectedValueHits: exactHits, rootLiveAssets })}\n`);
if (exactHits !== 0 || rootLiveAssets !== 0) process.exitCode = 1;
