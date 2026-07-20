import { lstatSync, mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

function stat(path) {
  try { return lstatSync(path); } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function inside(root, target) {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function workingRoot(value) {
  const path = resolve(value || ".");
  const root = parse(path).root;
  let cursor = root;
  for (const component of relative(root, path).split(sep).filter(Boolean)) {
    cursor = join(cursor, component);
    if (stat(cursor)?.isSymbolicLink()) throw Object.assign(new Error("working rootの途中にsymlinkがあるため、安全に操作できません。"), { code: "working-root-unsafe" });
  }
  const current = stat(path);
  if (!current?.isDirectory() || current.isSymbolicLink()) throw Object.assign(new Error("working rootを安全に確認できません。"), { code: "working-root-unsafe" });
  return realpathSync(path);
}

export function safeWritePath(rootValue, value) {
  const root = workingRoot(rootValue);
  const requested = resolve(root, value);
  if (!inside(root, requested) || requested === root) throw Object.assign(new Error("working rootの外は変更できません。"), { code: "filesystem-boundary" });
  let cursor = requested;
  const suffix = [];
  while (cursor !== root && !stat(cursor)) {
    suffix.unshift(cursor.slice(dirname(cursor).length + 1));
    cursor = dirname(cursor);
  }
  let ancestor;
  try { ancestor = realpathSync(cursor); } catch { throw Object.assign(new Error("書込み先の実体を確認できません。"), { code: "filesystem-boundary" }); }
  if (!inside(root, ancestor)) throw Object.assign(new Error("symlink経由でworking rootの外は変更できません。"), { code: "symlink-boundary" });
  const target = resolve(ancestor, ...suffix);
  if (!inside(root, target) || target === root) throw Object.assign(new Error("working rootの外は変更できません。"), { code: "filesystem-boundary" });
  return target;
}

export function writeFileAtomicSafe(root, value, content, options = {}) {
  const normalizedRoot = workingRoot(root);
  const path = safeWritePath(normalizedRoot, value);
  const parent = dirname(path) === normalizedRoot ? normalizedRoot : safeWritePath(normalizedRoot, dirname(path));
  mkdirSync(parent, { recursive: true });
  const temporary = safeWritePath(normalizedRoot, `${path}.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(temporary, content, { ...options, flag: "wx" });
    if (safeWritePath(normalizedRoot, path) !== path) throw Object.assign(new Error("書込み先が途中で変わりました。"), { code: "target-changed" });
    renameSync(temporary, path);
  } finally {
    try { if (stat(temporary)) rmSync(temporary, { force: true }); } catch { /* 元errorを保持 */ }
  }
  return path;
}

export async function fetchWithTimeout(url, options = {}, settings = {}) {
  const { timeoutMs = 15_000, label = "外部HTTP", fetchImpl = fetch, headersOnly = false } = settings;
  const limit = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 15_000;
  const controller = new AbortController();
  const upstream = options.signal;
  let timeoutError = null;
  let rejectControl;
  const control = new Promise((_, reject) => { rejectControl = reject; });
  const onAbort = () => {
    const reason = upstream?.reason ?? Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    controller.abort(reason);
    rejectControl(reason);
  };
  if (upstream?.aborted) onAbort();
  else upstream?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timeoutError = Object.assign(new Error(`${label}が時間切れになりました。後続処理は行っていません。`), { code: "timeout", timeoutMs: limit });
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
  const race = (operation) => Promise.race([operation, control]);
  try {
    const response = await race(Promise.resolve().then(() => fetchImpl(url, { ...options, signal: controller.signal })));
    if (!response || typeof response !== "object") { cleanup(); return response; }
    if (headersOnly || response.body === null) cleanup();
    const readers = new Set(["arrayBuffer", "blob", "formData", "json", "text"]);
    return new Proxy(response, { get(target, property, receiver) {
        const value = Reflect.get(target, property, target);
      if (!readers.has(property) || typeof value !== "function") return typeof value === "function" ? value.bind(target) : value;
      return async (...args) => { try { return await race(Promise.resolve().then(() => value.apply(target, args))); } finally { cleanup(); } };
    } });
  } catch (error) {
    cleanup();
    if (timeoutError && (error === timeoutError || controller.signal.reason === timeoutError)) throw timeoutError;
    throw error;
  }
}
