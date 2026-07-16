#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const API_BASE = (process.env.CHATWORK_API_BASE_URL || "https://api.chatwork.com/v2").replace(/\/$/, "");
const TOKEN = process.env.CHATWORK_API_TOKEN || "";
const NOW = process.env.CC_SECRETARY_NOW || new Date().toISOString();

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function apiFailure(status) {
  if (status === 401 || status === 403) return { code: "auth", message: "API Tokenを確認してください。" };
  if (status === 429) return { code: "rate-limit", message: "APIの利用上限に達しました。時間を置いて再実行してください。" };
  if (status >= 500) return { code: "server", message: "Chatwork側で一時的な問題が起きています。時間を置いて再実行してください。" };
  return { code: "api", message: `Chatwork APIの応答を確認できませんでした（HTTP ${status}）。` };
}

async function requestJson(path) {
  const controller = new AbortController();
  const timeout = Number(process.env.CHATWORK_API_TIMEOUT_MS || 15_000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "x-chatworktoken": TOKEN, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error("api"), apiFailure(response.status));
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted || error.name === "AbortError") {
      throw Object.assign(new Error("timeout"), { code: "timeout", message: "Chatworkへの接続が時間切れになりました。時間を置いて再実行してください。" });
    }
    if (error.code) throw error;
    throw Object.assign(new Error("network"), { code: "network", message: "Chatworkへ接続できませんでした。ネットワークを確認してください。" });
  } finally {
    clearTimeout(timer);
  }
}

function roomId(value) {
  const normalized = String(value ?? "");
  if (!/^\d+$/.test(normalized)) fail("Room IDの形式が不正です。", 3);
  return normalized;
}

function normalizeMessage(room, message) {
  return {
    messageId: String(message.message_id),
    roomId: room.roomId,
    roomName: room.name,
    accountId: String(message.account?.account_id ?? ""),
    accountName: String(message.account?.name ?? "不明"),
    sentAt: Number(message.send_time || 0),
    updatedAt: Number(message.update_time || message.send_time || 0),
    body: String(message.body ?? ""),
  };
}

async function discover(root) {
  const statePath = join(root, "chatwork", "state", "discovery.json");
  try {
    const response = await requestJson("/rooms");
    const rooms = (Array.isArray(response) ? response : [])
      .map((room) => ({ roomId: roomId(room.room_id), name: String(room.name || `Room ${room.room_id}`) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja") || a.roomId.localeCompare(b.roomId));
    writeJson(join(root, "chatwork", "rooms.json"), { version: 1, status: "ready", fetchedAt: NOW, rooms });
    writeJson(statePath, { version: 1, status: "success", fetchedAt: NOW, roomCount: rooms.length });
    process.stdout.write(`room一覧を更新しました（${rooms.length}件）。\n`);
  } catch (error) {
    writeJson(statePath, { version: 1, status: "failed", attemptedAt: NOW, error: error.code || "unknown", message: error.message });
    fail(error.message || "room一覧の取得に失敗しました。", 4);
  }
}

function readRooms(root) {
  const data = readJson(join(root, "chatwork", "rooms.json"), { rooms: [] });
  return new Map((data.rooms || []).map((room) => [String(room.roomId), { roomId: String(room.roomId), name: String(room.name) }]));
}

async function syncRooms(root, mode) {
  const config = readJson(join(root, "chatwork", "config.json"));
  if (!config || !Array.isArray(config.selectedRoomIds)) fail("Chatwork設定を読み取れません。wizardで設定してください。", 3);
  if (process.env.CHATWORK_TRIGGER === "schedule" && (!config.scheduleEnabled || !config.automaticPushConsent)) {
    fail("自動同期への同意が無効なため、schedule同期を開始しません。", 3);
  }
  const selected = [...new Set(config.selectedRoomIds.map(roomId))];
  if (selected.length === 0) fail("取得するroomが選ばれていません。", 3);
  const rooms = readRooms(root);
  const unknown = selected.filter((id) => !rooms.has(id));
  if (unknown.length > 0) fail("room一覧にないRoom IDが設定されています。room一覧を更新してください。", 3);

  const previousState = readJson(join(root, "chatwork", "state", "sync.json"), { version: 1, lastSuccessAt: null, cursors: {} });
  const results = [];
  const prepared = [];
  for (const id of selected) {
    const room = rooms.get(id);
    try {
      const response = await requestJson(`/rooms/${encodeURIComponent(id)}/messages?force=1`);
      const incoming = (Array.isArray(response) ? response : []).slice(-100).map((message) => normalizeMessage(room, message));
      const historyPath = join(root, "chatwork", "history", `${id}.json`);
      const previous = readJson(historyPath, { version: 1, room, messages: [] });
      const merged = new Map((previous.messages || []).map((message) => [String(message.messageId), message]));
      for (const message of incoming) merged.set(message.messageId, message);
      const messages = [...merged.values()].sort((a, b) => a.sentAt - b.sentAt || a.messageId.localeCompare(b.messageId));
      prepared.push({ historyPath, value: { version: 1, room, updatedAt: NOW, apiWindow: { limit: 100, returned: incoming.length }, messages } });
      results.push({ roomId: id, roomName: room.name, status: "success", fetched: incoming.length, stored: messages.length });
    } catch (error) {
      results.push({ roomId: id, roomName: room.name, status: "failed", fetched: 0, error: error.code || "unknown", message: error.message });
    }
  }
  const succeeded = results.filter((item) => item.status === "success").length;
  const status = succeeded === results.length ? "success" : succeeded === 0 ? "failed" : "partial";
  if (status !== "success") {
    writeJson(join(root, "chatwork", "state", "sync.json"), {
      version: 1,
      status,
      attemptedAt: NOW,
      lastSuccessAt: previousState.lastSuccessAt || null,
      cursors: previousState.cursors || {},
      results,
      message: "取得を完了できなかったため、前回の履歴と取得位置を保持しました。",
    });
    const failureKinds = [...new Set(results.filter((item) => item.status === "failed").map((item) => item.error || "unknown"))].join(",");
    fail(`一部または全部のroomを取得できませんでした。失敗種別: ${failureKinds}。前回の履歴と取得位置は保持しています。`, 4);
  }
  for (const item of prepared) writeJson(item.historyPath, item.value);
  const cursors = Object.fromEntries(prepared.map((item) => {
    const id = item.value.room.roomId;
    const last = item.value.messages.at(-1);
    return [id, last ? { messageId: last.messageId, sentAt: last.sentAt } : (previousState.cursors?.[id] || null)];
  }));
  writeJson(join(root, "chatwork", "state", "sync.json"), {
    version: 1,
    status: "success",
    attemptedAt: NOW,
    lastSuccessAt: NOW,
    cursors,
    results,
  });
  const fetched = results.reduce((total, item) => total + item.fetched, 0);
  process.stdout.write(`${mode === "initial" ? "初回取得" : "同期"}: 成功${succeeded} room／失敗0 room／${fetched}件。\n`);
}

if (!TOKEN) fail("Repository Secret CHATWORK_API_TOKEN が設定されていません。", 3);
const mode = process.argv[2];
const root = resolve(process.argv[3] || process.cwd());
if (mode === "discover") await discover(root);
else if (mode === "initial" || mode === "sync") await syncRooms(root, mode);
else fail("使い方: chatwork-sync.mjs discover|initial|sync [repo-root]");
