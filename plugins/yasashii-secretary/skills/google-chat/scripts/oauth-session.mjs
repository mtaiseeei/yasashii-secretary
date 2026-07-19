import { createHash, randomBytes } from "node:crypto";
import { fetchWithTimeout } from "../../../scripts/lib/external-ops.mjs";

export const GOOGLE_CHAT_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
]);

export const GOOGLE_CHAT_SECRET_NAMES = Object.freeze([
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT",
]);

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function parseDesktopClientJson(input) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  const installed = parsed?.installed;
  if (!installed || parsed.web) throw Object.assign(new Error("OAuth clientはDesktop appとして作成してください。"), { code: "desktop-client-required" });
  if (!installed.client_id || !installed.client_secret || !installed.auth_uri || !installed.token_uri) {
    throw Object.assign(new Error("OAuth client JSONの必要項目を確認できません。"), { code: "client-json-invalid" });
  }
  let auth;
  let token;
  try { auth = new URL(installed.auth_uri); token = new URL(installed.token_uri); }
  catch { throw Object.assign(new Error("OAuth client JSONのGoogle公式endpointを確認できません。"), { code: "client-json-invalid" }); }
  const authPathAllowed = ["/o/oauth2/auth", "/o/oauth2/v2/auth"].includes(auth.pathname);
  const officialEndpoints = auth.protocol === "https:" && auth.hostname === "accounts.google.com" && authPathAllowed && !auth.username && !auth.password
    && token.protocol === "https:" && token.hostname === "oauth2.googleapis.com" && token.pathname === "/token" && !token.username && !token.password;
  if (!officialEndpoints) throw Object.assign(new Error("OAuth client JSONのGoogle公式endpointを確認できません。"), { code: "client-json-invalid" });
  const redirects = Array.isArray(installed.redirect_uris) ? installed.redirect_uris : [];
  if (!redirects.some((uri) => /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/i.test(uri))) {
    throw Object.assign(new Error("Desktop appのloopback redirect URIを確認できません。"), { code: "redirect-uri-mismatch" });
  }
  return {
    clientId: String(installed.client_id),
    clientSecret: String(installed.client_secret),
    authUri: auth.toString(),
    tokenUri: token.toString(),
  };
}

export function createPkceState() {
  const verifier = base64Url(randomBytes(48));
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
    state: base64Url(randomBytes(32)),
  };
}

export function authorizationRequest({ clientId, authUri, redirectUri, challenge, state }) {
  const url = new URL(authUri);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: GOOGLE_CHAT_SCOPES.join(" "),
  }).toString();
  return url;
}

export function validateCallback({ expectedState, expectedOrigin, requestUrl }) {
  const url = new URL(requestUrl);
  if (url.origin !== expectedOrigin || url.pathname !== "/oauth/callback") {
    throw Object.assign(new Error("callbackの受信先が一致しません。Desktop appの設定を確認してください。"), { code: "callback-mismatch" });
  }
  const error = url.searchParams.get("error");
  if (error === "access_denied") throw Object.assign(new Error("Google認証が拒否されました。許可しない場合は変更されません。"), { code: "access-denied" });
  if (error) throw Object.assign(new Error("Google認証を完了できませんでした。管理者設定を確認してください。"), { code: "oauth-failed" });
  if (url.searchParams.get("state") !== expectedState) {
    throw Object.assign(new Error("認証状態を確認できません。最初からやり直してください。"), { code: "state-mismatch" });
  }
  const code = url.searchParams.get("code");
  if (!code) throw Object.assign(new Error("Googleから認可結果を受け取れませんでした。"), { code: "authorization-code-missing" });
  return code;
}

export async function exchangeAuthorizationCode({ tokenUri, clientId, clientSecret, redirectUri, code, verifier, fetchImpl = fetch, timeoutMs = Number(process.env.YASASHII_HTTP_TIMEOUT_MS || 15_000) }) {
  const response = await fetchWithTimeout(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  }, { timeoutMs, label: "Google OAuth", fetchImpl });
  let tokens = {};
  try { tokens = await response.json(); }
  catch (error) { if (error?.code === "timeout") throw error; }
  if (!response.ok) {
    const source = `${tokens.error || ""} ${tokens.error_description || ""}`.toLowerCase();
    if (source.includes("admin_policy_enforced") || source.includes("access_blocked")) {
      throw Object.assign(new Error("Google Workspace管理者により認証がブロックされています。API access controlsを確認してください。"), { code: "admin-blocked" });
    }
    if (source.includes("org_internal") || source.includes("unauthorized_client") || source.includes("audience")) {
      throw Object.assign(new Error("OAuth Audienceが利用者のGoogle Workspace組織と一致していません。Internal設定を確認してください。"), { code: "audience-mismatch" });
    }
    if (source.includes("invalid_scope") || source.includes("insufficient_scope")) {
      throw Object.assign(new Error("Google Chatの読み取りに必要なscopeが不足しています。"), { code: "scope-insufficient" });
    }
    if (source.includes("redirect_uri_mismatch")) {
      throw Object.assign(new Error("redirect_uri_mismatch: OAuth clientの種類とloopback設定を確認してください。"), { code: "redirect-uri-mismatch" });
    }
    throw Object.assign(new Error("認可コードをtokenへ交換できませんでした。"), { code: "token-exchange-failed" });
  }
  if (!tokens.access_token || !tokens.refresh_token) {
    throw Object.assign(new Error("refresh tokenを取得できませんでした。Googleのアプリ権限を取り消して再認証してください。"), { code: "refresh-token-missing" });
  }
  return { accessToken: String(tokens.access_token), refreshToken: String(tokens.refresh_token) };
}

export function publicOAuthState(session) {
  return {
    status: session.status,
    code: session.errorCode || null,
    message: session.message || "",
    scopes: GOOGLE_CHAT_SCOPES,
    secretNames: session.status === "connected" ? GOOGLE_CHAT_SECRET_NAMES : [],
  };
}
