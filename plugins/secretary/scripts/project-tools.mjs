#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, cpSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runExternalSync } from "./lib/external-ops.mjs";
import { safeWritePath, workingRoot } from "./lib/safe-fs.mjs";

class ProjectError extends Error {
  constructor(message, code = 3) {
    super(message);
    this.code = code;
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const memoryTools = resolve(scriptDir, "../skills/memory-care/scripts/memory-tools.sh");
const workspaceTools = resolve(scriptDir, "workspace-tools.sh");
const coreFiles = new Set(["AGENTS.md", "CLAUDE.md", "PROJECT.md", "DECISIONS.md", "MEMORY.md", "INDEX.md", "TODO.md"]);

function usage(message) {
  throw new ProjectError(`使い方エラー: ${message}`, 2);
}

function refuse(message) {
  throw new ProjectError(message, 3);
}

function credentialKind(value) {
  const patterns = [
    [/(?:^|[^A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{20,}(?=$|[^A-Za-z0-9])/i, "GitHub Token形式"],
    [/(?:^|[^A-Za-z0-9_])github_pat_[A-Za-z0-9_]{20,}(?=$|[^A-Za-z0-9_])/i, "GitHub fine-grained PAT形式"],
    [/(?:^|[^A-Za-z0-9_-])glpat-[A-Za-z0-9_-]{20,}(?=$|[^A-Za-z0-9_-])/i, "GitLab Token形式"],
    [/\bAKIA[A-Z0-9]{16}\b/, "AWS Access Key形式"],
    [/(?:^|\s)xox[baprs]-[A-Za-z0-9-]{20,}(?=$|\s)/i, "Slack Token形式"],
    [/https?:\/\/[^/\s:@]+:[^/\s@]+@[^/\s]+/i, "資格情報を含むURL"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/i, "秘密鍵形式"],
    [/(password|api[_-]?key|token|client[_-]?secret|credential)\s*[:=]\s*\S+/i, "ラベル付き資格情報"]
  ];
  return patterns.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

function text(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) refuse(`${label}が空です。空の内容は保存しません。`);
  if (/\r|\n/.test(normalized)) refuse(`${label}は1件1行で指定してください。`);
  const kind = credentialKind(normalized);
  if (kind) refuse(`${label}に資格情報らしき値があります（${kind}）。トークンやパスワードを除いてください。`);
  return normalized;
}

function dateNow() {
  const injected = process.env.CC_SECRETARY_NOW;
  if (injected) {
    const day = injected.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) refuse(`CC_SECRETARY_NOW は YYYY-MM-DD または ISO 8601 形式で指定してください: ${injected}`);
    return day;
  }
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateName(value) {
  const name = text(value, "プロジェクト名");
  if (name === "." || name === ".." || name.startsWith(".") || /[\\/\0]/.test(name) || name.includes("..")) {
    refuse(`安全に使えないプロジェクト名です: ${name}`);
  }
  if (name.length > 100) refuse("プロジェクト名は100文字以内にしてください。");
  return name;
}

function secretaryRoot(value) {
  try { return workingRoot(value); }
  catch { refuse(`秘書ディレクトリが通常のdirectoryではないため、安全に操作できません: ${value}`); }
}

function safePath(root, rel) {
  if (!rel || rel === "." || rel === ".." || rel.startsWith("/") || rel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) {
    refuse(`秘書ディレクトリ（secretary/）の外は操作できません: ${rel}`);
  }
  try { return safeWritePath(root, rel); }
  catch { refuse(`symlink経由で秘書ディレクトリの外は操作できません: ${rel}`); }
}

function projectPath(root, name) {
  return safePath(root, `projects/${validateName(name)}`);
}

function parseOptions(argv) {
  const positional = [];
  const options = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    if (["--confirm", "--all", "--multiple-actions", "--multiple-sessions", "--deadline", "--waiting", "--stakeholders", "--growing-decisions", "--repeated-topic", "--hard-to-read", "--guardrail-needed"].includes(item)) {
      options.set(item, true);
      continue;
    }
    if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) usage(`${item} の値を指定してください。`);
    options.set(item, argv[i + 1]);
    i += 1;
  }
  return { positional, options };
}

function requireConfirm(options, action) {
  if (!options.get("--confirm")) {
    refuse(`確認: ${action}\nユーザーの明示確認後に --confirm を付けて実行します。未確認のため変更しませんでした。`);
  }
}

function readProject(root, name) {
  const dir = projectPath(root, name);
  const file = safePath(root, `projects/${validateName(name)}/PROJECT.md`);
  if (!existsSync(dir) || !lstatSync(dir).isDirectory() || !existsSync(file)) refuse(`プロジェクトが見つかりません: ${name}`);
  return { dir, file, markdown: readFileSync(file, "utf8") };
}

function frontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function setFrontmatter(markdown, key, value) {
  const pattern = new RegExp(`^${key}:\\s*.*$`, "m");
  if (pattern.test(markdown)) return markdown.replace(pattern, `${key}: ${value}`);
  const end = markdown.indexOf("\n---", 4);
  if (!markdown.startsWith("---\n") || end < 0) refuse("PROJECT.md のfrontmatterが壊れています。自動変更せず確認してください。");
  return `${markdown.slice(0, end)}\n${key}: ${value}${markdown.slice(end)}`;
}

function section(markdown, headingPattern) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return { start: -1, end: -1, lines: [] };
  let end = start + 1;
  while (end < lines.length && !/^##\s+/.test(lines[end])) end += 1;
  return { start, end, lines: lines.slice(start + 1, end) };
}

function replaceSection(markdown, headingPattern, heading, body) {
  const lines = markdown.split("\n");
  const found = section(markdown, headingPattern);
  const block = [heading, "", ...body, ""];
  if (found.start < 0) return `${markdown.trimEnd()}\n\n${block.join("\n")}`;
  lines.splice(found.start, found.end - found.start, ...block);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function removeSection(markdown, headingPattern) {
  const lines = markdown.split("\n");
  const found = section(markdown, headingPattern);
  if (found.start >= 0) lines.splice(found.start, found.end - found.start);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function bullets(markdown, headingPattern) {
  return section(markdown, headingPattern).lines
    .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1]?.trim())
    .filter((value) => value && value !== "なし");
}

function writeMarkdown(path, value) {
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`, { encoding: "utf8", flag: "wx" });
}

function runJournal(root, type, message) {
  let result;
  try {
    result = runExternalSync("bash", [memoryTools, "journal-add", root, type, message], {
      encoding: "utf8",
      timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
      label: "journal記録",
      allowFailure: true,
    });
  } catch (error) {
    refuse(error?.code === "timeout" ? "journalの記録が時間切れになりました。後続処理は行っていません。" : "journalの記録を安全に完了できませんでした。");
  }
  if (result.status !== 0) refuse((result.stderr || result.stdout || "journalの記録に失敗しました。").trim());
}

function mutateProject(root, name, { create = false, journalType = "did", journalMessage }, mutate) {
  const target = projectPath(root, name);
  const parent = safePath(root, "projects");
  mkdirSync(parent, { recursive: true });
  if (create && existsSync(target)) refuse(`同名のプロジェクトが既にあります。上書きしません: ${name}`);
  if (!create && (!existsSync(target) || !lstatSync(target).isDirectory())) refuse(`プロジェクトが見つかりません: ${name}`);
  if (!create) assertNoSymlinks(target);
  const nonce = `${process.pid}-${Date.now()}`;
  const stage = safePath(root, `projects/.project-stage-${nonce}`);
  const backup = safePath(root, `projects/.project-backup-${nonce}`);
  try {
    if (create) mkdirSync(stage);
    else cpSync(target, stage, { recursive: true, dereference: false, errorOnExist: true });
    mutate(stage);
    if (!existsSync(join(stage, "PROJECT.md"))) refuse("PROJECT.md が生成されませんでした。変更を中止します。");
    if (create) {
      renameSync(stage, target);
      try { runJournal(root, journalType, journalMessage); }
      catch (error) { rmSync(target, { recursive: true, force: true }); throw error; }
    } else {
      renameSync(target, backup);
      try {
        renameSync(stage, target);
        runJournal(root, journalType, journalMessage);
        rmSync(backup, { recursive: true, force: true });
      } catch (error) {
        rmSync(target, { recursive: true, force: true });
        renameSync(backup, target);
        throw error;
      }
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
    rmSync(backup, { recursive: true, force: true });
  }
}

function projectStatus(markdown) {
  const status = frontmatterValue(markdown, "status");
  return status === "completed" ? "completed" : "active";
}

function projectType(markdown) {
  return frontmatterValue(markdown, "projectType") || "general";
}

function assertNoSymlinks(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) refuse(`プロジェクト内にsymlinkがあります。安全のため操作できません: ${entry.name}`);
    if (entry.isDirectory()) assertNoSymlinks(path);
  }
}

function ensureGeneral(markdown) {
  if (projectType(markdown) !== "general") refuse("この操作は一般プロジェクトだけが対象です。別repo開発PJの正本は参照先で更新してください。");
}

function ensureActive(markdown) {
  if (projectStatus(markdown) === "completed") refuse("完了済みプロジェクトです。新しい作業を始める前に、再開するか確認してください。");
}

function renderLight({ name, day, overview, goal, success, current, next, questions }) {
  return `---\nstatus: active\nprojectType: general\ncreatedAt: ${day}\nupdatedAt: ${day}\n---\n\n# ${name}\n\n## 現在の状況（${day}時点）\n\n- 現在: ${current}\n- 待ち: なし\n- 次の入口: ${next}\n- 要確認事項: ${questions || "なし"}\n\n## 概要\n\n${overview}\n\n## ゴールと成功の測り方\n\n- ゴール: ${goal}\n- 成功の測り方: ${success}\n\n## Decisions\n\n- なし\n\n## メモ\n\n- なし\n\n## 関連ドキュメント\n\n- なし\n\n## 完了記録\n\n- なし\n`;
}

function nextDecisionId(markdown) {
  const ids = [...markdown.matchAll(/\bD-(\d{3})\b/g)].map((match) => Number(match[1]));
  return `D-${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, "0")}`;
}

function updateCurrent(markdown, day, current, next) {
  const old = section(markdown, /^## 現在の状況(?:（.*）)?$/).lines;
  const waiting = old.find((line) => /^- 待ち:/.test(line)) ?? "- 待ち: なし";
  const questions = old.find((line) => /^- 要確認事項:/.test(line)) ?? "- 要確認事項: なし";
  let result = replaceSection(markdown, /^## 現在の状況(?:（.*）)?$/, `## 現在の状況（${day}時点）`, [`- 現在: ${current}`, waiting, `- 次の入口: ${next}`, questions]);
  result = setFrontmatter(result, "updatedAt", day);
  return result;
}

function promotionReasons(dir, markdown, options = new Map()) {
  const decisionCount = bullets(markdown, /^## Decisions$/).length;
  const noteCount = bullets(markdown, /^## メモ$/).length;
  const fileCount = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile() && !coreFiles.has(entry.name)).length;
  const reasons = [];
  if (decisionCount > 10) reasons.push(`Decisionsが${decisionCount}件`);
  if (noteCount > 10) reasons.push(`メモが${noteCount}件`);
  if (fileCount > 10) reasons.push(`PJ直下の作業ファイルが${fileCount}件`);
  if (options.get("--hard-to-read")) reasons.push("状態以外の情報が増えてPROJECT.mdが読みにくい");
  if (options.get("--guardrail-needed") || options.get("--guardrail")) reasons.push("PJ固有のガードレールが必要");
  return { decisionCount, noteCount, fileCount, reasons };
}

function indexEntries(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .map((entry) => `- \`${entry.name}${entry.isDirectory() ? "/" : ""}\``);
}

function renderAgents(name, dir, guardrail = "資格情報を保存しない。判断・状態・事実・タスクの正本を混ぜない。") {
  return `# ${name} プロジェクトの指示\n\n## Start here\n\n1. \`PROJECT.md\` で現在の状態と次の入口を確認する。\n2. 判断の経緯は \`DECISIONS.md\`、恒久的な事実は \`MEMORY.md\` を確認する。\n3. 実行タスクはこのフォルダへ複製せず、\`../../inbox/todo.md\` または接続済みサービスを正本にする。\n\n## ガードレール\n\n- ${guardrail}\n- 未確定事項を \`DECISIONS.md\` に入れない。\n- 確定成果物は \`outputs/\`、旧版は \`archive/\` に置く。最新版を判断できないときは移動前に確認する。\n\n## ファイル索引\n\n<!-- project-index:start -->\n${indexEntries(dir).join("\n")}\n<!-- project-index:end -->\n`;
}

function refreshIndex(dir) {
  const agents = join(dir, "AGENTS.md");
  if (!existsSync(agents)) return;
  const markdown = readFileSync(agents, "utf8");
  const block = `<!-- project-index:start -->\n${indexEntries(dir).join("\n")}\n<!-- project-index:end -->`;
  const replaced = markdown.replace(/<!-- project-index:start -->[\s\S]*?<!-- project-index:end -->/, block);
  writeFileSync(agents, replaced, "utf8");
}

function slugTitle(value) {
  const title = text(value, "タイトル");
  const slug = title.replace(/[ /\\]/g, "_");
  if (!slug || slug.includes("..")) refuse(`ファイル名に使えないタイトルです: ${title}`);
  return { title, slug };
}

function readStdin() {
  const body = readFileSync(0, "utf8").trim();
  return text(body, "本文");
}

function cmdCandidate(argv) {
  const { positional, options } = parseOptions(argv);
  if (positional.length === 1 || positional.length > 2) usage("candidate-check [<secretary> <project>] [候補signal]");
  const signals = [];
  if (options.get("--multiple-actions")) signals.push("同じ成果に向けた複数行動");
  if (options.get("--multiple-sessions")) signals.push("別の日・別セッションへの継続");
  if (options.get("--deadline")) signals.push("締切");
  if (options.get("--waiting")) signals.push("待ち状態");
  if (options.get("--stakeholders")) signals.push("関係者");
  if (options.get("--growing-decisions")) signals.push("増えていく判断・成果物");
  if (options.get("--repeated-topic")) signals.push("繰り返し登場する同一案件");
  const primary = Boolean(options.get("--multiple-actions") || options.get("--multiple-sessions"));
  const signalEligible = Boolean(signals.length >= 2 && primary);
  if (positional.length === 2) {
    const [sec, rawName] = positional;
    const root = secretaryRoot(sec), name = validateName(rawName), dir = projectPath(root, name), projectFile = safePath(root, `projects/${name}/PROJECT.md`);
    if (existsSync(dir)) {
      if (!lstatSync(dir).isDirectory() || !existsSync(projectFile)) refuse(`既存プロジェクトの構造を確認できません: ${name}`);
      const markdown = readFileSync(projectFile, "utf8"), status = projectStatus(markdown);
      if (status === "completed") {
        console.log(JSON.stringify({ eligible: false, route: "reopen", signals, existingProject: { name, status, path: `projects/${name}/PROJECT.md` }, reason: "同じ案件の完了済みプロジェクトがあるため、新規作成ではなく再開確認へ進む", question: "このプロジェクトを再開しますか？" }, null, 2));
        return;
      }
      console.log(JSON.stringify({ eligible: false, route: "existing-project", signals, existingProject: { name, status, path: `projects/${name}/PROJECT.md` }, reason: "同じ案件の進行中プロジェクトがあるため、新規作成せず既存PJへ続ける", question: null }, null, 2));
      return;
    }
  }
  console.log(JSON.stringify({ eligible: signalEligible, route: signalEligible ? "create-project" : "none", signals, reason: signalEligible ? signals.slice(0, 2).join("、") : "候補シグナルが基準未達", question: signalEligible ? "この内容は今後も続きそうです。プロジェクトとしてまとめますか？" : null }, null, 2));
}

function cmdCreateLight(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("create-light <secretary> <project> --overview ... --goal ... --success ... --current ... --next ... [--questions ...] --confirm");
  requireConfirm(options, `「${rawName}」を一般プロジェクトとして作成します。`);
  const root = secretaryRoot(sec);
  const name = validateName(rawName);
  const values = {
    name,
    day: dateNow(),
    overview: text(options.get("--overview"), "概要"),
    goal: text(options.get("--goal"), "ゴール"),
    success: text(options.get("--success"), "成功の測り方"),
    current: text(options.get("--current"), "現在の状況"),
    next: text(options.get("--next"), "次の入口"),
    questions: options.has("--questions") ? text(options.get("--questions"), "要確認事項") : ""
  };
  mutateProject(root, name, { create: true, journalMessage: `プロジェクト「${name}」をライト運用で作成（参照: projects/${name}/PROJECT.md）` }, (stage) => {
    writeMarkdown(join(stage, "PROJECT.md"), renderLight(values));
  });
  console.log(`一般プロジェクトを作成しました: projects/${name}/PROJECT.md`);
}

function cmdList(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec] = positional;
  if (!sec) usage("list <secretary> [--all]");
  const root = secretaryRoot(sec);
  const projects = safePath(root, "projects");
  if (!existsSync(projects)) return console.log("プロジェクトはまだありません。");
  const rows = [];
  for (const entry of readdirSync(projects, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "ja"))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    try {
      const md = readProject(root, entry.name).markdown;
      const status = projectStatus(md);
      if (!options.get("--all") && status !== "active") continue;
      rows.push(`- ${entry.name} [${status}] — projects/${entry.name}/PROJECT.md`);
    } catch { /* 壊れた項目は一覧へ混ぜない。明示参照時にエラーを返す。 */ }
  }
  console.log(rows.length ? rows.join("\n") : options.get("--all") ? "プロジェクトはまだありません。" : "進行中のプロジェクトはありません。");
}

function cmdShow(argv) {
  const { positional } = parseOptions(argv);
  const [sec, name] = positional;
  if (!sec || !name) usage("show <secretary> <project>");
  console.log(readProject(secretaryRoot(sec), name).markdown.trimEnd());
}

function cmdAddDecision(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("add-decision <secretary> <project> --decision ... --current ... --next ... --confirm");
  requireConfirm(options, `「${rawName}」の決定を記録し、現在の状況を更新します。`);
  const root = secretaryRoot(sec), name = validateName(rawName), day = dateNow();
  const decision = text(options.get("--decision"), "決定"), current = text(options.get("--current"), "現在の状況"), next = text(options.get("--next"), "次の入口");
  const existing = readProject(root, name); ensureGeneral(existing.markdown); ensureActive(existing.markdown);
  const id = nextDecisionId(existing.markdown);
  mutateProject(root, name, { journalType: "decided", journalMessage: `プロジェクト「${name}」の決定 ${id} を記録（参照: projects/${name}/PROJECT.md）` }, (stage) => {
    const projectFile = join(stage, "PROJECT.md");
    let md = readFileSync(projectFile, "utf8");
    const summaries = bullets(md, /^## Decisions$/);
    summaries.push(`${id} (${day}): ${decision}`);
    md = replaceSection(md, /^## Decisions$/, "## Decisions", summaries.map((item) => `- ${item}`));
    md = updateCurrent(md, day, current, next);
    writeFileSync(projectFile, md, "utf8");
    const full = join(stage, "DECISIONS.md");
    if (existsSync(full)) writeFileSync(full, `${readFileSync(full, "utf8").trimEnd()}\n\n## ${id} — ${day}\n\n- 結論: ${decision}\n- 背景・理由: PROJECT.mdの現在状況を参照\n- 影響範囲: このプロジェクト\n`, "utf8");
  });
  console.log(`決定 ${id} と現在の状況を一組で更新しました: projects/${name}/PROJECT.md`);
}

function cmdAddNote(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("add-note <secretary> <project> --note ... --confirm");
  requireConfirm(options, `「${rawName}」の恒久的な事実を記録します。`);
  const root = secretaryRoot(sec), name = validateName(rawName), day = dateNow(), note = text(options.get("--note"), "メモ");
  const existing = readProject(root, name); ensureGeneral(existing.markdown); ensureActive(existing.markdown);
  mutateProject(root, name, { journalType: "note", journalMessage: `プロジェクト「${name}」の事実メモを更新（参照: projects/${name}/PROJECT.md）` }, (stage) => {
    const projectFile = join(stage, "PROJECT.md"), memoryFile = join(stage, "MEMORY.md");
    if (existsSync(memoryFile)) {
      writeFileSync(memoryFile, `${readFileSync(memoryFile, "utf8").trimEnd()}\n- ${day}: ${note}\n`, "utf8");
      let md = readFileSync(projectFile, "utf8");
      md = setFrontmatter(md, "updatedAt", day);
      writeFileSync(projectFile, md, "utf8");
    } else {
      let md = readFileSync(projectFile, "utf8");
      const notes = bullets(md, /^## メモ$/); notes.push(`${day}: ${note}`);
      md = replaceSection(md, /^## メモ$/, "## メモ", notes.map((item) => `- ${item}`));
      md = setFrontmatter(md, "updatedAt", day);
      writeFileSync(projectFile, md, "utf8");
    }
  });
  console.log(`事実メモを記録しました: projects/${name}/${existsSync(join(existing.dir, "MEMORY.md")) ? "MEMORY.md" : "PROJECT.md"}`);
}

function cmdPromotionStatus(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, name] = positional;
  if (!sec || !name) usage("promotion-status <secretary> <project> [--hard-to-read] [--guardrail-needed]");
  const project = readProject(secretaryRoot(sec), name); ensureGeneral(project.markdown);
  const result = promotionReasons(project.dir, project.markdown, options);
  console.log(JSON.stringify({ eligible: result.reasons.length > 0, ...result, question: result.reasons.length ? "情報が増え、状態・判断・事実を分けた方が探しやすいです。フル運用へ整理しますか？" : null }, null, 2));
}

function cmdPromote(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("promote-full <secretary> <project> [--hard-to-read|--guardrail ...] --confirm");
  requireConfirm(options, `「${rawName}」をフル運用へ整理します。`);
  const root = secretaryRoot(sec), name = validateName(rawName), project = readProject(root, name); ensureGeneral(project.markdown); ensureActive(project.markdown);
  if (existsSync(join(project.dir, "AGENTS.md")) || existsSync(join(project.dir, "DECISIONS.md")) || existsSync(join(project.dir, "MEMORY.md"))) refuse("このプロジェクトは既にフル運用です。重ねて昇格しません。");
  if (existsSync(join(project.dir, "INDEX.md"))) refuse("INDEX.md が既にあります。自動削除せず、内容を確認してから整理してください。");
  const status = promotionReasons(project.dir, project.markdown, options);
  if (!status.reasons.length) refuse("フル運用の昇格トリガーに達していません。ライト運用を続けます。");
  const guardrail = options.has("--guardrail") ? text(options.get("--guardrail"), "ガードレール") : undefined;
  mutateProject(root, name, { journalMessage: `プロジェクト「${name}」をフル運用へ整理（参照: projects/${name}/AGENTS.md）` }, (stage) => {
    const projectFile = join(stage, "PROJECT.md");
    let md = readFileSync(projectFile, "utf8");
    const decisions = bullets(md, /^## Decisions$/), notes = bullets(md, /^## メモ$/);
    writeMarkdown(join(stage, "DECISIONS.md"), `# ${name} Decisions\n\n確認済みの判断だけを追記します。変更・撤回は過去を消さず、新しいDecisionとして残します。\n\n${decisions.length ? decisions.map((item) => `## ${item.match(/^(D-\d{3})/)?.[1] ?? "Decision"}\n\n- サマリー: ${item}`).join("\n\n") : "決定はまだありません。"}\n`);
    writeMarkdown(join(stage, "MEMORY.md"), `# ${name} Memory\n\n文書から導出できない恒久的な事実・知見を、記録日つきで残します。資格情報は保存しません。\n\n${notes.length ? notes.map((item) => `- ${item}`).join("\n") : "事実メモはまだありません。"}\n`);
    md = removeSection(md, /^## メモ$/);
    md = setFrontmatter(md, "updatedAt", dateNow());
    writeFileSync(projectFile, md, "utf8");
    writeMarkdown(join(stage, "CLAUDE.md"), "# CLAUDE.md\n\n指示とファイル索引の正本は、同じフォルダの `AGENTS.md` です。作業前にまず `AGENTS.md` を読んでください。\n");
    writeMarkdown(join(stage, "AGENTS.md"), renderAgents(name, stage, guardrail));
    refreshIndex(stage);
  });
  console.log(`フル運用へ整理しました: projects/${name}/AGENTS.md`);
}

function cmdTodo(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("add-todo <secretary> <project> --todo ... --source ... [--due YYYY-MM-DD]");
  const root = secretaryRoot(sec), name = validateName(rawName), project = readProject(root, name); ensureGeneral(project.markdown); ensureActive(project.markdown);
  const todo = text(options.get("--todo"), "TODO"), source = text(options.get("--source"), "根拠");
  const due = options.get("--due") ?? "";
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) usage("--due は YYYY-MM-DD 形式で指定してください。");
  const linked = `${todo} [PJ: ${name} / projects/${name}/PROJECT.md]`;
  let result;
  try {
    result = runExternalSync("bash", [workspaceTools, "todo-add", root, linked, source, due], {
      encoding: "utf8",
      timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
      label: "TODO追加",
      allowFailure: true,
    });
  } catch (error) {
    throw new ProjectError(error?.code === "timeout" ? "TODO追加が時間切れになりました。後続処理は行っていません。" : "TODO追加を安全に完了できませんでした。", 3);
  }
  if (result.status !== 0) throw new ProjectError((result.stderr || result.stdout).trim(), result.status === 2 ? 2 : 3);
  console.log(`PJ参照つきTODOを正本へ追加しました: inbox/todo.md`);
}

function deliverableMarkdown(day, title, tags, body) {
  const list = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  return `---\ncreatedAt: ${day}\ntags:\n${(list.length ? list : ["プロジェクト"]).map((tag) => `  - ${tag}`).join("\n")}\n---\n\n# ${title}\n\n${body}\n`;
}

function cmdSave(argv, output) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage(`${output ? "save-output" : "save-work"} <secretary> <project> --title ... [--tags ...] < 本文`);
  const root = secretaryRoot(sec), name = validateName(rawName), project = readProject(root, name); ensureGeneral(project.markdown); ensureActive(project.markdown);
  const { title, slug } = slugTitle(options.get("--title")), body = readStdin(), day = dateNow(), tags = text(options.get("--tags") ?? (output ? "確定成果物" : "作業文書"), "タグ");
  const rel = `${output ? "outputs/" : ""}${day}_${slug}.md`;
  mutateProject(root, name, { journalMessage: `プロジェクト「${name}」の${output ? "確定成果物" : "作業文書"}「${title}」を保存（参照: projects/${name}/${rel}）` }, (stage) => {
    const target = join(stage, rel);
    if (existsSync(target)) refuse(`同名ファイルが既にあります。上書きしません: ${rel}`);
    mkdirSync(dirname(target), { recursive: true });
    writeMarkdown(target, deliverableMarkdown(day, title, tags, body));
    refreshIndex(stage);
    const pf = join(stage, "PROJECT.md");
    let md = readFileSync(pf, "utf8");
    const refs = bullets(md, /^## 関連ドキュメント$/); refs.push(rel);
    md = replaceSection(md, /^## 関連ドキュメント$/, "## 関連ドキュメント", [...new Set(refs)].map((item) => `- ${item}`));
    md = setFrontmatter(md, "updatedAt", day);
    writeFileSync(pf, md, "utf8");
  });
  console.log(`${output ? "確定成果物" : "作業文書"}を保存しました: projects/${name}/${rel}`);
}

function cmdArchive(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName, rel] = positional;
  if (!sec || !rawName || !rel) usage("archive-file <secretary> <project> <project内の相対path> --confirm");
  const safeRel = text(rel, "archive対象path");
  requireConfirm(options, `「${safeRel}」を旧版としてarchive/へ移動します。最新版か判断できない場合は実行しないでください。`);
  if (coreFiles.has(basename(safeRel)) || safeRel.startsWith("archive/") || safeRel.split(/[\\/]/).some((part) => !part || part === "." || part === "..")) refuse(`archiveへ移動できないpathです: ${safeRel}`);
  const root = secretaryRoot(sec), name = validateName(rawName), project = readProject(root, name); ensureGeneral(project.markdown);
  mutateProject(root, name, { journalMessage: `プロジェクト「${name}」の旧版「${safeRel}」をarchiveへ移動（参照: projects/${name}/archive/${basename(safeRel)}）` }, (stage) => {
    const source = join(stage, safeRel), destination = join(stage, "archive", basename(safeRel));
    if (!existsSync(source) || !lstatSync(source).isFile()) refuse(`移動するファイルが見つかりません: ${safeRel}`);
    if (existsSync(destination)) refuse(`archiveに同名ファイルがあります。上書きしません: ${basename(safeRel)}`);
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);
    refreshIndex(stage);
    const pf = join(stage, "PROJECT.md");
    let md = readFileSync(pf, "utf8").replace(new RegExp(`^- ${safeRel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"), `- archive/${basename(safeRel)}`);
    md = setFrontmatter(md, "updatedAt", dateNow());
    writeFileSync(pf, md, "utf8");
  });
  console.log(`旧版を移動しました: projects/${name}/archive/${basename(safeRel)}`);
}

function cmdDevPointer(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("create-dev-pointer <secretary> <project> --repo ... --entry ... --overview ... --current ... --visibility private|public --confirm");
  const repo = text(options.get("--repo"), "正本repo"), entry = text(options.get("--entry"), "最初に読むファイル"), overview = text(options.get("--overview"), "概要"), current = text(options.get("--current"), "現在の状態"), visibility = options.get("--visibility");
  if (!visibility || !["private", "public"].includes(visibility)) usage("--visibility は private または public を指定してください。");
  requireConfirm(options, `別repo開発PJ「${rawName}」の参照ポインタを作ります。正本repo=${repo}、公開範囲=${visibility}。`);
  const root = secretaryRoot(sec), name = validateName(rawName), day = dateNow();
  mutateProject(root, name, { create: true, journalMessage: `別repo開発プロジェクト「${name}」の参照ポインタを作成（参照: projects/${name}/PROJECT.md）` }, (stage) => {
    writeMarkdown(join(stage, "PROJECT.md"), `---\nstatus: active\nprojectType: development-pointer\ncreatedAt: ${day}\nupdatedAt: ${day}\n---\n\n# ${name}\n\n## 概要\n\n${overview}\n\n## 正本repo\n\n- 場所: ${repo}\n- 公開範囲: ${visibility}\n- 最初に読むファイル: ${entry}\n\n## 現在の状態（${day}確認）\n\n${current}\n\n> 実装仕様、判断ログ、Sprint状態、コード、成果物の正本は上記repoです。このworkspaceには複製しません。\n`);
    writeMarkdown(join(stage, "AGENTS.md"), `# ${name} 開発プロジェクト参照\n\n- 正本repo: ${repo}\n- 公開範囲: ${visibility}\n- 最初に読むファイル: ${entry}\n- workspace側では実装仕様、判断、進行状態、コード、成果物を編集・複製しない。\n- 開発作業は正本repoで \`harness@yasashii-harness\` の Planner → Generator → Evaluator に従う。\n`);
  });
  console.log(`別repo開発PJの参照ポインタを作成しました: projects/${name}/PROJECT.md`);
}

function cmdComplete(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("complete <secretary> <project> --result ... --remaining ... --confirm");
  const result = text(options.get("--result"), "達成した結果"), remaining = text(options.get("--remaining"), "残件");
  requireConfirm(options, `「${rawName}」を完了扱いにし、結果と残件を記録します。`);
  const root = secretaryRoot(sec), name = validateName(rawName), project = readProject(root, name); ensureGeneral(project.markdown);
  if (projectStatus(project.markdown) === "completed") refuse("このプロジェクトは既に完了扱いです。");
  const day = dateNow();
  mutateProject(root, name, { journalMessage: `プロジェクト「${name}」を完了（参照: projects/${name}/PROJECT.md）` }, (stage) => {
    const pf = join(stage, "PROJECT.md"); let md = readFileSync(pf, "utf8");
    md = setFrontmatter(md, "status", "completed"); md = setFrontmatter(md, "updatedAt", day);
    const records = bullets(md, /^## 完了記録$/); records.push(`${day}: 結果=${result} / 残件=${remaining}`);
    md = replaceSection(md, /^## 完了記録$/, "## 完了記録", records.map((item) => `- ${item}`));
    md = replaceSection(md, /^## 現在の状況(?:（.*）)?$/, `## 現在の状況（${day}時点）`, ["- 現在: 完了", "- 待ち: なし", "- 次の入口: 明示的に再開するときに確認する", `- 要確認事項: 残件=${remaining}`]);
    writeFileSync(pf, md, "utf8");
  });
  console.log(`完了扱いにしました。検索と明示参照は引き続き可能です: projects/${name}/PROJECT.md`);
}

function cmdReopen(argv) {
  const { positional, options } = parseOptions(argv);
  const [sec, rawName] = positional;
  if (!sec || !rawName) usage("reopen <secretary> <project> --reason ... --next ... --confirm");
  const reason = text(options.get("--reason"), "再開理由"), next = text(options.get("--next"), "次の入口");
  requireConfirm(options, `完了済みの「${rawName}」を再開します。`);
  const root = secretaryRoot(sec), name = validateName(rawName), project = readProject(root, name); ensureGeneral(project.markdown);
  if (projectStatus(project.markdown) !== "completed") refuse("このプロジェクトは完了状態ではありません。自動再開しません。");
  const day = dateNow();
  mutateProject(root, name, { journalMessage: `プロジェクト「${name}」を再開（参照: projects/${name}/PROJECT.md）` }, (stage) => {
    const pf = join(stage, "PROJECT.md"); let md = readFileSync(pf, "utf8");
    md = setFrontmatter(md, "status", "active"); md = setFrontmatter(md, "updatedAt", day);
    md = replaceSection(md, /^## 現在の状況(?:（.*）)?$/, `## 現在の状況（${day}時点）`, [`- 現在: ${day}に再開（理由: ${reason}）`, "- 待ち: なし", `- 次の入口: ${next}`, "- 要確認事項: なし"]);
    writeFileSync(pf, md, "utf8");
  });
  console.log(`プロジェクトを再開しました。過去の完了記録は保持しています: projects/${name}/PROJECT.md`);
}

const [command, ...args] = process.argv.slice(2);
try {
  switch (command) {
    case "candidate-check": cmdCandidate(args); break;
    case "create-light": cmdCreateLight(args); break;
    case "list": cmdList(args); break;
    case "show": cmdShow(args); break;
    case "add-decision": cmdAddDecision(args); break;
    case "add-note": cmdAddNote(args); break;
    case "promotion-status": cmdPromotionStatus(args); break;
    case "promote-full": cmdPromote(args); break;
    case "add-todo": cmdTodo(args); break;
    case "save-work": cmdSave(args, false); break;
    case "save-output": cmdSave(args, true); break;
    case "archive-file": cmdArchive(args); break;
    case "create-dev-pointer": cmdDevPointer(args); break;
    case "complete": cmdComplete(args); break;
    case "reopen": cmdReopen(args); break;
    default: usage("不明なコマンドです。candidate-check|create-light|list|show|add-decision|add-note|promotion-status|promote-full|add-todo|save-work|save-output|archive-file|create-dev-pointer|complete|reopen を指定してください。");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(error instanceof ProjectError ? error.code : 3);
}
