#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import {
  SecretaryStoreError,
  archiveMonth,
  archivePlan,
  dateParts,
  journalAppend,
  oneLine,
  refuse,
  reindex,
  renderTimeline,
  renderWeekly,
  safeDelete,
  safePath,
  secretaryRoot,
  transaction,
  usage,
  validDate,
} from "../../../scripts/lib/secretary-store.mjs";
import { copyTreeNoFollow } from "../../../scripts/lib/safe-fs.mjs";
import { parseMarkdownLines, preferredLineEnding, renderMarkdownLines } from "../../../scripts/lib/markdown-lines.mjs";
import { commitOwnedChanges } from "../../../scripts/lib/safe-git.mjs";
import { runExternalSync } from "../../../scripts/lib/external-ops.mjs";

function defaultPreferences() {
  return "# 好み・環境（preferences.md v2）\n\n## 基本\n- 呼び方: あなた\n- お仕事・役割: 未設定\n- 主に使うサービス: まだ決めていない\n\n## 言葉遣い\n- 口調: 丁寧（標準）\n- 専門用語: ふつう\n- 報告の詳しさ: みじかく\n- 決定の確認: 都度\n\n## 口調のお手本\n- NG: なし\n- OK: 丁寧で、堅すぎず、次の行動が分かる伝え方\n\n## 秘書のメモ\n";
}

function validatePreference(section, key, rawValue) {
  const value = oneLine(rawValue, "設定値", { secret: true });
  const free = new Set(["基本:呼び方", "基本:お仕事・役割", "基本:主に使うサービス", "口調のお手本:NG", "口調のお手本:OK"]);
  const fixed = new Map([
    ["言葉遣い:口調", ["丁寧（標準）", "フランク", "きっちり敬語"]],
    ["言葉遣い:専門用語", ["ふつう", "ことば添え", "そのままOK"]],
    ["言葉遣い:報告の詳しさ", ["みじかく", "くわしく"]],
    ["言葉遣い:決定の確認", ["都度", "まとめて"]],
  ]);
  const id = `${section}:${key}`;
  if (free.has(id)) return value;
  if (!fixed.has(id)) usage(`変更できない設定です: ${section} / ${key}`);
  if (!fixed.get(id).includes(value)) usage(`${key}は ${fixed.get(id).join("|")} から指定`);
  return value;
}

function replaceSetting(content, section, key, value) {
  const lines = parseMarkdownLines(content); const eol = preferredLineEnding(content); let inSection = false; let sectionSeen = false; let changed = false; let insertAt = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].text.startsWith("## ")) {
      if (inSection && !changed) { insertAt = i; break; }
      inSection = lines[i].text === `## ${section}`; if (inSection) sectionSeen = true;
    }
    if (inSection && lines[i].text.startsWith(`- ${key}:`)) { lines[i].text = `- ${key}: ${value}`; changed = true; }
  }
  if (sectionSeen && !changed) lines.splice(insertAt, 0, { text: `- ${key}: ${value}`, ending: eol });
  if (!sectionSeen) {
    if (lines.length && !lines.at(-1).ending) lines.at(-1).ending = eol;
    lines.push({ text: "", ending: eol }, { text: `## ${section}`, ending: eol }, { text: `- ${key}: ${value}`, ending: "" });
  }
  return renderMarkdownLines(lines);
}

function rememberDecision(args) {
  const [sec, day, ...parts] = args; if (!sec || !day) usage("secretary と日付を指定"); if (!validDate(day)) usage(`日付は YYYY-MM-DD 形式で指定してください（例: 2026-07-08）: ${day}`);
  const text = oneLine(parts.join(" "), "決定の本文"); const root = secretaryRoot(sec);
  const target = safePath(root, `memory/decisions/${day}-decisions.md`), index = safePath(root, "memory/MEMORY.md"), journal = safePath(root, `memory/journal/${dateParts().day}.md`);
  transaction([target, index, journal], () => {
    mkdirSync(dirname(target), { recursive: true });
    let content = existsSync(target) ? readFileSync(target, "utf8") : `---\ncreatedAt: ${day} ${dateParts().time}\ntags:\n  - 決定\n---\n\n# ${day} 決まったこと\n\n`;
    if (!content.split(/\r?\n/u).includes(`- ${text}`)) writeFileSync(target, `${content.trimEnd()}\n- ${text}\n`, "utf8");
    if (process.env.CC_SECRETARY_FAIL_AT === "decision-before-journal") refuse("テスト用の決定中途失敗");
    journalAppend(root, "decided", text);
  });
  console.log(`決定を記録し、目次を更新しました（${day}）。`);
}

function topicAdd(args) {
  const [sec, rawTitle, ...parts] = args; if (!sec || !rawTitle) usage("secretary とトピック名を指定");
  const title = oneLine(rawTitle, "トピック名"), summary = oneLine(parts.join(" "), "案件メモの要点"); const slug = title.replace(/[ /\\]/gu, "_");
  if (!slug || slug.includes("..")) usage(`トピック名に使えない文字が含まれます: ${title}`);
  const root = secretaryRoot(sec), target = safePath(root, `memory/topics/${slug}.md`), index = safePath(root, "memory/MEMORY.md"), journal = safePath(root, `memory/journal/${dateParts().day}.md`);
  transaction([target, index, journal], () => {
    mkdirSync(dirname(target), { recursive: true });
    let content = existsSync(target) ? readFileSync(target, "utf8") : `---\ncreatedAt: ${dateParts().day} ${dateParts().time}\ntags:\n  - 案件メモ\n---\n\n# ${title}\n\n## 確認済みの要点\n\n`;
    if (!content.split(/\r?\n/u).includes(`- ${summary}`)) writeFileSync(target, `${content.trimEnd()}\n- ${summary}\n`, "utf8");
    if (process.env.CC_SECRETARY_FAIL_AT === "topic-before-journal") refuse("テスト用のtopic中途失敗");
    journalAppend(root, "note", `案件メモ「${title}」に要点を追加`);
  });
  console.log(`確認済みの要点を案件メモに記録し、目次を更新しました: memory/topics/${slug}.md`);
}

function prefSet(args) {
  const [sec, section, key, ...parts] = args; if (!sec || !section || !key) usage("secretary、セクション、キー、値を指定");
  const value = validatePreference(section, key, parts.join(" ")), root = secretaryRoot(sec), target = safePath(root, "memory/preferences.md"), index = safePath(root, "memory/MEMORY.md");
  if (!existsSync(dirname(target))) refuse("保存先のmemoryフォルダがありません。");
  transaction([target, index], () => { const content = existsSync(target) ? readFileSync(target, "utf8") : defaultPreferences(); writeFileSync(target, replaceSetting(content, section, key, value), "utf8"); if (process.env.CC_SECRETARY_FAIL_AT === "pref-before-index") refuse("テスト用の設定中途失敗"); reindex(root); });
  console.log(`設定を部分更新しました: ${section} / ${key}`);
}

function prefNote(args) {
  const [sec, ...parts] = args; if (!sec) usage("secretary を指定"); const note = oneLine(parts.join(" "), "秘書のメモ", { secret: true });
  const root = secretaryRoot(sec), target = safePath(root, "memory/preferences.md"), index = safePath(root, "memory/MEMORY.md"); if (!existsSync(dirname(target))) refuse("保存先のmemoryフォルダがありません。");
  transaction([target, index], () => {
    let content = existsSync(target) ? readFileSync(target, "utf8") : defaultPreferences(); const marker = "## 秘書のメモ"; const at = content.indexOf(marker); const eol = preferredLineEnding(content);
    if (at < 0) content = `${content.trimEnd()}${eol}${eol}${marker}${eol}`; else if (/^## /mu.test(content.slice(at + marker.length).trimStart())) refuse("秘書のメモ欄がファイル末尾にありません。既存内容を守るため追記しません。");
    if (!content.split(/\r?\n/u).includes(`- ${note}`)) writeFileSync(target, `${content.trimEnd()}${eol}- ${note}${eol}`, "utf8");
    reindex(root);
  });
  console.log("確認済みの内容を秘書のメモへ追記しました。");
}

function guardedWrite(args) {
  const [sec, rel] = args; if (!sec || !rel) usage("secretary と memory 相対パスを指定（例: preferences.md）"); const content = readFileSync(0, "utf8"); if (!content.trim()) refuse(`空（または空白のみ）の内容では上書きしません。既存の記憶を守りました: memory/${rel}`);
  const root = secretaryRoot(sec), target = safePath(root, `memory/${rel}`); if (!existsSync(dirname(target))) refuse(`保存先のフォルダがありません。先にフォルダを用意してください: memory/${rel}`);
  writeFileSync(target, `${content.trimEnd()}\n`, "utf8"); console.log(`書き込みました: memory/${rel}`);
}

function deleteMemory(args) {
  const [sec, rel, flag] = args; if (!sec || !rel) usage("secretary と memory 相対パスを指定"); const root = secretaryRoot(sec), target = safeDelete(root, `memory/${rel}`);
  if (!existsSync(target) && !lstatOptional(target)) usage(`見つかりません: memory/${rel}`);
  const stat = lstatSync(target); if (flag !== "--confirm") refuse(`確認: これから消そうとしているのは次の記憶です。\n  ${rel}${stat.isSymbolicLink() ? "\n  種類: symlink（参照先は削除しません）" : ""}\n本当に消してよければ、確認のうえ --confirm を付けて実行します（消すと元に戻せません）。\n未確認のため削除しませんでした。`);
  const index = safePath(root, "memory/MEMORY.md"), backup = resolve(tmpdir(), `secretary-delete-${process.pid}-${Date.now()}`); mkdirSync(backup, { recursive: true });
  try { copyTreeNoFollow(target, join(backup, "item")); const idx = readFileSync(index); rmSync(target, { recursive: stat.isDirectory() && !stat.isSymbolicLink(), force: true }); try { reindex(root); } catch (error) { copyTreeNoFollow(join(backup, "item"), target); writeFileSync(index, idx); throw error; } }
  finally { rmSync(backup, { recursive: true, force: true }); }
  console.log(`削除し、目次を更新しました: ${rel}`);
}

function lstatOptional(path) { try { return lstatSync(path); } catch (error) { if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null; throw error; } }

function resume(args, mode) {
  const [sec, project = "（未記入）", next = "（未記入）", open = "（未記入）"] = args; if (!sec) usage("secretary を指定"); const root = secretaryRoot(sec), target = safePath(root, "memory/_resume.md");
  if (mode === "write") { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, `# 再起動しおり（前回の続き）\n\nこの付箋は、作業を中断したときに書きます。次に秘書を呼ぶと、ここから続けられます。\n\n- 進行中の作業: ${project}\n- 次にやること: ${next}\n- まだ決まっていないこと: ${open}\n- 書いた日時: ${dateParts().day} ${dateParts().time}\n`, "utf8"); console.log("しおりを書きました: memory/_resume.md"); return; }
  if (mode === "check") { if (!existsSync(target)) process.exitCode = 1; return; }
  if (mode === "read") { if (!existsSync(target)) { process.stderr.write("しおりはありません。\n"); process.exitCode = 1; } else process.stdout.write(readFileSync(target, "utf8")); return; }
  rmSync(target, { force: true }); console.log("しおりを閉じました（memory/_resume.md を削除）。");
}

function commit(args) {
  const [sec, ...parts] = args; if (!sec) usage("secretary を指定"); const message = oneLine(parts.join(" "), "コミットメッセージ（日本語）"); const root = secretaryRoot(sec);
  let repo;
  try { repo = realpathSync(runExternalSync(process.env.YASASHII_GIT_BIN || "git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8", timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30000), label: "Git workspace確認" }).stdout.trim()); }
  catch { usage(`git 管理下ではありません: ${sec}`); }
  const rel = relative(repo, root); if (rel === ".." || rel.startsWith(`..${sep}`)) refuse("秘書ディレクトリがworkspace repoの内側にないためcommitしません。");
  const memoryRel = rel ? `${rel.split(sep).join("/")}/memory` : "memory"; if (!existsSync(join(repo, memoryRel))) usage(`memoryフォルダが見つかりません: ${sec}`);
  const result = commitOwnedChanges({ root: repo, ownedPaths: [memoryRel], message });
  console.log(result.status === "unchanged" ? "変更がないためコミットしませんでした。" : "作業の区切りを記録しました（ローカルのみ・インターネットには送っていません）。");
}

function parseTimeline(args) {
  const [sec, ...rest] = args; if (!sec) usage("secretary を指定"); const options = { from: "", to: "", type: "all", keyword: "" };
  for (let i = 0; i < rest.length; i += 1) { const item = rest[i]; if (!["--from", "--to", "--type", "--grep"].includes(item) || !rest[i + 1]) usage(`timeline の不明なオプションです: ${item}`); options[item === "--grep" ? "keyword" : item.slice(2)] = rest[++i]; }
  process.stdout.write(renderTimeline(sec, options));
}

const [command, ...args] = process.argv.slice(2);
try {
  switch (command) {
    case "reindex": { if (!args[0]) usage("secretary を指定"); reindex(args[0]); console.log("MEMORY.md の目次を最新にしました。"); break; }
    case "remember-decision": rememberDecision(args); break;
    case "journal-add": { const [sec, type, ...parts] = args; if (!sec || !type) usage("secretary と type（did|decided|next|note）を指定"); journalAppend(sec, type, parts.join(" ")); console.log(`journal に追記しました（${type}）。`); break; }
    case "topic-add": topicAdd(args); break;
    case "timeline": parseTimeline(args); break;
    case "weekly": { const [sec, flag, day] = args; if (!sec) usage("secretary を指定"); if (flag && flag !== "--week") usage(`weekly の不明なオプションです: ${flag}`); process.stdout.write(renderWeekly(sec, day || "")); break; }
    case "archive-plan": { const [sec, month = ""] = args; if (!sec) usage("secretary を指定"); process.stdout.write(archivePlan(sec, month)); break; }
    case "archive-month": { const [sec, month, flag] = args; if (!sec || !month) usage("secretary と YYYY-MM を指定"); const result = archiveMonth(sec, month, flag === "--confirm"); console.log(`journalを退避し、索引を更新しました: ${month}（${result.moved}件）\ntimelineとweeklyは退避先も検索します。通常どおり対象期間を指定してください。`); break; }
    case "pref-set": prefSet(args); break;
    case "pref-note-add": prefNote(args); break;
    case "guarded-write": guardedWrite(args); break;
    case "delete": deleteMemory(args); break;
    case "resume-write": resume(args, "write"); break;
    case "resume-check": resume(args, "check"); break;
    case "resume-read": resume(args, "read"); break;
    case "resume-clear": resume(args, "clear"); break;
    case "commit": commit(args); break;
    default: usage(`不明なコマンド: '${command || ""}'（reindex|remember-decision|journal-add|topic-add|timeline|weekly|archive-plan|archive-month|pref-set|pref-note-add|guarded-write|delete|resume-write|resume-check|resume-read|resume-clear|commit）`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof SecretaryStoreError ? error.exitCode : 3;
}
