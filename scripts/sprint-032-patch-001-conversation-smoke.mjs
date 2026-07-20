#!/usr/bin/env node

// Sprint 032 Patch 001/002 層C: 実pluginセッションのsmoke test（host固有runner）。
//
// host: Claude Code CLI（claude-code-cli）。この層だけがhost固有であり、
// 会話契約の検査は共通validator（scripts/lib/sprint-032-patch-001-conversation.mjs）に委ねる。
// 対応対象ホスト4環境と検証済みホストの別集計は scripts/lib/sprint-032-patch-002-hosts.mjs が正本。
// このrunnerの結果は「Claude Code CLI実行面の証拠」だけを構成し、他ホストへ昇格しない。
//
// 安全契約（sprint-032-patch-002）:
// 1. 子プロセスenvはallowlist方式。process.env全体を複製せず、起動必須の変数だけを渡す。
//    認証情報・APIキー・*_TOKEN・*_SECRET・GH_*／GITHUB_*・Google認証情報は渡さない。
// 2. Bashは許可しない。scenarioごとの最小ツールだけを許可し、証跡へ記録する。
// 3. 読み取り拒否・保存不能のテストは、一時workspace内に作った管理対象fixture
//    （chmodで読み取り専用にしたworkspace内ディレクトリ）で行う。/Systemやuser homeを対象にしない。
// 4. cwdは一時workspaceに固定し、TMPDIRもworkspace内へ向ける。
// 5. 成功・失敗を問わずtry/finallyで一時workspaceを削除する。
// 6. 証跡はサニタイズ済み構造化結果だけをTMPDIR配下のevidence dirへ保存する。
// 7. 実行前後でplugin dirとguard sentinel（workspace外の管理対象）が無変更であることを検査する。
// 8. claude CLIを利用できない場合は unverified（exit 2）として記録し、PASSと区別する。
//
// 実行: TMPDIR=/private/tmp node scripts/sprint-032-patch-001-conversation-smoke.mjs

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
import { HOST_STATUS, hostById, summarizeHostVerification } from "./lib/sprint-032-patch-002-hosts.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(repo, "plugins", "secretary");
const tmpBase = process.env.TMPDIR && process.env.TMPDIR.startsWith("/private/tmp")
  ? process.env.TMPDIR
  : "/private/tmp";

export const HOST_ID = "claude-code-cli";
export const RUNNER_ID = "sprint-032-patch-001-conversation-smoke";
export const EXECUTION_SURFACE = "cli";

// 子プロセスへ渡してよい環境変数名の完全な一覧（値はここに書かない）。
// PATH: CLI解決、HOME: Claude CLIの設定・認証読込、SHELL/TERM: CLI起動要件、
// LANG/LC_ALL/LC_CTYPE: 日本語入出力のlocale。TMPDIRはworkspace内の値で毎回上書きする。
export const ENV_ALLOWLIST = Object.freeze(["PATH", "HOME", "SHELL", "TERM", "LANG", "LC_ALL", "LC_CTYPE"]);

export function buildChildEnv(base = process.env, overrides = {}) {
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

export function seedWorkspace() {
  const workspace = mkdtempSync(join(tmpBase, "yasashii-smoke-"));
  const memory = join(workspace, "secretary", "memory");
  const docs = join(workspace, "secretary", "docs", "2026", "07");
  mkdirSync(memory, { recursive: true });
  mkdirSync(join(memory, "journal"), { recursive: true });
  mkdirSync(docs, { recursive: true });
  mkdirSync(join(workspace, ".tmp"), { recursive: true });
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

export function cleanupWorkspace(workspace) {
  try { chmodSync(join(workspace, "locked"), 0o755); } catch { /* fixture未作成でも削除は続行 */ }
  rmSync(workspace, { recursive: true, force: true });
}

// workspace外の管理対象（plugin dir、guard sentinel）の前後比較用inventory。
export function inventoryDigest(root) {
  const hash = createHash("sha256");
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git" || name === ".DS_Store") continue;
      const path = join(dir, name);
      const stats = statSync(path);
      if (stats.isDirectory()) walk(path);
      else hash.update(`${relative(root, path)}:${createHash("sha256").update(readFileSync(path)).digest("hex")}\n`);
    }
  };
  walk(root);
  return hash.digest("hex");
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

function runSession(workspace, scenario) {
  const env = buildChildEnv(process.env, { TMPDIR: join(workspace, ".tmp") });
  const args = [
    "-p",
    `/secretary ${scenario.prompt}`,
    "--plugin-dir",
    pluginDir,
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    scenario.allowedTools,
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
  try {
    const parsed = JSON.parse(run.stdout);
    result = typeof parsed.result === "string" ? parsed.result : null;
  } catch {
    result = null;
  }
  return { status: run.status, stderr: run.stderr ?? "", result };
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
  const host = hostById(HOST_ID);
  const evidenceDir = mkdtempSync(join(tmpBase, "sprint-032-patch-002-smoke-evidence-"));

  let cliAvailable = true;
  let cliUnavailableReason = "";
  try {
    execFileSync("claude", ["--version"], { encoding: "utf8", env: buildChildEnv(process.env, { TMPDIR: tmpBase }) });
  } catch (error) {
    cliAvailable = false;
    cliUnavailableReason = sanitize(String(error.message ?? error));
  }

  if (!cliAvailable) {
    const verification = summarizeHostVerification([]);
    writeFileSync(join(evidenceDir, "host-verification.json"), JSON.stringify(verification, null, 2));
    process.stdout.write("SMOKE_UNVERIFIED claude CLIが利用できないため実pluginセッションを実行できません\n");
    process.stdout.write(`SMOKE_UNVERIFIED_REASON ${cliUnavailableReason}\n`);
    process.stdout.write(`HOST_VERIFICATION ${JSON.stringify({ verified: verification.verifiedHosts, unverified: verification.unverifiedHosts })}\n`);
    process.stdout.write(`SMOKE_EVIDENCE ${evidenceDir}\n`);
    return 2;
  }

  // workspace外の管理対象を前後比較する: plugin dirと、workspace外に置いたguard sentinel。
  const guardDir = mkdtempSync(join(tmpBase, "yasashii-smoke-guard-"));
  writeFileSync(join(guardDir, "sentinel.txt"), "outside-workspace guard sentinel\n");
  const pluginBefore = inventoryDigest(pluginDir);
  const guardBefore = inventoryDigest(guardDir);

  const summary = [];
  let failed = 0;
  let unverified = 0;

  try {
    for (const scenario of SCENARIOS) {
      const workspace = seedWorkspace();
      const redact = [[workspace, "<workspace>"], [guardDir, "<guard>"], [evidenceDir, "<evidence>"]];
      process.stdout.write(`RUN ${scenario.kind} (${scenario.label}) host=${HOST_ID} runner=${RUNNER_ID} surface=${EXECUTION_SURFACE}\n`);
      const record = {
        kind: scenario.kind,
        label: scenario.label,
        host: HOST_ID,
        runner: RUNNER_ID,
        surface: EXECUTION_SURFACE,
        allowedTools: scenario.allowedTools.split(","),
        permissionMode: "acceptEdits",
        envAllowlist: [...ENV_ALLOWLIST, "TMPDIR(workspace内で上書き)"],
        boundaryFixture: "workspace内 locked/（chmod 0555）",
      };
      try {
        const session = runSession(workspace, scenario);
        record.exitStatus = session.status;
        // 認証情報を子プロセスへ渡さない契約のため、このホストにclaude CLIの
        // 通常login（credential store）が無い場合はセッションを確立できない。
        // これは会話契約の違反ではなく「安全な実行環境を用意できない」状態なので、
        // PASSにもFAILにも数えず unverified として別集計する。
        const notLoggedIn = typeof session.result === "string" && /Not logged in|\/login/.test(session.result) && session.result.length < 200;
        if (notLoggedIn) {
          unverified += 1;
          record.status = "unverified";
          record.reason = "claude CLI is not authenticated; the safety contract forbids passing credential env vars to the child session";
          record.checks = [];
          process.stdout.write(`UNVERIFIED ${scenario.kind}: 子セッションが未認証（契約により資格情報を渡さないため）\n`);
        } else if (session.result === null) {
          failed += 1;
          record.checks = [{ name: "実セッションの応答取得", ok: false, note: sanitize(session.stderr.slice(0, 400), redact) }];
          process.stdout.write(`FAIL ${scenario.kind}: 応答を取得できませんでした（exit=${session.status}）\n`);
        } else {
          record.result = sanitize(session.result, redact);
          record.checks = smokeChecks(scenario.kind, session.result, contract);
          for (const check of record.checks) {
            if (!check.ok) failed += 1;
            process.stdout.write(`${check.ok ? "PASS" : "FAIL"} ${scenario.kind}: ${check.name}${check.note ? ` (${sanitize(check.note, redact)})` : ""}\n`);
          }
        }
      } finally {
        cleanupWorkspace(workspace);
      }
      summary.push(record);
      writeFileSync(join(evidenceDir, `${scenario.kind}.json`), JSON.stringify(record, null, 2));
    }
  } finally {
    const outsideCheck = {
      pluginDirUnchanged: inventoryDigest(pluginDir) === pluginBefore,
      guardDirUnchanged: inventoryDigest(guardDir) === guardBefore,
    };
    rmSync(guardDir, { recursive: true, force: true });
    if (!outsideCheck.pluginDirUnchanged || !outsideCheck.guardDirUnchanged) failed += 1;
    // unverified scenarioが1件でも残る限り、このホストを検証済み（pass）へ数えない。
    const executedRecords = failed === 0 && unverified > 0
      ? []
      : [{
          hostId: HOST_ID,
          runner: RUNNER_ID,
          surface: EXECUTION_SURFACE,
          status: failed === 0 ? HOST_STATUS.PASS : HOST_STATUS.FAIL,
          detail: `scenarios=${summary.length} failedChecks=${failed} unverified=${unverified}`,
        }];
    const verification = summarizeHostVerification(executedRecords);
    writeFileSync(join(evidenceDir, "summary.json"), JSON.stringify({
      host: HOST_ID,
      runner: RUNNER_ID,
      surface: EXECUTION_SURFACE,
      envAllowlist: ENV_ALLOWLIST,
      outsideWorkspaceCheck: outsideCheck,
      scenarios: summary,
    }, null, 2));
    writeFileSync(join(evidenceDir, "host-verification.json"), JSON.stringify(verification, null, 2));
    process.stdout.write(`OUTSIDE_WORKSPACE_CHECK plugin=${outsideCheck.pluginDirUnchanged ? "unchanged" : "CHANGED"} guard=${outsideCheck.guardDirUnchanged ? "unchanged" : "CHANGED"}\n`);
    process.stdout.write(`HOST_VERIFICATION ${JSON.stringify({ verified: verification.verifiedHosts, unverified: verification.unverifiedHosts })}\n`);
    process.stdout.write(`SMOKE_EVIDENCE ${evidenceDir}\n`);
    process.stdout.write(`SPRINT032_PATCH001_SMOKE_FAIL=${failed} SMOKE_UNVERIFIED=${unverified}\n`);
  }
  if (failed > 0) return 1;
  return unverified > 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main());
}
