#!/usr/bin/env node

// Sprint 032 Patch 002: 会話改善の完成・実会話回帰の安全化・ホスト非依存化の専用回帰。
//
// 検査対象:
// 1. 実会話runner（層C）の安全条件: env allowlist、Bashなし最小ツール、workspace内fixture、
//    /System・user home非参照、try/finally cleanup、サニタイズ。
// 2. wizard進捗の一貫性: フェーズ名つき系列、欠番なし、progress()強調と本文番号の一致（負fixture付き）。
// 3. serializer正本参照: 不在rule参照0件、所在誤記0件（負fixture付き）。
// 4. yasashii表示用語: ユーザー向け自然言語の `room` 残存0件（コード・識別子・inline codeは対象外）。
// 5. GitHub用語の初出説明と、yasashii固有説明のagentic表現面への非漏出。
// 6. 対応対象ホスト4環境と検証済みホストの別集計（1ホストPASSの昇格なし、負テスト付き）。
// 7. 共通会話validator・fixtureのホスト非依存（Claude固有command前提0件）。
//
// 実行: node scripts/sprint-032-patch-002-test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENV_ALLOWLIST,
  SCENARIOS,
  buildChildEnv,
  cleanupWorkspace,
  sanitize,
  seedWorkspace,
} from "./sprint-032-patch-001-conversation-smoke.mjs";
import {
  HOST_STATUS,
  SUPPORTED_HOSTS,
  summarizeHostVerification,
} from "./lib/sprint-032-patch-002-hosts.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(repo, "plugins", "secretary");
const rulesRoot = join(plugin, "rules");
const fixtureRoot = join(repo, "scripts", "fixtures", "sprint-032-patch-002");
const read = (path) => readFileSync(path, "utf8");

let pass = 0;
function check(label, test) {
  test();
  pass += 1;
  process.stdout.write(`PASS ${label}\n`);
}

function walk(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

// check-report-schema.py と同じ20 user-facing surface。
function userSurfaces() {
  return [
    ...walk(join(plugin, "skills")).filter((path) => path.endsWith("/SKILL.md")),
    join(plugin, "templates", "AGENTS.md"),
    join(plugin, "templates", "CLAUDE.md"),
    ...walk(join(plugin, "templates", "tones")).filter((path) => path.endsWith(".md")),
  ].sort();
}

// ----- 1. 実会話runnerの安全条件 -----

const runnerSource = read(join(repo, "scripts", "sprint-032-patch-001-conversation-smoke.mjs"));

check("runner: 子プロセスenvはallowlist方式で、合成credentialを注入しても渡らない", () => {
  const base = {
    PATH: "/usr/bin:/bin",
    HOME: "/tmp/synthetic-home",
    LANG: "ja_JP.UTF-8",
    GITHUB_TOKEN: "synthetic-github-token-value",
    GH_TOKEN: "synthetic-gh-token-value",
    CHATWORK_API_TOKEN: "synthetic-chatwork-token-value",
    GOOGLE_OAUTH_CLIENT_SECRET: "synthetic-google-secret-value",
    GOOGLE_APPLICATION_CREDENTIALS: "/tmp/creds.json",
    ANTHROPIC_API_KEY: "synthetic-api-key-value",
    AWS_SECRET_ACCESS_KEY: "synthetic-aws-secret-value",
    NPM_TOKEN: "synthetic-npm-token-value",
  };
  const env = buildChildEnv(base, { TMPDIR: "/private/tmp/example" });
  assert.deepEqual(Object.keys(env).sort(), ["HOME", "LANG", "PATH", "TMPDIR"].sort());
  const serialized = JSON.stringify(env);
  for (const value of ["synthetic-github-token-value", "synthetic-gh-token-value", "synthetic-chatwork-token-value", "synthetic-google-secret-value", "synthetic-api-key-value", "synthetic-aws-secret-value", "synthetic-npm-token-value", "creds.json"]) {
    assert(!serialized.includes(value), `credential leaked into child env: ${value}`);
  }
  for (const name of Object.keys(env)) {
    assert([...ENV_ALLOWLIST, "TMPDIR"].includes(name), `env name outside allowlist: ${name}`);
  }
  assert(!/env\s*=\s*\{\s*\.\.\.process\.env/.test(runnerSource), "runner must not spread process.env into child env");
});

check("runner: allowlist名に資格情報系の名前が含まれない", () => {
  for (const name of ENV_ALLOWLIST) {
    assert(!/TOKEN|SECRET|KEY|CREDENTIAL|PASSWORD|GH_|GITHUB|OAUTH/i.test(name), `credential-like env name in allowlist: ${name}`);
  }
});

check("runner: 全scenarioがBashなしの最小ツール許可で、許可一覧を証跡へ記録する", () => {
  assert.equal(SCENARIOS.length, 5);
  for (const scenario of SCENARIOS) {
    const tools = scenario.allowedTools.split(",");
    for (const banned of ["Bash", "WebFetch", "WebSearch", "NotebookEdit"]) {
      assert(!tools.includes(banned), `${scenario.kind} allows banned tool: ${banned}`);
    }
  }
  const readOnly = SCENARIOS.filter((scenario) => ["complex-question", "diagnosis", "search-results"].includes(scenario.kind));
  for (const scenario of readOnly) {
    const tools = scenario.allowedTools.split(",");
    assert(!tools.includes("Write") && !tools.includes("Edit"), `${scenario.kind} must be read-only`);
  }
  assert(runnerSource.includes("allowedTools: scenario.allowedTools.split(\",\")"), "allowed tools must be recorded in evidence");
});

check("runner: 境界テストは一時workspace内fixtureで、/Systemやuser homeを対象にしない", () => {
  for (const scenario of SCENARIOS) {
    assert(!scenario.prompt.includes("/System"), `${scenario.kind} prompt targets /System`);
    assert(!scenario.prompt.includes("/Users/"), `${scenario.kind} prompt targets an absolute user path`);
  }
  const partial = SCENARIOS.find((scenario) => scenario.kind === "partial-failure");
  assert(partial.prompt.includes("locked/"), "partial-failure must use the managed workspace fixture");
  assert(runnerSource.includes("chmodSync(locked, 0o555)"), "read-only fixture must be created inside the workspace");
});

check("runner: 成功・失敗問わずtry/finallyでworkspaceをcleanupし、外部変更0件検査を持つ", () => {
  assert(/try\s*\{[\s\S]*runSession[\s\S]*\}\s*finally\s*\{[\s\S]*cleanupWorkspace\(workspace\)/.test(runnerSource), "per-scenario cleanup must be in finally");
  assert(runnerSource.includes("inventoryDigest(pluginDir)"), "outside-workspace check must cover the plugin dir");
  assert(runnerSource.includes("guardDirUnchanged"), "outside-workspace check must cover the guard sentinel");
  const workspace = seedWorkspace();
  assert(existsSync(join(workspace, "locked")), "workspace fixture missing");
  cleanupWorkspace(workspace);
  assert(!existsSync(workspace), "workspace must be removed by cleanup");
});

check("runner: 証跡はサニタイズされ、home・一時path・token様文字列を残さない", () => {
  const home = process.env.HOME ?? "/tmp/example-home";
  const raw = `${home}/notes と /private/tmp/yasashii-smoke-abc123/file、token: abcdefgh12345678 を含む`;
  const clean = sanitize(raw);
  if (process.env.HOME) assert(!clean.includes(process.env.HOME), "home path must be redacted");
  assert(!clean.includes("yasashii-smoke-abc123"), "tmp path must be redacted");
  assert(!clean.includes("abcdefgh12345678"), "token-like value must be redacted");
});

check("runner: CLI不在はunverified（exit 2）としてPASSと別集計する", () => {
  assert(runnerSource.includes("SMOKE_UNVERIFIED"), "unverified marker missing");
  assert(runnerSource.includes("return 2;"), "unverified must exit with a distinct code");
  assert(runnerSource.includes("summarizeHostVerification([])"), "unverified run must not record any verified host");
});

// ----- 2. wizard進捗の一貫性 -----

const PROGRESS_SERIES = ["接続", "設定", "設定変更"];

export function checkWizardProgress(source) {
  const problems = [];
  const regex = /progress\((\d)\)|class="eyebrow">([^<]+?)</g;
  const series = new Map();
  let lastProgress = null;
  let match;
  while ((match = regex.exec(source))) {
    if (match[1] !== undefined) { lastProgress = Number(match[1]); continue; }
    const eyebrow = match[2].trim();
    const numbered = eyebrow.match(/^(\S+?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (!numbered) continue;
    const [, name, numText, totalText] = numbered;
    const number = Number(numText);
    const total = Number(totalText);
    if (!PROGRESS_SERIES.includes(name)) {
      problems.push(`フェーズ名のない、または未知の進捗系列: ${eyebrow}`);
      continue;
    }
    if (number < 1 || number > total) problems.push(`進捗番号が範囲外: ${eyebrow}`);
    const entry = series.get(name) ?? { total, numbers: new Set() };
    if (entry.total !== total) problems.push(`系列「${name}」の分母が揃っていない: ${eyebrow}`);
    entry.numbers.add(number);
    series.set(name, entry);
    const expected = name === "接続" ? 0 : number;
    if (lastProgress === null) problems.push(`progress()未設定のままの進捗表示: ${eyebrow}`);
    else if (lastProgress !== expected) problems.push(`progress(${lastProgress})の強調と本文「${eyebrow}」が不一致`);
  }
  for (const [name, entry] of series) {
    for (let index = 1; index <= entry.total; index += 1) {
      if (!entry.numbers.has(index)) problems.push(`系列「${name}」に欠番: ${index} / ${entry.total}`);
    }
  }
  return problems;
}

const chatworkWizard = read(join(plugin, "skills", "chatwork", "assets", "wizard", "app.js"));
const googleWizard = read(join(plugin, "skills", "google-chat", "assets", "wizard", "app.js"));

check("wizard: Chatworkの進捗系列が後戻り・欠番・強調不一致0件", () => {
  assert.deepEqual(checkWizardProgress(chatworkWizard), []);
  assert(!/class="eyebrow">STEP /.test(chatworkWizard), "generic STEP series must not remain");
  assert(chatworkWizard.includes("接続 1 / 4") && chatworkWizard.includes("接続 4 / 4"), "connection phase steps must remain");
  assert(chatworkWizard.includes("設定 1 / 4") && chatworkWizard.includes("設定 4 / 4"), "settings phase must be an explicit named series");
});

check("wizard: Google Chatの進捗系列が後戻り・欠番・強調不一致0件", () => {
  assert.deepEqual(checkWizardProgress(googleWizard), []);
  assert(!/class="eyebrow">STEP /.test(googleWizard), "generic STEP series must not remain");
  assert(googleWizard.includes("接続 1 / 3") && googleWizard.includes("接続 3 / 3"), "connection phase must be a complete /3 series");
  assert(!googleWizard.includes("接続 3 / 4"), "old mismatched connection numbering must not remain");
  assert(googleWizard.includes("設定 1 / 4") && googleWizard.includes("設定変更 1 / 3"), "settings phases must be explicit named series");
});

check("wizard: 進捗後戻り・欠番・不一致の負fixtureを検出する", () => {
  for (const name of ["wizard-progress-generic-step.js", "wizard-progress-gap.js", "wizard-progress-mismatch.js"]) {
    const problems = checkWizardProgress(read(join(fixtureRoot, name)));
    assert(problems.length >= 1, `${name} was not rejected`);
  }
});

check("wizard: 認証方式・OAuth scope・Secret名・CTA色は不変", () => {
  assert(chatworkWizard.includes("CHATWORK_API_TOKEN"), "Chatwork Secret name must remain");
  assert(googleWizard.includes("PKCE"), "Google OAuth mechanism description must remain");
  const common = read(join(plugin, "skills", "chatwork", "assets", "wizard", "common.js"));
  assert(common.includes("#F03747") && common.includes("#11BB62"), "primary CTA colors must remain");
});

// ----- 3. serializer正本参照 -----

export function checkSerializerReferences(text, ruleFiles) {
  const problems = [];
  if (/plain-language\.md`?\s*(?:の|にある)\s*「?最終応答serializer/.test(text)) {
    problems.push("serializerの所在をplain-language.mdと誤記している");
  }
  if (/同ruleの\s*「?最終応答serializer/.test(text)) {
    problems.push("serializerの所在を入口ruleと誤記している");
  }
  for (const match of text.matchAll(/rules\/([A-Za-z0-9_/-]+\.md)/g)) {
    if (!ruleFiles.has(match[1])) problems.push(`不在ruleへの参照: rules/${match[1]}`);
  }
  return problems;
}

const ruleFiles = new Set(
  walk(rulesRoot).filter((path) => path.endsWith(".md")).map((path) => relative(rulesRoot, path)),
);

check("serializer: 全surfaceの参照が実在正本へ解決でき、所在誤記0件", () => {
  const failures = userSurfaces().flatMap((path) =>
    checkSerializerReferences(read(path), ruleFiles).map((problem) => ({ path: relative(repo, path), problem })));
  assert.deepEqual(failures, []);
});

check("serializer: plain-language.mdは正本を複製しない明示的なshimで、内部linkが解決できる", () => {
  const shim = read(join(rulesRoot, "plain-language.md"));
  assert(shim.includes("互換入口"), "shim declaration missing");
  assert(shim.includes("正本を複製しない明示的な入口（shim）"), "explicit shim wording missing");
  assert(shim.includes("styles/yasashii.md"), "shim must point to the serializer owner");
  assert(!shim.includes("やったこと:"), "shim must not duplicate the serializer schema");
  for (const match of shim.matchAll(/\]\(([^)]+\.md)\)/g)) {
    assert(existsSync(join(rulesRoot, match[1])), `shim link unresolved: ${match[1]}`);
  }
  const style = read(join(rulesRoot, "styles", "yasashii.md"));
  assert(style.includes("最終応答serializer（通常報告の唯一の正本）"), "serializer owner declaration missing");
});

check("serializer: 不在参照・所在誤記の負fixtureを検出する", () => {
  const missing = checkSerializerReferences(read(join(fixtureRoot, "serializer-missing-rule.md")), ruleFiles);
  assert(missing.some((problem) => problem.includes("不在rule")), "missing-rule fixture was not rejected");
  const mislocated = checkSerializerReferences(read(join(fixtureRoot, "serializer-mislocated.md")), ruleFiles);
  assert(mislocated.some((problem) => problem.includes("所在")), "mislocated fixture was not rejected");
});

// ----- 4. yasashii表示用語: room -----

export function roomViolations(text) {
  const stripped = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
  return stripped
    .split(/\r?\n/)
    .flatMap((line, index) => (/\brooms?\b/i.test(line) ? [{ line: index + 1, text: line.trim() }] : []));
}

check("room: ユーザー向け自然言語のroom単独表記が0件（コード・識別子は対象外）", () => {
  const failures = userSurfaces().flatMap((path) =>
    roomViolations(read(path)).map((hit) => ({ path: relative(repo, path), ...hit })));
  assert.deepEqual(failures, []);
  assert(roomViolations("Chatworkのroomを選びたい").length === 1, "scanner must detect plain room wording");
  assert(roomViolations("`chatwork/rooms.json` を読む").length === 0, "identifiers in inline code must stay out of scope");
});

check("room: 導線文言はルーム表記になっている", () => {
  const router = read(join(plugin, "skills", "secretary", "SKILL.md"));
  assert(router.includes("「ルームを選びたい」") && router.includes("ルーム設定・履歴検索"));
  const onboarding = read(join(plugin, "skills", "onboarding", "SKILL.md"));
  assert(onboarding.includes("選択したルーム") && onboarding.includes("ルーム接続"));
});

// ----- 5. GitHub用語の初出説明とeditionの非漏出 -----

const GITHUB_REPO_EXPLANATION = "自分や許可した人だけが見られる非公開の保存場所";
const GITHUB_PUSH_EXPLANATION = "手元の変更をGitHubへ送る操作";

check("GitHub用語: onboardingが正式名称を残したまま初出の短い説明を持つ", () => {
  const onboarding = read(join(plugin, "skills", "onboarding", "SKILL.md"));
  assert(onboarding.includes("private GitHub repo"), "formal name must remain");
  assert(onboarding.includes(GITHUB_REPO_EXPLANATION), "private repo explanation missing");
  assert(onboarding.includes(GITHUB_PUSH_EXPLANATION), "push explanation missing");
  const explanationIndex = onboarding.indexOf(GITHUB_REPO_EXPLANATION);
  const firstMention = onboarding.indexOf("private GitHub repo");
  assert(explanationIndex - firstMention < 80 && explanationIndex > firstMention, "explanation must accompany the first mention");
});

check("GitHub用語: yasashii固有説明がagentic表現面（common core・editions正本）へ漏れない", () => {
  const agenticSurfaces = [
    join(rulesRoot, "common-language.md"),
    join(rulesRoot, "safety.md"),
    join(rulesRoot, "evidence.md"),
    join(repo, "docs", "spec", "editions.md"),
  ];
  for (const path of agenticSurfaces) {
    const text = read(path);
    assert(!text.includes(GITHUB_REPO_EXPLANATION), `yasashii explanation leaked into ${relative(repo, path)}`);
    assert(!text.includes(GITHUB_PUSH_EXPLANATION), `yasashii explanation leaked into ${relative(repo, path)}`);
  }
});

// ----- 6. 対応対象ホストと検証済みホストの別集計 -----

check("hosts: 正式対象は4環境で、対応対象と検証済みを別集計する", () => {
  assert.deepEqual(SUPPORTED_HOSTS.map((host) => host.id), [
    "claude-code-desktop-app", "claude-code-cli", "codex-app", "codex-cli",
  ]);
  const empty = summarizeHostVerification([]);
  assert.deepEqual(empty.verifiedHosts, []);
  assert.equal(empty.unverifiedHosts.length, 4);
  assert.equal(empty.allHostsVerified, false);
});

check("hosts: 1ホストPASSは全ホストPASSへ昇格しない（負テスト）", () => {
  const summary = summarizeHostVerification([
    { hostId: "claude-code-cli", runner: "sprint-032-patch-001-conversation-smoke", surface: "cli", status: HOST_STATUS.PASS },
  ]);
  assert.deepEqual(summary.verifiedHosts, ["claude-code-cli"]);
  assert.deepEqual(summary.unverifiedHosts, ["claude-code-desktop-app", "codex-app", "codex-cli"]);
  assert.equal(summary.allHostsVerified, false);
  for (const host of summary.hosts) {
    if (host.hostId !== "claude-code-cli") assert.notEqual(host.status, HOST_STATUS.PASS, `${host.hostId} must stay unverified`);
  }
});

check("hosts: 不正な昇格入力は拒否する", () => {
  assert.throws(() => summarizeHostVerification([{ hostId: "all-hosts", status: HOST_STATUS.PASS }]), /unknown host/);
  assert.throws(() => summarizeHostVerification([{ hostId: "codex-cli", status: "unverified" }]), /invalid executed-host status/);
  assert.throws(() => summarizeHostVerification([
    { hostId: "claude-code-cli", status: HOST_STATUS.PASS },
    { hostId: "claude-code-cli", status: HOST_STATUS.PASS },
  ]), /duplicate record/);
});

check("hosts: runner未実装のホストを推測実装せず、runnerはhost・runner・実行面を証跡へ記録する", () => {
  for (const host of SUPPORTED_HOSTS) {
    if (host.id !== "claude-code-cli") assert.equal(host.runner, null, `${host.id} must not claim an unimplemented runner`);
  }
  for (const marker of ["HOST_ID = \"claude-code-cli\"", "RUNNER_ID", "EXECUTION_SURFACE", "host-verification.json"]) {
    assert(runnerSource.includes(marker), `runner evidence marker missing: ${marker}`);
  }
});

// ----- 7. 共通validator・fixtureのホスト非依存 -----

check("host-neutral: 共通validatorと会話fixtureにClaude固有command前提が0件", () => {
  const shared = [join(repo, "scripts", "lib", "sprint-032-patch-001-conversation.mjs")];
  const conversations = walk(join(repo, "scripts", "fixtures", "sprint-032-patch-001", "conversations"));
  for (const path of [...shared, ...conversations]) {
    const text = read(path);
    for (const hostSpecific of ["/secretary ", "--plugin-dir", "claude ", "claude-code", "spawnSync"]) {
      assert(!text.includes(hostSpecific), `${relative(repo, path)} contains host-specific reference: ${hostSpecific}`);
    }
  }
});

check("host-neutral: 共通rulesにClaude固有commandが新規追加されていない", () => {
  for (const name of ["common-language.md", "safety.md", "evidence.md"]) {
    const text = read(join(rulesRoot, name));
    assert(!/claude\s+(?:-p|--plugin-dir)|--permission-mode/.test(text), `${name} contains Claude CLI invocation`);
  }
});

process.stdout.write(`SPRINT032_PATCH002_PASS=${pass} SPRINT032_PATCH002_FAIL=0\n`);
