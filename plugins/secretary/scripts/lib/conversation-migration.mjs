import { createHash } from "node:crypto";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

export function applyConversationMigration({ target, plan, oldSection, newSection, simulateFailure = null }) {
  const before = readFileSync(target);
  if (sha256(before) !== plan.beforeHash || plan.action !== "change") throw new Error("migration-plan-stale");
  const beforeText = before.toString("utf8");
  if (occurrences(beforeText, oldSection) !== 1) throw new Error("migration-ownership-changed");
  const after = Buffer.from(beforeText.replace(oldSection, newSection), "utf8");
  const temp = join(dirname(target), `.${target.split("/").at(-1)}.conversation-migration-${process.pid}`);
  try {
    writeFileSync(temp, after, { mode: 0o600 });
    if (simulateFailure === "before-rename") throw new Error("simulated-before-rename");
    renameSync(temp, target);
    if (simulateFailure === "after-rename") throw new Error("simulated-after-rename");
    return { changed: true, before, afterHash: sha256(after) };
  } catch (error) {
    try { unlinkSync(temp); } catch { /* rename済み、または未作成 */ }
    writeFileSync(target, before);
    throw error;
  }
}

export function rollbackConversationMigration(target, backup) {
  writeFileSync(target, backup);
  return { restoredHash: sha256(readFileSync(target)), expectedHash: sha256(backup) };
}
