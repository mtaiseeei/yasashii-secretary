import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, parse, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { safeDeletePath, safeWritePath, workingRoot } from "./safe-fs.mjs";

export class SecretaryStoreError extends Error {
  constructor(message, exitCode = 3) {
    super(message);
    this.exitCode = exitCode;
  }
}

export function usage(message) {
  throw new SecretaryStoreError(`使い方エラー: ${message}`, 2);
}

export function refuse(message) {
  throw new SecretaryStoreError(message, 3);
}

export function secretaryRoot(value) {
  try {
    const root = workingRoot(value);
    if (root === parse(root).root) refuse("ドライブまたはfilesystemの直下は秘書ディレクトリとして使えません。");
    return root;
  } catch (error) {
    if (error instanceof SecretaryStoreError) throw error;
    refuse(`秘書ディレクトリが通常のdirectoryではないため、安全に操作できません: ${value}`);
  }
}

export function safePath(root, rel) {
  const normalized = String(rel ?? "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("/") || normalized.startsWith("\\") || normalized.split(/[\\/]/u).some((part) => !part || part === "." || part === "..")) {
    refuse(`秘書ディレクトリ（secretary/）の外は操作できません: ${normalized}`);
  }
  try { return safeWritePath(root, normalized); }
  catch { refuse(`symlink／junction経由で秘書ディレクトリの外は操作できません: ${normalized}`); }
}

export function safeDelete(root, rel) {
  const normalized = String(rel ?? "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("/") || normalized.startsWith("\\") || normalized.split(/[\\/]/u).some((part) => !part || part === "." || part === "..")) {
    refuse(`秘書ディレクトリ（secretary/）の外は操作できません: ${normalized}`);
  }
  try { return safeDeletePath(root, normalized); }
  catch { refuse(`symlink／junction経由で秘書ディレクトリの外は操作できません: ${normalized}`); }
}

export function dateParts() {
  const injected = process.env.CC_SECRETARY_NOW;
  if (injected) {
    const match = String(injected).match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/u);
    if (!match) refuse(`CC_SECRETARY_NOW は YYYY-MM-DD または ISO 8601 形式で指定してください: ${injected}`);
    return { day: match[1], time: match[2] ? `${match[2]}:${match[3]}` : "00:00" };
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

export function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/u.test(String(value ?? "")); }
export function validMonth(value) { return /^\d{4}-\d{2}$/u.test(String(value ?? "")); }

export function oneLine(value, label, { secret = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized) refuse(`${label}が空です。空では記録しません。`);
  if (/[\r\n]/u.test(normalized)) refuse(`${label}は1件1行で指定してください。`);
  if (secret && /(password|api[_-]?key|token|client[_-]?secret)\s*[:=]\s*\S+/iu.test(normalized)) {
    refuse(`資格情報らしき値は${label}へ保存しません。トークンやパスワードを除いてください。`);
  }
  return normalized;
}

function optionalSnapshot(path) {
  if (!existsSync(path)) return { present: false, bytes: null, mode: null };
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) refuse(`通常fileではない対象は変更できません: ${path}`);
  return { present: true, bytes: readFileSync(path), mode: stat.mode };
}

function restoreSnapshot(path, snapshot) {
  if (!snapshot.present) { rmSync(path, { force: true }); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, snapshot.bytes, { mode: snapshot.mode });
}

export function transaction(paths, operation) {
  const snapshots = new Map(paths.map((path) => [path, optionalSnapshot(path)]));
  try { return operation(); }
  catch (error) {
    for (const [path, snapshot] of [...snapshots.entries()].reverse()) restoreSnapshot(path, snapshot);
    throw error;
  }
}

function listMarkdownFiles(path, matcher = () => true) {
  if (!existsSync(path)) return [];
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) refuse(`通常directoryではないため読み取りません: ${path}`);
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".md") && matcher(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

function journalFiles(root) {
  const activeDir = safePath(root, "memory/journal");
  const archiveDir = safePath(root, "memory/archive/journal");
  const rows = listMarkdownFiles(activeDir, (name) => /^\d{4}-\d{2}-\d{2}\.md$/u.test(name))
    .map((name) => ({ day: name.slice(0, 10), rel: `memory/journal/${name}` }));
  if (existsSync(archiveDir)) {
    const months = readdirSync(archiveDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.isSymbolicLink()).map((entry) => entry.name).sort();
    for (const month of months) {
      const monthDir = safePath(root, `memory/archive/journal/${month}`);
      for (const name of listMarkdownFiles(monthDir, (item) => /^\d{4}-\d{2}-\d{2}\.md$/u.test(item))) {
        rows.push({ day: name.slice(0, 10), rel: `memory/archive/journal/${month}/${name}` });
      }
    }
  }
  return rows.sort((a, b) => a.day.localeCompare(b.day) || a.rel.localeCompare(b.rel));
}

export function reindex(rootValue) {
  const root = secretaryRoot(rootValue);
  const index = safePath(root, "memory/MEMORY.md");
  if (!existsSync(index)) usage("MEMORY.md がありません: memory/MEMORY.md");
  const memory = safePath(root, "memory");
  const before = readFileSync(index, "utf8");
  const heading = "## 記録の目次";
  const marker = before.indexOf(heading);
  const prefix = marker >= 0 ? before.slice(0, marker + heading.length) : `${before.trimEnd()}\n\n${heading}`;
  const entries = [];
  if (existsSync(safePath(root, "memory/preferences.md"))) entries.push("- [好み・環境](preferences.md) — 呼び方・口調・使うサービス");
  for (const name of listMarkdownFiles(safePath(root, "memory/decisions"))) {
    const day = name.endsWith("-decisions.md") ? name.slice(0, -"-decisions.md".length) : name.slice(0, -3);
    entries.push(`- [${day} の決定](decisions/${name}) — 決定ログ`);
  }
  for (const name of listMarkdownFiles(safePath(root, "memory/topics"))) entries.push(`- [${name.slice(0, -3)}](topics/${name}) — 案件メモ`);
  const activeMonths = [...new Set(journalFiles(root).filter(({ rel }) => rel.startsWith("memory/journal/")).map(({ day }) => day.slice(0, 7)))].sort();
  const archivedMonths = [...new Set(journalFiles(root).filter(({ rel }) => rel.startsWith("memory/archive/")).map(({ day }) => day.slice(0, 7)))].sort();
  for (const month of activeMonths) entries.push(`- ${month} の活動 — [日次 journal](journal/)`);
  for (const month of archivedMonths) entries.push(`- ${month} の活動（退避済み） — [journal archive](archive/journal/${month}/)`);
  const prefixText = `${prefix.trimEnd()}\n\n`;
  const capacity = Math.max(0, 200 - prefixText.split("\n").length + 1);
  const selected = entries.slice(0, capacity);
  writeFileSync(index, `${prefixText}${selected.join("\n")}${selected.length ? "\n" : ""}`, "utf8");
  if (entries.length > capacity) {
    process.stderr.write("警告: MEMORY.md が200行を超えるため索引を上限内に収めました（自動削除・自動退避はしていません）。\n");
    process.stderr.write(`退避候補: ${activeMonths[0] || "候補なし"}。残る参照: MEMORY.mdの月索引と退避先のjournal原本。\n`);
    process.stderr.write(`timeline/weeklyへの影響: 退避後も退避領域を検索するため表示は継続します（active月=${activeMonths.length} / 退避済み月=${archivedMonths.length}）。\n`);
  }
  return { index, memory };
}

export function journalAppend(rootValue, type, rawText) {
  const root = secretaryRoot(rootValue);
  if (!["did", "decided", "next", "note"].includes(type)) refuse(`journal の type が不正です: ${type}`);
  const text = oneLine(rawText, "journal の本文");
  const { day, time } = dateParts();
  const target = safePath(root, `memory/journal/${day}.md`);
  const index = safePath(root, "memory/MEMORY.md");
  if (!existsSync(index)) usage("MEMORY.md がありません: memory/MEMORY.md");
  return transaction([target, index], () => {
    mkdirSync(dirname(target), { recursive: true });
    let content = existsSync(target) ? readFileSync(target, "utf8") : `---\ncreatedAt: ${day} ${time}\ntags:\n  - journal\n---\n\n# ${day} journal\n\n`;
    const exact = new RegExp(`^- \\d{2}:\\d{2} \\[${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\] ${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
    if (exact.test(content)) return { status: "unchanged", target };
    content = `${content.trimEnd()}\n- ${time} [${type}] ${text}\n`;
    writeFileSync(target, content, "utf8");
    if (process.env.CC_SECRETARY_FAIL_AT === "journal-after-write") refuse("テスト用のjournal中途失敗");
    reindex(root);
    return { status: "saved", target };
  });
}

export function todoAdd(rootValue, rawText, rawRef, due = "") {
  const root = secretaryRoot(rootValue);
  const text = oneLine(rawText, "TODO 本文");
  const ref = oneLine(rawRef, "根拠（サービス名＋リンク/ID＋日付）");
  if (due && !validDate(due)) usage(`期限は YYYY-MM-DD 形式で指定してください: ${due}`);
  const target = safePath(root, "inbox/todo.md");
  const { day } = dateParts();
  const journal = safePath(root, `memory/journal/${day}.md`);
  const index = safePath(root, "memory/MEMORY.md");
  return transaction([target, journal, index], () => {
    mkdirSync(dirname(target), { recursive: true });
    let content = existsSync(target) ? readFileSync(target, "utf8") : "# TODO（クイックキャプチャ）\n\nその日の要点は「今日やること」で予定と突き合わせます。各項目には根拠（サービス名＋リンク/ID＋日付）を付けます。\n\n";
    const line = due ? `- [ ] ${text} （期限: ${due}）（根拠: ${ref}）` : `- [ ] ${text} （根拠: ${ref}）`;
    if (!content.split(/\r?\n/u).includes(line)) writeFileSync(target, `${content.trimEnd()}\n${line}\n`, "utf8");
    if (process.env.CC_SECRETARY_FAIL_AT === "todo-before-journal") refuse("テスト用のTODO中途失敗");
    journalAppend(root, "next", `TODO「${text}」を追加`);
    return { status: content.split(/\r?\n/u).includes(line) ? "unchanged" : "saved", target };
  });
}

function uncheckedTodos(content) {
  return content.split(/\r?\n/u).map((line, index) => ({ line, index })).filter(({ line }) => /^- \[ \] /u.test(line));
}

export function todoUpdate(rootValue, number, { mode, date, confirm = false } = {}) {
  const root = secretaryRoot(rootValue);
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) usage(`番号は 1 以上の数字で指定してください: ${number}`);
  if (mode === "carry" && !validDate(date)) usage(`繰越先の日付は YYYY-MM-DD 形式で指定してください: ${date}`);
  const target = safePath(root, "inbox/todo.md");
  if (!existsSync(target)) refuse("まだ TODO はありません: inbox/todo.md");
  const content = readFileSync(target, "utf8");
  const item = uncheckedTodos(content)[n - 1];
  if (!item) usage(`その番号の未完了TODOが見つかりません: ${number}（todo-listで確かめてください）`);
  if (!confirm) refuse(`確認: これから${mode === "done" ? "完了にする" : "繰り越す"}TODOです。\n  ${item.line}${mode === "carry" ? ` → ${date}` : ""}\nユーザーの確認後に --confirm を付けて実行します。未確認のため変更しませんでした。`);
  const { day } = dateParts();
  const journal = safePath(root, `memory/journal/${day}.md`);
  const index = safePath(root, "memory/MEMORY.md");
  return transaction([target, journal, index], () => {
    const lines = content.split(/\r?\n/u);
    const plain = item.line.replace(/^- \[ \] /u, "");
    lines[item.index] = mode === "done" ? item.line.replace(/^- \[ \]/u, "- [x]") + `（完了: ${day}）` : `${item.line}（繰越: ${date}）`;
    writeFileSync(target, lines.join("\n"), "utf8");
    if (process.env.CC_SECRETARY_FAIL_AT === "todo-before-journal") refuse("テスト用のTODO中途失敗");
    journalAppend(root, mode === "done" ? "did" : "next", mode === "done" ? `TODOを完了: ${plain}` : `TODOを${date}へ持ち越し: ${plain}`);
    return { item: plain, target };
  });
}

export function renderTimeline(rootValue, { from = "", to = "", type = "all", keyword = "" } = {}) {
  const root = secretaryRoot(rootValue);
  if (from && !validDate(from)) usage(`--from は YYYY-MM-DD 形式で指定してください: ${from}`);
  if (to && !validDate(to)) usage(`--to は YYYY-MM-DD 形式で指定してください: ${to}`);
  if (from && to && from > to) usage("--from は --to と同じ日か、それより前を指定してください。");
  if (!["decisions", "journal", "all"].includes(type)) usage(`--type は decisions|journal|all のいずれかです: ${type}`);
  const rows = [];
  if (type === "decisions" || type === "all") {
    const dir = safePath(root, "memory/decisions");
    for (const name of listMarkdownFiles(dir, (item) => /^\d{4}-\d{2}-\d{2}(?:-decisions)?\.md$/u.test(item))) {
      const day = name.slice(0, 10); if ((from && day < from) || (to && day > to)) continue;
      for (const line of readFileSync(safePath(root, `memory/decisions/${name}`), "utf8").split(/\r?\n/u)) {
        if (!line.startsWith("- ")) continue; const text = line.slice(2); if (keyword && !text.includes(keyword)) continue;
        rows.push({ day, clock: "9999", label: text.startsWith("変更:") ? "決定・変更（最新を優先）" : "決定", display: "-", text });
      }
    }
  }
  if (type === "journal" || type === "all") {
    for (const { day, rel } of journalFiles(root)) {
      if ((from && day < from) || (to && day > to)) continue;
      for (const line of readFileSync(safePath(root, rel), "utf8").split(/\r?\n/u)) {
        const match = line.match(/^- (\d{2}:\d{2}) \[(did|decided|next|note)\] (.+)$/u); if (!match) continue;
        if (type === "all" && match[2] === "decided") continue; if (keyword && !match[3].includes(keyword)) continue;
        rows.push({ day, clock: match[1].replace(":", ""), label: `活動・${match[2]}`, display: match[1], text: match[3] });
      }
    }
  }
  rows.sort((a, b) => b.day.localeCompare(a.day) || b.clock.localeCompare(a.clock));
  let output = `# timeline\n\n- 期間: ${from || "指定なし"} 〜 ${to || "指定なし"}\n- 種類: ${type}\n${keyword ? `- キーワード: ${keyword}\n` : ""}`;
  if (!rows.length) return `${output}\n該当する記録はありません。期間・種類・キーワードを変えて確認してください。\n`;
  let current = "";
  for (const row of rows) { if (row.day !== current) { current = row.day; output += `\n## ${current}\n\n`; } output += row.display === "-" ? `- [${row.label}] ${row.text}\n` : `- [${row.label} ${row.display}] ${row.text}\n`; }
  return output;
}

function localDate(day) { const parsed = new Date(`${day}T00:00:00Z`); if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== day) usage(`週の基準日を解釈できません: ${day}`); return parsed; }
function shiftDate(date, days) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); }

export function renderWeekly(rootValue, anchor = "") {
  const root = secretaryRoot(rootValue); const day = anchor || dateParts().day;
  if (!validDate(day)) usage(`週の基準日は YYYY-MM-DD 形式で指定してください: ${day}`);
  const parsed = localDate(day); const weekday = parsed.getUTCDay() || 7; const from = shiftDate(parsed, 1 - weekday); const to = shiftDate(localDate(from), 6);
  const files = journalFiles(root).filter((entry) => entry.day >= from && entry.day <= to);
  const rows = [];
  for (const entry of files) for (const line of readFileSync(safePath(root, entry.rel), "utf8").split(/\r?\n/u)) {
    const match = line.match(/^- (\d{2}:\d{2}) \[(did|decided|next)\] (.+)$/u); if (match) rows.push({ kind: match[2], day: entry.day, clock: match[1], rel: entry.rel, text: match[3] });
  }
  let out = `# 週次ふりかえり\n\n- 期間: ${from} 〜 ${to}（月曜〜日曜）\n- 入力: 対象期間の日次journal原本 ${files.length}件（過去の週次要約は不使用）\n`;
  if (!files.length) return `${out}\n対象週の日次journal原本はありません。期間を確認してください。\n`;
  out += `\n## 読み込んだ原本\n\n${files.map(({ day: fileDay, rel }) => `- ${fileDay}: \`${rel}\``).join("\n")}\n`;
  for (const [kind, title] of [["did", "活動（did）"], ["decided", "決定（decided）"], ["next", "翌週への申し送り（next）"]]) {
    const selected = rows.filter((row) => row.kind === kind).sort((a, b) => kind === "decided" ? b.day.localeCompare(a.day) || b.clock.localeCompare(a.clock) : 0);
    out += `\n## ${title}\n\n${selected.length ? selected.map((row) => `- ${row.day} ${row.clock}: ${row.text} （原本: \`${row.rel}\`）`).join("\n") : "- 該当なし"}\n`;
  }
  return `${out}\n決定は新しい記録を先にし、変更履歴は原文のまま表示しています。矛盾を自動統合せず、統合候補があればユーザー確認後に別の記録として追加してください。\n`;
}

export function archiveCandidates(rootValue) {
  const root = secretaryRoot(rootValue); const current = dateParts().day.slice(0, 7);
  return [...new Set(journalFiles(root).filter(({ rel, day }) => rel.startsWith("memory/journal/") && day.slice(0, 7) < current).map(({ day }) => day.slice(0, 7)))].sort();
}

export function archivePlan(rootValue, requested = "") {
  const root = secretaryRoot(rootValue); if (requested && !validMonth(requested)) usage(`月は YYYY-MM 形式で指定してください: ${requested}`);
  const candidates = archiveCandidates(root); if (requested && !candidates.includes(requested)) usage(`退避できる古い月ではありません: ${requested}`);
  const months = requested ? [requested] : candidates; let out = "# journal退避候補\n\n";
  if (!months.length) return `${out}退避候補はありません。現在月のjournalは対象にしません。\n`;
  for (const month of months) {
    const count = journalFiles(root).filter(({ rel, day }) => rel.startsWith("memory/journal/") && day.startsWith(month)).length;
    out += `- 対象: ${month} のjournal ${count}件\n  退避先: memory/archive/journal/${month}/\n  残る参照: MEMORY.mdの月索引と各原本（退避先へ移動。削除しない）\n  timeline/weeklyへの影響: 退避領域も検索するため表示は継続。原本パスだけが変わる\n`;
  }
  return `${out}\n確認前は何も変更しません。対象月を確認し、了承後だけ \`archive-month <secretary> YYYY-MM --confirm\` を実行してください。\n`;
}

export function archiveMonth(rootValue, month, confirm = false) {
  const root = secretaryRoot(rootValue); if (!validMonth(month)) usage(`月は YYYY-MM 形式で指定してください: ${month}`);
  if (!confirm) refuse(`${archivePlan(root, month)}未確認のためjournalを退避しませんでした。`);
  if (!archiveCandidates(root).includes(month)) usage(`退避できる古い月ではありません: ${month}`);
  const sourceDir = safePath(root, "memory/journal"); const targetDir = safePath(root, `memory/archive/journal/${month}`); const index = safePath(root, "memory/MEMORY.md");
  if (existsSync(targetDir) && listMarkdownFiles(targetDir, (name) => name.startsWith(month)).length) refuse(`同じ月の退避済みjournalがあるため、無断で混ぜずに中止しました: memory/archive/journal/${month}/`);
  const names = listMarkdownFiles(sourceDir, (name) => name.startsWith(`${month}-`)); if (!names.length) usage(`対象月のjournalがありません: ${month}`);
  const backup = resolve(tmpdir(), `secretary-archive-${process.pid}-${Date.now()}`); mkdirSync(backup, { recursive: true }); cpSync(index, join(backup, "MEMORY.md"));
  try {
    mkdirSync(targetDir, { recursive: true });
    for (const name of names) renameSync(safePath(root, `memory/journal/${name}`), safePath(root, `memory/archive/journal/${month}/${name}`));
    if (process.env.CC_SECRETARY_FAIL_AT === "archive-before-index") refuse("テスト用のarchive中途失敗");
    reindex(root); return { moved: names.length };
  } catch (error) {
    for (const name of names) { const archived = safePath(root, `memory/archive/journal/${month}/${name}`); if (existsSync(archived)) renameSync(archived, safePath(root, `memory/journal/${name}`)); }
    cpSync(join(backup, "MEMORY.md"), index); try { rmSync(targetDir); } catch { /* 空でなければ保持 */ } throw error;
  } finally { rmSync(backup, { recursive: true, force: true }); }
}
