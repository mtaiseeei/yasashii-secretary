import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

export class FilesystemBoundaryError extends Error {
  constructor(message, code = "filesystem-boundary", details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function lstatOptional(path) {
  try { return lstatSync(path); } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function insideOrSame(root, target) {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function isPlatformRootAlias(path) {
  if (process.platform !== "darwin" || (path !== "/var" && path !== "/tmp")) return false;
  try {
    const resolved = realpathSync(path);
    return (path === "/var" && resolved === "/private/var") || (path === "/tmp" && resolved === "/private/tmp");
  } catch { return false; }
}

const rootGuards = new Map();

export function registerWorkingRootGuard(rootValue, guard) {
  const root = realpathSync(resolve(rootValue));
  if (typeof guard !== "function") rootGuards.delete(root);
  else rootGuards.set(root, guard);
  return root;
}

function checkWorkingRootGuard(root) {
  const guard = rootGuards.get(root);
  if (guard) guard();
}

export function workingRoot(value, { allowAncestorSymlinks = false } = {}) {
  const requested = resolve(value || ".");
  const root = parse(requested).root;
  let cursor = root;
  const components = relative(root, requested).split(sep).filter(Boolean);
  for (const component of components) {
    cursor = join(cursor, component);
    const componentStat = lstatOptional(cursor);
    if (!componentStat?.isSymbolicLink() || isPlatformRootAlias(cursor)) continue;
    if (!allowAncestorSymlinks) {
      throw new FilesystemBoundaryError("working rootの途中にsymlinkがあるため、変更を止めました。", "working-root-unsafe");
    }
    if (cursor === requested) {
      throw new FilesystemBoundaryError("working root自身がsymlinkのため、変更を止めました。物理Repoのdirectoryを指定してください。", "root-self-symlink");
    }
    let target;
    try { target = realpathSync(cursor); }
    catch {
      throw new FilesystemBoundaryError("working rootより上のancestor symlinkが壊れているため、変更を止めました。", "ancestor-symlink-broken");
    }
    let targetStat;
    try { targetStat = statSync(target); }
    catch {
      throw new FilesystemBoundaryError("working rootより上のancestor symlinkの実体を確認できないため、変更を止めました。", "ancestor-symlink-broken");
    }
    if (!targetStat.isDirectory()) {
      throw new FilesystemBoundaryError("working rootより上のancestor symlinkがdirectory以外を指すため、変更を止めました。", "ancestor-symlink-not-directory");
    }
  }
  const stat = lstatOptional(requested);
  if (stat?.isSymbolicLink() && isPlatformRootAlias(requested)) {
    const physical = realpathSync(requested);
    if (!statSync(physical).isDirectory()) {
      throw new FilesystemBoundaryError("working rootが通常のdirectoryではないため、変更を止めました。", "working-root-unsafe");
    }
    return physical;
  }
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    const code = allowAncestorSymlinks && stat?.isSymbolicLink() ? "root-self-symlink" : "working-root-unsafe";
    throw new FilesystemBoundaryError("working rootが通常のdirectoryではないため、変更を止めました。", code);
  }
  return realpathSync(requested);
}

function lexicalTarget(root, value) {
  const target = resolve(root, value);
  if (!insideOrSame(root, target) || target === root) {
    throw new FilesystemBoundaryError("working rootの外は変更できません。", "filesystem-boundary");
  }
  return target;
}

function deepestExisting(path, stop) {
  let cursor = path;
  const suffix = [];
  while (cursor !== stop) {
    const stat = lstatOptional(cursor);
    if (stat) return { cursor, stat, suffix };
    suffix.unshift(cursor.slice(dirname(cursor).length + 1));
    cursor = dirname(cursor);
  }
  return { cursor: stop, stat: lstatSync(stop), suffix };
}

export function safeWritePath(rootValue, value) {
  const root = workingRoot(rootValue);
  checkWorkingRootGuard(root);
  const target = lexicalTarget(root, value);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { cursor, stat, suffix } = deepestExisting(target, root);
    if (stat.isSymbolicLink()) {
      let resolved;
      try { resolved = realpathSync(cursor); }
      catch (error) {
        if (error?.code === "ENOENT") continue;
        throw new FilesystemBoundaryError("壊れたsymlinkを含むため、変更を止めました。", "symlink-boundary");
      }
      if (!insideOrSame(root, resolved)) {
        throw new FilesystemBoundaryError("symlink経由でworking rootの外は変更できません。", "symlink-boundary");
      }
    }
    let resolvedAncestor;
    try { resolvedAncestor = realpathSync(cursor); }
    catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new FilesystemBoundaryError("書込み先の実体を確認できないため、変更を止めました。", "filesystem-boundary");
    }
    if (!insideOrSame(root, resolvedAncestor)) {
      throw new FilesystemBoundaryError("symlink経由でworking rootの外は変更できません。", "symlink-boundary");
    }
    const resolvedTarget = resolve(resolvedAncestor, ...suffix);
    if (!insideOrSame(root, resolvedTarget) || resolvedTarget === root) {
      throw new FilesystemBoundaryError("working rootの外は変更できません。", "filesystem-boundary");
    }
    return resolvedTarget;
  }
  throw new FilesystemBoundaryError("書込み先が同時に変わったため、安全を確認できません。", "filesystem-target-changed");
}

export function safeDeletePath(rootValue, value) {
  const root = workingRoot(rootValue);
  checkWorkingRootGuard(root);
  const target = lexicalTarget(root, value);
  const parent = dirname(target) === root ? root : safeWritePath(root, dirname(target));
  const finalTarget = resolve(parent, target.slice(dirname(target).length + 1));
  if (!insideOrSame(root, finalTarget) || finalTarget === root) {
    throw new FilesystemBoundaryError("working rootの外は削除できません。", "filesystem-boundary");
  }
  return finalTarget;
}

export function ensureSafeDirectory(root, value) {
  const normalizedRoot = workingRoot(root);
  const requested = resolve(normalizedRoot, value);
  const path = requested === normalizedRoot ? normalizedRoot : safeWritePath(normalizedRoot, requested);
  mkdirSync(path, { recursive: true });
  return path;
}

export function writeFileSafe(root, value, content, options) {
  const path = safeWritePath(root, value);
  ensureSafeDirectory(root, dirname(path));
  writeFileSync(path, content, options);
  return path;
}

export function writeFileAtomicSafe(root, value, content, options = {}) {
  const path = safeWritePath(root, value);
  ensureSafeDirectory(root, dirname(path));
  const temporary = safeWritePath(root, `${path}.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(temporary, content, { ...options, flag: "wx" });
    // 書込みとrenameの間にも境界を再確認し、候補の差替えを拒否する。
    if (safeWritePath(root, path) !== path || safeWritePath(root, temporary) !== temporary) {
      throw new FilesystemBoundaryError("書込み先が途中で変わったため、変更を止めました。", "filesystem-target-changed");
    }
    renameSync(temporary, path);
  } finally {
    try {
      const temporaryStat = lstatOptional(temporary);
      if (temporaryStat && !temporaryStat.isSymbolicLink()) rmSync(temporary, { force: true });
      else if (temporaryStat?.isSymbolicLink()) unlinkSync(temporary);
    } catch { /* 一時fileの後始末失敗は元のerrorを置き換えない。 */ }
  }
  return path;
}

export function renameSafe(root, from, to) {
  const source = safeWritePath(root, from);
  const destination = safeWritePath(root, to);
  ensureSafeDirectory(root, dirname(destination));
  const sourceStat = lstatOptional(source);
  if (!sourceStat || sourceStat.isSymbolicLink()) {
    throw new FilesystemBoundaryError("移動元を安全に確認できないため、変更を止めました。", "rename-source-unsafe");
  }
  renameSync(source, destination);
  return destination;
}

export function removeSafe(root, value, { recursive = false } = {}) {
  const path = safeDeletePath(root, value);
  const stat = lstatOptional(path);
  if (!stat) return { removed: false, kind: "missing" };
  if (stat.isSymbolicLink()) {
    unlinkSync(path);
    return { removed: true, kind: "symlink" };
  }
  if (stat.isDirectory()) {
    if (!recursive) throw new FilesystemBoundaryError("directoryの削除には再帰削除の明示が必要です。", "delete-confirmation-required");
    rmSync(path, { recursive: true });
    return { removed: true, kind: "directory" };
  }
  rmSync(path);
  return { removed: true, kind: "file" };
}

// Node.js 22 on Windows can crash while cpSync recursively copies a directory
// whose path contains Japanese characters. Walk the tree ourselves and copy
// only one entry at a time. Symbolic links are copied as link objects and are
// never traversed.
export function copyTreeNoFollow(source, destination) {
  if (lstatOptional(destination)) {
    throw new FilesystemBoundaryError("コピー先が既に存在するため変更を止めました。", "copy-target-exists");
  }
  const stat = lstatOptional(source);
  if (!stat) {
    throw new FilesystemBoundaryError("コピー元を確認できないため変更を止めました。", "copy-source-missing");
  }
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(source);
    let type;
    if (process.platform === "win32") {
      try { type = statSync(source).isDirectory() ? "junction" : "file"; }
      catch { type = "file"; }
    }
    symlinkSync(target, destination, type);
    return destination;
  }
  if (stat.isFile()) {
    copyFileSync(source, destination, constants.COPYFILE_EXCL);
    return destination;
  }
  if (!stat.isDirectory()) {
    throw new FilesystemBoundaryError("通常file／directory以外はコピーできません。", "copy-source-unsafe");
  }
  mkdirSync(destination, { mode: stat.mode });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    copyTreeNoFollow(join(source, entry.name), join(destination, entry.name));
  }
  return destination;
}
