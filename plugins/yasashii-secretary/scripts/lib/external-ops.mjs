import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export class ExternalTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label}が時間切れになりました。後続処理は行っていません。`);
    this.code = "timeout";
    this.timeoutMs = timeoutMs;
  }
}

function positiveTimeout(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stopProcessTree(pid, child, signal = "SIGTERM") {
  if (!pid) return;
  // 親processが先に終了してもdetached process groupは残り得る。
  // exitCodeでは打ち切らず、保存したgroup IDへ必ずsignalを送る。
  if (process.platform !== "win32") {
    try { process.kill(-pid, signal); return; } catch { /* group消滅時だけ直接killへfallbackする。 */ }
  }
  try { child?.kill(signal); } catch { /* 既に終了済み */ }
}

export function runExternal(binary, args = [], {
  cwd,
  env = process.env,
  input,
  timeoutMs = 30_000,
  maxBuffer = 2 * 1024 * 1024,
  label = binary,
  allowFailure = false,
  encoding = "utf8",
} = {}) {
  const limit = positiveTimeout(timeoutMs, 30_000);
  const bufferLimit = positiveTimeout(maxBuffer, 2 * 1024 * 1024);
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(binary, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const processGroupId = child.pid;
    const stdoutChunks = [];
    const stderrChunks = [];
    let bufferedBytes = 0;
    let settled = false;
    let terminationError = null;
    let closeResult = null;
    let timeoutTimer;
    let forceKillTimer;
    let postKillTimer;
    const output = () => {
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      return {
        stdout: encoding === null ? stdout : stdout.toString(encoding),
        stderr: encoding === null ? stderr : stderr.toString(encoding),
      };
    };
    const stopCapture = () => {
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
      child.stdout?.pause();
      child.stderr?.pause();
      child.stdout?.destroy();
      child.stderr?.destroy();
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceKillTimer);
      clearTimeout(postKillTimer);
      child.off("error", onError);
      child.off("close", onClose);
      stopCapture();
      callback(value);
    };
    const finishTermination = () => {
      const captured = output();
      finish(rejectRun, Object.assign(terminationError, captured, closeResult || {}, { killed: true }));
    };
    const beginTermination = (error) => {
      if (terminationError || settled) return;
      terminationError = error;
      stopCapture();
      try { child.stdin?.destroy(); } catch { /* stdinは既に閉じている場合がある。 */ }
      stopProcessTree(processGroupId, child, "SIGTERM");
      // 親がSIGTERMで先に終了しても、このescalationは取消さない。
      forceKillTimer = setTimeout(() => {
        stopProcessTree(processGroupId, child, "SIGKILL");
        postKillTimer = setTimeout(finishTermination, 25);
      }, 250);
    };
    const append = (chunks, chunk) => {
      if (terminationError || settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = Math.max(0, bufferLimit - bufferedBytes);
      if (remaining > 0) {
        const kept = bytes.length > remaining ? bytes.subarray(0, remaining) : bytes;
        chunks.push(kept);
        bufferedBytes += kept.length;
      }
      if (bytes.length > remaining) {
        beginTermination(Object.assign(new Error(`${label}の出力が上限を超えたため停止しました。`), { code: "max-buffer" }));
      }
    };
    function onStdout(chunk) { append(stdoutChunks, chunk); }
    function onStderr(chunk) { append(stderrChunks, chunk); }
    function onError(error) {
      if (terminationError) return;
      finish(rejectRun, error);
    }
    function onClose(status, signal) {
      closeResult = { status, signal };
      if (terminationError) return;
      const result = { ...output(), status, signal };
      if (status !== 0 && !allowFailure) return finish(rejectRun, Object.assign(new Error(`${label}に失敗しました。`), { code: status, ...result }));
      finish(resolveRun, result);
    }
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("error", onError);
    child.on("close", onClose);
    timeoutTimer = setTimeout(() => {
      beginTermination(new ExternalTimeoutError(label, limit));
    }, limit);
    timeoutTimer.unref?.();
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

function abortReason(signal) {
  if (signal?.reason !== undefined) return signal.reason;
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

export async function fetchWithTimeout(url, options = {}, {
  timeoutMs = 15_000,
  label = "外部HTTP",
  fetchImpl = fetch,
  headersOnly = false,
} = {}) {
  const limit = positiveTimeout(timeoutMs, 15_000);
  const controller = new AbortController();
  const upstream = options.signal;
  let timeoutError = null;
  let rejectControl;
  const controlPromise = new Promise((_, reject) => { rejectControl = reject; });
  const onAbort = () => {
    const reason = abortReason(upstream);
    controller.abort(reason);
    rejectControl(reason);
  };
  if (upstream?.aborted) onAbort();
  else upstream?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timeoutError = new ExternalTimeoutError(label, limit);
    controller.abort(timeoutError);
    rejectControl(timeoutError);
  }, limit);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    upstream?.removeEventListener?.("abort", onAbort);
  };
  const race = (operation) => Promise.race([operation, controlPromise]);
  try {
    const response = await race(Promise.resolve().then(() => fetchImpl(url, { ...options, signal: controller.signal })));
    if (!response || typeof response !== "object") {
      cleanup();
      return response;
    }
    if (headersOnly || response.body === null) cleanup();
    const bodyReaders = new Set(["arrayBuffer", "blob", "formData", "json", "text"]);
    return new Proxy(response, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, target);
        if (!bodyReaders.has(property) || typeof value !== "function") {
          return typeof value === "function" ? value.bind(target) : value;
        }
        return async (...args) => {
          try {
            return await race(Promise.resolve().then(() => value.apply(target, args)));
          } finally {
            cleanup();
          }
        };
      },
    });
  } catch (error) {
    cleanup();
    if (timeoutError && (error === timeoutError || controller.signal.reason === timeoutError)) throw timeoutError;
    throw error;
  }
}

export function runExternalSync(binary, args = [], options = {}) {
  const runner = fileURLToPath(new URL("./external-runner.mjs", import.meta.url));
  const maxBuffer = positiveTimeout(options.maxBuffer, 2 * 1024 * 1024);
  const payload = {
    binary,
    args,
    options: {
      ...options,
      env: options.env || process.env,
      input: options.input === undefined ? null : (Buffer.isBuffer(options.input) ? options.input : Buffer.from(String(options.input))).toString("base64"),
    },
  };
  const result = spawnSync(process.execPath, [runner], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    maxBuffer: Math.max(1024 * 1024, Math.ceil(maxBuffer * 3)),
    env: process.env,
  });
  if (result.error) throw result.error;
  let message;
  try { message = JSON.parse(result.stdout || "{}"); }
  catch { throw Object.assign(new Error("外部処理の安全な実行結果を読み取れませんでした。"), { code: "external-runner-failed", stderr: result.stderr }); }
  const decoded = {
    stdout: options.encoding === null ? Buffer.from(message.stdout || "", "base64") : Buffer.from(message.stdout || "", "base64").toString(options.encoding || "utf8"),
    stderr: options.encoding === null ? Buffer.from(message.stderr || "", "base64") : Buffer.from(message.stderr || "", "base64").toString(options.encoding || "utf8"),
    status: message.status ?? null,
    signal: message.signal ?? null,
  };
  if (message.ok) return decoded;
  const error = Object.assign(new Error(message.message || `${options.label || binary}に失敗しました。`), decoded, {
    name: message.name || "Error",
    code: message.code,
    timeoutMs: message.timeoutMs,
    killed: message.killed,
  });
  throw error;
}
