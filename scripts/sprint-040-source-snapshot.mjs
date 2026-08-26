#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const value = (name) => {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`);
  return process.argv[index + 1];
};
const source = resolve(value("--source"));
const editionId = value("--edition");
const handoff = JSON.parse(readFileSync(join(root, "scripts/fixtures/sprint-040/downstream-handoff.json"), "utf8"));
const edition = handoff.editions.find((item) => item.id === editionId);
if (!edition) throw new Error(`unknown-edition:${editionId}`);

function git(args) {
  const result = spawnSync("git", ["-C", source, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed:${result.stderr.trim()}`);
  return result.stdout.trim();
}
const sha = (path) => createHash("sha256").update(readFileSync(join(source, path))).digest("hex");
const snapshot = {
  edition: editionId,
  head: git(["rev-parse", "HEAD"]),
  branch: git(["branch", "--show-current"]),
  status: git(["status", "--short"]),
  staged: git(["diff", "--cached", "--name-status"]),
  remotes: git(["remote", "-v"]),
  protected: Object.fromEntries((edition.protected ?? []).map((item) => [item.path, sha(item.path)])),
};
process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
