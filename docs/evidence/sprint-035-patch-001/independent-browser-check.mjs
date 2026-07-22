#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:9237";
const evidenceDir = resolve(args.get("--evidence") || "docs/evidence/sprint-035-patch-001");
const targets = [
  {
    service: "Chatwork",
    url: args.get("--chatwork-url") || "http://127.0.0.1:18935/?direct=rooms",
    input: "#room-search",
    screen: "chatwork-select-rooms",
    composition: ["さ", "さい", "採用"],
    expectedJapanese: ["104"],
    expectedSelected: ["101", "102"],
    alpha: [
      { value: "14", caret: 1, expected: [] },
      { value: "104", caret: 2, expected: ["104"] },
      { value: "14", caret: 1, expected: [] },
      { value: "10", caret: 2, expected: ["101", "102", "103", "104"] },
      { value: "", caret: 0, expected: ["101", "102", "103", "104"] },
    ],
  },
  {
    service: "Google Chat",
    url: args.get("--google-url") || "http://127.0.0.1:18936/?direct=settings-spaces",
    input: "#settings-space-search",
    screen: "google-chat-settings-select-spaces",
    composition: ["ぜ", "ぜん", "全社"],
    expectedJapanese: ["spaces/space-c"],
    expectedSelected: ["spaces/space-a", "spaces/space-b"],
    alpha: [
      { value: "spacec", caret: 5, expected: [] },
      { value: "space-c", caret: 6, expected: ["spaces/space-c"] },
      { value: "spacec", caret: 5, expected: [] },
      { value: "space-", caret: 6, expected: ["spaces/space-a", "spaces/space-b", "spaces/space-c"] },
      { value: "", caret: 0, expected: ["spaces/space-a", "spaces/space-b", "spaces/space-c"] },
    ],
  },
];

const modes = {
  desktop: { width: 1440, height: 900, mobile: false, scale: 1 },
  mobile: { width: 390, height: 844, mobile: true, scale: 1 },
  "200pct": { width: 720, height: 450, mobile: false, scale: 2 },
};

const pages = await (await fetch(`${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("page target is unavailable");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", rejectOpen, { once: true });
});

let nextId = 1;
const pending = new Map();
const runtimeErrors = [];
const networkErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push({ type: "exception", text: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    runtimeErrors.push({ type: "console", text: message.params.args.map((arg) => arg.value || arg.description || "error").join(" ") });
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    runtimeErrors.push({ type: "log", text: message.params.entry.text, url: message.params.entry.url || "" });
  }
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    networkErrors.push({ status: message.params.response.status, url: message.params.response.url });
  }
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveResult, rejectResult) => pending.set(id, { resolve: resolveResult, reject: rejectResult }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(80);
  }
  throw new Error(`timeout: ${expression}`);
}

async function openPage(target, modeName) {
  const mode = modes[modeName];
  await send("Emulation.setDeviceMetricsOverride", {
    width: mode.width,
    height: mode.height,
    deviceScaleFactor: 1,
    mobile: mode.mobile,
    screenWidth: mode.width,
    screenHeight: mode.height,
  });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: mode.scale });
  const url = new URL(target.url);
  url.searchParams.set("independentEvaluator", `${Date.now()}-${modeName}`);
  await send("Page.navigate", { url: url.href });
  await waitFor(`document.readyState === "complete" && document.querySelector(${JSON.stringify(target.input)}) && document.querySelector("#app")?.dataset.screen === ${JSON.stringify(target.screen)}`);
}

async function captureScreenshot(fileName) {
  const dimensions = await evaluate("({width:Math.max(innerWidth,document.documentElement.scrollWidth),height:Math.max(innerHeight,document.documentElement.scrollHeight)})");
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
  });
  const bytes = Buffer.from(shot.data, "base64");
  const path = resolve(evidenceDir, fileName);
  writeFileSync(path, bytes);
  return { file: fileName, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

async function pressTab() {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
}

async function runScenario(target) {
  return evaluate(`(async () => {
    const config = ${JSON.stringify(target)};
    const app = document.querySelector("#app");
    const input = document.querySelector(config.input);
    const results = document.querySelector("[data-search-results]");
    const ids = () => [...document.querySelectorAll("[data-search-results] input[type=checkbox]")].map((node) => node.value);
    const checked = () => [...document.querySelectorAll("[data-search-results] input[type=checkbox]:checked")].map((node) => node.value);
    const allInitialIds = ids();
    const selectionClicks = [];
    for (const id of config.expectedSelected) {
      const checkbox = [...document.querySelectorAll("[data-search-results] input[type=checkbox]")].find((node) => node.value === id);
      if (!checkbox) throw new Error("選択対象が見つかりません: " + id);
      if (checkbox.checked) {
        checkbox.click();
        selectionClicks.push({ id, action: "uncheck", checked: checkbox.checked });
      }
      checkbox.click();
      selectionClicks.push({ id, action: "check", checked: checkbox.checked });
    }
    const selectedAtStart = checked();
    const inputNode = input;
    const screen = app.dataset.screen;
    let resultMutations = 0;
    let fullScreenMutations = 0;
    const resultObserver = new MutationObserver((entries) => { resultMutations += entries.length; });
    const appObserver = new MutationObserver((entries) => { fullScreenMutations += entries.length; });
    resultObserver.observe(results, { childList: true, subtree: true });
    appObserver.observe(app, { childList: true, subtree: false });
    const snapshot = (label) => ({
      label,
      value: input.value,
      activeId: document.activeElement?.id || null,
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd,
      sameInputNode: document.querySelector(config.input) === inputNode,
      sameScreen: app.dataset.screen === screen,
      displayedIds: ids(),
      visibleCheckedIds: checked(),
      resultMutations,
      fullScreenMutations,
    });
    const emitInput = async (value, caret, isComposing = false) => {
      input.value = value;
      input.focus();
      input.setSelectionRange(caret, caret);
      input.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        data: value,
        inputType: isComposing ? "insertCompositionText" : "insertText",
        isComposing,
      }));
      await Promise.resolve();
      return snapshot(value);
    };

    input.focus();
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
    const composingStates = [];
    for (const value of config.composition) composingStates.push(await emitInput(value, value.length, true));
    const duringComposition = snapshot("during-composition");
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: config.composition.at(-1) }));
    await Promise.resolve();
    const afterComposition = snapshot("after-composition");
    const resultMutationsAfterCommit = resultMutations;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: config.composition.at(-1), inputType: "insertText", isComposing: false }));
    await Promise.resolve();
    const afterFollowupInput = snapshot("after-followup-input");

    const afterJapaneseClear = await emitInput("", 0, false);
    const alphaStates = [];
    for (const step of config.alpha) alphaStates.push({ ...step, observed: await emitInput(step.value, step.caret, false) });
    const selectedAfterHiddenRoundTrip = checked();
    resultObserver.disconnect();
    appObserver.disconnect();
    return {
      screen,
      allInitialIds,
      selectionClicks,
      selectedAtStart,
      composingStates,
      duringComposition,
      afterComposition,
      resultMutationsAfterCommit,
      afterFollowupInput,
      afterJapaneseClear,
      alphaStates,
      selectedAfterHiddenRoundTrip,
      finalFullScreenMutations: fullScreenMutations,
    };
  })()`);
}

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function scenarioPasses(target, scenario) {
  const compositionStable = scenario.composingStates.every((state) =>
    state.sameInputNode && state.sameScreen && state.activeId === target.input.slice(1)
    && state.selectionStart === state.value.length && state.selectionEnd === state.value.length
    && state.resultMutations === 0 && state.fullScreenMutations === 0);
  const committedOnce = arraysEqual(scenario.afterComposition.displayedIds, target.expectedJapanese)
    && scenario.afterComposition.resultMutations > 0
    && scenario.afterComposition.fullScreenMutations === 0
    && scenario.afterComposition.sameInputNode
    && scenario.afterComposition.activeId === target.input.slice(1)
    && scenario.afterComposition.selectionStart === scenario.afterComposition.value.length;
  const duplicateSuppressed = scenario.afterFollowupInput.resultMutations === scenario.resultMutationsAfterCommit;
  const alpha = scenario.alphaStates.every((state) =>
    arraysEqual(state.observed.displayedIds, state.expected)
    && state.observed.value === state.value
    && state.observed.selectionStart === state.caret
    && state.observed.selectionEnd === state.caret
    && state.observed.sameInputNode
    && state.observed.sameScreen
    && state.observed.fullScreenMutations === 0);
  const selection = arraysEqual(scenario.selectedAtStart, target.expectedSelected)
    && arraysEqual(scenario.selectedAfterHiddenRoundTrip, target.expectedSelected);
  return compositionStable && committedOnce && duplicateSuppressed && alpha && selection;
}

mkdirSync(evidenceDir, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");

const report = {
  evaluatedAt: new Date().toISOString(),
  downstreamCandidate: "44066b9b4b834c4b5bfa24fa59fb08ebd2719b68",
  upstreamCandidate: "1cf2ae690a39ef822d204624d53ee183b386f715",
  surfaces: [],
  externalLive: {
    chatworkApi: "not-run",
    googleChatApi: "not-run",
    oauth: "not-run",
    repositorySecret: "not-run",
    githubActions: "not-run",
    upstreamRemoteWrite: "not-run",
    originRemoteWrite: "not-run",
  },
};

for (const target of targets) {
  for (const modeName of Object.keys(modes)) {
    const runtimeStart = runtimeErrors.length;
    const networkStart = networkErrors.length;
    await openPage(target, modeName);
    const scenario = await runScenario(target);
    const layoutBeforeRoundTrip = await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(target.input)});
      const actionRects = [...document.querySelectorAll("#app button,#app input.search,#app label.choice")]
        .map((node) => node.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
      return {
        url: location.href,
        screen: document.querySelector("#app")?.dataset.screen,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > innerWidth,
        minActionHeight: actionRects.length ? Math.min(...actionRects.map((rect) => rect.height)) : null,
        activeId: document.activeElement?.id || null,
        value: input.value,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      };
    })()`);
    await evaluate(`document.querySelector(${JSON.stringify(target.input)}).focus(); true`);
    await pressTab();
    const tabTarget = await evaluate("({tag:document.activeElement?.tagName||null,id:document.activeElement?.id||null,type:document.activeElement?.getAttribute('type')||null,action:document.activeElement?.dataset?.action||null})");
    const selectionBeforeRoundTrip = scenario.selectedAfterHiddenRoundTrip;
    await evaluate("document.querySelector('[data-action=next]')?.click(); true");
    await waitFor(`document.querySelector("#app")?.dataset.screen !== ${JSON.stringify(target.screen)}`);
    const forwardScreen = await evaluate("document.querySelector('#app')?.dataset.screen");
    await evaluate("document.querySelector('[data-action=back]')?.click(); true");
    await waitFor(`document.querySelector("#app")?.dataset.screen === ${JSON.stringify(target.screen)}`);
    const selectionAfterRoundTrip = await evaluate("[...document.querySelectorAll('[data-search-results] input[type=checkbox]:checked')].map((node)=>node.value)");
    const screenshot = await captureScreenshot(`${target.service === "Chatwork" ? "chatwork" : "google-chat"}-${modeName}.png`);
    const surfaceRuntime = runtimeErrors.slice(runtimeStart).filter((entry) => !/favicon\.ico/.test(entry.url || entry.text || ""));
    const surfaceNetwork = networkErrors.slice(networkStart).filter((entry) => !/favicon\.ico/.test(entry.url));
    const passed = scenarioPasses(target, scenario)
      && layoutBeforeRoundTrip.overflowX === false
      && layoutBeforeRoundTrip.minActionHeight >= 44
      && tabTarget.tag && tabTarget.tag !== "BODY"
      && arraysEqual(selectionBeforeRoundTrip, selectionAfterRoundTrip)
      && surfaceRuntime.length === 0
      && surfaceNetwork.length === 0;
    report.surfaces.push({
      service: target.service,
      mode: modeName,
      scenario,
      layout: layoutBeforeRoundTrip,
      tabTarget,
      roundTrip: { forwardScreen, before: selectionBeforeRoundTrip, after: selectionAfterRoundTrip },
      runtimeErrors: surfaceRuntime,
      networkErrors: surfaceNetwork,
      screenshot,
      passed,
    });
  }
}

report.runtimeErrors = runtimeErrors;
report.networkErrors = networkErrors;
report.passed = report.surfaces.length === 6 && report.surfaces.every((surface) => surface.passed);
writeFileSync(resolve(evidenceDir, "independent-browser-evidence.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`INDEPENDENT_BROWSER_PASS=${report.surfaces.filter((surface) => surface.passed).length} INDEPENDENT_BROWSER_FAIL=${report.surfaces.filter((surface) => !surface.passed).length}`);
socket.close();
process.exit(report.passed ? 0 : 1);
