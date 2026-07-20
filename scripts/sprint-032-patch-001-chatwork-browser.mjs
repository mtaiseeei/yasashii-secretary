#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const cdp = args.get("--cdp") || "http://127.0.0.1:29331";
const chatworkUrl = args.get("--chatwork-url") || "http://127.0.0.1:18765/";
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
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text || "exception");
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

async function open(mode) {
  const metrics = mode === "mobile"
    ? { width: 390, height: 844, mobile: true, scale: 1 }
    : mode === "200%"
      ? { width: 640, height: 800, mobile: false, scale: 2 }
      : { width: 1440, height: 900, mobile: false, scale: 1 };
  await send("Emulation.setDeviceMetricsOverride", {
    width: metrics.width, height: metrics.height, deviceScaleFactor: 1, mobile: metrics.mobile,
    screenWidth: metrics.width, screenHeight: metrics.height,
  });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: metrics.scale });
  const url = new URL(chatworkUrl);
  url.searchParams.set("sprint032Patch001Browser", `${mode}-${Date.now()}-${nextId}`);
  await send("Page.navigate", { url: url.href });
  await waitFor(`document.readyState === "complete" && document.querySelector('#app[data-screen="chatwork-prepare-connection"] [data-action="next"]')`);
  await evaluate(`document.querySelector('#app [data-action="next"]').click()`);
  await waitFor(`document.querySelector('#app')?.dataset.screen === "chatwork-register-connection"`);
}

async function observe(mode) {
  return evaluate(`(() => {
    const app = document.querySelector('#app');
    const rows = [...app.querySelectorAll('[data-copy-role="secret-instructions"] .summary-row')]
      .map((row) => ({ label: row.querySelector('dt')?.textContent.trim(), value: row.querySelector('dd')?.textContent.trim() }));
    const controls = [...app.querySelectorAll('button,a,summary,input,label')].filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const secretLink = app.querySelector('#secret-link');
    return {
      mode: ${JSON.stringify(mode)},
      screen: app.dataset.screen,
      heading: app.querySelector('h1')?.textContent.trim(),
      rows,
      hint: app.querySelector('.hint')?.textContent.trim(),
      secretInputs: app.querySelectorAll('input[type="text"],input[type="password"],textarea').length,
      href: secretLink?.href || '',
      overflow: document.documentElement.scrollWidth > innerWidth,
      minControlHeight: controls.length ? Math.min(...controls.map((node) => node.getBoundingClientRect().height)) : 0,
      activeTag: document.activeElement?.tagName || '',
    };
  })()`);
}

await send("Page.enable");
await send("Runtime.enable");

const report = { views: [], browserErrors };
for (const mode of ["desktop", "mobile", "200%"]) {
  await open(mode);
  report.views.push(await observe(mode));
}

const passed = report.views.every((view) =>
  view.screen === "chatwork-register-connection"
  && view.heading === "接続情報をGitHubへ登録します。"
  && JSON.stringify(view.rows) === JSON.stringify([
    { label: "Name 欄", value: "CHATWORK_API_TOKEN" },
    { label: "Secret 欄", value: "Chatwork公式画面でご本人が取得したAPI Token" },
  ])
  && view.hint.includes("GitHubの登録画面にだけ入力します")
  && view.hint.includes("AIとの会話")
  && view.hint.includes("ログには貼り付けないでください")
  && view.secretInputs === 0
  && /^https:\/\/github\.com\/[^/]+\/[^/]+\/settings\/secrets\/actions\/new$/.test(view.href)
  && !view.overflow
  && view.minControlHeight >= 44
) && browserErrors.length === 0;

report.passed = passed;
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`SPRINT032_PATCH001_CHATWORK_BROWSER_PASS=${passed ? report.views.length : 0} SPRINT032_PATCH001_CHATWORK_BROWSER_FAIL=${passed ? 0 : 1}\n`);
socket.close();
process.exit(passed ? 0 : 1);
