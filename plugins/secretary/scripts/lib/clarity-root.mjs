import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { dirname, join, parse, relative, resolve, sep } from "node:path";
import {
  FilesystemBoundaryError,
  registerWorkingRootGuard,
  workingRoot,
} from "./safe-fs.mjs";
import { runExternalSync } from "./external-ops.mjs";

// agentic-secretary:clarity-root-policy:v1
// A physical root can be reached through more than one live alias request. Keep
// each distinct observation until its handle is released; replacing a single
// physical-root slot would let a later alias hide an earlier alias change.
const observations = new Map();
let observationSequence = 0;
let activeRequestScope = null;

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function filesystemIdentity(path, { follow = true } = {}) {
  const stat = follow ? statSync(path) : lstatSync(path);
  return {
    dev: String(stat.dev),
    ino: String(stat.ino),
    mode: stat.mode,
    kind: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : stat.isSymbolicLink() ? "symlink" : "other",
  };
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode && left.kind === right.kind;
}

function git(root, args) {
  const result = runExternalSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    timeoutMs: 5_000,
    maxBuffer: 1024 * 1024,
    allowFailure: true,
    label: "Clarity root Git identity inspection",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  return result.status === 0 ? String(result.stdout).trim() : null;
}

function gitConfigDigest(gitDir) {
  const path = join(gitDir, "config");
  if (!existsSync(path)) return null;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) return null;
  return sha256(readFileSync(path));
}

function gitIdentity(root, reference = null) {
  if (reference?.kind === "git") {
    const gitDir = realpathSync(reference.gitDir);
    const top = realpathSync(reference.top);
    return {
      kind: "git",
      top,
      topIdentity: filesystemIdentity(top),
      gitDir,
      gitDirIdentity: filesystemIdentity(gitDir),
      remoteDigest: gitConfigDigest(gitDir),
    };
  }
  if (reference?.kind === "non-git" && !existsSync(join(root, ".git"))) {
    return { kind: "non-git", top: null, topIdentity: null, gitDir: null, gitDirIdentity: null, remoteDigest: null };
  }
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (!top) return { kind: "non-git", top: null, topIdentity: null, gitDir: null, gitDirIdentity: null, remoteDigest: null };
  const physicalTop = realpathSync(top);
  const gitDirRaw = git(root, ["rev-parse", "--absolute-git-dir"]);
  const gitDir = gitDirRaw ? realpathSync(gitDirRaw) : null;
  return {
    kind: "git",
    top: physicalTop,
    topIdentity: filesystemIdentity(physicalTop),
    gitDir,
    gitDirIdentity: gitDir ? filesystemIdentity(gitDir) : null,
    remoteDigest: gitDir ? gitConfigDigest(gitDir) : null,
  };
}

function aliasChain(requested) {
  const root = parse(requested).root;
  let cursor = root;
  const rows = [];
  for (const component of relative(root, requested).split(sep).filter(Boolean)) {
    cursor = join(cursor, component);
    const stat = lstatSync(cursor);
    if (!stat.isSymbolicLink()) continue;
    rows.push({
      path: cursor,
      linkIdentity: filesystemIdentity(cursor, { follow: false }),
      linkTarget: readlinkSync(cursor),
      resolvedTarget: realpathSync(cursor),
      targetIdentity: filesystemIdentity(cursor),
    });
  }
  return rows;
}

function snapshot(requested, physicalRoot, previous = null) {
  return {
    requested,
    physicalRoot,
    rootIdentity: filesystemIdentity(physicalRoot),
    aliases: aliasChain(requested).filter((row) => row.path !== requested),
    git: gitIdentity(physicalRoot, previous?.git),
  };
}

function observationFingerprint(observation) {
  return sha256(JSON.stringify(observation));
}

function observationBucket(physicalRoot, { create = false } = {}) {
  let bucket = observations.get(physicalRoot);
  if (!bucket && create) {
    bucket = { byToken: new Map(), byFingerprint: new Map(), latestToken: null };
    observations.set(physicalRoot, bucket);
  }
  return bucket || null;
}

function latestEntry(bucket) {
  if (!bucket) return null;
  return bucket.byToken.get(bucket.latestToken) || [...bucket.byToken.values()].at(-1) || null;
}

function revalidateAll(physicalRoot) {
  const bucket = observationBucket(physicalRoot);
  if (!bucket) return;
  for (const entry of bucket.byToken.values()) revalidate(entry.observation);
}

function registerObservation(observation) {
  const bucket = observationBucket(observation.physicalRoot, { create: true });
  const fingerprint = observationFingerprint(observation);
  const existingToken = bucket.byFingerprint.get(fingerprint);
  const existing = existingToken ? bucket.byToken.get(existingToken) : null;
  if (existing) {
    existing.leases += 1;
    bucket.latestToken = existing.token;
    registerWorkingRootGuard(observation.physicalRoot, () => revalidateAll(observation.physicalRoot));
    return existing;
  }
  const token = `clarity-root-observation-${process.pid}-${++observationSequence}`;
  const entry = { token, observation, fingerprint, leases: 1 };
  bucket.byToken.set(token, entry);
  bucket.byFingerprint.set(fingerprint, token);
  bucket.latestToken = token;
  registerWorkingRootGuard(observation.physicalRoot, () => revalidateAll(observation.physicalRoot));
  return entry;
}

function trackRequestHandle(handle) {
  if (!activeRequestScope) return handle;
  const existing = activeRequestScope.handles.find((candidate) => (
    candidate.root === handle.root && candidate.observationToken === handle.observationToken
  ));
  if (existing) {
    // resolveClarityRoot acquired one more lease before finding the request-local
    // duplicate. Release only that lease; the request-owned handle stays live.
    clearClarityRootObservation(handle);
    return existing;
  }
  activeRequestScope.handles.push(handle);
  return handle;
}

function rootChanged(message, previous, current = null) {
  throw new FilesystemBoundaryError(message, "clarity-root-changed", {
    changed: false,
    previousPhysicalRoot: previous.physicalRoot,
    currentPhysicalRoot: current?.physicalRoot || null,
  });
}

function revalidate(observation) {
  let physicalRoot;
  try { physicalRoot = workingRoot(observation.requested, { allowAncestorSymlinks: true }); }
  catch (error) {
    if (["root-self-symlink", "ancestor-symlink-broken", "ancestor-symlink-not-directory"].includes(error?.code)) throw error;
    return rootChanged("Clarity working rootのaliasまたは実体が変わったため、変更せず停止しました。", observation);
  }
  if (physicalRoot !== observation.physicalRoot) {
    return rootChanged("Clarity working rootのalias解決先が変わったため、旧・新rootとも変更せず停止しました。", observation, { physicalRoot });
  }
  let current;
  try { current = snapshot(observation.requested, physicalRoot, observation); }
  catch { return rootChanged("Clarity working rootのfilesystem identityを再確認できないため、変更せず停止しました。", observation); }
  if (!sameIdentity(observation.rootIdentity, current.rootIdentity)) {
    return rootChanged("Clarity working rootの実体が差し替わったため、変更せず停止しました。", observation, current);
  }
  if (observation.aliases.length !== current.aliases.length || observation.aliases.some((row, index) => {
    const next = current.aliases[index];
    return !next || row.path !== next.path || row.linkTarget !== next.linkTarget || row.resolvedTarget !== next.resolvedTarget
      || !sameIdentity(row.linkIdentity, next.linkIdentity) || !sameIdentity(row.targetIdentity, next.targetIdentity);
  })) {
    return rootChanged("Clarity working rootのancestor aliasが差し替わったため、旧・新rootとも変更せず停止しました。", observation, current);
  }
  if (observation.git.kind !== current.git.kind || observation.git.top !== current.git.top
    || observation.git.remoteDigest !== current.git.remoteDigest
    || Boolean(observation.git.topIdentity) !== Boolean(current.git.topIdentity)
    || (observation.git.topIdentity && !sameIdentity(observation.git.topIdentity, current.git.topIdentity))
    || Boolean(observation.git.gitDirIdentity) !== Boolean(current.git.gitDirIdentity)
    || (observation.git.gitDirIdentity && !sameIdentity(observation.git.gitDirIdentity, current.git.gitDirIdentity))) {
    return rootChanged("Clarity working rootのRepo／Git identityが変わったため、変更せず停止しました。", observation, current);
  }
  return current;
}

export function resolveClarityRoot(value) {
  const requested = resolve(value || ".");
  let physicalRoot;
  try { physicalRoot = workingRoot(requested, { allowAncestorSymlinks: true }); }
  catch (error) {
    if (error instanceof FilesystemBoundaryError) throw error;
    throw new FilesystemBoundaryError("Clarity working rootを安全に確認できません。", "working-root-unsafe");
  }
  const bucket = observationBucket(physicalRoot);
  const existing = requested === physicalRoot ? latestEntry(bucket) : null;
  const entry = existing
    ? registerObservation(existing.observation)
    : registerObservation(snapshot(requested, physicalRoot));
  const observation = entry.observation;
  return trackRequestHandle({
    root: physicalRoot,
    observation,
    observationToken: entry.token,
    policy: {
      source: "clarity-internal-root-resolver",
      allowAncestorSymlinks: true,
      requestedRootIsSymlink: false,
      ancestorAliasCount: observation.aliases.length,
      physicalRootApplied: true,
    },
  });
}

export function withClarityRootRequest(callback) {
  if (typeof callback !== "function") throw new TypeError("Clarity root request callback is required");
  if (activeRequestScope) return callback();
  const scope = { handles: [] };
  activeRequestScope = scope;
  try {
    return callback();
  } finally {
    activeRequestScope = null;
    for (const handle of [...scope.handles].reverse()) clearClarityRootObservation(handle);
  }
}

export function withClarityRootObservation(value, callback) {
  return withClarityRootRequest(() => callback(resolveClarityRoot(value)));
}

export function revalidateClarityRoot(rootValue) {
  const physical = realpathSync(resolve(typeof rootValue === "object" && rootValue?.root ? rootValue.root : rootValue));
  const bucket = observationBucket(physical);
  const entry = rootValue?.observationToken
    ? bucket?.byToken.get(rootValue.observationToken)
    : latestEntry(bucket);
  if (!entry) return resolveClarityRoot(rootValue?.root || rootValue);
  if (rootValue?.observationToken) revalidate(entry.observation);
  else revalidateAll(physical);
  return { root: physical, observation: entry.observation, observationToken: entry.token, policy: rootPolicyFor(rootValue) };
}

export function refreshClarityRootAfterOwnedReplacement(rootValue) {
  const physical = realpathSync(resolve(typeof rootValue === "object" && rootValue?.root ? rootValue.root : rootValue));
  const bucket = observationBucket(physical);
  if (!bucket) return resolveClarityRoot(rootValue?.root || rootValue);
  for (const entry of bucket.byToken.values()) {
    const previous = entry.observation;
    const currentPhysical = workingRoot(previous.requested, { allowAncestorSymlinks: true });
    if (currentPhysical !== previous.physicalRoot) {
      return rootChanged("Clarity working rootのalias解決先が変わったため、旧・新rootとも変更せず停止しました。", previous, { physicalRoot: currentPhysical });
    }
    const current = snapshot(previous.requested, currentPhysical, previous);
    if (previous.aliases.length !== current.aliases.length || previous.aliases.some((row, index) => {
      const next = current.aliases[index];
      return !next || row.path !== next.path || row.linkTarget !== next.linkTarget || row.resolvedTarget !== next.resolvedTarget
        || !sameIdentity(row.linkIdentity, next.linkIdentity) || !sameIdentity(row.targetIdentity, next.targetIdentity);
    })) {
      return rootChanged("Clarity working rootのancestor aliasが差し替わったため、旧・新rootとも変更せず停止しました。", previous, current);
    }
    if (previous.git.kind !== current.git.kind || previous.git.top !== current.git.top
      || previous.git.remoteDigest !== current.git.remoteDigest
      || Boolean(previous.git.topIdentity) !== Boolean(current.git.topIdentity)
      || (previous.git.topIdentity && !sameIdentity(previous.git.topIdentity, current.git.topIdentity))
      || Boolean(previous.git.gitDirIdentity) !== Boolean(current.git.gitDirIdentity)
      || (previous.git.gitDirIdentity && !sameIdentity(previous.git.gitDirIdentity, current.git.gitDirIdentity))) {
      return rootChanged("Clarity working rootのRepo／Git identityが変わったため、変更せず停止しました。", previous, current);
    }
    entry.observation = current;
    entry.fingerprint = observationFingerprint(current);
  }
  bucket.byFingerprint.clear();
  for (const entry of bucket.byToken.values()) bucket.byFingerprint.set(entry.fingerprint, entry.token);
  registerWorkingRootGuard(physical, () => revalidateAll(physical));
  const entry = latestEntry(bucket);
  return { root: physical, observation: entry.observation, observationToken: entry.token, policy: rootPolicyFor(rootValue) };
}

export function rootPolicyFor(rootValue) {
  const physical = realpathSync(resolve(typeof rootValue === "object" && rootValue?.root ? rootValue.root : rootValue));
  const bucket = observationBucket(physical);
  const entry = rootValue?.observationToken
    ? bucket?.byToken.get(rootValue.observationToken)
    : latestEntry(bucket);
  const observation = entry?.observation;
  return {
    source: "clarity-internal-root-resolver",
    allowAncestorSymlinks: true,
    requestedRootIsSymlink: false,
    ancestorAliasCount: observation?.aliases.length || 0,
    physicalRootApplied: true,
  };
}

export function clearClarityRootObservation(rootValue) {
  const isHandle = typeof rootValue === "object" && rootValue?.root && rootValue?.observationToken;
  // A handle already carries the canonical physical key. Do not require that
  // path to still exist merely to release a failed or displaced observation.
  const physical = isHandle ? resolve(rootValue.root) : realpathSync(resolve(rootValue));
  const bucket = observationBucket(physical);
  if (!bucket) return;
  if (!isHandle) {
    observations.delete(physical);
    registerWorkingRootGuard(physical, null);
    return;
  }
  const entry = bucket.byToken.get(rootValue.observationToken);
  if (!entry) return;
  entry.leases -= 1;
  if (entry.leases > 0) return;
  bucket.byToken.delete(entry.token);
  if (bucket.byFingerprint.get(entry.fingerprint) === entry.token) bucket.byFingerprint.delete(entry.fingerprint);
  if (bucket.latestToken === entry.token) bucket.latestToken = [...bucket.byToken.keys()].at(-1) || null;
  if (bucket.byToken.size === 0) {
    observations.delete(physical);
    registerWorkingRootGuard(physical, null);
  }
}
