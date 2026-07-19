import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeWritePath, workingRoot, writeFileAtomicSafe } from "./runtime-safety.mjs";

function partsInTokyo(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function tokyoDate(value) {
  const part = partsInTokyo(value);
  return `${part.year}-${part.month}-${part.day}`;
}

function tokyoTime(value) {
  const part = partsInTokyo(value);
  return `${part.hour}:${part.minute}`;
}

export function safeSegment(value) {
  return String(value).normalize("NFKC").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "space";
}

function senderFallback(message) {
  const resource = message.sender?.name || message.sender?.type || "unknown";
  const suffix = String(resource).split("/").pop().slice(-8) || "unknown";
  return `Google Chatユーザー ${suffix}`;
}

export function normalizeMessage(message, displayName) {
  const name = String(message.name || "");
  if (!/^spaces\/[^/]+\/messages\/[^/]+$/.test(name)) throw new Error("message resource nameを確認できません。");
  const attachments = (message.attachment || message.attachments || []).map((item) => ({
    name: item.contentName || item.name || "名称なし",
    type: item.contentType || "種類不明",
    source: item.source || "Google Chat",
    reference: item.attachmentDataRef?.resourceName || item.driveDataRef?.driveFileId || "参照先なし",
  }));
  const deleted = Boolean(message.deletionMetadata);
  return {
    name,
    createTime: message.createTime || message.lastUpdateTime || new Date(0).toISOString(),
    updateTime: message.lastUpdateTime || message.createTime || null,
    sender: displayName || senderFallback(message),
    thread: message.thread?.name || null,
    text: deleted ? "" : String(message.text || message.formattedText || ""),
    attachments,
    deleted,
    deletionType: message.deletionMetadata?.deletionType || null,
  };
}

function messageBlock(message) {
  const encoded = Buffer.from(message.name).toString("base64url");
  const lines = [
    `<!-- google-chat-message:${encoded} created:${message.createTime} -->`,
    `## [${tokyoTime(message.createTime)}] ${message.sender}`,
    "",
    message.deleted ? `削除済みメッセージ（${message.deletionType || "削除情報あり"}）` : (message.text || "（本文なし）"),
  ];
  if (message.thread) lines.push("", `- スレッド: \`${message.thread}\``);
  for (const attachment of message.attachments) {
    lines.push("", `- 添付メタデータ: ${attachment.name} / ${attachment.type} / ${attachment.source} / ${attachment.reference}`);
  }
  lines.push("", "<!-- /google-chat-message -->");
  return lines.join("\n");
}

function existingBlocks(source) {
  const blocks = new Map();
  const pattern = /<!-- google-chat-message:([A-Za-z0-9_-]+) created:([^ ]+) -->[\s\S]*?<!-- \/google-chat-message -->/g;
  for (const match of source.matchAll(pattern)) {
    try { blocks.set(Buffer.from(match[1], "base64url").toString(), { created: match[2], body: match[0] }); } catch { /* 壊れたmarkerは無視 */ }
  }
  return blocks;
}

export function writeSpaceHistory({ root, space, messages }) {
  const rootPath = workingRoot(root);
  const byDate = new Map();
  for (const message of messages) {
    const date = tokyoDate(message.createTime);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(message);
  }
  const files = [];
  for (const [date, dayMessages] of byDate) {
    const directory = join(rootPath, "google-chat", "history", `${safeSegment(space.displayName)}--${safeSegment(space.name.split("/").pop())}`);
    const path = safeWritePath(rootPath, join(directory, `${date}.md`));
    let previous = "";
    try { previous = readFileSync(path, "utf8"); } catch { /* 新規 */ }
    const blocks = existingBlocks(previous);
    for (const message of dayMessages) blocks.set(message.name, { created: message.createTime, body: messageBlock(message) });
    const content = [...blocks.values()].sort((a, b) => a.created.localeCompare(b.created)).map((item) => item.body).join("\n\n---\n\n");
    writeFileAtomicSafe(rootPath, path, `# ${space.displayName} - ${date}\n\n- source: Google Chat\n- space: \`${space.name}\`\n- timezone: Asia/Tokyo\n\n${content}\n`, { mode: 0o600 });
    files.push(path);
  }
  return files;
}
