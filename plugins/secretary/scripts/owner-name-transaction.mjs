#!/usr/bin/env node

import {
  existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, join, parse, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { commitOwnedChanges } from "./lib/safe-git.mjs";
import { runExternalSync } from "./lib/external-ops.mjs";
import { journalAppend } from "./lib/secretary-store.mjs";
import { parseMarkdownLines, renderMarkdownLines } from "./lib/markdown-lines.mjs";
import { normalizeNameCandidate } from "./name-candidates.mjs";

function requireRegularFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} が見つかりません。`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} が通常ファイルではないため停止しました。`);
}

function requireInside(root, path, label) {
  const actual = realpathSync(path);
  const rel = relative(root, actual);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`${label} がsecretaryディレクトリ外を指しているため停止しました。`);
  }
}

function replaceSetting(content, section, key, value) {
  const lines = parseMarkdownLines(content);
  let inside = false;
  let found = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].text.startsWith("## ")) inside = lines[index].text === `## ${section}`;
    if (inside && lines[index].text.startsWith(`- ${key}:`)) {
      lines[index].text = `- ${key}: ${value}`;
      found += 1;
    }
  }
  if (found !== 1) throw new Error(`${section} の ${key} を一意に確認できません。`);
  return renderMarkdownLines(lines);
}

function snapshot(path) {
  return existsSync(path) ? { present: true, bytes: readFileSync(path) } : { present: false, bytes: null };
}

function restore(path, state) {
  if (state.present) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, state.bytes);
  } else {
    rmSync(path, { force: true });
  }
}

function gitRoot(secretaryRoot) {
  const value = runExternalSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: secretaryRoot,
    encoding: "utf8",
    timeoutMs: 10_000,
    label: "Git workspace確認",
  }).stdout.trim();
  return realpathSync(value);
}

export function updateOwnerName({
  secretaryRoot,
  name,
  now = process.env.CC_SECRETARY_NOW || new Date().toISOString(),
  failAt = null,
} = {}) {
  const normalizedName = normalizeNameCandidate(name);
  if (!normalizedName || /[\r\n]/u.test(normalizedName) || [...normalizedName].length > 40) {
    throw new Error("呼び方は空にせず、40文字以内の1行で指定してください。");
  }

  const rootInput = resolve(String(secretaryRoot || ""));
  if (rootInput === parse(rootInput).root) throw new Error("ドライブまたはfilesystemの直下はsecretaryとして使えません。");
  if (!existsSync(rootInput) || lstatSync(rootInput).isSymbolicLink() || !lstatSync(rootInput).isDirectory()) {
    throw new Error("secretary ディレクトリを安全に確認できません。");
  }
  const root = realpathSync(rootInput);
  const repo = gitRoot(root);
  const rel = relative(repo, root);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("secretary がGit workspace内にありません。");

  const targets = [
    { path: join(root, "memory", "preferences.md"), section: "基本", key: "呼び方", label: "preferences.md" },
    { path: join(root, "AGENTS.md"), section: "オーナー情報", key: "呼び方", label: "AGENTS.md" },
    { path: join(root, "memory", "MEMORY.md"), section: "オーナーの基本", key: "呼び方", label: "MEMORY.md" },
  ];
  for (const target of targets) {
    requireRegularFile(target.path, target.label);
    requireInside(root, target.path, target.label);
  }

  const date = String(now).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error("日時を安全に確認できません。");
  const journal = join(root, "memory", "journal", `${date}.md`);
  const journalDirectory = dirname(journal);
  const journalDirectoryExisted = existsSync(journalDirectory);
  if (journalDirectoryExisted) {
    if (lstatSync(journalDirectory).isSymbolicLink() || !lstatSync(journalDirectory).isDirectory()) {
      throw new Error("journalディレクトリを安全に確認できません。");
    }
    requireInside(root, journalDirectory, "journalディレクトリ");
  }
  if (existsSync(journal)) {
    requireRegularFile(journal, "journal");
    requireInside(root, journal, "journal");
  }
  const states = new Map([...targets.map(({ path }) => [path, snapshot(path)]), [journal, snapshot(journal)]]);

  try {
    targets.forEach((target, index) => {
      if (failAt === `before-write-${index + 1}`) throw new Error("テスト用の書込み失敗");
      const before = states.get(target.path).bytes.toString("utf8");
      writeFileSync(target.path, replaceSetting(before, target.section, target.key, normalizedName), { mode: lstatSync(target.path).mode });
    });
    if (failAt === "before-journal") throw new Error("テスト用のjournal失敗");

    const previousNow = process.env.CC_SECRETARY_NOW;
    process.env.CC_SECRETARY_NOW = now;
    try { journalAppend(root, "did", "設定を変更: 呼び方"); }
    finally {
      if (previousNow === undefined) delete process.env.CC_SECRETARY_NOW;
      else process.env.CC_SECRETARY_NOW = previousNow;
    }
    if (failAt === "before-commit") throw new Error("テスト用のcommit失敗");

    const journalRelative = relative(repo, journal).split(sep).join("/");
    const ownedPaths = [...targets.map(({ path }) => relative(repo, path).split(sep).join("/")), journalRelative];
    const commit = commitOwnedChanges({
      root: repo,
      ownedPaths,
      message: "設定を変更（呼び方）",
    });
    if (commit.status !== "committed") throw new Error("呼び方変更のlocal commitを作成できませんでした。");
    return { status: "committed", name: normalizedName, commit: commit.newHead, journal: journalRelative };
  } catch (error) {
    for (const [path, state] of states) restore(path, state);
    try {
      if (!journalDirectoryExisted && existsSync(journalDirectory) && !existsSync(journal)) rmSync(journalDirectory);
    } catch { /* 空でないdirectoryは保持する */ }
    throw error;
  }
}

async function main() {
  const [secretaryRoot, ...nameParts] = process.argv.slice(2);
  const result = updateOwnerName({ secretaryRoot, name: nameParts.join(" ") });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 3;
  });
}
