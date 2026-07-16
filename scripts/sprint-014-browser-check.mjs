#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:9224";
const targetUrl = args.get("--url") || "http://127.0.0.1:8765/";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("browser page target not found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 1;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id); pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error))); else waiter.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text || "exception");
});
function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "evaluation failed");
  return result.result.value;
}
async function waitFor(expression, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`timeout: ${expression}`);
}
async function open(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await send("Page.navigate", { url: targetUrl });
  await waitFor('document.readyState === "complete" && document.querySelectorAll(".room-list input").length === 4');
}

await send("Page.enable");
await send("Runtime.enable");
await open(1440, 900);
const initial = await evaluate(`({rooms:document.querySelectorAll('.room-list input').length,selected:document.querySelectorAll('.room-list input:checked').length,nextDisabled:document.querySelector('.button-primary').disabled})`);
await evaluate(`document.querySelector('input[value="101"]').click();document.querySelector('input[value="102"]').click();document.querySelector('[data-action="next"]').click();true`);
await waitFor(`document.querySelectorAll('input[name="interval"]').length === 6`);
await evaluate(`document.querySelector('input[name="interval"][value="6h"]').click();document.querySelector('[data-action="next"]').click();true`);
await waitFor(`document.querySelector('#automatic-consent') !== null`);
const review = await evaluate(`({
  text:document.querySelector('#app').innerText,
  consentChecked:document.querySelector('#automatic-consent').checked,
  confirmDisabled:document.querySelector('[data-action="next"]').disabled,
  ctaCount:document.querySelectorAll('.actions .button').length
})`);
await evaluate(`document.querySelector('#automatic-consent').click();true`);
const consent = await evaluate(`({checked:document.querySelector('#automatic-consent').checked,confirmDisabled:document.querySelector('[data-action="next"]').disabled})`);
await evaluate(`(() => {
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(url,options)=>String(url).endsWith('/api/confirm')
    ? Promise.resolve(new Response(JSON.stringify({error:'GitHubの書込権限を確認できません。repoのActions権限を確認してください。'}),{status:400,headers:{'content-type':'application/json'}}))
    : nativeFetch(url,options);
  document.querySelector('[data-action="next"]').click();
  return true;
})()`);
await waitFor(`document.querySelector('[role="alert"]') !== null`);
const errorState = await evaluate(`({message:document.querySelector('[role="alert"]').textContent,buttonEnabled:!document.querySelector('[data-action="next"]').disabled})`);

await open(390, 844, true);
const mobile = await evaluate(`({
  columns:getComputedStyle(document.querySelector('.room-list')).gridTemplateColumns,
  actionDirection:getComputedStyle(document.querySelector('.actions')).flexDirection,
  horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
  buttonHeights:[...document.querySelectorAll('button')].map((button)=>button.getBoundingClientRect().height),
  labels:[...document.querySelectorAll('input')].every((input)=>input.closest('label')||document.querySelector('label[for="'+input.id+'"]'))
})`);
const report = { initial, review, consent, errorState, mobile, browserErrors: errors };
const passed = initial.rooms === 4 && initial.selected === 0 && initial.nextDisabled
  && review.text.includes("営業チーム") && review.text.includes("6時間") && review.text.includes("自動取得・commit・push")
  && !review.consentChecked && review.confirmDisabled && review.ctaCount === 2
  && consent.checked && !consent.confirmDisabled
  && errorState.message.includes("GitHubの書込権限") && errorState.buttonEnabled
  && mobile.actionDirection === "column-reverse" && !mobile.horizontalOverflow
  && mobile.buttonHeights.every((height) => height >= 44) && mobile.labels && errors.length === 0;
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
socket.close();
process.exit(passed ? 0 : 1);
