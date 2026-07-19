#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildObserveExpression } from "./sprint-027-browser-expression.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:9228";
const chatworkUrl = args.get("--chatwork-url");
const googleUrl = args.get("--google-url");
const screenshotDir = resolve(args.get("--screenshots") || "/tmp/sprint-027-browser");
if (!chatworkUrl || !googleUrl) throw new Error("--chatwork-url and --google-url are required");

const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("browser page target not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((accept, reject) => { socket.addEventListener("open", accept, { once: true }); socket.addEventListener("error", reject, { once: true }); });
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
const delay = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(80);
  }
  throw new Error(`timeout: ${expression}`);
}
async function screenshot(name) {
  const size = await evaluate("({width:Math.max(document.documentElement.scrollWidth,innerWidth),height:Math.max(document.documentElement.scrollHeight,innerHeight)})");
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
  writeFileSync(resolve(screenshotDir, name), Buffer.from(result.data, "base64"));
}
async function open(url, mode) {
  const config = mode === "mobile" ? { width: 390, height: 844, mobile: true, scale: 1 } : mode === "200%" ? { width: 720, height: 450, mobile: false, scale: 2 } : { width: 1440, height: 900, mobile: false, scale: 1 };
  await send("Emulation.setDeviceMetricsOverride", { width: config.width, height: config.height, deviceScaleFactor: 1, mobile: config.mobile, screenWidth: config.width, screenHeight: config.height });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: config.scale });
  await send("Page.navigate", { url: `${url}${url.includes("?") ? "&" : "?"}qa=${Date.now()}-${nextId}` });
  await waitFor("document.readyState === 'complete' && document.querySelector('#app[data-screen]')");
}
async function click(selector) {
  const ok = await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return false;node.click();return true})()`);
  if (!ok) throw new Error(`missing click target: ${selector}`);
}
async function observe(mode, service) {
  return { mode, service, ...(await evaluate(buildObserveExpression())) };
}
async function checkCaret(inputSelector) {
  return evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(inputSelector)});if(!input)return {available:false};input.focus();input.value='検索文字';input.setSelectionRange(2,2);input.dispatchEvent(new Event('input',{bubbles:true}));return {available:true,activeId:document.activeElement?.id,selectionStart:document.activeElement?.selectionStart,selectionEnd:document.activeElement?.selectionEnd}})()`);
}

mkdirSync(screenshotDir, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
const report = { screens: [], caret: [], screenshots: screenshotDir };

for (const mode of ["desktop", "mobile", "200%"]) {
  await open(chatworkUrl, mode);
  await waitFor("document.querySelector('#room-search')");
  const caret = await checkCaret("#room-search");
  report.caret.push({ service: "Chatwork", mode, ...caret });
  const first = await evaluate("document.querySelector('.room-list input')?.value || null");
  if (first && !(await evaluate("document.querySelector('.room-list input')?.checked"))) await click('.room-list input');
  await screenshot(`chatwork-${mode}.png`);
  report.screens.push(await observe(mode, "Chatwork"));
  await click('[data-action="next"]');
  await waitFor("document.querySelector('#app[data-screen] h1') && document.querySelector('#app').dataset.screen.includes('select-interval')");
  report.screens.push(await observe(mode, "Chatwork-step-transition"));
}

await open(googleUrl, "desktop");
await evaluate("fetch('/api/oauth/synthetic',{method:'POST',headers:{'content-type':'application/json'},body:'{\"mode\":\"success\"}'}).then(()=>true)");
await send("Page.reload", { ignoreCache: true });
await waitFor("document.querySelector('.room-list input')");
for (const mode of ["desktop", "mobile", "200%"]) {
  if (mode !== "desktop") { await open(googleUrl, mode); await waitFor("document.querySelector('.room-list input')"); }
  const caret = await checkCaret("#space-search");
  report.caret.push({ service: "Google Chat", mode, ...caret });
  const first = await evaluate("document.querySelector('.room-list input')?.value || null");
  if (first && !(await evaluate("document.querySelector('.room-list input')?.checked"))) await click('.room-list input');
  await screenshot(`google-chat-${mode}.png`);
  report.screens.push(await observe(mode, "Google Chat"));
  await click('[data-action="next"]');
  await waitFor("document.querySelector('#app[data-screen] h1') && document.querySelector('#app').dataset.screen.includes('select-interval')");
  report.screens.push(await observe(mode, "Google Chat-step-transition"));
}

const focusTransitions = report.screens.filter((item) => item.service.endsWith("step-transition"));
const passed = browserErrors.length === 0
  && report.screens.every((item) => !item.overflow && item.overlapCount === 0 && item.controlMinHeight >= 44 && item.summaryClosed)
  && report.caret.every((item) => item.available && item.activeId && item.selectionStart === 2 && item.selectionEnd === 2)
  && focusTransitions.every((item) => item.active.tag === "H1" && item.active.name.length > 0);
report.browserErrors = browserErrors;
report.passed = passed;
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`SPRINT027_BROWSER_PASS=${passed ? report.screens.length : 0} SPRINT027_BROWSER_FAIL=${passed ? 0 : 1}\n`);
socket.close();
process.exit(passed ? 0 : 1);
