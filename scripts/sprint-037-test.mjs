#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync,
  rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyNameCandidate, collectNameCandidates, normalizeNameCandidate, unicodeCaseFoldKey,
} from "../plugins/secretary/scripts/name-candidates.mjs";
import { updateOwnerName } from "../plugins/secretary/scripts/owner-name-transaction.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS: ${label}`);
  } catch (error) {
    fail += 1;
    console.error(`FAIL: ${label}: ${error.message}`);
  }
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

check("NFKC・前後空白・連続空白を正規化", () => {
  assert.equal(normalizeNameCandidate("  Ａｌｅｘ　 Example  "), "Alex Example");
});

check("host→Git→OSの優先順、重複排除、おすすめ1件", () => {
  const result = collectNameCandidates({
    selection: "account-name",
    hostTaskContext: {
      currentConversationName: " 青空　みらい ",
      personalizationPreferredName: "青空 みらい",
      projectUserName: "Alex Example",
      memoryName: "Memory Person",
    },
    providers: { readGitUserName: () => "Git Person", readOsUserName: () => "Os Person" },
  });
  assert.deepEqual(result.candidates.map(({ value, sourceLabel }) => [value, sourceLabel]), [
    ["青空 みらい", "現在の会話"],
    ["Alex Example", "Project"],
    ["Memory Person", "現在タスクの記憶"],
    ["Git Person", "Gitの表示名"],
    ["Os Person", "OSのユーザー名"],
  ]);
  assert.equal(result.candidates.filter((item) => item.recommended).length, 1);
  assert.equal(result.candidates[0].recommended, true);
});

check("Unicode case-fold同値は上位sourceの1候補へ統合", () => {
  assert.equal(unicodeCaseFoldKey("Straße"), unicodeCaseFoldKey("STRASSE"));
  assert.equal(unicodeCaseFoldKey("ẞ"), unicodeCaseFoldKey("ss"));
  assert.equal(unicodeCaseFoldKey("ὈΔΥΣΣΕΎΣ"), unicodeCaseFoldKey("ὀδυσσεύς"));
  assert.equal(unicodeCaseFoldKey("Ꭰ"), unicodeCaseFoldKey("ꭰ"));
  assert.notEqual(unicodeCaseFoldKey("ı"), unicodeCaseFoldKey("i"));
  const result = collectNameCandidates({
    selection: "account-name",
    hostTaskContext: {
      currentConversationName: "Straße",
      personalizationPreferredName: "STRASSE",
    },
    providers: { readGitUserName: () => "", readOsUserName: () => "" },
  });
  assert.deepEqual(result.candidates.map(({ value, sourceLabel }) => [value, sourceLabel]), [
    ["Straße", "現在の会話"],
  ]);
});

check("host差があっても同じ順でbest effort", () => {
  const result = collectNameCandidates({
    selection: "account-name",
    hostTaskContext: { personalizationPreferredName: "Alex Example" },
    providers: { readGitUserName: () => "", readOsUserName: () => "青空みらい" },
  });
  assert.deepEqual(result.candidates.map((item) => item.value), ["Alex Example", "青空みらい"]);
});

check("取得できないsourceはエラーにせず次へ進む", () => {
  const result = collectNameCandidates({
    selection: "account-name",
    providers: {
      readGitUserName: () => { throw new Error("git unavailable"); },
      readOsUserName: () => "Alex Example",
    },
  });
  assert.deepEqual(result.candidates.map((item) => item.value), ["Alex Example"]);
});

check("アカウント名以外ではproviderを読まない", () => {
  let calls = 0;
  for (const selection of ["you", "specified-name", "other", undefined]) {
    const result = collectNameCandidates({
      selection,
      providers: {
        readGitUserName: () => { calls += 1; return "Git Person"; },
        readOsUserName: () => { calls += 1; return "Os Person"; },
      },
    });
    assert.equal(result.available, false);
  }
  assert.equal(calls, 0);
});

check("全除外規則とOS letter条件", () => {
  const rejected = [
    ["", "host-task-context"], ["person@example.com", "host-task-context"],
    ["bot", "host-task-context"], ["CI", "host-task-context"], ["root", "host-task-context"],
    ["admin", "host-task-context"], ["user", "host-task-context"], ["unknown", "host-task-context"],
    ["12345A", "host-task-context"], ["あ".repeat(41), "host-task-context"],
    ["/Users/example/private", "host-task-context"],
    ["550e8400-e29b-41d4-a716-446655440000", "host-task-context"],
    ["0123456789abcdef", "host-task-context"], ["host.example.com", "host-task-context"],
    ["device.jp", "os-user-name"], ["server.jp", "os-user-name"],
    ["pc.localhost", "os-user-name"], ["localhost", "os-user-name"],
    ["github_pat_1234567890abcdef", "host-task-context"],
    ["runner-build-1234", "host-task-context"], ["1234", "os-user-name"],
  ];
  for (const [value, source] of rejected) {
    assert.equal(classifyNameCandidate(value, { source }).accepted, false, value);
  }
  for (const value of ["青空みらい", "Alex Example"]) {
    assert.equal(classifyNameCandidate(value, { source: "os-user-name" }).accepted, true, value);
  }
  assert.equal(classifyNameCandidate("J. Smith", { source: "os-user-name" }).accepted, true);
});

check("候補0件は利用不能で架空候補を作らない", () => {
  const result = collectNameCandidates({
    selection: "account-name",
    hostTaskContext: { currentConversationName: "root" },
    providers: { readGitUserName: () => "ci", readOsUserName: () => "1234" },
  });
  assert.deepEqual(result, { available: false, candidates: [], providerCalls: { git: 1, os: 1 } });
});

check("探索は永続化せず任意会話・session探索APIを持たない", () => {
  const directory = mkdtempSync(join(tmpdir(), "sprint-037-exploration-"));
  try {
    const before = readdirSync(directory);
    collectNameCandidates({
      selection: "account-name",
      hostTaskContext: { currentConversationName: "Synthetic Current" },
      providers: { readGitUserName: () => "Synthetic Git", readOsUserName: () => "Synthetic OS" },
    });
    assert.deepEqual(readdirSync(directory), before);
    const source = readFileSync(join(ROOT, "plugins/secretary/scripts/name-candidates.mjs"), "utf8");
    assert.doesNotMatch(source, /(?:read_thread|list_threads|session[_-]?log|transcript|memory[_-]?store)/iu);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

check("共通Skillは4経路・重複しないその他・保存前別turn確認を規定", () => {
  const onboarding = readFileSync(join(ROOT, "plugins/secretary/skills/onboarding/SKILL.md"), "utf8");
  const settings = readFileSync(join(ROOT, "plugins/secretary/skills/settings/SKILL.md"), "utf8");
  for (const choice of ["あなた", "アカウント名", "指定の名前", "その他"]) assert.match(onboarding, new RegExp(choice, "u"));
  assert.match(onboarding, /host UIが「その他」を自動で付ける場合[\s\S]*重複させない/u);
  assert.match(onboarding, /ステップ2より前の別turn/u);
  assert.match(onboarding, /保存する呼び方/u);
  assert.match(onboarding, /保存確認未完了なら副作用0件/u);
  assert.match(settings, /name-candidates\.mjs/u);
  assert.match(settings, /owner-name-transaction\.mjs/u);
});

function makeWorkspace() {
  const repo = mkdtempSync(join(tmpdir(), "sprint-037-"));
  const secretary = join(repo, "secretary");
  mkdirSync(join(secretary, "memory", "decisions"), { recursive: true });
  mkdirSync(join(secretary, "memory", "journal"), { recursive: true });
  writeFileSync(join(secretary, "AGENTS.md"), "# 秘書\n\n## オーナー情報\n- 呼び方: 旧名\n- 手書き: 保持\n\n## プロジェクト\n- open: projects/open\n- closed: projects/closed\n");
  writeFileSync(join(secretary, "memory", "preferences.md"), "# 好み\n\n## 基本\n- 呼び方: 旧名\n- お仕事・役割: 講師\n\n## 言葉遣い\n- 報告の詳しさ: みじかく\n");
  writeFileSync(join(secretary, "memory", "MEMORY.md"), "# MEMORY\n\n## オーナーの基本\n- 呼び方: 旧名\n- 手書き: 保持\n\n## 記録の目次\n\n- [既存](topics/existing.md)\n");
  writeFileSync(join(secretary, "memory", "decisions", "2026-01-01-decisions.md"), "初回の呼び方: 旧名\n");
  git(repo, "init", "-q");
  git(repo, "config", "user.name", "Synthetic Tester");
  git(repo, "config", "user.email", "synthetic@example.invalid");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "初期fixture");
  return { repo, secretary };
}

function activeName(path, section) {
  const text = readFileSync(path, "utf8");
  const block = text.split(`## ${section}`)[1]?.split("\n## ")[0] || "";
  return block.match(/^- 呼び方: (.+)$/mu)?.[1];
}

check("3正本だけに値を保存し、journal・commitは項目名だけを各1件記録", () => {
  const cases = [
    {
      input: " 青空　みらい ",
      normalized: "青空 みらい",
      fragments: ["青空", "みらい", "青空　みらい"],
    },
    {
      input: " 例名 =: \"Q\" `B` $() ${X} *_[M]_ ",
      normalized: "例名 =: \"Q\" `B` $() ${X} *_[M]_",
      fragments: ["例名", "\"Q\"", "`B`", "$()", "${X}", "*_[M]_"],
    },
  ];
  for (const fixture of cases) {
    const { repo, secretary } = makeWorkspace();
    try {
      const decision = readFileSync(join(secretary, "memory", "decisions", "2026-01-01-decisions.md"));
      const beforeCommits = Number(git(repo, "rev-list", "--count", "HEAD"));
      updateOwnerName({
        secretaryRoot: secretary,
        name: fixture.input,
        now: "2026-07-24T09:30:00+09:00",
      });
      assert.equal(activeName(join(secretary, "memory", "preferences.md"), "基本"), fixture.normalized);
      assert.equal(activeName(join(secretary, "AGENTS.md"), "オーナー情報"), fixture.normalized);
      assert.equal(activeName(join(secretary, "memory", "MEMORY.md"), "オーナーの基本"), fixture.normalized);
      assert.match(readFileSync(join(secretary, "AGENTS.md"), "utf8"), /projects\/open[\s\S]*projects\/closed/u);
      assert.deepEqual(readFileSync(join(secretary, "memory", "decisions", "2026-01-01-decisions.md")), decision);

      const journal = readFileSync(join(secretary, "memory", "journal", "2026-07-24.md"), "utf8");
      const journalEvents = journal.split("\n").filter((line) => line.includes("[did]"));
      const subject = git(repo, "log", "-1", "--format=%s");
      const body = git(repo, "log", "-1", "--format=%b");
      assert.deepEqual(journalEvents, ["- 09:30 [did] 設定を変更: 呼び方"]);
      assert.equal(subject, "設定を変更（呼び方）");
      assert.equal(body, "");
      const valueDerived = [
        JSON.stringify(fixture.normalized),
        encodeURIComponent(fixture.normalized),
        Buffer.from(fixture.normalized).toString("base64"),
        createHash("sha256").update(fixture.normalized).digest("hex"),
      ];
      for (const forbidden of [
        fixture.input.trim(), fixture.normalized, ...fixture.fragments, ...valueDerived,
      ]) {
        assert.equal(journalEvents[0].includes(forbidden), false, `journalに入力断片が残っています: ${forbidden}`);
        assert.equal(subject.includes(forbidden), false, `commit subjectに入力断片が残っています: ${forbidden}`);
        assert.equal(body.includes(forbidden), false, `commit bodyに入力断片が残っています: ${forbidden}`);
      }

      assert.equal(Number(git(repo, "rev-list", "--count", "HEAD")), beforeCommits + 1);
      assert.equal(git(repo, "remote"), "");
      assert.equal(git(repo, "status", "--porcelain"), "");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }
});

check("5失敗点は3正本・journal・HEAD・index・working treeをrollback", () => {
  for (const failAt of ["before-write-1", "before-write-2", "before-write-3", "before-journal", "before-commit"]) {
    const { repo, secretary } = makeWorkspace();
    try {
      const paths = [
        join(secretary, "memory", "preferences.md"),
        join(secretary, "AGENTS.md"),
        join(secretary, "memory", "MEMORY.md"),
        join(secretary, "memory", "decisions", "2026-01-01-decisions.md"),
      ];
      const before = paths.map((path) => readFileSync(path));
      const head = git(repo, "rev-parse", "HEAD");
      const index = git(repo, "diff", "--cached", "--binary");
      const workingTree = git(repo, "status", "--porcelain=v1");
      assert.throws(() => updateOwnerName({
        secretaryRoot: secretary,
        name: "例名 =: \"Q\" `B` $() ${X} *_[M]_",
        now: "2026-07-24T09:30:00+09:00",
        failAt,
      }));
      paths.forEach((path, index_) => assert.deepEqual(readFileSync(path), before[index_]));
      assert.equal(existsSync(join(secretary, "memory", "journal", "2026-07-24.md")), false);
      assert.equal(existsSync(join(secretary, "memory", "journal")), true);
      assert.equal(git(repo, "rev-parse", "HEAD"), head);
      assert.equal(git(repo, "diff", "--cached", "--binary"), index);
      assert.equal(git(repo, "status", "--porcelain=v1"), workingTree);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }
});

check("symlinkと空値を副作用なしで拒否", () => {
  const { repo, secretary } = makeWorkspace();
  const outside = join(repo, "outside.md");
  try {
    assert.throws(() => updateOwnerName({ secretaryRoot: secretary, name: " " }));
    writeFileSync(outside, "outside\n");
    rmSync(join(secretary, "memory", "preferences.md"));
    symlinkSync(outside, join(secretary, "memory", "preferences.md"));
    const head = git(repo, "rev-parse", "HEAD");
    assert.throws(() => updateOwnerName({ secretaryRoot: secretary, name: "Alex Example" }));
    assert.equal(readFileSync(outside, "utf8"), "outside\n");
    assert.equal(git(repo, "rev-parse", "HEAD"), head);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

const ACTIVE_ROOTS = [
  "README.md", ".claude-plugin", ".agents/plugins", "adapters", "plugins/secretary",
  "CLAUDE.md", "docs/spec.md", "docs/spec", "docs/DESIGN.md",
  "docs/yasashii-upstream-mapping.md", "docs/guide", "scripts",
];
const EXCLUDED = [
  /^docs\/sprints\//u, /^docs\/progress\//u, /^docs\/feedback\//u,
  /^docs\/evidence\//u, /^docs\/proposal-.*\.md$/u,
  // 検出器と合成の負fixture自身。active製品面とは別に下で必ず検出力を検査する。
  /^scripts\/sprint-037-test\.mjs$/u,
];
const OWNER_COUNTS = new Map(Object.entries({
  ".claude-plugin/marketplace.json": 2, "CLAUDE.md": 2, "README.md": 9,
  "docs/DESIGN.md": 9, "docs/guide/getting-started.md": 1, "docs/spec.md": 2,
  "docs/spec/constraints.md": 11, "docs/spec/domain.md": 7, "docs/spec/editions.md": 4,
  "docs/spec/features.md": 5, "docs/spec/product.md": 3, "docs/spec/rubric.md": 3,
  "docs/yasashii-upstream-mapping.md": 4, "plugins/secretary/.claude-plugin/plugin.json": 3,
  "plugins/secretary/.codex-plugin/plugin.json": 6, "plugins/secretary/edition.json": 4,
  "plugins/secretary/skills/build/SKILL.md": 5, "scripts/archive-release-gate.mjs": 2,
  "scripts/check-release-integrity.py": 2, "scripts/check-yasashii-harness-online.sh": 1,
  "scripts/check-yasashii-harness-reference.py": 3,
  "scripts/fixtures/yasashii-harness/claude-marketplace-good.json": 1,
  "scripts/fixtures/yasashii-harness/claude-marketplace-mismatch.json": 1,
  "scripts/fixtures/yasashii-harness/claude-plugin-good.json": 2,
  "scripts/fixtures/yasashii-harness/codex-plugin-good.json": 2,
  "scripts/fixtures/yasashii-harness/metadata-overrides-good.json": 5,
  "scripts/fixtures/yasashii-harness/repo-good.json": 2, "scripts/master-release-gate.mjs": 2,
  "scripts/regression-check.sh": 2, "scripts/sprint-012-patch-001-regression.sh": 1,
  "scripts/sprint-014-regression.sh": 1, "scripts/sprint-025-regression.sh": 1,
  "scripts/sprint-026-release-gate-test.mjs": 5, "scripts/sprint-034-test.mjs": 1,
  "scripts/sprint-035-test.mjs": 2, "scripts/sprint-038-patch-001-test.mjs": 2,
  "scripts/sprint-038-patch-002-test.mjs": 1, "scripts/sync-secretary-overlay.mjs": 4,
}));

function filesUnder(path) {
  if (!existsSync(path)) return [];
  if (lstatSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => filesUnder(join(path, entry.name)));
}

function scanText(path, text) {
  const matches = [];
  for (const regex of [
    /(?:Taisei Murayama|村山汰成|村山さん|たいせいさん)/gu,
    /\/Users\/(?!synthetic-real-home(?:\/|$))(?=[A-Za-z0-9._-]+\/)[A-Za-z0-9._-]+\/[^\s"'`]*/gu,
    /(?:agentic-secretary-my-vault|\bmy-vault\b)/gu,
  ]) {
    for (const match of text.matchAll(regex)) {
      if (regex.source.includes("my-vault")) {
        const lineStart = text.lastIndexOf("\n", match.index) + 1;
        const nextBreak = text.indexOf("\n", match.index);
        const line = text.slice(lineStart, nextBreak < 0 ? text.length : nextBreak);
        if (/(?:対象外|(?:write|書込み)(?:は)?0件|対応済み(?:と|とも)?(?:は)?(?:誤)?表示しない|対応済み.*表示しない)/u.test(line)) continue;
      }
      matches.push(match[0]);
    }
  }
  return matches;
}

check("active surface scanは固定allowlist一致・unexpected 0・負fixture検出", () => {
  const paths = [...new Set(ACTIVE_ROOTS.flatMap((item) => filesUnder(join(ROOT, item)))
    .map((path) => relative(ROOT, path).split("\\").join("/"))
    .filter((path) => !EXCLUDED.some((regex) => regex.test(path))))].sort();
  const unexpected = [];
  const ownerCounts = new Map();
  const syntheticPathCounts = new Map();
  for (const path of paths) {
    const buffer = readFileSync(join(ROOT, path));
    if (buffer.includes(0)) continue;
    const text = buffer.toString("utf8");
    for (const match of scanText(path, text)) unexpected.push({ path, match });
    const owner = ["mta", "iseeei"].join("");
    const ownerCount = text.split(owner).length - 1;
    if (ownerCount) ownerCounts.set(path, ownerCount);
    const synthetic = (text.match(/\/Users\/synthetic-real-home/gu) || []).length;
    const generic = (text.match(/\/\/Users\/\*\*/gu) || []).length;
    if (synthetic || generic) syntheticPathCounts.set(path, { synthetic, generic });
  }
  assert.deepEqual(Object.fromEntries(ownerCounts), Object.fromEntries(OWNER_COUNTS));
  assert.deepEqual(Object.fromEntries(syntheticPathCounts), {
    "scripts/sprint-032-patch-001-conversation-smoke.mjs": { synthetic: 0, generic: 3 },
    "scripts/sprint-032-patch-002-test.mjs": { synthetic: 2, generic: 3 },
  });
  assert.deepEqual(unexpected, []);
  const negativeFixture = [
    "/Users/example-person/private-workspace/file.md",
    "村山さん",
    "agentic-secretary-my-vault",
  ].join("\n");
  assert.equal(scanText("synthetic-negative-fixture.txt", negativeFixture).length, 3);
  console.log(`SCAN: ${JSON.stringify({
    population: paths.length,
    excluded: EXCLUDED.map(String),
    allowlistFiles: OWNER_COUNTS.size + 2,
    unexpected: unexpected.length,
    negativeFixtureDetected: 3,
  })}`);
});

console.log(`RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exitCode = 1;
