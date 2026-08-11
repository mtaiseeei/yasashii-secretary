#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  SecretaryStoreError,
  dateParts,
  journalAppend,
  oneLine,
  refuse,
  safePath,
  secretaryRoot,
  todoAdd,
  todoUpdate,
  transaction,
  usage,
  validDate,
} from "./lib/secretary-store.mjs";

function stdin() { return readFileSync(0, "utf8"); }

function saveDeliverable(args) {
  const [sec, date, rawTitle, tags = "成果物"] = args;
  if (!sec || !date || !rawTitle) usage("secretary・日付・タイトルを指定");
  if (!validDate(date)) usage(`日付は YYYY-MM-DD 形式で指定してください（例: 2026-07-08）: ${date}`);
  const title = oneLine(rawTitle, "タイトル");
  const slug = title.replace(/[ /\\]/gu, "_");
  if (!slug || slug.includes("..")) usage(`タイトルにファイル名として使えない文字（..）が含まれます: ${title}`);
  const body = stdin();
  if (!body.trim()) refuse("本文が空です。空の成果物は保存しません。");
  const root = secretaryRoot(sec);
  const [year, month] = date.split("-");
  const rel = `docs/${year}/${month}/${date}_${slug}.md`;
  const target = safePath(root, rel);
  const journal = safePath(root, `memory/journal/${dateParts().day}.md`);
  const index = safePath(root, "memory/MEMORY.md");
  const tagLines = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const markdown = `---\ncreatedAt: ${date} ${dateParts().time}\ntags:\n${(tagLines.length ? tagLines : ["成果物"]).map((tag) => `  - ${tag}`).join("\n")}\n---\n\n# ${title}\n\n${body.trimEnd()}\n`;
  const result = transaction([target, journal, index], () => {
    if (existsSync(target)) {
      if (readFileSync(target, "utf8") !== markdown) refuse(`同名の成果物が既にあります。上書きしません: ${rel}`);
      journalAppend(root, "did", `成果物「${title}」を保存`);
      return "unchanged";
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, markdown, { encoding: "utf8", flag: "wx" });
    if (process.env.CC_SECRETARY_FAIL_AT === "deliverable-before-journal") refuse("テスト用の成果物中途失敗");
    journalAppend(root, "did", `成果物「${title}」を保存`);
    return "saved";
  });
  console.log(result === "unchanged" ? `同じ成果物は保存済みです: ${rel}` : `成果物を保存しました: ${rel}`);
}

const [command, ...args] = process.argv.slice(2);
try {
  switch (command) {
    case "save-deliverable": saveDeliverable(args); break;
    case "todo-add": {
      const [sec, text, ref, due = ""] = args; if (!sec || !text) usage("secretary と TODO 本文を指定");
      const result = todoAdd(sec, text, ref, due);
      console.log(result.status === "unchanged" ? "同じ TODO は追加済みです: inbox/todo.md" : "TODO を追記しました（根拠つき）: inbox/todo.md");
      break;
    }
    case "todo-list": {
      const [sec] = args; if (!sec) usage("secretary を指定"); const root = secretaryRoot(sec), target = safePath(root, "inbox/todo.md");
      if (!existsSync(target)) { process.stderr.write("まだ TODO はありません。\n"); process.exitCode = 1; }
      else process.stdout.write(readFileSync(target, "utf8"));
      break;
    }
    case "todo-done": {
      const [sec, number, flag] = args; if (!sec || !number) usage("secretary と TODO の番号を指定（例: todo-done secretary 2 --confirm）");
      const result = todoUpdate(sec, number, { mode: "done", confirm: flag === "--confirm" });
      console.log(`TODOを完了にしました: ${result.item}`); break;
    }
    case "todo-carry": {
      const [sec, number, date, flag] = args; if (!sec || !number || !date) usage("secretary・番号・繰越先の日付を指定（例: todo-carry secretary 1 2026-07-17 --confirm）");
      const result = todoUpdate(sec, number, { mode: "carry", date, confirm: flag === "--confirm" });
      console.log(`TODOを${date}へ持ち越しました: ${result.item}`); break;
    }
    default: usage(`不明なコマンド: '${command || ""}'（save-deliverable|todo-add|todo-list|todo-done|todo-carry）`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof SecretaryStoreError ? error.exitCode : 3;
}
