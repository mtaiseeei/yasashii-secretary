#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyConversationMigration, planConversationMigration, rollbackConversationMigration,
} from "../plugins/secretary/scripts/lib/conversation-migration.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireWindows = process.argv.includes("--require-windows");
const oldSection = "## 会話契約 v1\n\n古い契約";
const marker = "<!-- agentic-secretary:conversation-contract:v2:start -->";
const endMarker = "<!-- agentic-secretary:conversation-contract:v2:end -->";
const newSection = `${marker}\n## 会話契約 v2\n\n新しい契約\n${endMarker}`;
const fingerprint = "0e613e03e15ae54da6660a4f694aafb66d3a0f9e37238909bf6d649c532efff6";
let pass = 0;
let fail = 0;

function check(label, action) {
  try { action(); pass += 1; console.log(`PASS ${label}`); }
  catch (error) { fail += 1; console.error(`FAIL ${label}: ${error.stack ?? error.message}`); }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function original(prefix = "利用者固有の前置き", suffix = "利用者固有の後書き") {
  return Buffer.from(`${prefix}\n\n${oldSection}\n\n${suffix}\n`, "utf8");
}

function planFor(bytes) {
  return planConversationMigration({
    body: bytes.toString("utf8"), oldSection, newSection, marker, endMarker, templateFingerprint: fingerprint,
  });
}

function migrationTemps(target) {
  const stem = `.${basename(target)}.conversation-migration`;
  return readdirSync(dirname(target)).filter((name) => name.startsWith(stem));
}

function makeTarget(sandbox, name = "AGENTS.md") {
  const parent = join(sandbox, "workspace 空白", "secretary", "日本語");
  mkdirSync(parent, { recursive: true });
  const target = join(parent, name);
  const before = original();
  writeFileSync(target, before);
  return { target, before };
}

const sandbox = mkdtempSync(join(tmpdir(), "sprint-038-patch-003 日本語-"));
try {
  console.log(`OS=${process.platform} arch=${process.arch} node=${process.version} root=${ROOT} sandbox=${sandbox}`);

  check("修正前のslash限定basenameはWindows absolute pathを混入させるnegative", () => {
    const windowsTarget = String.raw`C:\Users\利用者\workspace 空白\secretary\AGENTS.md`;
    const legacyName = windowsTarget.split("/").at(-1);
    assert.equal(legacyName, windowsTarget);
    assert.equal(win32.basename(windowsTarget), "AGENTS.md");
    assert.match(legacyName, /^[A-Za-z]:\\/u);
    assert.match(legacyName, /\\/u);
  });

  check("native sibling tempで通常applyし利用者bytesを保持する", () => {
    const { target, before } = makeTarget(sandbox, "通常 AGENTS.md");
    const result = applyConversationMigration({ target, plan: planFor(before), oldSection, newSection });
    const after = readFileSync(target);
    assert.equal(dirname(result.temporaryPath), dirname(target));
    assert.equal(
      basename(result.temporaryPath),
      `.${basename(target)}.conversation-migration-${process.pid}-0000000000000000`,
    );
    assert.equal(result.temporaryCreateAttempts, 1);
    assert.doesNotMatch(basename(result.temporaryPath), /[\\/]/u);
    assert.equal(existsSync(result.temporaryPath), false);
    assert.equal(after.toString("utf8").startsWith("利用者固有の前置き\n\n"), true);
    assert.equal(after.toString("utf8").endsWith("\n\n利用者固有の後書き\n"), true);
    assert.equal(after.toString("utf8").includes(oldSection), false);
    assert.equal(after.toString("utf8").includes(newSection), true);
    assert.equal(migrationTemps(target).length, 0);
  });

  check("現行candidate temp名とのEEXIST後は別owned tempで成功し開始前fileを保持する", () => {
    const { target, before } = makeTarget(sandbox, "collision AGENTS.md");
    const collisionTemp = join(
      dirname(target),
      `.${basename(target)}.conversation-migration-${process.pid}-0000000000000000`,
    );
    const canary = Buffer.from("開始前から存在する他者所有temp\n", "utf8");
    writeFileSync(collisionTemp, canary);
    const fixedTime = new Date("2020-03-04T05:06:07.000Z");
    utimesSync(collisionTemp, fixedTime, fixedTime);
    const canaryHash = digest(canary);
    const canaryMtime = statSync(collisionTemp).mtimeMs;
    const result = applyConversationMigration({ target, plan: planFor(before), oldSection, newSection });
    assert.equal(result.changed, true);
    assert.equal(result.temporaryCreateAttempts > 1, true, "openSync(wx)のEEXIST後にretryした");
    assert.notEqual(result.temporaryPath, collisionTemp);
    assert.match(basename(result.temporaryPath), /^\.collision AGENTS\.md\.conversation-migration-\d+-[a-f0-9]{16}$/u);
    assert.equal(existsSync(result.temporaryPath), false);
    assert.equal(digest(readFileSync(collisionTemp)), canaryHash);
    assert.equal(statSync(collisionTemp).mtimeMs, canaryMtime);
    assert.equal(existsSync(collisionTemp), true);
    assert.equal(planFor(readFileSync(target)).action, "already-applied");
    assert.equal(migrationTemps(target).filter((name) => name !== basename(collisionTemp)).length, 0);
    console.log(
      `EEXIST_RETRY_OBSERVED=true TEMP_CREATE_ATTEMPTS=${result.temporaryCreateAttempts} `
      + "CANARY_HASH_UNCHANGED=true CANARY_MTIME_UNCHANGED=true OWNED_TEMP_RESIDUAL=0",
    );
  });

  check("dry-runとownership conflictは対象・sibling・外部canaryを変更しない", () => {
    const { target, before } = makeTarget(sandbox, "dry-run AGENTS.md");
    const outside = join(sandbox, "outside-canary.txt");
    writeFileSync(outside, "outside unchanged\n");
    const siblingBefore = readdirSync(dirname(target)).sort();
    assert.equal(planFor(before).action, "change");
    assert.equal(digest(readFileSync(target)), digest(before));
    assert.deepEqual(readdirSync(dirname(target)).sort(), siblingBefore);
    for (const invalid of [
      Buffer.from(`片側marker\n${marker}\n`, "utf8"),
      Buffer.from(`${before.toString("utf8")}\n${oldSection}\n`, "utf8"),
      Buffer.from("ownership不明\n", "utf8"),
    ]) {
      writeFileSync(target, invalid);
      const targetBefore = readFileSync(target);
      assert.equal(planFor(targetBefore).action, "conflict");
      assert.deepEqual(readFileSync(target), targetBefore);
      assert.equal(migrationTemps(target).length, 0);
    }
    assert.equal(readFileSync(outside, "utf8"), "outside unchanged\n");
  });

  check("stale planはtempを作らず現在targetを再書込みしない", () => {
    const { target, before } = makeTarget(sandbox, "stale AGENTS.md");
    const plan = planFor(before);
    const changed = Buffer.from(`${before.toString("utf8")}dry-run後の利用者変更\n`, "utf8");
    writeFileSync(target, changed);
    const fixedTime = new Date("2020-01-02T03:04:05.000Z");
    utimesSync(target, fixedTime, fixedTime);
    const mtimeBefore = statSync(target).mtimeMs;
    assert.throws(() => applyConversationMigration({ target, plan, oldSection, newSection }), /migration-plan-stale/u);
    assert.deepEqual(readFileSync(target), changed);
    assert.equal(statSync(target).mtimeMs, mtimeBefore);
    assert.equal(migrationTemps(target).length, 0);
  });

  check("rename前failureは未変更targetをrollback再書込みせず所有tempだけ片付ける", () => {
    const { target, before } = makeTarget(sandbox, "before-failure AGENTS.md");
    const plan = planFor(before);
    const fixedTime = new Date("2020-02-03T04:05:06.000Z");
    utimesSync(target, fixedTime, fixedTime);
    const mtimeBefore = statSync(target).mtimeMs;
    assert.throws(
      () => applyConversationMigration({ target, plan, oldSection, newSection, simulateFailure: "before-rename" }),
      /simulated-before-rename/u,
    );
    assert.deepEqual(readFileSync(target), before);
    assert.equal(statSync(target).mtimeMs, mtimeBefore, "rename前targetは再書込みしない");
    assert.equal(migrationTemps(target).length, 0);
    const retried = applyConversationMigration({ target, plan, oldSection, newSection });
    assert.equal(retried.changed, true);
    assert.equal(planFor(readFileSync(target)).action, "already-applied");
    assert.equal(migrationTemps(target).length, 0);
  });

  check("rename後failureは元bytesをrollback siblingからatomic相当に復元してretryできる", () => {
    const { target, before } = makeTarget(sandbox, "after-failure AGENTS.md");
    const plan = planFor(before);
    let observed = null;
    assert.throws(
      () => applyConversationMigration({ target, plan, oldSection, newSection, simulateFailure: "after-rename" }),
      (error) => {
        observed = error.conversationMigration;
        return /simulated-after-rename/u.test(error.message);
      },
    );
    assert.deepEqual(readFileSync(target), before);
    assert.equal(observed.restoredHash, digest(before));
    assert.equal(dirname(observed.rollbackTemporaryPath), dirname(target));
    assert.match(basename(observed.rollbackTemporaryPath), /^\.after-failure AGENTS\.md\.conversation-migration-rollback-\d+-[a-f0-9]{16}$/u);
    assert.equal(existsSync(observed.rollbackTemporaryPath), false);
    assert.equal(migrationTemps(target).length, 0);
    applyConversationMigration({ target, plan, oldSection, newSection });
    const afterRetry = readFileSync(target);
    const rerunPlan = planFor(afterRetry);
    assert.equal(rerunPlan.action, "already-applied");
    const rerunHash = digest(afterRetry);
    const rerunMtime = statSync(target).mtimeMs;
    const rerun = applyConversationMigration({ target, plan: rerunPlan, oldSection, newSection });
    assert.equal(rerun.changed, false);
    assert.equal(rerun.temporaryPath, null);
    assert.equal(rerun.temporaryCreateAttempts, 0);
    assert.equal(digest(readFileSync(target)), rerunHash);
    assert.equal(statSync(target).mtimeMs, rerunMtime, "already-applied rerunはtarget write 0件");
    assert.equal(migrationTemps(target).length, 0);
  });

  check("明示rollbackも完成済みsibling tempから復元し開始前collisionを保持する", () => {
    const { target, before } = makeTarget(sandbox, "rollback AGENTS.md");
    const applied = applyConversationMigration({ target, plan: planFor(before), oldSection, newSection });
    const legacyRollback = join(dirname(target), `.${basename(target)}.conversation-migration-rollback-${process.pid}`);
    writeFileSync(legacyRollback, "開始前rollback canary\n");
    const result = rollbackConversationMigration(target, applied.before);
    assert.deepEqual(readFileSync(target), before);
    assert.equal(result.restoredHash, result.expectedHash);
    assert.equal(dirname(result.temporaryPath), dirname(target));
    assert.equal(existsSync(result.temporaryPath), false);
    assert.equal(readFileSync(legacyRollback, "utf8"), "開始前rollback canary\n");
  });

  check("Windows native実行面のpath特性を記録する", () => {
    if (process.platform !== "win32") {
      if (requireWindows) assert.fail("Windowsネイティブrunnerではありません");
      console.log("WINDOWS_NATIVE=NOT-RUN reason=local OS is not win32");
      return;
    }
    const { target, before } = makeTarget(sandbox, "Windows native AGENTS.md");
    assert.match(target, /^[A-Za-z]:\\/u);
    assert.match(target, /\\/u);
    assert.match(target, /workspace 空白/u);
    assert.match(target, /日本語/u);
    const result = applyConversationMigration({ target, plan: planFor(before), oldSection, newSection });
    assert.equal(dirname(result.temporaryPath), dirname(target));
    assert.doesNotMatch(basename(result.temporaryPath), /[\\/]/u);
    assert.equal(planFor(readFileSync(target)).action, "already-applied");
  });
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`SPRINT038_PATCH003_PASS=${pass} FAIL=${fail} OS=${process.platform} WINDOWS_NATIVE=${process.platform === "win32" ? "RUN" : "NOT-RUN"}`);
if (fail) process.exitCode = 1;
