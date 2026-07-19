import { join } from "node:path";
import { normalizeMessage, writeSpaceHistory } from "./history.mjs";
import { workingRoot, writeFileAtomicSafe } from "../../../scripts/lib/safe-fs.mjs";

function writeJson(root, path, value) {
  writeFileAtomicSafe(root, path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export async function initialGoogleChatSync({ root, selectedSpaceNames, spaces, client }) {
  root = workingRoot(root);
  const selected = [...new Set(selectedSpaceNames || [])];
  if (selected.length === 0) throw Object.assign(new Error("通常スペースを1件以上選んでください。"), { code: "space-required" });
  const candidates = new Map(spaces.filter((space) => space.spaceType === "SPACE").map((space) => [space.name, space]));
  if (selected.some((name) => !candidates.has(name))) throw Object.assign(new Error("選択候補にないスペースは取得できません。"), { code: "space-not-allowed" });
  const results = [];
  for (const name of selected) {
    const candidate = candidates.get(name);
    try {
      const verified = await client.getSpace(name);
      if (verified.spaceType !== "SPACE") throw Object.assign(new Error("DMまたはグループDMは取得できません。"), { code: "space-type-rejected" });
      const source = await client.listAllMessages(name);
      const normalized = [];
      for (const message of source) normalized.push(normalizeMessage(message, await client.displayName(message.sender?.name)));
      const files = writeSpaceHistory({ root, space: { name, displayName: verified.displayName || candidate.displayName || name }, messages: normalized });
      results.push({ name, displayName: verified.displayName || candidate.displayName || name, status: "success", messages: normalized.length, files: files.length });
    } catch (error) {
      results.push({ name, displayName: candidate.displayName || name, status: "failed", code: error.code || "fetch-failed", message: error.message });
    }
  }
  const status = results.every((item) => item.status === "success") ? "success" : results.some((item) => item.status === "success") ? "partial" : "failed";
  const state = { version: 1, status, completedAt: new Date().toISOString(), results };
  writeJson(root, join(root, "google-chat", "state", "sync.json"), state);
  return state;
}
