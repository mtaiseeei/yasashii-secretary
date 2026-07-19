import { fetchWithTimeout } from "./runtime-safety.mjs";

export async function exchangeRefreshToken({ clientId, clientSecret, refreshToken, fetchImpl = fetch, timeoutMs = Number(process.env.YASASHII_HTTP_TIMEOUT_MS || 15_000) }) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw Object.assign(new Error("Google Chat用のRepository Secretを確認できません。"), { code: "secret-missing" });
  }
  let response;
  try {
    response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    }, { timeoutMs, label: "Google OAuth", fetchImpl });
  } catch (error) {
    if (error?.code === "timeout") throw error;
    throw Object.assign(new Error("Google OAuthへ接続できません。ネットワークを確認してください。"), { code: "network" });
  }
  let result = {};
  try { result = await response.json(); }
  catch (error) { if (error?.code === "timeout") throw error; }
  if (!response.ok || !result.access_token) {
    const source = `${result.error || ""} ${result.error_description || ""}`.toLowerCase();
    if (/invalid_grant|revoked|expired/.test(source)) throw Object.assign(new Error("Google認証の同意が取り消されたか、refresh tokenが失効しています。再認証してください。"), { code: "reauthorization-needed" });
    if (/invalid_scope|scope/.test(source)) throw Object.assign(new Error("Google Chatの読み取りに必要なscopeが不足しています。再認証してください。"), { code: "scope-insufficient" });
    if (/admin|policy|blocked/.test(source)) throw Object.assign(new Error("Google Workspace管理者によりOAuth利用がブロックされています。"), { code: "admin-blocked" });
    if (/org_internal|audience|unauthorized_client/.test(source)) throw Object.assign(new Error("OAuth Audienceが利用者のGoogle Workspace組織と一致していません。"), { code: "audience-mismatch" });
    if (response.status === 429) throw Object.assign(new Error("Google OAuthの利用上限に達しました。時間を置いて再実行してください。"), { code: "rate-limit" });
    throw Object.assign(new Error("Google OAuthでaccess tokenを取得できませんでした。"), { code: "oauth-failed" });
  }
  return String(result.access_token);
}
