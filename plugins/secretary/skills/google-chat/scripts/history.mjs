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

function normalizedTimestamp(value, field) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error(`${field}を確認できません。`);
  return date.toISOString();
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
  const createTime = normalizedTimestamp(message.createTime || message.lastUpdateTime || new Date(0).toISOString(), "message createTime");
  const updateTime = message.lastUpdateTime || message.createTime
    ? normalizedTimestamp(message.lastUpdateTime || message.createTime, "message updateTime")
    : null;
  return {
    name,
    createTime,
    updateTime,
    sender: displayName || senderFallback(message),
    thread: message.thread?.name || null,
    text: deleted ? "" : String(message.text || message.formattedText || ""),
    attachments,
    deleted,
    deletionType: message.deletionMetadata?.deletionType || null,
  };
}

function quoted(value, fallback = "（なし）") {
  const source = String(value || fallback).replace(/\r\n?/g, "\n");
  return source.split("\n").map((line) => `> ${line}`).join("\n");
}

function messageBlock(message) {
  const encoded = Buffer.from(message.name).toString("base64url");
  const lines = [
    `<!-- google-chat-message:${encoded} created:${message.createTime} format:v2 -->`,
    `## [${tokyoTime(message.createTime)}] Google Chatメッセージ`,
    "",
    "### 発言者",
    quoted(message.sender, "Google Chatユーザー"),
    "",
    "### 本文",
    message.deleted ? quoted("削除済みメッセージ") : quoted(message.text, "（本文なし）"),
  ];
  if (message.deleted) lines.push("", "### 削除メタデータ", quoted(message.deletionType, "削除情報あり"));
  if (message.thread) lines.push("", "### スレッド", quoted(message.thread));
  for (const [index, attachment] of message.attachments.entries()) {
    lines.push(
      "",
      `### 添付メタデータ ${index + 1}`,
      "#### 名前", quoted(attachment.name, "名称なし"),
      "#### 種類", quoted(attachment.type, "種類不明"),
      "#### 取得元", quoted(attachment.source, "Google Chat"),
      "#### 参照先", quoted(attachment.reference, "参照先なし"),
    );
  }
  lines.push("", `<!-- /google-chat-message:${encoded} -->`);
  return lines.join("\n");
}

function existingBlocks(source) {
  const blocks = new Map();
  const v2Start = /^<!-- google-chat-message:([A-Za-z0-9_-]+) created:([^ \r\n]+) format:v2 -->$/gm;
  for (const match of source.matchAll(v2Start)) {
    const end = `<!-- /google-chat-message:${match[1]} -->`;
    const endAt = source.indexOf(`\n${end}`, match.index + match[0].length);
    if (endAt < 0) continue;
    try {
      const name = Buffer.from(match[1], "base64url").toString();
      if (!/^spaces\/[^/]+\/messages\/[^/]+$/.test(name)) continue;
      blocks.set(name, { created: match[2], body: source.slice(match.index, endAt + 1 + end.length) });
    } catch { /* 壊れたmarkerは無視 */ }
  }

  // v1履歴は次のmessage開始までを1区間とし、最後の終了markerを正規の境界として移行する。
  const legacyStarts = [...source.matchAll(/^<!-- google-chat-message:([A-Za-z0-9_-]+) created:([^ \r\n]+) -->$/gm)];
  for (const [index, match] of legacyStarts.entries()) {
    const segmentEnd = legacyStarts[index + 1]?.index ?? source.length;
    const segment = source.slice(match.index, segmentEnd);
    const endMarker = "<!-- /google-chat-message -->";
    const endAt = segment.lastIndexOf(endMarker);
    if (endAt < 0) continue;
    try {
      const name = Buffer.from(match[1], "base64url").toString();
      if (!/^spaces\/[^/]+\/messages\/[^/]+$/.test(name) || blocks.has(name)) continue;
      blocks.set(name, { created: match[2], body: segment.slice(0, endAt + endMarker.length) });
    } catch { /* 壊れたmarkerは無視 */ }
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
    const content = [...blocks.entries()].sort((left, right) => left[1].created.localeCompare(right[1].created) || left[0].localeCompare(right[0])).map(([, item]) => item.body).join("\n\n---\n\n");
    writeFileAtomicSafe(rootPath, path, `# ${space.displayName} - ${date}\n\n- source: Google Chat\n- space: \`${space.name}\`\n- timezone: Asia/Tokyo\n\n${content}\n`, { mode: 0o600 });
    files.push(path);
  }
  return files;
}
