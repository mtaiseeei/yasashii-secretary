#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:9228";
const wizardUrl = args.get("--url") || "http://127.0.0.1:18783/";
const normalUrl = args.get("--normal-url") || null;
const screenshotDir = resolve(args.get("--screenshots") || "/tmp/sprint-023-browser");
const delay = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page" && item.url === "about:blank") || pages.find((item) => item.type === "page");
if (!page) throw new Error("browser page target not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text || "exception");
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveSend, reject) => pending.set(id, { resolve: resolveSend, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`timeout: ${expression}`);
}

async function screenshot(name) {
  const dimensions = await evaluate(`({width:Math.max(document.documentElement.scrollWidth,innerWidth),height:Math.max(document.documentElement.scrollHeight,innerHeight)})`);
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
  });
  writeFileSync(resolve(screenshotDir, name), Buffer.from(result.data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
mkdirSync(screenshotDir, { recursive: true });
await send("Page.navigate", { url: wizardUrl });
await waitFor(`location.href === ${JSON.stringify(wizardUrl)} && document.readyState === "complete" && document.querySelector("#app h1")`);

const initial = await evaluate(`({
  heading: document.querySelector("#app h1")?.textContent,
  loopback: location.hostname === "127.0.0.1",
  cookieVisible: document.cookie.includes("yasashii_google_chat_session"),
  confirmDisabled: document.querySelector('[data-action="next"]')?.disabled === true
})`);
await screenshot("google-chat-initial.png");

const synthetic = await evaluate(`fetch("/api/oauth/synthetic", {method:"POST", headers:{"content-type":"application/json"}, body:'{"mode":"success"}'}).then(async response => ({status:response.status, body:await response.json()}))`);
await send("Page.reload", { ignoreCache: true });
await waitFor(`document.querySelectorAll('.room-list input').length === 3`);
const spaces = await evaluate(`({
  heading: document.querySelector("#app h1")?.textContent,
  count: document.querySelectorAll('.room-list input').length,
  selected: document.querySelectorAll('.room-list input:checked').length,
  body: document.querySelector("#app")?.innerText,
  secretInputs: document.querySelectorAll('input[type="password"],input[name*="secret" i],input[name*="token" i]').length,
  secretLeak: /client_secret|memory-|authorizationTarget|callback URL/i.test(document.documentElement.innerText),
  cookieVisible: document.cookie.includes("yasashii_google_chat_session")
})`);
await screenshot("google-chat-spaces.png");

let normal = { skipped: true };
if (normalUrl) {
  await send("Page.navigate", { url: normalUrl });
  await waitFor(`location.href === ${JSON.stringify(normalUrl)} && document.readyState === "complete" && document.querySelector("#app h1")`);
  const clientBody = JSON.stringify({ clientJson: JSON.stringify({ installed: { client_id: "browser-runtime-client", client_secret: "browser-runtime-secret", auth_uri: "https://accounts.google.com/o/oauth2/v2/auth", token_uri: "https://oauth2.googleapis.com/token", redirect_uris: ["http://localhost"] } }) });
  await evaluate(`fetch("/api/oauth/client", {method:"POST", headers:{"content-type":"application/json"}, body:${JSON.stringify(clientBody)}}).then(response => response.status)`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(`document.querySelector('[data-action="authorize"]') !== null`);
  await evaluate(`window.__oauthPopup={closed:false,opener:null,location:{replace(url){this.url=url}},close(){this.closed=true}};window.__oauthOpen={count:0,url:null,name:null};window.open=(url,name)=>{window.__oauthOpen={count:window.__oauthOpen.count+1,url,name};return window.__oauthPopup};document.querySelector('[data-action="authorize"]').click();true`);
  await waitFor(`document.querySelector('#app h1')?.textContent.includes('Googleの許可を待っています')`);
  const launched = await evaluate(`({open:window.__oauthOpen,popupTarget:window.__oauthPopup.location.url,heading:document.querySelector('#app h1')?.textContent})`);
  await evaluate(`window.__oauthPopup.closed=true;true`);
  await waitFor(`document.querySelector('[data-oauth-status]')?.textContent.includes('確認画面が閉じられました')`, 3000);
  const closedReported = await evaluate(`document.querySelector('[data-oauth-status]')?.textContent`);

  await evaluate(`fetch("/api/oauth/client", {method:"POST", headers:{"content-type":"application/json"}, body:${JSON.stringify(clientBody)}}).then(response => response.status)`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(`document.querySelector('[data-action="authorize"]') !== null`);
  await evaluate(`window.open=()=>null;document.querySelector('[data-action="authorize"]').click();true`);
  await waitFor(`document.querySelector('#app h1')?.textContent.includes('開けませんでした')`);
  const blocked = await evaluate(`({heading:document.querySelector('#app h1')?.textContent,text:document.querySelector('#app')?.innerText,retry:Boolean(document.querySelector('[data-action="reopen"]'))})`);
  await screenshot("google-chat-popup-blocked.png");

  await evaluate(`fetch("/api/oauth/synthetic", {method:"POST", headers:{"content-type":"application/json"}, body:'{"mode":"denied"}'}).then(response => response.status)`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(`document.querySelector('#app h1')?.textContent.includes('接続を確認できませんでした')`);
  const denied = await evaluate(`({heading:document.querySelector('#app h1')?.textContent,retry:Boolean(document.querySelector('[data-action="next"]')),secretLeak:/browser-runtime-|client_secret|memory-/i.test(document.documentElement.innerText)})`);

  await evaluate(`fetch("/api/oauth/synthetic", {method:"POST", headers:{"content-type":"application/json"}, body:'{"mode":"success"}'}).then(response => response.status)`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(`document.querySelectorAll('.room-list input').length === 3`);
  const recovered = await evaluate(`({spaces:document.querySelectorAll('.room-list input').length,secretLeak:/browser-runtime-|client_secret|memory-/i.test(document.documentElement.innerText)})`);
  normal = { skipped: false, launched, closedReported, blocked, denied, recovered };
}

const checks = {
  syntheticSucceeded: synthetic.status === 200,
  loopbackOnly: initial.loopback,
  initialConfirmationDisabled: initial.confirmDisabled,
  initialCookieHttpOnly: !initial.cookieVisible,
  spacesHeading: spaces.heading?.includes("Google Chatスペース") === true,
  threeSpaces: spaces.count === 3,
  initiallyUnselected: spaces.selected === 0,
  excludesDirectMessages: spaces.body.includes("ダイレクトメッセージ"),
  noSecretInputs: spaces.secretInputs === 0,
  noSecretLeak: !spaces.secretLeak,
  spacesCookieHttpOnly: !spaces.cookieVisible,
  noBrowserErrors: browserErrors.length === 0,
  normalPopupFlow: normal.skipped || (
    normal.launched.open.count === 1
    && normal.launched.open.url === "about:blank"
    && normal.launched.open.name === "yasashii-google-chat-oauth"
    && normal.launched.popupTarget === "/api/oauth/authorize"
    && normal.closedReported.includes("確認画面が閉じられました")
    && normal.blocked.heading.includes("開けませんでした")
    && normal.blocked.text.includes("ポップアップを許可")
    && normal.blocked.retry
    && normal.denied.heading.includes("接続を確認できませんでした")
    && normal.denied.retry
    && !normal.denied.secretLeak
    && normal.recovered.spaces === 3
    && !normal.recovered.secretLeak
  ),
};
const passed = Object.values(checks).every(Boolean);

const report = { checks, initial, syntheticStatus: synthetic.status, spaces, normal, browserErrors, screenshots: screenshotDir };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`SPRINT023_BROWSER_${passed ? "PASS" : "FAIL"}=1\n`);
socket.close();
process.exit(passed ? 0 : 1);
