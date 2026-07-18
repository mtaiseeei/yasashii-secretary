#!/usr/bin/env node

import { rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestOnlyDesktopClientFile } from "../../../../scripts/create-sprint-020-patch-001-google-chat-test-client.mjs";

const evidence = dirname(fileURLToPath(import.meta.url));
const cdp = process.argv[2] || "http://127.0.0.1:9331";
const wizard = process.argv[3] || "http://127.0.0.1:18880/";
const testClient = createTestOnlyDesktopClientFile();
process.on("exit", () => rmSync(testClient.directory, { recursive: true, force: true }));

const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("browser page target not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((open, reject) => {
  socket.addEventListener("open", open, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
});
function send(method, params = {}) {
  const callId = id++;
  socket.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((accept, reject) => pending.set(callId, { resolve: accept, reject }));
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
    await delay(80);
  }
  throw new Error(`timeout: ${expression}`);
}
async function click(selector) {
  const found = await evaluate(`(()=>{const item=document.querySelector(${JSON.stringify(selector)});if(!item)return false;item.click();return true})()`);
  if (!found) throw new Error(`missing click target: ${selector}`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1440, screenHeight: 900 });
await send("Page.navigate", { url: `${wizard}?partial=${Date.now()}` });
await waitFor(`document.readyState==='complete'&&document.querySelector('#app')?.dataset.screen==='google-chat-prepare-cloud'`);

await click('[data-action="next"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-prepare-access'`);
await click('[data-action="next"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-prepare-file'`);
const document = await send("DOM.getDocument", { depth: -1, pierce: true });
const fileInput = await send("DOM.querySelector", { nodeId: document.root.nodeId, selector: "#client-json" });
await send("DOM.setFileInputFiles", { nodeId: fileInput.nodeId, files: [testClient.path] });
await evaluate(`document.querySelector('#client-json').dispatchEvent(new Event('change',{bubbles:true}))`);
await click('[data-action="next"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-authorize'`);
await click('[data-action="synthetic"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-select-spaces'`);
await click('.room-list input[type="checkbox"]');
await click('[data-action="next"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-select-interval'`);
await click('[data-action="next"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-review'`);
await click('#save-consent');
await click('#git-consent');
await click('#automatic-consent');

const partialResponse = {
  sync: {
    status: "success",
    results: [{ name: "spaces/space-a", displayName: "営業連絡", status: "success", messages: 3, files: 1 }],
  },
  git: { status: "skipped", committed: false, pushed: false },
  schedule: {
    status: "failed",
    enabled: false,
    interval: "3h",
    code: "schedule-setup-failed",
    message: "合成テスト: 自動取得設定に失敗",
  },
  config: {
    version: 2,
    selectedSpaceNames: ["spaces/space-a"],
    selectedSpaces: [{ name: "spaces/space-a", displayName: "営業連絡", spaceType: "SPACE" }],
    interval: "3h",
    scheduleEnabled: false,
    automaticPushConsent: false,
  },
  savedLocally: true,
  tokenDiscarded: true,
  connectionState: "completed-with-schedule-failure",
  workflowDispatches: 0,
};
await evaluate(`(()=>{const real=window.fetch;const response=${JSON.stringify(partialResponse)};window.fetch=(url,options)=>String(url).includes('/api/initial-sync')?Promise.resolve(new Response(JSON.stringify(response),{status:207,headers:{'content-type':'application/json'}})):real(url,options);return true})()`);
await click('[data-action="next"]');
await waitFor(`document.querySelector('#app')?.dataset.screen==='google-chat-initial-result-partial'`);

const result = await evaluate(`(()=>{const app=document.querySelector('#app');const primary=[...app.querySelectorAll('.actions .button')].map((item)=>item.textContent.trim());return {screen:app.dataset.screen,state:app.dataset.state,heading:app.querySelector('h1')?.textContent.trim(),result:app.querySelector('[data-copy-role="result"]')?.textContent.trim(),schedule:app.querySelector('[data-schedule-result]')?.textContent.trim(),rows:[...app.querySelectorAll('.result-list li')].map((item)=>item.textContent.trim()),primary,detailsClosed:[...app.querySelectorAll('details')].every((item)=>!item.open),overflow:document.documentElement.scrollWidth>innerWidth,containsWholeSuccess:/設定が完了しました/.test(app.innerText),containsNextAction:/設定変更からもう一度お試しください/.test(app.innerText)}})()`);

const size = await evaluate(`({width:Math.max(document.documentElement.scrollWidth,innerWidth),height:Math.max(document.documentElement.scrollHeight,innerHeight)})`);
const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
writeFileSync(resolve(evidence, "google-chat-schedule-partial-desktop.png"), Buffer.from(capture.data, "base64"));
writeFileSync(resolve(evidence, "google-chat-schedule-partial.json"), `${JSON.stringify(result, null, 2)}\n`);

const passed = result.screen === "google-chat-initial-result-partial"
  && result.state === "error"
  && result.heading === "最初の取得は保存しましたが、自動取得を設定できませんでした。"
  && result.result === "取得したメッセージを保存しました。"
  && result.schedule.includes("自動取得の設定は完了していません")
  && result.containsNextAction
  && !result.containsWholeSuccess
  && result.primary.join() === "設定を終了する"
  && result.detailsClosed
  && !result.overflow;

process.stdout.write(`GOOGLE_CHAT_PARTIAL_BROWSER_PASS=${passed ? 1 : 0} FAIL=${passed ? 0 : 1}\n`);
process.stdout.write(`${JSON.stringify(result)}\n`);
socket.close();
process.exit(passed ? 0 : 1);
