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
import { createHash } from "node:crypto";
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
import { commitOwnedChanges, inspectOwnedCheckpoint } from "../../../scripts/lib/safe-git.mjs";
import { runExternalSync } from "../../../scripts/lib/external-ops.mjs";
import { canonicalMeaning, isMemoryDestination, meaningTuple } from "../../../scripts/lib/conversation-contract.mjs";

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

function markdownFiles(path) {
  if (!existsSync(path)) return [];
  const detail = lstatSync(path);
  if (detail.isSymbolicLink() || !detail.isDirectory()) refuse(`通常directoryではないため読み取りません: ${path}`);
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md"))
    .map((entry) => join(path, entry.name));
}

function memoryContentKey(root, kind, meaning) {
  const payload = JSON.stringify({
    canonicalMemoryRoot: realpathSync(root),
    memoryKind: kind,
    meaning: canonicalMeaning(meaning),
  });
  return createHash("sha256").update(payload).digest("hex");
}

function markerFor(key) { return `<!-- memory-content-key:${key} -->`; }

function meaningMarker(meaning) {
  const encoded = Buffer.from(JSON.stringify(meaningTuple(meaning)), "utf8").toString("base64url");
  return `<!-- memory-meaning-v1:${encoded} -->`;
}

function canonicalComparableText(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s\p{P}\p{S}]+/gu, "");
}

function validateMemoryMeaning(meaning, display) {
  const tuple = meaningTuple(meaning);
  const supplied = Object.values(tuple).filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (supplied.length === 0) usage("意味tupleが空です。保存対象とmemory destinationを指定してください。");
  if (!String(tuple.target ?? "").trim()) usage("意味tupleのtargetがありません。保存内容を特定できないため記録しません。");
  if (!isMemoryDestination(tuple.destination) || !String(tuple.destination ?? "").trim()) {
    usage("save-memoryのdestinationはmemory内（memory / decision / topic）を指定してください。");
  }
  for (const [field, value] of Object.entries(tuple)) {
    if (value !== null && value !== undefined && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      usage(`意味tupleの${field}は文字列・数値・真偽値のいずれかで指定してください。`);
    }
  }
  const target = canonicalComparableText(tuple.target);
  const rendered = canonicalComparableText(display);
  if (!target || !rendered.includes(target)) {
    usage("意味tupleのtargetと表示要点が一致しません。保存内容を確認してください。");
  }
  return tuple;
}

function findContentFiles(root, key) {
  const marker = markerFor(key);
  const content = [
    ...markdownFiles(safePath(root, "memory/decisions")),
    ...markdownFiles(safePath(root, "memory/topics")),
  ].filter((path) => readFileSync(path, "utf8").includes(marker));
  const journals = markdownFiles(safePath(root, "memory/journal"))
    .filter((path) => readFileSync(path, "utf8").includes(marker));
  return { content, journals };
}

function gitContext(root) {
  let repo;
  try {
    repo = realpathSync(runExternalSync(process.env.YASASHII_GIT_BIN || "git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
      timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30000),
      label: "Git workspace確認",
    }).stdout.trim());
  } catch { usage(`git 管理下ではありません: ${root}`); }
  const rel = relative(repo, root);
  if (rel === ".." || rel.startsWith(`..${sep}`)) refuse("秘書ディレクトリがworkspace repoの内側にないためcommitしません。");
  return { repo, secretaryRel: rel.split(sep).join("/") };
}

function relativeOwned(repo, paths) {
  return paths.map((path) => relative(repo, path).split(sep).join("/"));
}

function parseSaveMemoryArgs(args) {
  const positional = [];
  const options = { checkpoint: false, failAt: null };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--checkpoint") { options.checkpoint = true; continue; }
    if (args[index] === "--fail-at") { options.failAt = args[++index]; continue; }
    positional.push(args[index]);
  }
  const [sec, kind, day, rawTitle, rawMeaning, ...displayParts] = positional;
  if (!sec || !kind || !day || !rawTitle || !rawMeaning || !displayParts.length) {
    usage("save-memory <secretary> <decision|topic> <YYYY-MM-DD> <題名> <意味tuple JSON> <表示要点> [--checkpoint]");
  }
  if (!new Set(["decision", "topic"]).has(kind)) usage(`memory種別は decision|topic から指定してください: ${kind}`);
  if (!validDate(day)) usage(`日付は YYYY-MM-DD 形式で指定してください: ${day}`);
  if (options.failAt && !new Set(["stage", "commit", "post-commit"]).has(options.failAt)) usage(`不明なcheckpoint failure: ${options.failAt}`);
  let meaning;
  try { meaning = JSON.parse(rawMeaning); } catch { usage("意味tupleはJSON objectで指定してください。"); }
  if (!meaning || Array.isArray(meaning) || typeof meaning !== "object") usage("意味tupleはJSON objectで指定してください。");
  const display = oneLine(displayParts.join(" "), "記憶の要点", { secret: true });
  meaning = validateMemoryMeaning(meaning, display);
  return {
    sec,
    kind,
    day,
    title: oneLine(rawTitle, "記憶の題名", { secret: true }),
    meaning,
    display,
    ...options,
  };
}

function saveMemory(args) {
  const input = parseSaveMemoryArgs(args);
  const root = secretaryRoot(input.sec);
  const index = safePath(root, "memory/MEMORY.md");
  if (!existsSync(index)) usage("MEMORY.md がありません: memory/MEMORY.md");
  const key = memoryContentKey(root, input.kind, input.meaning);
  const existing = findContentFiles(root, key);
  let ownedAbsolute = [...existing.content, ...existing.journals, index];

  if (existing.content.length === 0) {
    const slug = input.title.replace(/[ /\\]/gu, "_");
    if (!slug || slug.includes("..")) usage(`題名に使えない文字が含まれます: ${input.title}`);
    const target = input.kind === "decision"
      ? safePath(root, `memory/decisions/${input.day}-decisions.md`)
      : safePath(root, `memory/topics/${slug}.md`);
    const journal = safePath(root, `memory/journal/${dateParts().day}.md`);
    ownedAbsolute = [target, journal, index];

    let checkpointContext = null;
    if (input.checkpoint) {
      checkpointContext = gitContext(root);
      const owned = relativeOwned(checkpointContext.repo, ownedAbsolute);
      const missing = owned.filter((_, position) => !existsSync(ownedAbsolute[position]));
      inspectOwnedCheckpoint(checkpointContext.repo, owned, { allowMissingPaths: missing });
    }

    transaction(ownedAbsolute, () => {
      mkdirSync(dirname(target), { recursive: true });
      const heading = input.kind === "decision" ? `# ${input.day} 決まったこと` : `# ${input.title}\n\n## 確認済みの要点`;
      let content = existsSync(target)
        ? readFileSync(target, "utf8")
        : `---\ncreatedAt: ${input.day} ${dateParts().time}\ntags:\n  - ${input.kind === "decision" ? "決定" : "案件メモ"}\n---\n\n${heading}\n\n`;
      const correction = input.meaning.correctionOf
        ? `訂正: ${input.meaning.correctionOf} → ${input.display}${input.meaning.correctionReason ? `（${input.meaning.correctionReason}）` : ""}`
        : input.display;
      content = `${content.trimEnd()}\n- ${correction}\n${meaningMarker(input.meaning)}\n${markerFor(key)}\n`;
      writeFileSync(target, content, "utf8");
      if (process.env.CC_SECRETARY_FAIL_AT === "memory-before-journal") refuse("テスト用のmemory中途失敗");

      mkdirSync(dirname(journal), { recursive: true });
      let journalContent = existsSync(journal)
        ? readFileSync(journal, "utf8")
        : `---\ncreatedAt: ${dateParts().day} ${dateParts().time}\ntags:\n  - journal\n---\n\n# ${dateParts().day} journal\n\n`;
      const journalText = input.kind === "decision" ? `決定を記録: ${input.display}` : `案件メモ「${input.title}」に要点を追加`;
      journalContent = `${journalContent.trimEnd()}\n- ${dateParts().time} [${input.kind === "decision" ? "decided" : "note"}] ${journalText}\n${meaningMarker(input.meaning)}\n${markerFor(key)}\n`;
      writeFileSync(journal, journalContent, "utf8");
      if (process.env.CC_SECRETARY_FAIL_AT === "memory-after-journal") refuse("テスト用のmemory journal後失敗");
      reindex(root);
    });
  }

  if (!input.checkpoint) {
    console.log(JSON.stringify({ status: existing.content.length ? "already-saved" : "saved", response: existing.content.length ? "answered" : "saved", contentKey: key, memoryWrites: existing.content.length ? 0 : 1, journalWrites: existing.content.length ? 0 : 1, commitWrites: 0 }));
    return;
  }

  const context = gitContext(root);
  const ownedPaths = relativeOwned(context.repo, ownedAbsolute);
  try {
    const committed = commitOwnedChanges({ root: context.repo, ownedPaths, message: "[secretary-memory] 記憶をローカル記録", failAt: input.failAt });
    const changed = committed.status === "committed" ? 1 : 0;
    console.log(JSON.stringify({ status: changed ? "saved" : "already-saved", response: changed ? "saved" : "answered", contentKey: key, memoryWrites: existing.content.length ? 0 : 1, journalWrites: existing.content.length ? 0 : 1, commitWrites: changed, checkpoint: committed.status }));
  } catch (error) {
    console.log(JSON.stringify({ status: "partial", response: "partial", contentKey: key, memoryWrites: existing.content.length ? 0 : 1, journalWrites: existing.content.length ? 0 : 1, commitWrites: 0, checkpoint: "failed", reason: error?.code || "git-failed" }));
    process.exitCode = 4;
  }
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
    case "save-memory": saveMemory(args); break;
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
    default: usage(`不明なコマンド: '${command || ""}'（reindex|remember-decision|journal-add|topic-add|save-memory|timeline|weekly|archive-plan|archive-month|pref-set|pref-note-add|guarded-write|delete|resume-write|resume-check|resume-read|resume-clear|commit）`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof SecretaryStoreError ? error.exitCode : 3;
}
