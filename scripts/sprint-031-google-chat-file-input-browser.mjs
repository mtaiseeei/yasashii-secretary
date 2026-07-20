#!/usr/bin/env node

import { basename, resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:29331";
const googleUrl = args.get("--google-url") || "http://127.0.0.1:18783/";
const testClient = args.get("--test-client");
if (!testClient) throw new Error("--test-client is required");
const testClientPath = resolve(testClient);
const expectedName = "Google Cloudから取得した接続用ファイル";
const delay = (ms) => new Promise((accept) => setTimeout(accept, ms));

const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page" && item.url === "about:blank")
  || pages.find((item) => item.type === "page" && item.url.includes("127.0.0.1"))
  || pages.find((item) => item.type === "page");
if (!page) throw new Error("browser page target not found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((accept, reject) => {
  socket.addEventListener("open", accept, { once: true });
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
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(`exception: ${message.params.exceptionDetails.text || "unknown"}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") browserErrors.push("console.error");
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
    await delay(80);
  }
  throw new Error(`timeout: ${expression}`);
}

async function key(key, modifiers = 0) {
  const code = key === "Tab" ? "Tab" : key === "Enter" ? "Enter" : key === " " ? "Space" : key;
  const windowsVirtualKeyCode = key === "Tab" ? 9 : key === "Enter" ? 13 : key === " " ? 32 : 0;
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode });
}

async function open(mode) {
  const metrics = mode === "mobile"
    ? { width: 390, height: 844, mobile: true, scale: 1 }
    : mode === "200%"
      ? { width: 640, height: 800, mobile: false, scale: 2 }
      : { width: 1440, height: 900, mobile: false, scale: 1 };
  await send("Emulation.setDeviceMetricsOverride", {
    width: metrics.width,
    height: metrics.height,
    deviceScaleFactor: 1,
    mobile: metrics.mobile,
    screenWidth: metrics.width,
    screenHeight: metrics.height,
  });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: metrics.scale });
  const url = new URL(googleUrl);
  url.searchParams.set("sprint031Browser", `${mode}-${Date.now()}-${nextId}`);
  await send("Page.navigate", { url: url.href });
  await waitFor(`document.readyState === "complete" && document.querySelector('#app[data-screen="google-chat-prepare-file"] #client-json')`);
}

async function accessibleName(selector) {
  const remote = await send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)})` });
  const objectId = remote.result.objectId;
  if (!objectId) return "";
  const tree = await send("Accessibility.getPartialAXTree", { objectId, fetchRelatives: false });
  return tree.nodes?.[0]?.name?.value || "";
}

async function setFile(selector, path) {
  const document = await send("DOM.getDocument", { depth: 0 });
  const selected = await send("DOM.querySelector", { nodeId: document.root.nodeId, selector });
  if (!selected.nodeId) throw new Error(`file input not found: ${selector}`);
  await send("DOM.setFileInputFiles", { nodeId: selected.nodeId, files: [path] });
}

async function observe(mode) {
  const name = await accessibleName("#client-json");
  const keyboard = await evaluate(`({
    activeId: document.activeElement?.id || "",
    focusVisible: document.querySelector('#client-json')?.matches(':focus-visible') === true,
    outlineStyle: getComputedStyle(document.querySelector('#client-json')).outlineStyle,
    outlineWidth: getComputedStyle(document.querySelector('#client-json')).outlineWidth
  })`);
  const ui = await evaluate(`(() => {
    const visibleEnabled = (node) => {
      if (!node || node.disabled || node.getAttribute('aria-disabled') === 'true') return false;
      let current = node;
      while (current) {
        const style = getComputedStyle(current);
        if (current.hidden || current.inert || current.getAttribute?.('aria-hidden') === 'true' ||
            style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' ||
            style.opacity === '0' || style.pointerEvents === 'none' ||
            (current.tagName === 'DETAILS' && !current.open && current !== node && node.tagName !== 'SUMMARY')) return false;
        current = current.parentElement;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('#app button,#app a,#app summary,#app input[type="file"],#app label.choice,#app label.consent')]
      .filter(visibleEnabled);
    const file = document.querySelector('#client-json');
    const fileRect = file.getBoundingClientRect();
    const pointTarget = document.elementFromPoint(fileRect.left + fileRect.width / 2, fileRect.top + fileRect.height / 2);
    return {
      screen: document.querySelector('#app')?.dataset.screen,
      heading: document.querySelector('#app h1')?.textContent || "",
      overflow: document.documentElement.scrollWidth > innerWidth,
      controlHeights: controls.map((node) => ({ tag: node.tagName, id: node.id || "", height: node.getBoundingClientRect().height })),
      file: {
        visibleEnabled: visibleEnabled(file),
        width: fileRect.width,
        height: fileRect.height,
        pointerEvents: getComputedStyle(file).pointerEvents,
        opacity: getComputedStyle(file).opacity,
        centerHitIsFile: pointTarget === file,
        labelFor: document.querySelector('label[for="client-json"]')?.htmlFor || "",
        accept: file.accept,
        fileCount: file.files?.length || 0,
        selectedName: file.files?.[0]?.name || "",
      },
      nextDisabled: document.querySelector('[data-action="next"]')?.disabled === true,
    };
  })()`);
  return { mode, accessibleName: name, keyboard, ...ui };
}

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
await send("Accessibility.enable");

const report = { views: [], browserErrors };
for (const mode of ["desktop", "mobile", "200%"]) {
  await open(mode);
  const initialFocus = await evaluate(`({tag:document.activeElement?.tagName,id:document.activeElement?.id})`);
  await key("Tab");
  await waitFor(`document.activeElement?.id === "client-json"`);
  const before = await observe(mode);
  await setFile("#client-json", testClientPath);
  await waitFor(`document.querySelector('#client-json').files?.length === 1 && document.querySelector('[data-action="next"]').disabled === false`);
  const after = await observe(mode);
  await key("Tab");
  await waitFor(`document.activeElement?.tagName === "SUMMARY"`);
  await key("Enter");
  await waitFor(`document.querySelector('#app details')?.open === true`);
  const summaryKeyboard = await evaluate(`({tag:document.activeElement?.tagName,open:document.querySelector('#app details')?.open === true})`);
  report.views.push({ initialFocus, before, after, summaryKeyboard });
}

const passed = report.views.every(({ initialFocus, before, after, summaryKeyboard }) =>
  initialFocus.tag === "H1"
  && before.accessibleName === expectedName
  && before.keyboard.activeId === "client-json"
  && before.keyboard.focusVisible
  && before.keyboard.outlineStyle !== "none"
  && Number.parseFloat(before.keyboard.outlineWidth) > 0
  && !before.overflow
  && before.file.visibleEnabled
  && before.file.height >= 44
  && before.file.pointerEvents !== "none"
  && before.file.opacity !== "0"
  && before.file.centerHitIsFile
  && before.file.labelFor === "client-json"
  && before.file.accept.includes(".json")
  && before.controlHeights.length > 0
  && before.controlHeights.every((control) => control.height >= 44)
  && before.nextDisabled
  && after.file.fileCount === 1
  && after.file.selectedName === basename(testClientPath)
  && !after.nextDisabled
  && summaryKeyboard.tag === "SUMMARY"
  && summaryKeyboard.open
) && browserErrors.length === 0;

report.passed = passed;
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`SPRINT031_FILE_INPUT_BROWSER_PASS=${passed ? report.views.length : 0} SPRINT031_FILE_INPUT_BROWSER_FAIL=${passed ? 0 : 1}\n`);
socket.close();
process.exit(passed ? 0 : 1);
