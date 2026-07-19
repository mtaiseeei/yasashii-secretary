import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, relative, resolve, sep } from "node:path";
import { runExternalSync } from "./external-ops.mjs";

const MAX_INSPECTABLE_BYTES = 5 * 1024 * 1024;

export class GitSafetyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GitSafetyError";
    this.code = code;
  }
}

function git(root, args, { env = {}, allowFailure = false, encoding = "utf8" } = {}) {
  try {
    return runExternalSync(process.env.YASASHII_GIT_BIN || "git", args, {
      cwd: root,
      encoding,
      env: { ...process.env, ...env },
      maxBuffer: 16 * 1024 * 1024,
      timeoutMs: Number(process.env.YASASHII_GIT_TIMEOUT_MS || 30_000),
      label: "Git",
    }).stdout;
  } catch (error) {
    const timeout = error?.code === "timeout";
    if (allowFailure && !timeout && error?.code !== "max-buffer") return null;
    const wrapped = new GitSafetyError(timeout ? "timeout" : "git-failed", timeout
      ? "Gitの処理が時間切れになりました。commit・push等の後続処理は行っていません。"
      : "Gitの安全なcommit処理に失敗しました。");
    wrapped.cause = error;
    throw wrapped;
  }
}

function normalizedPath(root, input) {
  const candidate = String(input || "").split(sep).join("/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!candidate || candidate.startsWith("/") || candidate.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new GitSafetyError("owned-path-invalid", "commit対象のpathが安全な相対pathではありません。");
  }
  const absolute = resolve(root, candidate);
  const rel = relative(root, absolute);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new GitSafetyError("owned-path-invalid", "workspace外のpathはcommit対象にできません。");
  }
  return candidate;
}

export function normalizeOwnedPaths(root, paths) {
  const normalizedRoot = resolve(root);
  return [...new Set((paths || []).map((item) => normalizedPath(normalizedRoot, item)))].sort();
}

function belongsTo(path, ownedPaths) {
  return ownedPaths.some((owned) => path === owned || path.startsWith(`${owned}/`));
}

function callbackParams(url) {
  const params = [url.searchParams];
  const fragment = url.hash.slice(1);
  if (fragment) {
    const queryStart = fragment.indexOf("?");
    params.push(new URLSearchParams(queryStart >= 0 ? fragment.slice(queryStart + 1) : fragment));
  }
  return params;
}

function hasAuthorizationCode(params) {
  const placeholders = /^(?:sample|example|placeholder|redacted|masked|authorization[-_ ]?code|auth[-_ ]?code|x+|\*+)$/i;
  for (const item of params) {
    for (const [key, rawValue] of item) {
      if (key.toLowerCase() !== "code") continue;
      const value = rawValue.trim();
      if (!value || placeholders.test(value)) continue;
      if (/^(?:<[^>]+>|\$\{[^}]+\}|\{\{[^}]+\}\})$/.test(value)) continue;
      return true;
    }
  }
  return false;
}

function containsOAuthCallbackCode(body) {
  const candidates = body.match(/\bhttps?:\/\/[^\s<>"'`]+/gi) || [];
  for (const candidate of candidates) {
    let url;
    try { url = new URL(candidate.replace(/[),.;]+$/, "")); } catch { continue; }
    const params = callbackParams(url);
    if (!hasAuthorizationCode(params)) continue;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const loopback = hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
    const fragmentRoute = url.hash.slice(1).split("?", 1)[0];
    let route = `${url.pathname} ${fragmentRoute}`;
    try { route = decodeURIComponent(route); } catch { /* 不正escapeは生文字列のまま判定する。 */ }
    const callbackPath = /(?:^|[/._-])(?:oauth2?[/._-]?)?callback(?:$|[/._\s-])/i.test(route);
    const hasState = params.some((item) => [...item].some(([key, value]) => key.toLowerCase() === "state" && value.trim()));
    if (callbackPath || (loopback && hasState)) return true;
  }
  return false;
}

const STRICT_CREDENTIAL_KEYS = new Set([
  "clientsecret",
  "accesstoken",
  "refreshtoken",
  "authorizationcode",
  "authcode",
  "apikey",
  "apitoken",
  "chatworkapitoken",
  "xchatworktoken",
]);

const STRICT_CREDENTIAL_WORD_SEQUENCES = [
  ["client", "secret"],
  ["access", "token"],
  ["refresh", "token"],
  ["authorization", "code"],
  ["auth", "code"],
  ["api", "key"],
  ["api", "token"],
];

function credentialKeyWords(value) {
  return String(value || "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function canonicalCredentialKey(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isStrictCredentialKey(value) {
  if (STRICT_CREDENTIAL_KEYS.has(canonicalCredentialKey(value))) return true;
  const words = credentialKeyWords(value);
  // policy / description / name 等は値を保持するfieldではなく、製品の説明metadataである。
  // 値の文字種や長さを推測せず、keyの役割だけで通常の資格情報fieldと分ける。
  if (CREDENTIAL_METADATA_SUFFIXES.has(words.at(-1))) return false;
  return STRICT_CREDENTIAL_WORD_SEQUENCES.some((sequence) => words.some(
    (_, index) => sequence.every((word, offset) => words[index + offset] === word),
  ));
}

const CREDENTIAL_METADATA_SUFFIXES = new Set([
  "policy",
  "handling",
  "description",
  "example",
  "name",
  "label",
  "documentation",
  "docs",
  "note",
  "guidance",
  "help",
]);

function isPlaceholderCredentialValue(rawValue) {
  const value = String(rawValue ?? "").trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
  if (!value) return true;
  if (/^(?:sample|example|placeholder|redacted|\[redacted\]|masked|changeme|replace[-_ ]?me|none|null|undefined|x+|\*+)$/i.test(value)) return true;
  if (/^\$\{\{\s*secrets\.[A-Za-z_][A-Za-z0-9_]*\s*\}\}$/.test(value)) return true;
  if (/^\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[A-Za-z_][A-Za-z0-9_]*\})$/.test(value)) return true;
  return false;
}

function jsonContainsCredentialField(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => jsonContainsCredentialField(item, seen));
  for (const [key, fieldValue] of Object.entries(value)) {
    if (isStrictCredentialKey(key) && !isPlaceholderCredentialValue(fieldValue)) return true;
    if (jsonContainsCredentialField(fieldValue, seen)) return true;
  }
  return false;
}

function containsCredentialUrl(body) {
  const candidates = body.match(/\bhttps?:\/\/[^\s<>"'`]+/gi) || [];
  for (const candidate of candidates) {
    let url;
    try { url = new URL(candidate.replace(/[),.;]+$/, "")); } catch { continue; }
    for (const params of callbackParams(url)) {
      for (const [key, value] of params) {
        if (isStrictCredentialKey(key) && !isPlaceholderCredentialValue(value)) return true;
      }
    }
  }
  return false;
}

function containsCredentialAssignment(path, body) {
  const shellFile = /\.(?:sh|bash|zsh)$/i.test(path);
  const codeFile = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|swift|php)$/i.test(path);
  const shellDeclaration = "(?:(?:export|local|readonly|declare|typeset)(?:[ \\t]+(?:--|[-+][A-Za-z]+))*[ \\t]+)?";
  const assignment = new RegExp(
    `^[ \\t]*${shellFile ? shellDeclaration : ""}["']?([A-Za-z][A-Za-z0-9_.-]*)["']?[ \\t]*[:=][ \\t]*(.*?)[ \\t]*[,;]?[ \\t]*$`,
    "gm",
  );
  for (const match of body.matchAll(assignment)) {
    if (!isStrictCredentialKey(match[1])) continue;
    const rawValue = match[2].trim().replace(/[,;]\s*$/, "").trim();
    if (shellFile) {
      const withoutComment = rawValue.replace(/\s+#.*$/, "").trim();
      if (!withoutComment || /^(?:""|'')$/.test(withoutComment)) continue;
      const doubleQuoted = withoutComment.match(/^"([\s\S]*)"$/);
      const runtimeReference = doubleQuoted ? doubleQuoted[1] : withoutComment;
      // shellのbare wordは変数名のように見えても実literalになる。
      // 値を持たない代入と、明示的な単一のshell変数／位置引数参照だけを許可する。
      if (/^\$(?:[A-Za-z_][A-Za-z0-9_]*|[1-9][0-9]*)$/.test(runtimeReference)) continue;
      if (/^\$\{(?:[A-Za-z_][A-Za-z0-9_]*|[1-9][0-9]*)\}$/.test(runtimeReference)) continue;
      return true;
    }
    if (isPlaceholderCredentialValue(rawValue)) continue;
    // プログラム中の `client_secret: clientSecret` のような変数参照は値そのものではない。
    // 通常文書・設定では全英字も資格情報になり得るため、文字種や長さでは弱めない。
    if (codeFile && !/^["'`]/.test(rawValue)) continue;
    return true;
  }

  if (codeFile) {
    // 行頭だけでなく、`{ client_secret: "..." }` のような同一行object propertyも検査する。
    // keyの開始境界と代入記号だけを正規表現で見つけ、値は引用符の終端まで個別に読む。
    const property = /(?:^|[,{;]\s*|\b(?:const|let|var)\s+)["']?([A-Za-z][A-Za-z0-9_.-]*)["']?[ \t]*[:=][ \t]*/gm;
    for (const match of body.matchAll(property)) {
      if (!isStrictCredentialKey(match[1])) continue;
      const start = match.index + match[0].length;
      const quote = body[start];
      if (quote !== '"' && quote !== "'" && quote !== "`") continue;
      let end = start + 1;
      let escaped = false;
      for (; end < body.length; end += 1) {
        const character = body[end];
        if (escaped) { escaped = false; continue; }
        if (character === "\\") { escaped = true; continue; }
        if (character === quote) break;
      }
      const rawValue = body.slice(start, end < body.length ? end + 1 : body.length);
      if (isPlaceholderCredentialValue(rawValue)) continue;
      return true;
    }
  }
  return false;
}

function secretReason(path, body) {
  const filename = posix.basename(path);
  if (
    /^(?:\.env(?:\..+)?|id_rsa|id_ed25519)$/i.test(filename)
    || /\.(?:pem|key|p12|pfx)$/i.test(filename)
  ) return "資格情報を示すファイル名";

  if (/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/.test(body)) return "秘密鍵";
  if (/(?:https?|[a-z][a-z0-9+.-]*):\/\/[^\s/:@]+:[^\s/@]+@/i.test(body)) return "資格情報を含むURL";
  if (containsOAuthCallbackCode(body)) return "OAuth callbackの認可コード";
  if (containsCredentialUrl(body)) return "資格情報を含むURL";
  if (containsCredentialAssignment(path, body)) return "資格情報の値";
  if (/\b(?:token|password|api[_-]?key)\s*[:=]\s*["'][^"'\r\n]{12,}["']/i.test(body)) return "資格情報の値";
  // 旧来の設定ファイルにある unquoted 値も検出する。単なる用語説明を避けるため、
  // 8文字以上かつ数字または記号を含む値だけを資格情報候補として扱う。
  const unquotedGeneric = body.match(/^\s*["']?(?:token|password|api[_-]?key)["']?\s*[:=]\s*([A-Za-z0-9._~+/=-]{8,})\s*$/im);
  if (unquotedGeneric && /[0-9~+/=-]/.test(unquotedGeneric[1])) return "資格情報の値";
  if (/\bcode\s*[:=]\s*["'][A-Za-z0-9._~+/=-]{24,}["']/i.test(body)) return "認可コードらしき値";

  try {
    const parsed = JSON.parse(body);
    const candidates = [parsed?.installed, parsed?.web, parsed];
    if (candidates.some((item) => item && typeof item === "object" && item.client_id && item.client_secret && item.token_uri)) {
      return "OAuth client JSON";
    }
    if (jsonContainsCredentialField(parsed)) return "資格情報の値";
  } catch {
    // JSONでない通常文書は上の構造・内容検査だけを適用する。
  }
  return null;
}

function collectWorkingFiles(root, owned, current = owned) {
  const absolute = resolve(root, current);
  if (!existsSync(absolute)) return [];
  let detail;
  try { detail = lstatSync(absolute); } catch { throw new GitSafetyError("inspection-failed", `commit候補を検査できませんでした: ${current}`); }
  if (detail.isSymbolicLink()) throw new GitSafetyError("secret-detected", `symlinkはcommit候補にできません: ${current}`);
  if (detail.isFile()) return [current];
  if (!detail.isDirectory()) throw new GitSafetyError("inspection-failed", `内容を検査できない対象です: ${current}`);
  const files = [];
  let children;
  try { children = readdirSync(absolute); } catch { throw new GitSafetyError("inspection-failed", `commit候補を読み取れませんでした: ${current}`); }
  for (const name of children) files.push(...collectWorkingFiles(root, owned, `${current}/${name}`));
  return files;
}

export function inspectWorkingCandidates(root, ownedPaths) {
  const normalizedRoot = resolve(root);
  const paths = normalizeOwnedPaths(normalizedRoot, ownedPaths);
  const files = paths.flatMap((owned) => collectWorkingFiles(normalizedRoot, owned));
  const risks = [];
  for (const path of files) {
    let buffer;
    try { buffer = readFileSync(resolve(normalizedRoot, path)); } catch { throw new GitSafetyError("inspection-failed", `commit候補を読み取れませんでした: ${path}`); }
    if (buffer.length > MAX_INSPECTABLE_BYTES || buffer.includes(0)) {
      risks.push({ path, reason: "内容を安全に検査できないファイル" });
      continue;
    }
    const reason = secretReason(path, buffer.toString("utf8"));
    if (reason) risks.push({ path, reason });
  }
  if (risks.length > 0) {
    throw new GitSafetyError("secret-detected", `資格情報の可能性があるcommit候補を検出したため停止しました: ${risks.slice(0, 5).map((item) => item.path).join(", ")}`);
  }
  return files;
}

function stagedEntries(root, env, ownedPaths) {
  const output = git(root, ["ls-files", "--stage", "-z", "--", ...ownedPaths], { env });
  const entries = new Map();
  for (const record of output.split("\0").filter(Boolean)) {
    const match = record.match(/^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/);
    if (!match) throw new GitSafetyError("inspection-failed", "commit候補のGit情報を検査できませんでした。");
    const [, mode, object, stage, path] = match;
    if (stage !== "0") throw new GitSafetyError("inspection-failed", "競合中のファイルはcommit候補にできません。");
    entries.set(path, { mode, object });
  }
  return entries;
}

function changedPaths(root, env) {
  return git(root, ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMRTUXBD"], { env })
    .split("\0")
    .filter(Boolean);
}

function inspectStagedCandidates(root, env, candidates, ownedPaths) {
  if (candidates.some((path) => !belongsTo(path, ownedPaths))) {
    throw new GitSafetyError("commit-scope", "操作対象外のファイルがcommit候補に含まれたため停止しました。");
  }
  const entries = stagedEntries(root, env, ownedPaths);
  const risks = [];
  for (const path of candidates) {
    const entry = entries.get(path);
    if (!entry) continue; // 削除候補には読み取る内容がない。
    if (entry.mode === "120000") {
      risks.push({ path, reason: "symlink" });
      continue;
    }
    if (entry.mode !== "100644" && entry.mode !== "100755") {
      risks.push({ path, reason: "検査できないファイル形式" });
      continue;
    }
    const buffer = git(root, ["cat-file", "blob", entry.object], { env, encoding: null });
    if (!Buffer.isBuffer(buffer) || buffer.length > MAX_INSPECTABLE_BYTES || buffer.includes(0)) {
      risks.push({ path, reason: "内容を安全に検査できないファイル" });
      continue;
    }
    const reason = secretReason(path, buffer.toString("utf8"));
    if (reason) risks.push({ path, reason });
  }
  if (risks.length > 0) {
    const paths = risks.slice(0, 5).map((item) => item.path).join(", ");
    throw new GitSafetyError("secret-detected", `資格情報の可能性があるcommit候補を検出したため停止しました: ${paths}`);
  }
}

function head(root) {
  const value = git(root, ["rev-parse", "--verify", "HEAD"], { allowFailure: true });
  return value ? value.trim() : null;
}

function currentRef(root) {
  const value = git(root, ["symbolic-ref", "-q", "HEAD"], { allowFailure: true });
  return value ? value.trim() : null;
}

export function restoreOwnedCommit({ root, oldHead, newHead, ownedPaths }) {
  const normalizedRoot = resolve(root);
  const paths = normalizeOwnedPaths(normalizedRoot, ownedPaths);
  if (oldHead) git(normalizedRoot, ["update-ref", "HEAD", oldHead, newHead]);
  else {
    const ref = currentRef(normalizedRoot);
    if (!ref) throw new GitSafetyError("rollback-failed", "初回commitの参照先を確認できませんでした。");
    git(normalizedRoot, ["update-ref", "-d", ref, newHead]);
  }
  if (oldHead) git(normalizedRoot, ["reset", "-q", oldHead, "--", ...paths]);
}

export function commitOwnedChanges({ root, ownedPaths, message, afterScan = null }) {
  const normalizedRoot = resolve(root);
  const paths = normalizeOwnedPaths(normalizedRoot, ownedPaths);
  if (paths.length === 0) throw new GitSafetyError("owned-path-empty", "commit対象がありません。");
  if (!String(message || "").trim()) throw new GitSafetyError("message-required", "commitメッセージが必要です。");

  const oldHead = head(normalizedRoot);
  const temporary = mkdtempSync(join(tmpdir(), "yasashii-safe-git-"));
  const indexFile = join(temporary, "index");
  const hooksDirectory = join(temporary, "hooks");
  mkdirSync(hooksDirectory);
  const env = { GIT_INDEX_FILE: indexFile };
  let newHead = null;
  try {
    if (oldHead) git(normalizedRoot, ["read-tree", oldHead], { env });
    else git(normalizedRoot, ["read-tree", "--empty"], { env });
    git(normalizedRoot, ["add", "-A", "--", ...paths], { env });
    const candidates = changedPaths(normalizedRoot, env);
    if (candidates.length === 0) return { status: "unchanged", oldHead, newHead: oldHead, candidates: [] };
    inspectStagedCandidates(normalizedRoot, env, candidates, paths);
    const scannedTree = git(normalizedRoot, ["write-tree"], { env }).trim();

    if (typeof afterScan === "function") afterScan();
    const unstaged = git(normalizedRoot, ["diff", "--name-only", "-z", "--", ...paths], { env });
    const untracked = git(normalizedRoot, ["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths], { env });
    const currentTree = git(normalizedRoot, ["write-tree"], { env }).trim();
    if (unstaged || untracked || currentTree !== scannedTree) {
      throw new GitSafetyError("candidate-changed", "secret検査後にcommit候補が変わったため、commitせず停止しました。");
    }

    // 利用者のGit hookが検査後の一時indexを書き換えないよう、このcommitだけ空のhook領域を使う。
    git(normalizedRoot, ["-c", `core.hooksPath=${hooksDirectory}`, "commit", "-q", "-m", message], { env });
    newHead = head(normalizedRoot);
    if (!newHead || newHead === oldHead) throw new GitSafetyError("commit-failed", "安全なcommitを作成できませんでした。");
    const committed = git(normalizedRoot, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", newHead])
      .split("\0")
      .filter(Boolean);
    if (committed.length === 0 || committed.some((path) => !belongsTo(path, paths))) {
      restoreOwnedCommit({ root: normalizedRoot, oldHead, newHead, ownedPaths: paths });
      throw new GitSafetyError("commit-scope", "操作対象外のファイルがcommitに含まれたため、commitを取り消しました。");
    }

    // 一時indexでcommitした後、元のindexは所有pathだけを新HEADへ追随させる。
    // これにより対象外のstaged内容とstage状態は維持される。
    git(normalizedRoot, ["reset", "-q", newHead, "--", ...paths]);
    return { status: "committed", oldHead, newHead, candidates: committed };
  } catch (error) {
    if (newHead && head(normalizedRoot) === newHead) {
      try { restoreOwnedCommit({ root: normalizedRoot, oldHead, newHead, ownedPaths: paths }); } catch { /* 元の例外を優先する */ }
    }
    throw error;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function stagedSnapshot(root, paths = []) {
  const normalizedRoot = resolve(root);
  const args = ["diff", "--cached", "--binary", "--full-index"];
  if (paths.length > 0) args.push("--", ...normalizeOwnedPaths(normalizedRoot, paths));
  return git(normalizedRoot, args);
}

export function pushOwnedCommit({ root, oldHead, newHead, remote = "origin", setUpstream = false }) {
  const normalizedRoot = resolve(root);
  const branch = git(normalizedRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true })?.trim();
  if (!branch || !newHead) throw new GitSafetyError("push-failed", "今回のcommitをpushできるbranchを確認できませんでした。");
  const upstream = git(normalizedRoot, ["rev-parse", "--verify", "@{upstream}"], { allowFailure: true })?.trim() || null;
  if (upstream && oldHead && upstream !== oldHead) {
    throw new GitSafetyError("push-base-changed", "今回の操作より前に未送信のcommitがあるためpushしていません。");
  }
  if (!upstream) {
    let remoteHeads;
    try {
      remoteHeads = git(normalizedRoot, ["ls-remote", "--heads", remote, `refs/heads/${branch}`]);
    } catch {
      throw new GitSafetyError("push-failed", "push先の履歴基点を確認できないため、今回のcommitをpushしていません。");
    }
    const remoteTip = remoteHeads.trim().split(/\s+/, 1)[0] || null;
    if ((remoteTip && remoteTip !== oldHead) || (!remoteTip && oldHead)) {
      throw new GitSafetyError("push-base-changed", "今回の操作より前に未送信のcommitがあるためpushしていません。");
    }
  }
  try {
    const args = ["push"];
    if (setUpstream) args.push("-u");
    args.push(remote, `${newHead}:refs/heads/${branch}`);
    git(normalizedRoot, args);
  } catch (error) {
    const raw = `${error?.cause?.stdout || ""}\n${error?.cause?.stderr || ""}`.toLowerCase();
    if (/non-fast-forward|rejected|fetch first|divergent/.test(raw)) {
      throw new GitSafetyError("git-conflict", "remoteに別の変更があるため、今回のcommitをpushしていません。");
    }
    throw new GitSafetyError("push-failed", "今回のcommitをpushできませんでした。既存のstageや別作業は変更していません。");
  }
  return { status: "pushed", commit: newHead, branch };
}
