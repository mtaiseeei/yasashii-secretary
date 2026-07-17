#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:9226";
const url = args.get("--url") || "http://127.0.0.1:18770/";
const evidence = resolve(args.get("--evidence") || "docs/evidence/sprint-020");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page" && (item.url === "about:blank" || item.url.includes("127.0.0.1"))) || pages.find((item) => item.type === "page");
if (!page) throw new Error("browser page target not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((open, reject) => { socket.addEventListener("open", open, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 1;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { const waiter = pending.get(message.id); pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); }
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text || "exception");
});
function send(method, params = {}) { const callId = id++; socket.send(JSON.stringify({ id: callId, method, params })); return new Promise((accept, reject) => pending.set(callId, { resolve: accept, reject })); }
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
async function waitFor(expression, timeout = 8000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`timeout: ${expression}`); }
async function open(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  const target = new URL(url); target.searchParams.set("browserCheck", `${Date.now()}-${id}`);
  await send("Page.navigate", { url: target.href });
  await waitFor(`location.href===${JSON.stringify(target.href)}&&document.readyState==='complete'&&document.querySelectorAll('.room-list input').length===3`);
}
async function screenshot(name) {
  const size = await evaluate(`({width:Math.max(document.documentElement.scrollWidth,innerWidth),height:Math.max(document.documentElement.scrollHeight,innerHeight)})`);
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
  writeFileSync(resolve(evidence, name), Buffer.from(result.data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");
mkdirSync(evidence, { recursive: true });

await open(1440, 900);
const desktop = await evaluate(`({service:document.querySelector('#app').getAttribute('aria-label'),context:document.querySelector('.service-context').textContent,heading:document.querySelector('h1').textContent,selected:[...document.querySelectorAll('.room-list input:checked')].map(i=>i.value),cta:[...document.querySelectorAll('.button-primary')].map(i=>({bg:getComputedStyle(i).backgroundColor,fg:getComputedStyle(i).color})),blue:[...document.querySelectorAll('.button-primary')].filter(i=>getComputedStyle(i).backgroundColor==='rgb(62, 106, 225)').length,text:document.querySelector('#app').innerText})`);
await screenshot("google-chat-settings-desktop.png");
await evaluate(`document.querySelector('input[value="spaces/space-b"]').click();document.querySelector('input[value="spaces/space-c"]').click();document.querySelector('[data-action="next"]').click();true`);
await waitFor(`document.querySelectorAll('input[name="settings-interval"]').length===5`);
const frequency = await evaluate(`({selected:document.querySelector('input[name="settings-interval"]:checked').value,text:document.querySelector('#app').innerText})`);
await evaluate(`document.querySelector('input[value="manual"]').click();document.querySelector('[data-action="next"]').click();true`);
await waitFor(`document.querySelector('#settings-git-consent')!==null`);
const manualReview = await evaluate(`({text:document.querySelector('#app').innerText,disabled:document.querySelector('[data-action="next"]').disabled,autoConsent:Boolean(document.querySelector('#settings-auto-consent')),ctaCount:document.querySelectorAll('.actions .button').length})`);
await evaluate(`document.querySelector('[data-action="back"]').click();document.querySelector('input[value="3h"]').click();document.querySelector('[data-action="next"]').click();true`);
await waitFor(`document.querySelector('#settings-auto-consent')!==null`);
const automaticReview = await evaluate(`({text:document.querySelector('#app').innerText,disabled:document.querySelector('[data-action="next"]').disabled,gitChecked:document.querySelector('#settings-git-consent').checked,autoChecked:document.querySelector('#settings-auto-consent').checked})`);
await evaluate(`document.querySelector('#settings-git-consent').click();document.querySelector('#settings-auto-consent').click();document.querySelector('[data-action="next"]').click();true`);
await waitFor(`document.querySelector('h1')?.textContent.includes('現在のGoogle Chat設定')`);
const result = await evaluate(`({text:document.querySelector('#app').innerText,service:document.querySelector('#app').getAttribute('aria-label')})`);
await screenshot("google-chat-settings-result.png");

await open(390, 844, true);
const mobile = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,actions:getComputedStyle(document.querySelector('.actions')).flexDirection,buttons:[...document.querySelectorAll('button')].map(i=>i.getBoundingClientRect().height),labels:[...document.querySelectorAll('input')].every(i=>i.closest('label')||document.querySelector('label[for="'+i.id+'"]'))})`);
await screenshot("google-chat-settings-mobile.png");

await open(720, 450);
await send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
const zoom = await evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('button')].every(i=>i.getBoundingClientRect().height>=44),service:document.querySelector('.service-context').textContent})`);
await screenshot("google-chat-settings-zoom200.png");

const report = { desktop, frequency, manualReview, automaticReview, result, mobile, zoom, browserErrors };
const passed = desktop.service === "Google Chatの設定" && desktop.context === "Google Chatの設定" && desktop.selected.length === 2 && desktop.cta.every((item) => item.bg === "rgb(17, 187, 98)" && item.fg === "rgb(0, 0, 0)") && desktop.blue === 0 && desktop.text.includes("取得済み履歴は削除しません")
  && frequency.selected === "3h" && frequency.text.includes("3時間ごと（おすすめ・初期値）")
  && manualReview.disabled && !manualReview.autoConsent && manualReview.ctaCount === 2 && manualReview.text.includes("手動取得時だけ保存")
  && automaticReview.disabled && !automaticReview.gitChecked && !automaticReview.autoChecked && automaticReview.text.includes("差分範囲より古い変更")
  && result.text.includes("現在の対象") && result.text.includes("現在の間隔") && result.text.includes("自動実行") && result.text.includes("直近の取得") && result.text.includes("既存履歴は削除していません")
  && !mobile.overflow && mobile.actions === "column-reverse" && mobile.buttons.every((height) => height >= 44) && mobile.labels
  && !zoom.overflow && zoom.buttons && zoom.service === "Google Chatの設定" && browserErrors.length === 0;
writeFileSync(resolve(evidence, "browser-evidence.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
socket.close();
process.exit(passed ? 0 : 1);
