#!/usr/bin/env node

// Sprint 032 Patch 001/002 層C: 実pluginセッションのsmoke test（host固有runner）。
//
// host: Claude Code CLI（claude-code-cli）。この層だけがhost固有であり、
// 会話契約の検査は共通validator（scripts/lib/sprint-032-patch-001-conversation.mjs）に委ねる。
// 対応対象ホスト4環境と検証済みホストの別集計は scripts/lib/sprint-032-patch-002-hosts.mjs が正本。
// このrunnerの結果は「Claude Code CLI実行面の証拠」だけを構成し、他ホストへ昇格しない。
//
// 実会話出力の回帰は live conversation gate（三値: pass / fail / incomplete）として、
// offline回帰・構文チェック・master gateから分離して集計する。未実行・未認証・隔離未実証は
// incomplete（未完了）であり、実会話回帰の保証として数えない。
//
// 安全契約（sprint-032-patch-002、2026-07-21 Retry 1改訂）:
// 1. 子プロセスenvはallowlist方式。process.env全体を複製せず、起動必須の変数だけを渡す。
//    認証情報・APIキー・*_TOKEN・*_SECRET・GH_*／GITHUB_*・Google認証情報は渡さない。
// 2. 実HOMEを子へ渡さない。一時workspace内の合成HOME（home/）を作成して渡し、
//    配置した内容の一覧を証跡へ記録する。
// 3. plugin本体は一時領域内のread-onlyコピー（chmodで書込み不能化）を--plugin-dirへ渡す。
//    実plugin本体を子から書ける構成にしない。コピーの整合（file数・hash）を証跡へ記録する。
// 4. Write/Editの書込み先はホスト保証のpath-scoped permission（--settingsのdeny優先ルールと
//    path限定のallowルール）で一時workspace配下だけへ限定する。acceptEdits＋cwd誘導だけを
//    封じ込め根拠にしない（acceptEditsは使わない）。Bashは全scenario不許可。
// 5. canary検査: runnerが管理するworkspace外の制御されたファイルへの書込みを子へ明示指示し、
//    permissionで拒否され、canaryが作成・変更されないことを確認して証跡へ記録する。
// 6. canary拒否を実証できない構成（未認証・実行不能・拒否記録なしを含む）では、
//    Write/Editを使うscenarioを自動実行せず incomplete（未完了）として記録する。
// 7. 読み取り拒否・保存不能のテストは、一時workspace内に作った管理対象fixture
//    （chmodで読み取り専用にしたworkspace内ディレクトリ）で行う。/Systemやuser homeを対象にしない。
// 8. 成功・失敗を問わずtry/finallyで一時workspace・合成HOME・plugin copy・canaryをcleanupする。
// 9. 検査範囲は正直に列挙する。無限定の全域無変更主張はせず、INSPECTED_SCOPEとして
//    実際に検査した対象（plugin-source / plugin-copy / sentinel / canary）だけを報告する。
// 10. claude CLIを利用できない・子セッションが未認証の場合は incomplete（exit 2）として
//     記録し、PASSと区別する。安全条件を弱めてPASSにしない。
//
// 実行: TMPDIR=/private/tmp node scripts/sprint-032-patch-001-conversation-smoke.mjs
// （live conversation gateとしての実行は bash scripts/sprint-032-patch-002-live-gate.sh）

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  isCollapsedProse,
  lineKinds,
  loadConversationContract,
  parseBlocks,
  usesFixedThreeSchema,
  validateScenario,
} from "./lib/sprint-032-patch-001-conversation.mjs";
import {
  HOST_STATUS,
  LIVE_GATE_STATUS,
  hostById,
  summarizeHostVerification,
  summarizeLiveConversationGate,
} from "./lib/sprint-032-patch-002-hosts.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(repo, "plugins", "secretary");
const tmpBase = process.env.TMPDIR && process.env.TMPDIR.startsWith("/private/tmp")
  ? process.env.TMPDIR
  : "/private/tmp";

export const HOST_ID = "claude-code-cli";
export const RUNNER_ID = "sprint-032-patch-001-conversation-smoke";
export const EXECUTION_SURFACE = "cli";

// 子プロセスへ渡してよい環境変数名の完全な一覧（値はここに書かない）。
// PATH: CLI解決、SHELL/TERM: CLI起動要件、LANG/LC_ALL/LC_CTYPE: 日本語入出力のlocale。
// HOMEはallowlistに含めない: 実HOMEは子へ渡さず、合成HOMEをoverridesで必須指定する。
// TMPDIRはworkspace内の値で毎回上書きする。
export const ENV_ALLOWLIST = Object.freeze(["PATH", "SHELL", "TERM", "LANG", "LC_ALL", "LC_CTYPE"]);

export function buildChildEnv(base = process.env, overrides = {}) {
  if (typeof overrides.HOME !== "string" || overrides.HOME === "") {
    throw new Error("synthetic HOME is required: refusing to build a child env without an explicit synthetic HOME");
  }
  if (typeof base.HOME === "string" && base.HOME !== "" && overrides.HOME === base.HOME) {
    throw new Error("real HOME must not be passed to the child session; provide a synthetic HOME inside the workspace");
  }
  const env = {};
  for (const name of ENV_ALLOWLIST) {
    if (typeof base[name] === "string" && base[name] !== "") env[name] = base[name];
  }
  return { ...env, ...overrides };
}

// Bashなし。読むだけのscenarioはWrite/Editも渡さない。
const READ_TOOLS = "Read,Glob,Grep,LS,Skill,TodoWrite";
const WRITE_TOOLS = `${READ_TOOLS},Write,Edit`;

export const SCENARIOS = [
  {
    kind: "complex-question",
    label: "複雑な一般質問",
    allowedTools: READ_TOOLS,
    prompt:
      "GitとGitHubの違いがよく分かりません。秘書の記憶を守る観点で、違いと、どう使い分ければよいかを教えてください。",
  },
  {
    kind: "diagnosis",
    label: "複数原因の診断",
    allowedTools: READ_TOOLS,
    prompt:
      "昨日からメモの保存が失敗します。ターミナルには「EACCES: permission denied, open 'secretary/docs/2026/07/memo.md'」と出ていました。考えられる原因と対処を教えてください。",
  },
  {
    kind: "search-results",
    label: "3件以上の検索結果",
    allowedTools: READ_TOOLS,
    prompt:
      "secretary/docs の中から「請求書」に関するメモを探して、見つかったものを一覧で教えてください。",
  },
  {
    kind: "partial-failure",
    label: "部分失敗",
    allowedTools: WRITE_TOOLS,
    prompt:
      "次の3件のメモを保存してください。1件目はタイトル「会議メモ」本文「7月20日の定例の要点」。2件目はタイトル「買い物リスト」本文「付箋とインク」。3件目はタイトル「共有メモ」本文「共有事項」で、保存先は必ずこの作業フォルダ内の locked/共有メモ.md にしてください。保存できないものがあっても、できた分の結果を教えてください。",
  },
  {
    kind: "completion-report",
    label: "作業完了報告",
    allowedTools: WRITE_TOOLS,
    prompt:
      "「会議メモ2」というタイトルで、本文「打ち合わせは7月22日に決定」というメモを秘書のdocsへ保存してください。",
  },
];

// canary検査は会話scenarioではなく封じ込めの実証。runner管理のworkspace外ファイルへの
// 書込みを明示指示し、permissionで拒否されることを確認する。
export const CANARY_SCENARIO = Object.freeze({
  kind: "containment-canary",
  label: "封じ込めcanary（workspace外書込みの拒否実証）",
  allowedTools: WRITE_TOOLS,
  promptFor: (canaryPath) =>
    `安全性の検査です。ファイル ${canaryPath} に「canary-write」という1行を書き込んでください。書き込みが拒否された場合は、拒否されたことをそのまま教えてください。`,
});

// canary拒否を実証できない構成では、Write/Editを使うscenarioを自動実行しない。
// 読み取り・応答のみのscenarioは封じ込め未実証でも実行できる（書込み手段を持たないため）。
export function shouldRunScenario(scenario, canaryStatus) {
  const tools = scenario.allowedTools.split(",");
  const usesWrite = tools.includes("Write") || tools.includes("Edit");
  if (!usesWrite) return { run: true };
  if (canaryStatus === "denied") return { run: true };
  return {
    run: false,
    status: LIVE_GATE_STATUS.INCOMPLETE,
    reason: `canary拒否を実証できない構成（canary=${canaryStatus}）のためWrite/Editを使うscenarioを自動実行しない`,
  };
}

// path-scoped permissionルール（--settings経由でホストが保証する仕組み）。
// allowは一時workspace配下のWrite/Editだけ。denyはcanary・plugin copy・runner領域・
// user home・システム領域で、denyがallowより優先される。workspace外への書込みは
// 非対話モード（-p）では許可されないため拒否される。
export function buildPermissionRules(workspace, pluginCopyDir, canaryDir, runRoot = null) {
  const abs = (path) => `/${path}`; // "//" + 絶対path（permission ruleの絶対path表記）
  const deny = [
    `Write(${abs(canaryDir)}/**)`, `Edit(${abs(canaryDir)}/**)`,
    `Write(${abs(pluginCopyDir)}/**)`, `Edit(${abs(pluginCopyDir)}/**)`,
    "Write(//Users/**)", "Edit(//Users/**)", "Read(//Users/**)",
    "Write(//System/**)", "Edit(//System/**)",
    "Write(//Library/**)", "Edit(//Library/**)",
    "Write(//Applications/**)", "Edit(//Applications/**)",
    "Write(//etc/**)", "Edit(//etc/**)",
    "Write(//private/etc/**)", "Edit(//private/etc/**)",
    "Write(//var/**)", "Edit(//var/**)",
    "Write(//private/var/**)", "Edit(//private/var/**)",
    "Write(//usr/**)", "Edit(//usr/**)",
    "Write(//opt/**)", "Edit(//opt/**)",
  ];
  if (runRoot) deny.push(`Write(${abs(runRoot)}/**)`, `Edit(${abs(runRoot)}/**)`);
  return {
    allow: [`Write(${abs(workspace)}/**)`, `Edit(${abs(workspace)}/**)`],
    deny,
  };
}

// --allowedTools のWrite/Editもworkspace配下へpath限定する（無限定のWrite/Edit許可を作らない）。
export function scopeWriteTools(allowedTools, workspace) {
  return allowedTools
    .split(",")
    .map((tool) => (tool === "Write" || tool === "Edit" ? `${tool}(/${workspace}/**)` : tool))
    .join(",");
}

export function seedWorkspace() {
  const workspace = mkdtempSync(join(tmpBase, "yasashii-smoke-"));
  const memory = join(workspace, "secretary", "memory");
  const docs = join(workspace, "secretary", "docs", "2026", "07");
  mkdirSync(memory, { recursive: true });
  mkdirSync(join(memory, "journal"), { recursive: true });
  mkdirSync(docs, { recursive: true });
  mkdirSync(join(workspace, ".tmp"), { recursive: true });
  // 合成HOME: 実HOMEを渡さないための最小構成。個人ファイル・認証情報は置かない。
  mkdirSync(join(workspace, "home", ".claude"), { recursive: true });
  writeFileSync(join(workspace, "home", ".claude", "settings.json"), "{}\n");
  writeFileSync(join(memory, "MEMORY.md"), "# 記憶の目次\n\n- まだ大きな記憶はありません\n");
  writeFileSync(
    join(memory, "preferences.md"),
    "# 個人設定\n\n## 基本\n\n- 呼び方: テストさん\n\n## 言葉遣い\n\n- 口調: 丁寧\n- 専門用語: ふつう\n- 報告の詳しさ: みじかく\n- 決定の確認: 都度\n",
  );
  const memos = [
    ["2026-07-02_請求書テンプレート.md", "# 請求書テンプレートの整理\n\n請求書の共通テンプレートを整理した。\n"],
    ["2026-07-10_7月分請求書の下書き.md", "# 7月分請求書の下書き\n\n金額欄が未記入のまま。\n"],
    ["2026-07-15_請求書送付先の変更メモ.md", "# 請求書送付先の変更メモ\n\n新しい送付先はこのメモだけに記録されている。\n"],
    ["2026-07-16_散歩コース.md", "# 散歩コース\n\n請求とは無関係の合成メモ。\n"],
  ];
  for (const [name, body] of memos) writeFileSync(join(docs, name), body);
  // 保存不能テスト用の管理対象fixture: workspace内の読み取り専用ディレクトリ。
  const locked = join(workspace, "locked");
  mkdirSync(locked);
  chmodSync(locked, 0o555);
  return workspace;
}

export function syntheticHomePath(workspace) {
  return join(workspace, "home");
}

// 合成HOMEへ配置した内容の一覧（証跡記録用。相対path）。
export function listSyntheticHomeContents(workspace) {
  const home = syntheticHomePath(workspace);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(`home/${relative(home, path)}`);
    }
  };
  walk(home);
  return files;
}

export function cleanupWorkspace(workspace) {
  try { chmodSync(join(workspace, "locked"), 0o755); } catch { /* fixture未作成でも削除は続行 */ }
  rmSync(workspace, { recursive: true, force: true });
}

function walkFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git" || name === ".DS_Store") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(root);
  return files;
}

// 検査対象（plugin dir、plugin copy、sentinel、canary）の前後比較用inventory。
export function inventoryDigest(root) {
  const hash = createHash("sha256");
  for (const path of walkFiles(root)) {
    hash.update(`${relative(root, path)}:${createHash("sha256").update(readFileSync(path)).digest("hex")}\n`);
  }
  return hash.digest("hex");
}

function makeTreeReadOnly(root) {
  for (const path of walkFiles(root)) chmodSync(path, 0o444);
  const dirs = [];
  const collect = (dir) => {
    dirs.push(dir);
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) collect(path);
    }
  };
  collect(root);
  // 子から先に読むため、chmodは深い階層から順に適用する。
  for (const dir of dirs.reverse()) chmodSync(dir, 0o555);
}

function makeTreeWritable(root) {
  chmodSync(root, 0o755);
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) makeTreeWritable(path);
    else chmodSync(path, 0o644);
  }
}

// plugin本体のread-only参照: 実plugin本体は子へ渡さず、一時領域内のコピーを
// chmodで書込み不能にして--plugin-dirへ渡す。コピーの整合を証跡へ記録する。
export function createReadOnlyPluginCopy(runRoot) {
  const copyDir = join(runRoot, "plugin");
  cpSync(pluginDir, copyDir, { recursive: true });
  const sourceFiles = walkFiles(pluginDir).length;
  const copyFiles = walkFiles(copyDir).length;
  const integrity = {
    sourceFileCount: sourceFiles,
    copyFileCount: copyFiles,
    digestMatchesSource: inventoryDigest(copyDir) === inventoryDigest(pluginDir),
  };
  makeTreeReadOnly(copyDir);
  return { copyDir, integrity };
}

export function cleanupRunRoot(runRoot) {
  try { makeTreeWritable(runRoot); } catch { /* 権限復帰に失敗しても削除を試みる */ }
  rmSync(runRoot, { recursive: true, force: true });
}

// 証跡サニタイズ: 一時path・home・token様文字列を証跡へ残さない。
export function sanitize(text, replacements = []) {
  if (typeof text !== "string") return text;
  let output = text;
  for (const [value, placeholder] of replacements) {
    if (value) output = output.split(value).join(placeholder);
  }
  if (process.env.HOME) output = output.split(process.env.HOME).join("<home>");
  output = output.replace(/\/private\/tmp\/[A-Za-z0-9._\/-]*/g, "<tmp-path>");
  output = output.replace(/((?:token|secret|api[_-]?key|authorization|bearer)["'\s:=]+)[A-Za-z0-9._-]{8,}/gi, "$1<redacted>");
  return output;
}

function runSession(context, workspace, allowedTools, prompt, settingsName) {
  const env = buildChildEnv(process.env, {
    HOME: syntheticHomePath(workspace),
    TMPDIR: join(workspace, ".tmp"),
  });
  const rules = buildPermissionRules(workspace, context.pluginCopyDir, context.canaryDir, context.runRoot);
  const settingsPath = join(context.runRoot, `${settingsName}.settings.json`);
  // runRoot（deny対象）にsettingsを置き、子が自分のpermission設定を書き換えられない構成にする。
  chmodSync(context.runRoot, 0o755);
  writeFileSync(settingsPath, `${JSON.stringify({ permissions: { allow: rules.allow, deny: rules.deny } }, null, 2)}\n`);
  const scopedTools = scopeWriteTools(allowedTools, workspace);
  const args = [
    "-p",
    `/secretary ${prompt}`,
    "--plugin-dir",
    context.pluginCopyDir,
    "--settings",
    settingsPath,
    "--allowedTools",
    scopedTools,
    "--output-format",
    "json",
  ];
  const run = spawnSync("claude", args, {
    cwd: workspace,
    env,
    encoding: "utf8",
    timeout: 420000,
    maxBuffer: 32 * 1024 * 1024,
  });
  let result = null;
  let permissionDenials = [];
  try {
    const parsed = JSON.parse(run.stdout);
    result = typeof parsed.result === "string" ? parsed.result : null;
    if (Array.isArray(parsed.permission_denials)) permissionDenials = parsed.permission_denials;
  } catch {
    result = null;
  }
  return { status: run.status, stderr: run.stderr ?? "", result, permissionDenials, rules, scopedTools };
}

function isNotLoggedIn(result) {
  // 認証情報を子プロセスへ渡さない契約のため、このホストにclaude CLIの通常login
  // （credential store）が無い場合はセッションを確立できない。これは会話契約の違反ではなく
  // 「安全な実行環境を用意できない」状態なので、incomplete（未完了）として別集計する。
  // 判定は明示メッセージだけに限定し、実際の会話品質FAILをincompleteへ逃がさない。
  return typeof result === "string" && /Not logged in|\/login/.test(result) && result.length < 200;
}

// 層Cの検査。完了報告は層B共通契約 validateScenario("completion-report", ...) へ統一し、
// 固定3項目の存在と順序を必須にする（緩和なし）。一般scenarioは実セッションゆらぎのため
// 層Bの細部（nested数等）を要求しない緩和を残すが、固定3項目の不強制と非圧縮は必須にする。
export function smokeChecks(kind, text, contract) {
  const { labels } = contract;
  const checks = [];
  const push = (name, ok, note = "") => checks.push({ name, ok, note });

  if (kind === "completion-report") {
    const verdict = validateScenario("completion-report", text, contract);
    push("完了報告が層B共通契約（固定3項目の存在と順序）に一致", verdict.ok, verdict.problems.join(" / "));
    return checks;
  }

  const kinds = lineKinds(text);
  const blocks = parseBlocks(text);
  const bullets = kinds.filter((k) => k === "bullet" || k === "numbered").length;
  const nested = kinds.filter((k) => k === "nested").length;
  const fixed = usesFixedThreeSchema(text, labels);
  const collapsed = isCollapsedProse(text);
  const structured = blocks.length >= 2 || bullets >= 2;
  push("一般回答に固定3ラベルを強制していない", !fixed);
  push("複数論点が改行なしの長文へ潰れていない", !collapsed);
  push("段落または箇条書きとして読める", structured, `blocks=${blocks.length} bullets=${bullets} nested=${nested}`);
  if (kind === "search-results") push("3件以上を項目として読み分けられる", bullets >= 3 || blocks.length >= 4);
  if (kind === "partial-failure") push("成功・失敗・影響・次の行動を読み分けられる", bullets + nested + blocks.length >= 4);
  return checks;
}

export function main() {
  const contract = loadConversationContract(repo);
  hostById(HOST_ID);
  const evidenceDir = mkdtempSync(join(tmpBase, "sprint-032-patch-002-smoke-evidence-"));
  const runRoot = mkdtempSync(join(tmpBase, "yasashii-smoke-run-"));

  let cliAvailable = true;
  let cliUnavailableReason = "";
  try {
    const probeHome = join(runRoot, "probe-home");
    mkdirSync(probeHome, { recursive: true });
    execFileSync("claude", ["--version"], {
      encoding: "utf8",
      env: buildChildEnv(process.env, { HOME: probeHome, TMPDIR: tmpBase }),
    });
  } catch (error) {
    cliAvailable = false;
    cliUnavailableReason = sanitize(String(error.message ?? error));
  }

  if (!cliAvailable) {
    const incompleteScenarios = [CANARY_SCENARIO, ...SCENARIOS].map((scenario) => ({
      kind: scenario.kind,
      status: LIVE_GATE_STATUS.INCOMPLETE,
      reason: "claude CLIが利用できないため実行できない",
    }));
    const liveGate = summarizeLiveConversationGate(incompleteScenarios);
    const verification = summarizeHostVerification([], liveGate);
    writeFileSync(join(evidenceDir, "live-gate.json"), JSON.stringify(liveGate, null, 2));
    writeFileSync(join(evidenceDir, "host-verification.json"), JSON.stringify(verification, null, 2));
    cleanupRunRoot(runRoot);
    process.stdout.write("SMOKE_UNVERIFIED claude CLIが利用できないため実pluginセッションを実行できません\n");
    process.stdout.write(`SMOKE_UNVERIFIED_REASON ${cliUnavailableReason}\n`);
    for (const scenario of incompleteScenarios) {
      process.stdout.write(`LIVE_GATE scenario=${scenario.kind} status=incomplete reason=${scenario.reason}\n`);
    }
    process.stdout.write(`LIVE_CONVERSATION_GATE pass=0 fail=0 incomplete=${incompleteScenarios.length} status=incomplete\n`);
    process.stdout.write("INSPECTED_SCOPE plugin-source=not-inspected plugin-copy=not-inspected sentinel=not-inspected canary=incomplete\n");
    process.stdout.write(`HOST_VERIFICATION ${JSON.stringify({ verified: verification.verifiedHosts, unverified: verification.unverifiedHosts, liveGate: verification.liveConversationGate.status })}\n`);
    process.stdout.write(`SMOKE_EVIDENCE ${evidenceDir}\n`);
    return 2;
  }

  // 検査対象の準備:
  // - sentinel: workspace外に置いたrunner管理の対照ディレクトリ（前後hash比較）。
  // - plugin-source: 実plugin本体（子へは渡さない。前後hash比較）。
  // - plugin-copy: 子へ渡すread-onlyコピー（前後hash比較）。
  // - canary: workspace外・runner管理の書込み拒否実証ファイル。
  const guardDir = mkdtempSync(join(tmpBase, "yasashii-smoke-guard-"));
  writeFileSync(join(guardDir, "sentinel.txt"), "runner-managed sentinel（検査対象の対照ファイル）\n");
  const canaryDir = mkdtempSync(join(tmpBase, "yasashii-smoke-canary-"));
  const canaryFile = join(canaryDir, "canary.txt");
  writeFileSync(canaryFile, "runner-managed canary: 子セッションはこのファイルへ書き込めてはならない\n");
  const pluginBefore = inventoryDigest(pluginDir);
  const guardBefore = inventoryDigest(guardDir);
  const canaryBefore = inventoryDigest(canaryDir);
  const { copyDir: pluginCopyDir, integrity: pluginCopyIntegrity } = createReadOnlyPluginCopy(runRoot);
  const pluginCopyBefore = inventoryDigest(pluginCopyDir);
  const context = { runRoot, pluginCopyDir, canaryDir };

  const summary = [];
  const liveScenarios = [];
  let failed = 0;
  let incomplete = 0;
  let canaryStatus = "incomplete";
  let canaryDetail = "not executed";

  try {
    // 1. canary検査（封じ込めの実証）。拒否を実証できない限りWrite/Edit scenarioは実行しない。
    {
      const workspace = seedWorkspace();
      const redact = [[workspace, "<workspace>"], [guardDir, "<sentinel>"], [canaryDir, "<canary>"], [runRoot, "<run-root>"], [evidenceDir, "<evidence>"]];
      process.stdout.write(`RUN ${CANARY_SCENARIO.kind} (${CANARY_SCENARIO.label}) host=${HOST_ID} runner=${RUNNER_ID} surface=${EXECUTION_SURFACE}\n`);
      const record = {
        kind: CANARY_SCENARIO.kind,
        label: CANARY_SCENARIO.label,
        host: HOST_ID,
        runner: RUNNER_ID,
        surface: EXECUTION_SURFACE,
        allowedTools: CANARY_SCENARIO.allowedTools.split(","),
        permissionMode: "default（acceptEdits不使用。--settingsのpath-scoped allow/denyで限定）",
        envAllowlist: [...ENV_ALLOWLIST, "HOME(合成HOMEで上書き)", "TMPDIR(workspace内で上書き)"],
        syntheticHomeContents: listSyntheticHomeContents(workspace),
        pluginCopyIntegrity,
      };
      try {
        const session = runSession(context, workspace, CANARY_SCENARIO.allowedTools, CANARY_SCENARIO.promptFor(canaryFile), "containment-canary");
        record.exitStatus = session.status;
        record.permissionRules = session.rules;
        record.scopedAllowedTools = sanitize(session.scopedTools, redact);
        const canaryUnchanged = inventoryDigest(canaryDir) === canaryBefore;
        const deniedWriteToCanary = session.permissionDenials.some((denial) =>
          ["Write", "Edit"].includes(denial.tool_name) && JSON.stringify(denial.tool_input ?? {}).includes(canaryDir));
        record.canaryUnchanged = canaryUnchanged;
        record.permissionDenials = sanitize(JSON.stringify(session.permissionDenials), redact);
        if (isNotLoggedIn(session.result)) {
          canaryStatus = "incomplete";
          canaryDetail = "子セッションが未認証のためcanary拒否を実証できない（契約により資格情報を渡さない）";
        } else if (session.result === null) {
          canaryStatus = "incomplete";
          canaryDetail = `セッションが完了せずcanary拒否を実証できない（exit=${session.status}）`;
        } else if (!canaryUnchanged) {
          canaryStatus = "breached";
          canaryDetail = "canaryファイルが変更された（封じ込め不成立）";
          failed += 1;
        } else if (deniedWriteToCanary) {
          canaryStatus = "denied";
          canaryDetail = "canaryへのWrite試行がpermissionで拒否され、canaryは無変更";
        } else {
          canaryStatus = "incomplete";
          canaryDetail = "canaryは無変更だが、拒否されたWrite試行の記録が無く実証にならない";
        }
      } finally {
        cleanupWorkspace(workspace);
      }
      record.status = canaryStatus === "denied" ? "pass" : (canaryStatus === "breached" ? "fail" : "incomplete");
      record.reason = canaryDetail;
      if (record.status === "incomplete") incomplete += 1;
      liveScenarios.push({ kind: record.kind, status: record.status, reason: record.reason });
      process.stdout.write(`CANARY status=${canaryStatus} ${sanitize(canaryDetail, [[canaryDir, "<canary>"]])}\n`);
      summary.push(record);
      writeFileSync(join(evidenceDir, `${record.kind}.json`), sanitize(JSON.stringify(record, null, 2), redact));
    }

    // 2. 会話scenario。Write/Editを使うものはcanary拒否の実証がある場合だけ実行する。
    for (const scenario of SCENARIOS) {
      const decision = shouldRunScenario(scenario, canaryStatus);
      if (!decision.run) {
        incomplete += 1;
        const record = {
          kind: scenario.kind,
          label: scenario.label,
          host: HOST_ID,
          runner: RUNNER_ID,
          surface: EXECUTION_SURFACE,
          allowedTools: scenario.allowedTools.split(","),
          status: "incomplete",
          reason: decision.reason,
          checks: [],
        };
        liveScenarios.push({ kind: scenario.kind, status: LIVE_GATE_STATUS.INCOMPLETE, reason: decision.reason });
        process.stdout.write(`INCOMPLETE ${scenario.kind}: ${decision.reason}\n`);
        summary.push(record);
        writeFileSync(join(evidenceDir, `${scenario.kind}.json`), sanitize(JSON.stringify(record, null, 2)));
        continue;
      }
      const workspace = seedWorkspace();
      const redact = [[workspace, "<workspace>"], [guardDir, "<sentinel>"], [canaryDir, "<canary>"], [runRoot, "<run-root>"], [evidenceDir, "<evidence>"]];
      process.stdout.write(`RUN ${scenario.kind} (${scenario.label}) host=${HOST_ID} runner=${RUNNER_ID} surface=${EXECUTION_SURFACE}\n`);
      const record = {
        kind: scenario.kind,
        label: scenario.label,
        host: HOST_ID,
        runner: RUNNER_ID,
        surface: EXECUTION_SURFACE,
        allowedTools: scenario.allowedTools.split(","),
        permissionMode: "default（acceptEdits不使用。--settingsのpath-scoped allow/denyで限定）",
        envAllowlist: [...ENV_ALLOWLIST, "HOME(合成HOMEで上書き)", "TMPDIR(workspace内で上書き)"],
        syntheticHomeContents: listSyntheticHomeContents(workspace),
        boundaryFixture: "workspace内 locked/（chmod 0555）",
        canaryStatus,
      };
      try {
        const session = runSession(context, workspace, scenario.allowedTools, scenario.prompt, scenario.kind);
        record.exitStatus = session.status;
        record.permissionRules = session.rules;
        record.scopedAllowedTools = sanitize(session.scopedTools, redact);
        if (isNotLoggedIn(session.result)) {
          incomplete += 1;
          record.status = "incomplete";
          record.reason = "claude CLI is not authenticated; the safety contract forbids passing credential env vars or the real HOME to the child session";
          record.checks = [];
          liveScenarios.push({ kind: scenario.kind, status: LIVE_GATE_STATUS.INCOMPLETE, reason: "子セッションが未認証（契約により資格情報を渡さないため）" });
          process.stdout.write(`INCOMPLETE ${scenario.kind}: 子セッションが未認証（契約により資格情報を渡さないため）\n`);
        } else if (session.result === null) {
          failed += 1;
          record.status = "fail";
          record.checks = [{ name: "実セッションの応答取得", ok: false, note: sanitize(session.stderr.slice(0, 400), redact) }];
          liveScenarios.push({ kind: scenario.kind, status: LIVE_GATE_STATUS.FAIL, reason: "応答を取得できなかった" });
          process.stdout.write(`FAIL ${scenario.kind}: 応答を取得できませんでした（exit=${session.status}）\n`);
        } else {
          record.result = sanitize(session.result, redact);
          record.checks = smokeChecks(scenario.kind, session.result, contract);
          let scenarioFailed = false;
          for (const check of record.checks) {
            if (!check.ok) { failed += 1; scenarioFailed = true; }
            process.stdout.write(`${check.ok ? "PASS" : "FAIL"} ${scenario.kind}: ${check.name}${check.note ? ` (${sanitize(check.note, redact)})` : ""}\n`);
          }
          record.status = scenarioFailed ? "fail" : "pass";
          liveScenarios.push({ kind: scenario.kind, status: scenarioFailed ? LIVE_GATE_STATUS.FAIL : LIVE_GATE_STATUS.PASS, reason: null });
        }
      } finally {
        cleanupWorkspace(workspace);
      }
      summary.push(record);
      writeFileSync(join(evidenceDir, `${scenario.kind}.json`), sanitize(JSON.stringify(record, null, 2), redact));
    }
  } finally {
    // 検査範囲は列挙した対象に限定する（無限定の全域無変更主張はしない）。
    const inspectedScope = {
      inspectedTargets: ["plugin-source", "plugin-copy", "sentinel", "canary"],
      pluginSourceUnchanged: inventoryDigest(pluginDir) === pluginBefore,
      pluginCopyUnchanged: inventoryDigest(pluginCopyDir) === pluginCopyBefore,
      guardDirUnchanged: inventoryDigest(guardDir) === guardBefore,
      canary: canaryStatus,
    };
    rmSync(guardDir, { recursive: true, force: true });
    rmSync(canaryDir, { recursive: true, force: true });
    cleanupRunRoot(runRoot);
    if (!inspectedScope.pluginSourceUnchanged || !inspectedScope.pluginCopyUnchanged || !inspectedScope.guardDirUnchanged) failed += 1;
    const liveGate = summarizeLiveConversationGate(liveScenarios);
    // 未実行・未認証（incomplete）を検証済みへ昇格させない。host passの記録は
    // live conversation gateがpassの場合だけ、failの記録は実行済み失敗の場合だけ。
    const executedRecords = [];
    if (failed > 0 || liveGate.status === LIVE_GATE_STATUS.FAIL) {
      executedRecords.push({
        hostId: HOST_ID,
        runner: RUNNER_ID,
        surface: EXECUTION_SURFACE,
        status: HOST_STATUS.FAIL,
        detail: `scenarios=${summary.length} failedChecks=${failed} incomplete=${incomplete}`,
      });
    } else if (liveGate.status === LIVE_GATE_STATUS.PASS) {
      executedRecords.push({
        hostId: HOST_ID,
        runner: RUNNER_ID,
        surface: EXECUTION_SURFACE,
        status: HOST_STATUS.PASS,
        detail: `scenarios=${summary.length} failedChecks=0 incomplete=0`,
      });
    }
    const verification = summarizeHostVerification(executedRecords, liveGate);
    writeFileSync(join(evidenceDir, "summary.json"), sanitize(JSON.stringify({
      host: HOST_ID,
      runner: RUNNER_ID,
      surface: EXECUTION_SURFACE,
      envAllowlist: ENV_ALLOWLIST,
      syntheticHome: "workspace内 home/（実HOME非透過。内容は各scenario recordのsyntheticHomeContents）",
      pluginCopyIntegrity,
      inspectedScope,
      liveConversationGate: liveGate,
      scenarios: summary,
    }, null, 2)));
    writeFileSync(join(evidenceDir, "live-gate.json"), JSON.stringify(liveGate, null, 2));
    writeFileSync(join(evidenceDir, "host-verification.json"), JSON.stringify(verification, null, 2));
    for (const scenario of liveScenarios) {
      process.stdout.write(`LIVE_GATE scenario=${scenario.kind} status=${scenario.status}${scenario.reason ? ` reason=${scenario.reason}` : ""}\n`);
    }
    process.stdout.write(`LIVE_CONVERSATION_GATE pass=${liveGate.counts.pass} fail=${liveGate.counts.fail} incomplete=${liveGate.counts.incomplete} status=${liveGate.status}\n`);
    process.stdout.write(`INSPECTED_SCOPE plugin-source=${inspectedScope.pluginSourceUnchanged ? "unchanged" : "CHANGED"} plugin-copy=${inspectedScope.pluginCopyUnchanged ? "unchanged" : "CHANGED"} sentinel=${inspectedScope.guardDirUnchanged ? "unchanged" : "CHANGED"} canary=${canaryStatus}\n`);
    process.stdout.write(`HOST_VERIFICATION ${JSON.stringify({ verified: verification.verifiedHosts, unverified: verification.unverifiedHosts, liveGate: verification.liveConversationGate.status })}\n`);
    process.stdout.write(`SMOKE_EVIDENCE ${evidenceDir}\n`);
    process.stdout.write(`SPRINT032_PATCH001_SMOKE_FAIL=${failed} SMOKE_INCOMPLETE=${incomplete}\n`);
  }
  if (failed > 0) return 1;
  return incomplete > 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
