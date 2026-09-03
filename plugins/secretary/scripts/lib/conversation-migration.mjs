import { createHash, randomBytes } from "node:crypto";
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const TEMP_CREATE_ATTEMPTS = 16;
const INITIAL_TEMP_NONCE = "0000000000000000";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function occurrences(body, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = body.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

export function planConversationMigration({ body, oldSection, newSection, marker, endMarker, templateFingerprint }) {
  const beforeHash = sha256(body);
  const oldHash = sha256(oldSection);
  const startCount = occurrences(body, marker);
  const endCount = occurrences(body, endMarker);
  if (startCount === 1 && endCount === 1 && body.indexOf(marker) < body.indexOf(endMarker)) {
    return { action: "already-applied", beforeHash, oldHash, templateFingerprint, conflict: null };
  }
  if (startCount !== 0 || endCount !== 0) {
    return { action: "conflict", beforeHash, oldHash, templateFingerprint, conflict: "marker-collision" };
  }
  const oldCount = occurrences(body, oldSection);
  if (oldCount !== 1) {
    return { action: "conflict", beforeHash, oldHash, templateFingerprint, conflict: oldCount === 0 ? "template-ownership-unverified" : "old-section-ambiguous" };
  }
  const after = body.replace(oldSection, newSection);
  return {
    action: "change",
    beforeHash,
    afterHash: sha256(after),
    oldHash,
    newHash: sha256(newSection),
    templateFingerprint,
    conflict: null,
  };
}

function createOwnedSiblingTemp(target, purpose) {
  const parent = dirname(target);
  const targetName = basename(target);
  for (let attempt = 0; attempt < TEMP_CREATE_ATTEMPTS; attempt += 1) {
    const nonce = attempt === 0 ? INITIAL_TEMP_NONCE : randomBytes(8).toString("hex");
    const path = join(parent, `.${targetName}.${purpose}-${process.pid}-${nonce}`);
    try {
      return { path, descriptor: openSync(path, "wx", 0o600), createAttempts: attempt + 1 };
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }
  }
  throw new Error("conversation-migration-temp-collision");
}

function closeOwnedTemp(owned) {
  if (owned.descriptor === null) return;
  closeSync(owned.descriptor);
  owned.descriptor = null;
}

function writeOwnedTemp(owned, bytes) {
  writeFileSync(owned.descriptor, bytes);
  fsyncSync(owned.descriptor);
  closeOwnedTemp(owned);
}

function cleanupOwnedTemp(owned) {
  let closeError = null;
  try { closeOwnedTemp(owned); } catch (error) { closeError = error; }
  let unlinkError = null;
  try { unlinkSync(owned.path); } catch (error) {
    if (error?.code !== "ENOENT") unlinkError = error;
  }
  if (closeError || unlinkError) {
    throw new AggregateError([closeError, unlinkError].filter(Boolean), "conversation-migration-temp-cleanup-failed");
  }
}

function atomicReplace(target, bytes, purpose) {
  const owned = createOwnedSiblingTemp(target, purpose);
  try {
    writeOwnedTemp(owned, bytes);
    renameSync(owned.path, target);
    return owned.path;
  } catch (error) {
    try {
      cleanupOwnedTemp(owned);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "conversation-migration-atomic-replace-failed");
    }
    throw error;
  }
}

export function applyConversationMigration({ target, plan, oldSection, newSection, simulateFailure = null }) {
  const before = readFileSync(target);
  const beforeHash = sha256(before);
  if (beforeHash !== plan.beforeHash) throw new Error("migration-plan-stale");
  if (plan.action === "already-applied") {
    return { changed: false, before, afterHash: beforeHash, temporaryPath: null, temporaryCreateAttempts: 0 };
  }
  if (plan.action !== "change") throw new Error("migration-plan-stale");
  const beforeText = before.toString("utf8");
  if (occurrences(beforeText, oldSection) !== 1) throw new Error("migration-ownership-changed");
  const after = Buffer.from(beforeText.replace(oldSection, newSection), "utf8");
  const owned = createOwnedSiblingTemp(target, "conversation-migration");
  let renamed = false;
  try {
    writeOwnedTemp(owned, after);
    if (simulateFailure === "before-rename") throw new Error("simulated-before-rename");
    renameSync(owned.path, target);
    renamed = true;
    if (simulateFailure === "after-rename") throw new Error("simulated-after-rename");
    return {
      changed: true,
      before,
      afterHash: sha256(after),
      temporaryPath: owned.path,
      temporaryCreateAttempts: owned.createAttempts,
    };
  } catch (error) {
    if (!renamed) {
      try {
        cleanupOwnedTemp(owned);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "conversation-migration-apply-cleanup-failed");
      }
      throw error;
    }
    try {
      const rollbackTemporaryPath = atomicReplace(target, before, "conversation-migration-rollback");
      error.conversationMigration = {
        temporaryPath: owned.path,
        rollbackTemporaryPath,
        restoredHash: sha256(readFileSync(target)),
      };
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "conversation-migration-rollback-failed");
    }
    throw error;
  }
}

export function rollbackConversationMigration(target, backup) {
  const temporaryPath = atomicReplace(target, backup, "conversation-migration-rollback");
  return { restoredHash: sha256(readFileSync(target)), expectedHash: sha256(backup), temporaryPath };
}
