#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function files(root, current = root) {
  const result = [];
  for (const name of readdirSync(current).sort((a, b) => a.localeCompare(b, "en"))) {
    const path = join(current, name);
    const rel = relative(root, path).replaceAll("\\", "/");
    if (rel === ".git" || rel.startsWith(".git/")
      || rel === "docs/sprints/state.md"
      || rel === "docs/progress/sprint-038.md"
      || rel === "docs/feedback/sprint-038.md"
      || rel === "scripts/fixtures/sprint-038/candidate-source-snapshot.json"
      || rel === "scripts/fixtures/sprint-038/candidate-inputs.json"
      || rel === "candidate-report.json") continue;
    const stat = lstatSync(path);
    if (stat.isDirectory()) result.push(...files(root, path));
    else if (stat.isFile()) result.push(rel);
    else throw new Error(`unsupported-candidate-entry:${rel}`);
  }
  return result;
}

export function candidateDigest(candidateRoot) {
  const root = resolve(candidateRoot);
  const paths = files(root).sort((a, b) => Buffer.from(a).compare(Buffer.from(b)));
  const hash = createHash("sha256");
  for (const path of paths) {
    hash.update(Buffer.from(path));
    hash.update(Buffer.from([0]));
    hash.update(readFileSync(join(root, path)));
    hash.update(Buffer.from([0]));
  }
  return { root, files: paths.length, algorithm: "sorted-relative-path-NUL-bytes-NUL", sha256: hash.digest("hex") };
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = args[0];
  if (!root) throw new Error("usage: sprint-038-candidate-digest.mjs <candidate-root> [expected-sha256]");
  const result = candidateDigest(root);
  const expected = args[1];
  console.log(JSON.stringify(result));
  if (expected && result.sha256 !== expected.replace(/^sha256:/, "")) process.exitCode = 1;
}
