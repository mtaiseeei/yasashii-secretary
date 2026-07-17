#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestOnlyDesktopClientFile } from "./create-sprint-020-patch-001-google-chat-test-client.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:9231";
const chatworkUrl = args.get("--chatwork-url") || "http://127.0.0.1:18784/";
const googleNewUrl = args.get("--google-new-url") || "http://127.0.0.1:18783/";
const googleSettingsUrl = args.get("--google-settings-url") || "http://127.0.0.1:18782/";
const evidence = resolve(args.get("--evidence") || "docs/evidence/sprint-020-patch-001/generator");
const testClient = createTestOnlyDesktopClientFile();
process.on("exit", () => rmSync(testClient.directory, { recursive: true, force: true }));
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page");
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
async function waitFor(expression, timeout = 8000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await delay(80); } throw new Error(`timeout: ${expression}`); }
async function open(url, width = 1440, height = 900, scale = 1) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768, screenWidth: width, screenHeight: height });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: scale });
  const target = new URL(url); target.searchParams.set("qa", `${Date.now()}-${id}`);
  await send("Page.navigate", { url: target.href });
  await waitFor(`document.readyState==='complete'&&document.querySelector('#app[data-screen]')`);
}
async function screen(expected) { await waitFor(`document.querySelector('#app')?.dataset.screen===${JSON.stringify(expected)}`); return observe(); }
async function click(selector) { const ok = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return true})()`); if (!ok) throw new Error(`missing click target: ${selector}`); }
async function check(selector) { const ok = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return el.checked})()`); if (!ok) throw new Error(`missing check target: ${selector}`); }
async function setFileInput(selector, path) {
  const document = await send("DOM.getDocument", { depth: -1, pierce: true });
  const target = await send("DOM.querySelector", { nodeId: document.root.nodeId, selector });
  if (!target.nodeId) throw new Error(`missing file input: ${selector}`);
  await send("DOM.setFileInputFiles", { nodeId: target.nodeId, files: [path] });
  const selected = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.files.length===1`);
  if (!selected) throw new Error(`file chooser did not select exactly one file: ${selector}`);
}
async function actionTabSequence() {
  const expected = await evaluate(`(()=>{const items=[...document.querySelectorAll('#app .actions .button')].filter((item)=>!item.disabled&&item.tabIndex>=0);if(items.length<2)return [];items[0].focus();return items.map((item)=>item.classList.contains('button-primary')?'primary':'secondary')})()`);
  if (expected.length < 2) return { expected, actual: expected };
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  const active = await evaluate(`document.activeElement?.classList.contains('button-primary')?'primary':document.activeElement?.classList.contains('button-secondary')?'secondary':'other'`);
  return { expected, actual: [expected[0], active] };
}
async function observe() {
  return evaluate(`(()=>{const app=document.querySelector('#app');const primary=[app.querySelector('h1')?.textContent,...[...app.querySelectorAll('[data-copy-role="now"],[data-copy-role="result"],[data-copy-role="status"],[data-copy-role="error"],.actions .button')].map(x=>x.textContent)].join(' ');const buttons=[...app.querySelectorAll('.actions .button')];const cta=buttons.map((x,index)=>{const rect=x.getBoundingClientRect();return {name:x.getAttribute('aria-label')||x.textContent,role:x.classList.contains('button-primary')?'primary':'secondary',domIndex:index,top:Math.round(rect.top),left:Math.round(rect.left),tabIndex:x.tabIndex,disabled:Boolean(x.disabled),bg:getComputedStyle(x).backgroundColor,fg:getComputedStyle(x).color,height:rect.height}});const dom=cta.map(x=>x.role);const visual=[...cta].sort((a,b)=>Math.abs(a.top-b.top)>1?a.top-b.top:a.left-b.left).map(x=>x.role);const tabbable=cta.filter(x=>!x.disabled&&x.tabIndex>=0).map(x=>x.role);return {screen:app.dataset.screen,state:app.dataset.state,service:app.getAttribute('aria-label'),heading:app.querySelector('h1')?.textContent,primary,forbidden:/\\b(?:wizard|workflow|commit|push|Repository Secret|loopback|runtime|scope|token|OAuth client JSON|Sprint[- ]?\\d*)\\b/i.test(primary),details:[...app.querySelectorAll('details')].map(x=>({open:x.open,summary:x.querySelector('summary')?.textContent,text:x.textContent})),safety:[...app.querySelectorAll('[data-copy-role="safety"] strong')].map(x=>x.textContent),resultRows:[...app.querySelectorAll('.result-list li')].map(x=>x.textContent),selectedResultCount:app.querySelector('[data-copy-role="selected-result-count"]')?.textContent||null,cta,ctaOrder:{dom,visual,tabbable,matches:JSON.stringify(dom)===JSON.stringify(visual)},overflow:document.documentElement.scrollWidth>innerWidth,width:innerWidth,actions:app.querySelector('.actions')?getComputedStyle(app.querySelector('.actions')).flexDirection:null}})()`);
}
async function screenshot(name) {
  const size = await evaluate(`({width:Math.max(document.documentElement.scrollWidth,innerWidth),height:Math.max(document.documentElement.scrollHeight,innerHeight)})`);
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
  writeFileSync(resolve(evidence, name), Buffer.from(result.data, "base64"));
}

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
mkdirSync(evidence, { recursive: true });
const report = { chatwork: [], google: [], responsive: [], sideEffects: [] };

// Chatwork: prepare, admin, back, zero, failure, select, interval, review, manual, complete, cancel.
await open(chatworkUrl);
report.chatwork.push(await screen("chatwork-prepare-connection"));
await click('[data-action="back"]'); report.chatwork.push(await screen("chatwork-admin-approval"));
await click('[data-action="next"]'); await screen("chatwork-prepare-connection");
await click('[data-action="next"]'); await screen("chatwork-register-connection");
await evaluate(`document.querySelector('#secret-link').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))`); await screen("chatwork-confirm-registration");
await check('#secret-confirmed'); await click('[data-action="next"]'); await screen("chatwork-discover");
await evaluate(`window.__realFetch=window.fetch;window.fetch=(u,o)=>String(u).includes('/api/discover')?Promise.resolve(new Response(JSON.stringify({rooms:{rooms:[]}}),{status:200,headers:{'content-type':'application/json'}})):window.__realFetch(u,o)`);
await click('[data-action="next"]'); report.chatwork.push(await screen("chatwork-discover-empty"));
await click('[data-action="retry"]'); await screen("chatwork-discover");
await evaluate(`window.fetch=(u,o)=>String(u).includes('/api/discover')?Promise.resolve(new Response(JSON.stringify({error:'synthetic failure detail'}),{status:500,headers:{'content-type':'application/json'}})):window.__realFetch(u,o)`);
await click('[data-action="next"]'); report.chatwork.push(await screen("chatwork-discover-failure"));
await evaluate(`window.fetch=window.__realFetch`); await click('[data-action="next"]'); await screen("chatwork-discover"); await click('[data-action="next"]');
const chatSelect = await screen("chatwork-select-rooms"); chatSelect.tabSequence = await actionTabSequence(); report.chatwork.push(chatSelect);
await check('.room-list input'); await click('[data-action="next"]'); report.chatwork.push(await screen("chatwork-select-interval"));
await click('[data-action="back"]'); const chatBack = await screen("chatwork-select-rooms"); if (!(await evaluate(`document.querySelector('.room-list input').checked`))) throw new Error("Chatwork back lost selection");
await click('[data-action="next"]'); await screen("chatwork-select-interval"); await check('input[value="manual"]'); await click('[data-action="next"]');
report.chatwork.push(await screen("chatwork-review")); await screenshot("chatwork-review-desktop.png");
await click('[data-action="next"]'); await waitFor(`document.querySelector('#app')?.dataset.screen.startsWith('chatwork-initial-result')||document.querySelector('#app')?.dataset.screen.startsWith('chatwork-settings-result')`); const chatResult = await observe(); report.chatwork.push(chatResult); await screenshot("chatwork-result-desktop.png");
if (chatResult.screen.startsWith("chatwork-initial-result") && (chatResult.resultRows.length !== 1 || !chatResult.resultRows[0].includes("営業チーム") || chatResult.resultRows[0].includes("商品開発") || !chatResult.selectedResultCount?.includes("0件"))) throw new Error("Chatwork initial result includes an unselected room or wrong selected count");
await click('[data-action="close"]'); report.chatwork.push(await screen("chatwork-complete"));
await open(chatworkUrl); await screen("chatwork-select-rooms"); await click('[data-action="back"]'); report.chatwork.push(await screen("chatwork-cancelled"));

// Google Chat onboarding: cancel, three preparations, auth failure, selection, interval, review, zero result, complete.
await open(googleNewUrl);
report.google.push(await screen("google-chat-prepare-cloud"));
await click('[data-action="back"]'); report.google.push(await screen("google-chat-cancelled"));
await click('[data-action="restart"]'); await screen("google-chat-prepare-cloud");
await click('[data-action="next"]'); report.google.push(await screen("google-chat-prepare-access"));
await click('[data-action="next"]'); report.google.push(await screen("google-chat-prepare-file"));
await setFileInput("#client-json", testClient.path); await click('[data-action="next"]'); report.google.push(await screen("google-chat-authorize"));
await evaluate(`fetch('/api/oauth/synthetic',{method:'POST',headers:{'content-type':'application/json'},body:'{"mode":"admin-blocked"}'}).then(r=>r.json())`); await send("Page.reload", { ignoreCache: true }); report.google.push(await screen("google-chat-authorize-failure")); await screenshot("google-chat-failure-desktop.png");
await click('[data-action="next"]'); await screen("google-chat-prepare-cloud");
await click('[data-action="next"]'); await screen("google-chat-prepare-access"); await click('[data-action="next"]'); await screen("google-chat-prepare-file");
await setFileInput("#client-json", testClient.path); await click('[data-action="next"]'); await screen("google-chat-authorize");
await evaluate(`window.__realFetch=window.fetch;window.fetch=(u,o)=>String(u).includes('/api/spaces')?Promise.resolve(new Response(JSON.stringify({error:'synthetic space discovery failure',code:'synthetic-discovery-failed'}),{status:503,headers:{'content-type':'application/json'}})):window.__realFetch(u,o)`);
await click('[data-action="synthetic"]'); const googleDiscoverFailureBack = await screen("google-chat-discover-failure"); report.google.push(googleDiscoverFailureBack); await screenshot("google-chat-discover-failure-desktop.png");
if (googleDiscoverFailureBack.state !== "error" || googleDiscoverFailureBack.cta.length !== 2 || !googleDiscoverFailureBack.details.some((item) => item.text.includes("synthetic-discovery-failed"))) throw new Error("Google discover failure state is incomplete");
await evaluate(`window.fetch=window.__realFetch`);
const beforeBack = await evaluate(`fetch('/api/bootstrap').then(r=>r.json()).then(x=>({configured:x.configured,oauth:x.oauth.status}))`); report.sideEffects.push({ action: "discover-failure-before-back", ...beforeBack });
await click('[data-action="back"]'); await screen("google-chat-cancelled");
const afterBack = await evaluate(`fetch('/api/bootstrap').then(r=>r.json()).then(x=>({configured:x.configured,oauth:x.oauth.status}))`); report.sideEffects.push({ action: "discover-failure-back", ...afterBack });
if (beforeBack.configured || afterBack.configured || afterBack.oauth !== "cancelled") throw new Error("Google discover failure back changed configuration or skipped cleanup");
await click('[data-action="restart"]'); await screen("google-chat-prepare-cloud");
await click('[data-action="next"]'); await screen("google-chat-prepare-access"); await click('[data-action="next"]'); await screen("google-chat-prepare-file");
await setFileInput("#client-json", testClient.path); await click('[data-action="next"]'); await screen("google-chat-authorize");
await evaluate(`window.__realFetch=window.fetch;window.fetch=(u,o)=>String(u).includes('/api/spaces')?Promise.resolve(new Response(JSON.stringify({error:'synthetic retry failure',code:'synthetic-retry-failed'}),{status:503,headers:{'content-type':'application/json'}})):window.__realFetch(u,o)`);
await click('[data-action="synthetic"]'); const googleDiscoverFailureRetry = await screen("google-chat-discover-failure"); googleDiscoverFailureRetry.tabSequence = await actionTabSequence(); report.google.push(googleDiscoverFailureRetry);
const beforeRetry = await evaluate(`fetch('/api/bootstrap').then(r=>r.json()).then(x=>({configured:x.configured,oauth:x.oauth.status}))`); report.sideEffects.push({ action: "discover-failure-before-retry", ...beforeRetry });
await evaluate(`window.fetch=window.__realFetch`); await click('[data-action="retry"]'); const googleSelect = await screen("google-chat-select-spaces"); googleSelect.tabSequence = await actionTabSequence(); report.google.push(googleSelect);
const afterRetry = await evaluate(`fetch('/api/bootstrap').then(r=>r.json()).then(x=>({configured:x.configured,oauth:x.oauth.status}))`); report.sideEffects.push({ action: "discover-failure-retry", ...afterRetry });
if (beforeRetry.configured || afterRetry.configured) throw new Error("Google discover retry changed configuration before consent");
await check('input[value="spaces/space-empty"]'); await click('[data-action="next"]'); report.google.push(await screen("google-chat-select-interval"));
await click('[data-action="back"]'); await screen("google-chat-select-spaces"); if (!(await evaluate(`document.querySelector('input[value="spaces/space-empty"]').checked`))) throw new Error("Google back lost selection");
await click('[data-action="next"]'); await screen("google-chat-select-interval"); await check('input[value="manual"]'); await click('[data-action="next"]'); report.google.push(await screen("google-chat-review")); await screenshot("google-chat-review-desktop.png");
await check('#save-consent'); await check('#git-consent'); await click('[data-action="next"]'); report.google.push(await screen("google-chat-initial-result-empty")); await screenshot("google-chat-empty-desktop.png");
await click('[data-action="close"]'); report.google.push(await screen("google-chat-complete"));

// Google Chat settings: selection 0 + manual only + history retention.
await open(googleSettingsUrl); await screen("google-chat-settings-select-spaces"); await click('[data-action="clear"]'); const zeroSelect = await screen("google-chat-settings-select-spaces"); report.google.push(zeroSelect);
await click('[data-action="next"]'); await screen("google-chat-settings-select-interval"); if (await evaluate(`!document.querySelector('[data-action="next"]').disabled`)) throw new Error("0 selection automatic should be blocked");
await check('input[value="manual"]'); await click('[data-action="next"]'); report.google.push(await screen("google-chat-settings-review"));
await check('#settings-git-consent'); await click('[data-action="next"]'); report.google.push(await screen("google-chat-settings-result-stopped")); await screenshot("google-chat-zero-manual-result.png");

// Responsive evidence: running UI at mobile and 200% equivalent; no overflow, 44px controls, closed details.
await open(chatworkUrl, 390, 844); await screen("chatwork-select-rooms"); const chatMobile = await observe(); chatMobile.tabSequence = await actionTabSequence(); report.responsive.push({ service: "chatwork", mode: "mobile", ...chatMobile }); await screenshot("chatwork-mobile.png");
await open(chatworkUrl, 720, 450, 2); await screen("chatwork-select-rooms"); const chatZoom = await observe(); chatZoom.tabSequence = await actionTabSequence(); report.responsive.push({ service: "chatwork", mode: "200%", ...chatZoom }); await screenshot("chatwork-zoom200.png");
await open(googleSettingsUrl, 390, 844); await screen("google-chat-settings-select-spaces"); const googleMobile = await observe(); googleMobile.tabSequence = await actionTabSequence(); report.responsive.push({ service: "google-chat", mode: "mobile", ...googleMobile }); await screenshot("google-chat-mobile.png");
await open(googleSettingsUrl, 720, 450, 2); await screen("google-chat-settings-select-spaces"); const googleZoom = await observe(); googleZoom.tabSequence = await actionTabSequence(); report.responsive.push({ service: "google-chat", mode: "200%", ...googleZoom }); await screenshot("google-chat-zoom200.png");

const all = [...report.chatwork, ...report.google, ...report.responsive];
const serviceColor = (item) => item.cta.filter((button) => button.bg !== "rgba(0, 0, 0, 0)").every((button) => item.service === "Chatworkの設定" ? button.bg === "rgb(240, 55, 71)" && button.fg === "rgb(0, 0, 0)" : button.bg === "rgb(17, 187, 98)" && button.fg === "rgb(0, 0, 0)");
const actionOrder = (item) => item.cta.length < 2 || (item.ctaOrder.matches && (!item.tabSequence || JSON.stringify(item.tabSequence.expected) === JSON.stringify(item.tabSequence.actual)));
const passed = browserErrors.length === 0 && all.every((item) => !item.forbidden && !item.overflow && item.details.every((detail) => !detail.open) && item.cta.every((button) => button.height >= 44) && serviceColor(item) && actionOrder(item))
  && report.chatwork.some((item) => item.screen === "chatwork-discover-empty") && report.chatwork.some((item) => item.screen === "chatwork-discover-failure") && report.chatwork.some((item) => item.screen === "chatwork-review" && item.safety.length === 5)
  && report.google.some((item) => item.screen === "google-chat-authorize-failure") && report.google.filter((item) => item.screen === "google-chat-discover-failure").length === 2 && report.google.some((item) => item.screen === "google-chat-select-spaces") && report.google.some((item) => item.screen === "google-chat-initial-result-empty") && report.google.some((item) => item.screen === "google-chat-review" && item.safety.length === 5)
  && report.sideEffects.every((item) => item.configured === false)
  && report.google.some((item) => item.screen === "google-chat-settings-result-stopped");
report.browserErrors = browserErrors;
report.passed = passed;
writeFileSync(resolve(evidence, "browser-evidence.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`SPRINT020_PATCH001_BROWSER_PASS=${passed ? all.length : 0} SPRINT020_PATCH001_BROWSER_FAIL=${passed ? 0 : 1} SCREENS=${all.length}\n`);
socket.close();
process.exit(passed ? 0 : 1);
