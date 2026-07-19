import { randomBytes, timingSafeEqual } from "node:crypto";

function cookieValue(header, name) {
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

function sameSecret(actual, expected) {
  if (typeof actual !== "string") return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createWizardSessionGuard({ origin, cookieName }) {
  if (typeof origin !== "function") throw new TypeError("origin must be a function");
  if (!/^[A-Za-z0-9_-]+$/.test(cookieName || "")) throw new TypeError("cookieName is invalid");
  const confirmation = randomBytes(32).toString("base64url");

  function hasSession(request) {
    return sameSecret(cookieValue(request.headers.cookie, cookieName), confirmation);
  }

  function cookieHeader() {
    return `${cookieName}=${confirmation}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`;
  }

  function validateMutation(request) {
    if (request.method !== "POST") return { status: 405, code: "method-not-allowed", message: "この操作方法は受け付けられません。設定画面を開き直してください。" };
    if (request.headers.origin !== origin()) return { status: 403, code: "origin-mismatch", message: "設定画面の接続元を確認できません。設定画面を開き直してください。" };
    if (!hasSession(request)) return { status: 403, code: "session-mismatch", message: "設定画面のsessionを確認できません。設定画面を開き直してください。" };
    const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    if (contentType !== "application/json") return { status: 415, code: "content-type-required", message: "設定内容の送信形式を確認できません。設定画面を開き直してください。" };
    return null;
  }

  return Object.freeze({ cookieHeader, hasSession, validateMutation });
}
