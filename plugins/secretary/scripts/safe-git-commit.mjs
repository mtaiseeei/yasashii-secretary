#!/usr/bin/env node

import { commitOwnedChanges } from "./lib/safe-git.mjs";

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

const values = new Map();
const paths = [];
for (let index = 2; index < process.argv.length; index += 1) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!["--root", "--path", "--message"].includes(name) || !value) fail("使い方: safe-git-commit.mjs --root <repo> --path <owned-path> --message <日本語>");
  if (name === "--path") paths.push(value);
  else values.set(name, value);
  index += 1;
}

if (!values.get("--root") || paths.length === 0 || !values.get("--message")) {
  fail("使い方: safe-git-commit.mjs --root <repo> --path <owned-path> --message <日本語>");
}

try {
  const result = commitOwnedChanges({
    root: values.get("--root"),
    ownedPaths: paths,
    message: values.get("--message"),
  });
  process.stdout.write(`${JSON.stringify({ status: result.status, commit: result.newHead, files: result.candidates.length })}\n`);
} catch (error) {
  fail(error.message || "安全なcommitを作成できませんでした。", error.code === "secret-detected" ? 3 : 1);
}
