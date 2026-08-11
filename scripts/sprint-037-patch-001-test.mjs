#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { updateOwnerName as updateAgenticOwnerName } from "../plugins/secretary/scripts/owner-name-transaction.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const JOURNAL_TEXT = "設定を変更: 呼び方";
const COMMIT_SUBJECT = "設定を変更（呼び方）";
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
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeWorkspace(prefix) {
  const repo = mkdtempSync(join(tmpdir(), prefix));
  const secretary = join(repo, "secretary");
  mkdirSync(join(secretary, "memory", "decisions"), { recursive: true });
  mkdirSync(join(secretary, "memory", "journal"), { recursive: true });
  writeFileSync(join(secretary, "AGENTS.md"), "# 秘書\n\n## オーナー情報\n- 呼び方: 旧名\n- 手書き: 保持\n\n## プロジェクト\n- open: projects/open\n- closed: projects/closed\n");
  writeFileSync(join(secretary, "memory", "preferences.md"), "# 好み\n\n## 基本\n- 呼び方: 旧名\n- お仕事・役割: 講師\n");
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
  return block.match(/^- 呼び方: (.+)$/mu)?.[1]?.trimEnd();
}

const candidateRoot = mkdtempSync(join(tmpdir(), "sprint-037-patch-001-downstream-"));
try {
  const agenticPlugin = join(ROOT, "plugins", "secretary");
  const downstreamPlugin = join(candidateRoot, "plugins", "secretary");
  cpSync(agenticPlugin, downstreamPlugin, { recursive: true, preserveTimestamps: true });

  const relativeScript = join("scripts", "owner-name-transaction.mjs");
  const agenticScript = join(agenticPlugin, relativeScript);
  const downstreamScript = join(downstreamPlugin, relativeScript);
  const agenticBytes = readFileSync(agenticScript);
  const downstreamBytes = readFileSync(downstreamScript);

  check("一時downstreamの共通transactionはAgentic candidateとbyte一致", () => {
    assert.deepEqual(downstreamBytes, agenticBytes);
  });
  check("一時downstreamの共通transactionはAgentic candidateとSHA-256一致", () => {
    assert.equal(sha256(downstreamBytes), sha256(agenticBytes));
    console.log(`SHA256: ${sha256(agenticBytes)} bytes=${agenticBytes.length}`);
  });
  check("共通transactionにedition別分岐がない", () => {
    assert.doesNotMatch(agenticBytes.toString("utf8"), /\b(?:agentic|yasashii|edition)\b/iu);
  });

  const downstreamModule = await import(`${pathToFileURL(downstreamScript).href}?candidate=patch-001`);
  const fixture = {
    input: " 例名　=: \"Q\" `B` $() ${X} *_[M]_ ",
    normalized: "例名 =: \"Q\" `B` $() ${X} *_[M]_",
    fragments: ["例名", "\"Q\"", "`B`", "$()", "${X}", "*_[M]_"],
  };
  for (const [label, updateOwnerName] of [
    ["Agentic", updateAgenticOwnerName],
    ["一時downstream", downstreamModule.updateOwnerName],
  ]) {
    check(`${label}は値を3正本だけへ保存し履歴メタデータへ再掲しない`, () => {
      const { repo, secretary } = makeWorkspace(`sprint-037-patch-001-${label}-`);
      try {
        const activePaths = [
          join(secretary, "memory", "preferences.md"),
          join(secretary, "AGENTS.md"),
          join(secretary, "memory", "MEMORY.md"),
        ];
        for (const path of activePaths) {
          const crlf = readFileSync(path, "utf8").replace(/\r?\n/gu, "\r\n");
          writeFileSync(path, crlf, "utf8");
        }
        git(repo, "add", ".");
        git(repo, "commit", "-q", "-m", "CRLF fixture");
        const decisionPath = join(secretary, "memory", "decisions", "2026-01-01-decisions.md");
        const decision = readFileSync(decisionPath);
        const beforeCommits = Number(git(repo, "rev-list", "--count", "HEAD"));
        updateOwnerName({
          secretaryRoot: secretary,
          name: fixture.input,
          now: "2026-07-24T09:30:00+09:00",
        });

        assert.equal(activeName(join(secretary, "memory", "preferences.md"), "基本"), fixture.normalized);
        assert.equal(activeName(join(secretary, "AGENTS.md"), "オーナー情報"), fixture.normalized);
        assert.equal(activeName(join(secretary, "memory", "MEMORY.md"), "オーナーの基本"), fixture.normalized);
        for (const path of activePaths.slice(0, 2)) {
          assert.doesNotMatch(readFileSync(path, "utf8"), /(^|[^\r])\n/u, `${path} のCRLFを維持する`);
        }
        assert.deepEqual(readFileSync(decisionPath), decision);
        assert.match(readFileSync(join(secretary, "AGENTS.md"), "utf8"), /projects\/open[\s\S]*projects\/closed/u);

        const journal = readFileSync(join(secretary, "memory", "journal", "2026-07-24.md"), "utf8");
        const events = journal.split("\n").filter((line) => line.includes("[did]"));
        const subject = git(repo, "log", "-1", "--format=%s");
        const body = git(repo, "log", "-1", "--format=%b");
        assert.deepEqual(events, [`- 09:30 [did] ${JOURNAL_TEXT}`]);
        assert.equal(subject, COMMIT_SUBJECT);
        assert.equal(body, "");
        const valueDerived = [
          JSON.stringify(fixture.normalized),
          encodeURIComponent(fixture.normalized),
          Buffer.from(fixture.normalized).toString("base64"),
          sha256(Buffer.from(fixture.normalized)),
        ];
        for (const forbidden of [
          fixture.input.trim(), fixture.normalized, ...fixture.fragments, ...valueDerived,
        ]) {
          assert.equal(events[0].includes(forbidden), false, `journalに入力断片が残っています: ${forbidden}`);
          assert.equal(subject.includes(forbidden), false, `commit subjectに入力断片が残っています: ${forbidden}`);
          assert.equal(body.includes(forbidden), false, `commit bodyに入力断片が残っています: ${forbidden}`);
        }

        assert.equal(Number(git(repo, "rev-list", "--count", "HEAD")), beforeCommits + 1);
        assert.equal(git(repo, "remote"), "");
        assert.equal(git(repo, "status", "--porcelain"), "");
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    });
  }
} finally {
  rmSync(candidateRoot, { recursive: true, force: true });
}

console.log(`RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exitCode = 1;
