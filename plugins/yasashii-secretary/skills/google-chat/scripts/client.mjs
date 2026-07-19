import { fetchWithTimeout } from "./runtime-safety.mjs";

const CHAT_API = "https://chat.googleapis.com/v1";
const PEOPLE_API = "https://people.googleapis.com/v1";

function classifyApiFailure(response, detail = "") {
  let parsed = null;
  try { parsed = JSON.parse(detail); } catch { /* JSON以外のGoogle API応答も下の文字列検査で扱う */ }
  const apiError = parsed?.error || parsed || {};
  const details = Array.isArray(apiError?.details) ? apiError.details : [];
  const reasons = details.map((item) => String(item?.reason || "").toUpperCase()).filter(Boolean);
  const source = `${String(detail)}\n${String(apiError?.status || "")}\n${String(apiError?.message || "")}\n${reasons.join("\n")}`.toLowerCase();
  const hasReason = (...values) => values.some((value) => reasons.includes(value));
  if (response.status === 401) return Object.assign(new Error("Google認証の有効期限が切れています。再認証してください。"), { code: "reauth-required" });
  if (response.status === 403 && (hasReason("SERVICE_DISABLED", "API_DISABLED", "SERVICE_NOT_ENABLED") || /service[_ -]?disabled|api (?:is )?disabled|api.+disabled|has not been used.+or it is disabled|chat\.googleapis\.com.+disabled/.test(source))) {
    return Object.assign(new Error("Google Chat APIが無効です。Google CloudでAPIを有効にしてください。"), { code: "api-disabled" });
  }
  if (response.status === 403 && (hasReason("ACCESS_TOKEN_SCOPE_INSUFFICIENT", "INSUFFICIENT_SCOPE") || /insufficient authentication|access_token_scope_insufficient|insufficient[_ -]?scope|required.+scope|scope.+insufficient/.test(source))) {
    return Object.assign(new Error("Google Chatの読み取りに必要なscopeが不足しています。再認証してください。"), { code: "scope-insufficient" });
  }
  if (response.status === 403 && (hasReason("ADMIN_POLICY_ENFORCED", "ACCESS_BLOCKED", "ORG_POLICY", "ORG_RESTRICTION", "POLICY_DENIED") || /admin(?:istrator)?|admin[_ -]?policy|blocked by.+policy|org[_ -]?policy/.test(source))) {
    return Object.assign(new Error("Google Workspace管理者のAPI access controlsにより読み取りが拒否されました。"), { code: "admin-blocked" });
  }
  if (response.status === 403) return Object.assign(new Error("Google Chat APIへのアクセスが拒否されましたが、原因を特定できませんでした。APIの有効化、必要scope、管理者設定を順に確認してください。"), { code: "permission-denied" });
  if (response.status === 429) return Object.assign(new Error("Google Chat APIの利用上限に達しました。時間を置いて再実行してください。"), { code: "rate-limit" });
  if (response.status === 404) return Object.assign(new Error("対象スペースへアクセスできないか、Google Chat APIが無効です。"), { code: "space-not-found" });
  return Object.assign(new Error("Google Chat APIから取得できませんでした。"), { code: "api-failed" });
}

export function createGoogleChatClient({ accessToken, fetchImpl = fetch, chatBase = CHAT_API, peopleBase = PEOPLE_API, timeoutMs = Number(process.env.YASASHII_HTTP_TIMEOUT_MS || 15_000) }) {
  const request = async (url) => {
    let response;
    try { response = await fetchWithTimeout(url, { headers: { authorization: `Bearer ${accessToken}` } }, { timeoutMs, label: "Google Chat API", fetchImpl }); }
    catch (error) {
      if (error?.code === "timeout") throw error;
      throw Object.assign(new Error("Google Chat APIへ接続できません。ネットワークを確認してください。"), { code: "network" });
    }
    if (!response.ok) {
      let detail = "";
      try { detail = await response.text(); }
      catch (error) { if (error?.code === "timeout") throw error; }
      throw classifyApiFailure(response, detail);
    }
    return response.json();
  };
  return {
    async listSpaces() {
      const spaces = [];
      let pageToken = "";
      do {
        const url = new URL(`${chatBase}/spaces`);
        url.searchParams.set("pageSize", "1000");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const page = await request(url);
        spaces.push(...(page.spaces || []));
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      return spaces;
    },
    getSpace(name) { return request(`${chatBase}/${name}`); },
    async listAllMessages(parent, { after = "" } = {}) {
      const messages = [];
      let pageToken = "";
      do {
        const url = new URL(`${chatBase}/${parent}/messages`);
        url.searchParams.set("pageSize", "100");
        url.searchParams.set("orderBy", "createTime asc");
        if (after) url.searchParams.set("filter", `createTime > \"${after}\"`);
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const page = await request(url);
        messages.push(...(page.messages || []));
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      return messages;
    },
    async displayName(senderName) {
      if (!senderName) return null;
      const id = senderName.split("/").pop();
      try {
        const person = await request(`${peopleBase}/people/${encodeURIComponent(id)}?personFields=names`);
        return person.names?.find((item) => item.displayName)?.displayName || null;
      } catch { return null; }
    },
  };
}
