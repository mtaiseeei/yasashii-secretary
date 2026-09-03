import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import {
  CLARITY_SCHEMA_VERSION,
  ClarityError,
  appendEvent,
  applyInit,
  inspectRepoIdentity,
  previewInit,
  rebuildState,
  validateProject,
} from "./clarity-core.mjs";
import { safeWritePath, writeFileAtomicSafe } from "./safe-fs.mjs";
import { resolveClarityRoot, withClarityRootObservation } from "./clarity-root.mjs";

const LINK_SCHEMA_VERSION = 1;
const LINK_STATES = new Set(["accepted", "active", "disabled"]);
const LINK_ROLES = new Set(["secretary", "repo"]);
const AUTHORITY_KINDS = new Set(["primary", "reference", "shared-derived"]);
const RESOLUTION_CHOICES = new Set(["secretary", "repo", "new-decision", "split", "defer", "unlink"]);
const SENSITIVE_KEY = /(?:secret(?!ary)|token|password|credential|private.?key|oauth|customer.?body|transcript|absolute.?path)/iu;
const SENSITIVE_VALUE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b|(?:password|api[_-]?key|api[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*\S+)/iu;

export const DEFAULT_AUTHORITY_PROFILE = Object.freeze({
  schemaVersion: 1,
  fields: {
    customerAgreement: { kind: "primary", primary: "secretary" },
    businessDirection: { kind: "primary", primary: "secretary" },
    scope: { kind: "primary", primary: "secretary" },
    goal: { kind: "primary", primary: "secretary" },
    priority: { kind: "primary", primary: "secretary" },
    implementation: { kind: "primary", primary: "repo" },
    test: { kind: "primary", primary: "repo" },
    technicalArchitecture: { kind: "primary", primary: "repo" },
    deploymentEvidence: { kind: "primary", primary: "repo" },
    alignment: { kind: "shared-derived", primary: null },
    drift: { kind: "shared-derived", primary: null },
    attention: { kind: "shared-derived", primary: null },
  },
});

function fail(condition, code, message, details = {}) {
  if (!condition) throw new ClarityError(code, message, 3, { changed: false, ...details });
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stableId(prefix, seed) {
  return `${prefix}_${sha256(String(seed)).slice(0, 20)}`;
}

function nowIso() {
  const injected = process.env.CLARITY_NOW || process.env.CC_SECRETARY_NOW;
  if (!injected) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(injected)) return `${injected}T00:00:00.000Z`;
  const parsed = new Date(injected);
  fail(!Number.isNaN(parsed.valueOf()), "time-invalid", "固定時刻はISO 8601形式で指定してください。");
  return parsed.toISOString();
}

function noSensitiveData(value, label) {
  const visit = (node, path = label) => {
    if (Array.isArray(node)) return node.forEach((item, index) => visit(item, `${path}[${index}]`));
    if (node && typeof node === "object") {
      for (const [key, item] of Object.entries(node)) {
        fail(!SENSITIVE_KEY.test(key), "link-sensitive-field", `${label}に保存できないfieldがあります。`, { field: key });
        visit(item, `${path}.${key}`);
      }
      return;
    }
    if (typeof node !== "string") return;
    fail(!SENSITIVE_VALUE.test(node), "link-secret-detected", `${label}にSecretらしき値があるため拒否します。`);
    fail(!/^\/?(?:Users|home|var|private|tmp|Volumes|[A-Za-z]:[\\/])/u.test(node), "link-absolute-path", `${label}にabsolute pathを保存できません。`);
  };
  visit(value);
  return value;
}

function currentRoot(rootValue, { legacyLocatorError = false } = {}) {
  let root;
  try { root = resolveClarityRoot(rootValue).root; }
  catch (error) {
    const code = legacyLocatorError && error?.code === "root-self-symlink" ? "working-root-unsafe" : error?.code || "working-root-unsafe";
    throw new ClarityError(code, error instanceof Error ? error.message : "working rootを安全に確認できません。", 3, { changed: false });
  }
  let identity;
  try { identity = inspectRepoIdentity(root); }
  catch (error) {
    if (error?.code !== "git-root-mismatch") throw error;
    const projectPath = safeWritePath(root, ".clarity/project.json");
    fail(existsSync(projectPath), "git-root-mismatch", "linked Clarity rootとGit top-levelが一致しません。");
    const project = readJson(projectPath, "project-json-invalid", "Clarity project.jsonがJSONではありません。");
    validateProject(project);
    fail(project.mode === "secretary-local" || project.mode === "linked-external", "git-root-mismatch", "nested Clarity rootはSecretary-local Projectだけで利用できます。");
    identity = project.repoIdentity;
  }
  return { root, identity, identityRef: repositoryIdentity(identity) };
}

function repositoryIdentity(identity) {
  const stable = {
    kind: identity.kind,
    rootName: identity.rootName,
    repository: identity.remote?.repository || null,
  };
  return { ...stable, identityId: stableId("cr", canonical(stable)) };
}

function readJson(path, code, message) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new ClarityError(code, message, 3, { changed: false }); }
}

function clarityProject(root) {
  let path;
  try { path = safeWritePath(root, ".clarity/project.json"); }
  catch (error) {
    if (["symlink-boundary", "filesystem-boundary"].includes(error?.code)) throw new ClarityError("root-internal-symlink", "Repo内の.clarityが安全ではないため、参照先を追わず停止しました。", 3, { changed: false });
    throw error;
  }
  fail(existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink(), "clarity-not-initialized", "このRepoにはClarityが初期化されていません。");
  const project = readJson(path, "project-json-invalid", "Clarity project.jsonがJSONではありません。");
  validateProject(project);
  return { path, project };
}

function linkDirectory(root) {
  return safeWritePath(root, ".clarity/links");
}

function owningGitRoot(root) {
  let cursor = root;
  while (cursor !== dirname(cursor)) {
    const git = join(cursor, ".git");
    if (existsSync(git)) {
      const stat = lstatSync(git);
      fail(stat.isDirectory() && !stat.isSymbolicLink(), "git-mapping-unavailable", "local mappingのGit metadataを安全に確認できません。");
      return cursor;
    }
    cursor = dirname(cursor);
  }
  throw new ClarityError("git-mapping-unavailable", "local mappingには通常のGit Repoが必要です。", 3, { changed: false });
}

function manifestPath(root, linkId) {
  fail(/^cl_[a-f0-9]{20}$/u.test(String(linkId || "")), "link-id-invalid", "link IDが不正です。");
  return safeWritePath(root, `.clarity/links/${linkId}.json`);
}

function listManifests(root) {
  const directory = linkDirectory(root);
  if (!existsSync(directory)) return [];
  fail(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink(), "link-root-unsafe", "link directoryが安全ではありません。");
  return readdirSync(directory).filter((name) => /^cl_[a-f0-9]{20}\.json$/u.test(name)).sort().map((name) => validateManifest(readJson(join(directory, name), "link-json-invalid", "link manifestがJSONではありません。")));
}

function writeJson(rootValue, relative, value) {
  const first = currentRoot(rootValue);
  const second = currentRoot(first.root);
  fail(first.root === second.root && first.identityRef.identityId === second.identityRef.identityId, "root-changed", "書込み直前にRepo identityが変わったため停止しました。");
  writeFileAtomicSafe(second.root, relative, stableJson(value), { encoding: "utf8" });
}

function digestEnvelope(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return sha256(copy);
}

function validateAuthorityProfile(profile) {
  fail(profile && profile.schemaVersion === 1 && profile.fields && typeof profile.fields === "object" && !Array.isArray(profile.fields), "authority-invalid", "authority profileが不正です。");
  for (const [field, rule] of Object.entries(profile.fields)) {
    fail(/^[A-Za-z][A-Za-z0-9]*$/u.test(field), "authority-invalid", "authority field名が不正です。", { field });
    fail(rule && AUTHORITY_KINDS.has(rule.kind), "authority-invalid", "authority kindが不正です。", { field });
    if (rule.kind === "primary") {
      fail(typeof rule.primary === "string" && LINK_ROLES.has(rule.primary), "authority-primary-conflict", "同じfieldのPrimaryは1つだけ指定してください。", { field, primary: rule.primary });
    } else fail(rule.primary === null || rule.primary === undefined, "authority-invalid", "Primary以外へprimary ownerを指定できません。", { field });
  }
  noSensitiveData(profile, "authority profile");
  return profile;
}

function normalizeParticipant(input, label) {
  fail(input && /^cp_[a-f0-9]{20}$/u.test(input.projectId || ""), "link-target-invalid", `${label} Project IDが不正です。`);
  fail(input.repositoryIdentity && /^cr_[a-f0-9]{20}$/u.test(input.repositoryIdentity.identityId || ""), "link-target-invalid", `${label} Repo identityが不正です。`);
  noSensitiveData(input, label);
  return { projectId: input.projectId, repositoryIdentity: input.repositoryIdentity };
}

function localParticipant(rootValue) {
  const { root, identityRef } = currentRoot(rootValue);
  const { project } = clarityProject(root);
  return { root, project, participant: { projectId: project.clarityProjectId, repositoryIdentity: identityRef } };
}

function inspectLinkIdentityImpl(rootValue) {
  const { participant, project } = localParticipant(rootValue);
  return { status: "inspected", changed: false, projectId: participant.projectId, repositoryIdentity: participant.repositoryIdentity, mode: project.mode, networkCalls: 0, externalWrites: 0 };
}

function validateRequest(request) {
  fail(request?.kind === "clarity-link-request" && request.schemaVersion === LINK_SCHEMA_VERSION, "link-request-invalid", "Link Request schemaが不正です。");
  fail(/^cl_[a-f0-9]{20}$/u.test(request.linkId || ""), "link-id-invalid", "Link Requestのlink IDが不正です。");
  normalizeParticipant(request.source, "Link Request source");
  normalizeParticipant(request.target, "Link Request target");
  validateAuthorityProfile(request.authorityProfile);
  fail(request.requestDigest === digestEnvelope(request, "requestDigest"), "link-digest-mismatch", "Link Request digestが一致しません。");
  noSensitiveData(request, "Link Request");
  return request;
}

function validateAcceptance(acceptance) {
  fail(acceptance?.kind === "clarity-link-acceptance" && acceptance.schemaVersion === LINK_SCHEMA_VERSION, "link-acceptance-invalid", "Link Acceptance schemaが不正です。");
  fail(/^cl_[a-f0-9]{20}$/u.test(acceptance.linkId || ""), "link-id-invalid", "Link Acceptanceのlink IDが不正です。");
  normalizeParticipant(acceptance.source, "Link Acceptance source");
  normalizeParticipant(acceptance.target, "Link Acceptance target");
  fail(/^[a-f0-9]{64}$/u.test(acceptance.requestDigest || ""), "link-acceptance-invalid", "Link Request digest参照が不正です。");
  validateAuthorityProfile(acceptance.authorityProfile);
  fail(acceptance.acceptanceDigest === digestEnvelope(acceptance, "acceptanceDigest"), "link-digest-mismatch", "Link Acceptance digestが一致しません。");
  noSensitiveData(acceptance, "Link Acceptance");
  return acceptance;
}

function validateFinalization(finalization) {
  fail(finalization?.kind === "clarity-link-finalization" && finalization.schemaVersion === LINK_SCHEMA_VERSION, "link-finalization-invalid", "Link Finalization schemaが不正です。");
  fail(/^cl_[a-f0-9]{20}$/u.test(finalization.linkId || ""), "link-id-invalid", "Link Finalizationのlink IDが不正です。");
  normalizeParticipant(finalization.source, "Link Finalization source");
  normalizeParticipant(finalization.target, "Link Finalization target");
  fail(/^[a-f0-9]{64}$/u.test(finalization.acceptanceDigest || ""), "link-finalization-invalid", "Link Acceptance digest参照が不正です。");
  validateAuthorityProfile(finalization.authorityProfile);
  fail(finalization.finalizationDigest === digestEnvelope(finalization, "finalizationDigest"), "link-digest-mismatch", "Link Finalization digestが一致しません。");
  noSensitiveData(finalization, "Link Finalization");
  return finalization;
}

function validateManifest(manifest) {
  fail(manifest?.kind === "clarity-link-manifest" && manifest.schemaVersion === LINK_SCHEMA_VERSION, "link-manifest-invalid", "link manifest schemaが不正です。");
  fail(LINK_STATES.has(manifest.state), "link-state-invalid", "link manifest stateが不正です。");
  fail(LINK_ROLES.has(manifest.localRole) && LINK_ROLES.has(manifest.peerRole) && manifest.localRole !== manifest.peerRole, "link-role-invalid", "link roleが不正です。");
  normalizeParticipant(manifest.local, "link manifest local");
  normalizeParticipant(manifest.peer, "link manifest peer");
  validateAuthorityProfile(manifest.authorityProfile);
  fail(manifest.manifestDigest === digestEnvelope(manifest, "manifestDigest"), "link-digest-mismatch", "link manifest digestが一致しません。");
  noSensitiveData(manifest, "link manifest");
  return manifest;
}

function manifestFor({ linkId, state, localRole, local, peer, authorityProfile, requestDigest, acceptanceDigest = null, finalizationDigest = null, originalMode, originalSecretaryLink = null, acceptedAt = null, finalizedAt = null, occurredAt }) {
  const manifest = {
    kind: "clarity-link-manifest",
    schemaVersion: LINK_SCHEMA_VERSION,
    linkId,
    state,
    localRole,
    peerRole: localRole === "secretary" ? "repo" : "secretary",
    local,
    peer,
    authorityProfile,
    requestDigest,
    acceptanceDigest,
    finalizationDigest,
    originalMode,
    originalSecretaryLink,
    acceptedAt,
    finalizedAt,
    occurredAt,
  };
  return { ...manifest, manifestDigest: sha256(manifest) };
}

function sameParticipant(left, right) {
  return left.projectId === right.projectId && left.repositoryIdentity.identityId === right.repositoryIdentity.identityId;
}

function assertLocal(local, expected, label) {
  fail(sameParticipant(local, expected), "link-target-mismatch", `${label}のProject IDまたはRepo identityが一致しません。`, { expectedProjectId: expected.projectId, actualProjectId: local.projectId });
}

function linkEvent(root, type, linkId, payload) {
  return appendEvent(root, { type, itemId: null, actor: "clarity-link", payload: { linkId, ...payload } });
}

function updateProjectLink(rootValue, manifest) {
  const { root } = currentRoot(rootValue);
  const current = clarityProject(root);
  const originalMode = current.project.mode;
  const project = {
    ...current.project,
    mode: manifest.state === "disabled" ? manifest.originalMode : "linked-external",
    secretaryLink: manifest.state === "disabled" ? manifest.originalSecretaryLink : {
      ...(current.project.secretaryLink || {}),
      linkId: manifest.linkId,
      state: manifest.state,
      peerProjectId: manifest.peer.projectId,
      peerRepositoryIdentity: manifest.peer.repositoryIdentity,
      manifestDigest: manifest.manifestDigest,
    },
  };
  fail(project.clarityProjectId === current.project.clarityProjectId, "project-id-mutation", "linkでClarity Project IDを変更できません。");
  validateProject(project);
  writeJson(root, ".clarity/project.json", project);
  return { project, originalMode };
}

function prepareLinkImpl(rootValue, { targetProjectId, targetRepositoryIdentity, localRole = "secretary", authorityProfile = DEFAULT_AUTHORITY_PROFILE } = {}) {
  fail(LINK_ROLES.has(localRole), "link-role-invalid", "local roleはsecretaryまたはrepoです。");
  const { participant: source, project: sourceProject } = localParticipant(rootValue);
  const target = normalizeParticipant({ projectId: targetProjectId, repositoryIdentity: targetRepositoryIdentity }, "Link Request target");
  const normalizedAuthority = validateAuthorityProfile(structuredClone(authorityProfile));
  const linkId = stableId("cl", [source.projectId, target.projectId, source.repositoryIdentity.identityId, target.repositoryIdentity.identityId].sort().join(":"));
  const request = {
    kind: "clarity-link-request",
    schemaVersion: LINK_SCHEMA_VERSION,
    linkId,
    source,
    target,
    sourceRole: localRole,
    targetRole: localRole === "secretary" ? "repo" : "secretary",
    challenge: sha256(`${linkId}:${source.projectId}:${target.projectId}`),
    authorityProfile: normalizedAuthority,
    createdAt: sourceProject.createdAt,
  };
  request.requestDigest = sha256(request);
  validateRequest(request);
  return { status: "prepared", changed: false, networkCalls: 0, externalWrites: 0, request };
}

function acceptLinkImpl(rootValue, requestInput, { apply = false } = {}) {
  const request = validateRequest(structuredClone(requestInput));
  let root;
  try { root = localParticipant(rootValue); }
  catch (error) {
    if (error?.code !== "clarity-not-initialized") throw error;
    const anticipated = previewInit(rootValue);
    const inspected = currentRoot(rootValue);
    assertLocal({ projectId: anticipated.project.clarityProjectId, repositoryIdentity: inspected.identityRef }, request.target, "Link Request target");
    if (!apply) return { status: "initialization-preview-required", changed: false, requiresInitialization: true, init: { command: "clarity init <repo> --apply" }, networkCalls: 0, externalWrites: 0 };
    applyInit(rootValue);
    root = localParticipant(rootValue);
  }
  assertLocal(root.participant, request.target, "Link Request target");
  const localRole = request.targetRole;
  const path = manifestPath(root.root, request.linkId);
  const acceptance = {
    kind: "clarity-link-acceptance",
    schemaVersion: LINK_SCHEMA_VERSION,
    linkId: request.linkId,
    requestDigest: request.requestDigest,
    source: request.source,
    target: request.target,
    sourceRole: request.sourceRole,
    targetRole: request.targetRole,
    authorityProfile: request.authorityProfile,
    acceptedAt: nowIso(),
  };
  acceptance.acceptanceDigest = sha256(acceptance);
  validateAcceptance(acceptance);
  if (!apply) return { status: "accept-preview", changed: false, writes: [`.clarity/links/${request.linkId}.json`, ".clarity/project.json", ".clarity/events.jsonl"], acceptance, networkCalls: 0, externalWrites: 0 };
  if (existsSync(path)) {
    const existing = validateManifest(readJson(path, "link-json-invalid", "link manifestがJSONではありません。"));
    fail(existing.requestDigest === request.requestDigest && sameParticipant(existing.local, request.target) && sameParticipant(existing.peer, request.source), "duplicate-link-conflict", "同じlink IDに異なるLink Requestがあります。");
    const stableAcceptance = { ...acceptance, acceptedAt: existing.acceptedAt || acceptance.acceptedAt, acceptanceDigest: existing.acceptanceDigest };
    validateAcceptance(stableAcceptance);
    return { status: existing.state, changed: false, acceptance: stableAcceptance, manifest: existing, networkCalls: 0, externalWrites: 0 };
  }
  const manifest = manifestFor({ linkId: request.linkId, state: "accepted", localRole, local: request.target, peer: request.source, authorityProfile: request.authorityProfile, requestDigest: request.requestDigest, acceptanceDigest: acceptance.acceptanceDigest, originalMode: root.project.mode, originalSecretaryLink: root.project.secretaryLink, acceptedAt: acceptance.acceptedAt, occurredAt: acceptance.acceptedAt });
  writeJson(root.root, `.clarity/links/${request.linkId}.json`, manifest);
  updateProjectLink(root.root, manifest);
  linkEvent(root.root, "link.accepted", request.linkId, { manifestDigest: manifest.manifestDigest, peerProjectId: manifest.peer.projectId });
  return { status: "accepted", changed: true, acceptance, manifest, networkCalls: 0, externalWrites: 0 };
}

function finalizeLinkImpl(rootValue, input, { apply = false } = {}) {
  const local = localParticipant(rootValue);
  if (input?.kind === "clarity-link-finalization") {
    const finalization = validateFinalization(structuredClone(input));
    assertLocal(local.participant, finalization.target, "Link Finalization target");
    const path = manifestPath(local.root, finalization.linkId);
    fail(existsSync(path), "link-manifest-missing", "accept済みlink manifestがありません。");
    const existing = validateManifest(readJson(path, "link-json-invalid", "link manifestがJSONではありません。"));
    fail(existing.acceptanceDigest === finalization.acceptanceDigest && sameParticipant(existing.peer, finalization.source), "link-finalization-mismatch", "Link Finalizationとaccept済みmanifestが一致しません。");
    if (!apply) return { status: "finalize-preview", changed: false, finalization, writes: [`.clarity/links/${finalization.linkId}.json`, ".clarity/project.json", ".clarity/events.jsonl"], networkCalls: 0, externalWrites: 0 };
    if (existing.state === "active") return { status: "active", changed: false, finalization, manifest: existing, networkCalls: 0, externalWrites: 0 };
    const manifest = manifestFor({ ...existing, state: "active", finalizationDigest: finalization.finalizationDigest, finalizedAt: finalization.finalizedAt, occurredAt: finalization.finalizedAt });
    writeJson(local.root, `.clarity/links/${finalization.linkId}.json`, manifest);
    updateProjectLink(local.root, manifest);
    linkEvent(local.root, "link.finalized", finalization.linkId, { manifestDigest: manifest.manifestDigest, peerProjectId: manifest.peer.projectId });
    return { status: "active", changed: true, finalization, manifest, networkCalls: 0, externalWrites: 0 };
  }
  const acceptance = validateAcceptance(structuredClone(input));
  assertLocal(local.participant, acceptance.source, "Link Acceptance source");
  const path = manifestPath(local.root, acceptance.linkId);
  let existing = existsSync(path) ? validateManifest(readJson(path, "link-json-invalid", "link manifestがJSONではありません。")) : null;
  if (existing) fail(existing.requestDigest === acceptance.requestDigest && sameParticipant(existing.peer, acceptance.target), "duplicate-link-conflict", "同じlink IDに異なるacceptanceがあります。");
  const finalization = {
    kind: "clarity-link-finalization",
    schemaVersion: LINK_SCHEMA_VERSION,
    linkId: acceptance.linkId,
    acceptanceDigest: acceptance.acceptanceDigest,
    source: acceptance.source,
    target: acceptance.target,
    sourceRole: acceptance.sourceRole,
    targetRole: acceptance.targetRole,
    authorityProfile: acceptance.authorityProfile,
    finalizedAt: nowIso(),
  };
  finalization.finalizationDigest = sha256(finalization);
  validateFinalization(finalization);
  if (!apply) return { status: "finalize-preview", changed: false, finalization, writes: [`.clarity/links/${acceptance.linkId}.json`, ".clarity/project.json", ".clarity/events.jsonl"], networkCalls: 0, externalWrites: 0 };
  if (existing?.state === "active") {
    const stableFinalization = { ...finalization, finalizedAt: existing.finalizedAt || finalization.finalizedAt, finalizationDigest: existing.finalizationDigest };
    validateFinalization(stableFinalization);
    return { status: "active", changed: false, finalization: stableFinalization, manifest: existing, networkCalls: 0, externalWrites: 0 };
  }
  const manifest = manifestFor({ linkId: acceptance.linkId, state: "active", localRole: acceptance.sourceRole, local: acceptance.source, peer: acceptance.target, authorityProfile: acceptance.authorityProfile, requestDigest: acceptance.requestDigest, acceptanceDigest: acceptance.acceptanceDigest, finalizationDigest: finalization.finalizationDigest, originalMode: local.project.mode, originalSecretaryLink: local.project.secretaryLink, acceptedAt: acceptance.acceptedAt, finalizedAt: finalization.finalizedAt, occurredAt: finalization.finalizedAt });
  writeJson(local.root, `.clarity/links/${acceptance.linkId}.json`, manifest);
  updateProjectLink(local.root, manifest);
  linkEvent(local.root, "link.finalized", acceptance.linkId, { manifestDigest: manifest.manifestDigest, peerProjectId: manifest.peer.projectId });
  return { status: "active", changed: true, finalization, manifest, networkCalls: 0, externalWrites: 0 };
}

function activeManifest(root, linkId = null) {
  const rows = listManifests(root).filter((row) => row.state === "active" && (!linkId || row.linkId === linkId));
  fail(rows.length === 1, rows.length ? "link-ambiguous" : "link-not-active", rows.length ? "active linkを1つに特定できません。" : "active linkがありません。");
  return rows[0];
}

function exportItem(item) {
  return {
    itemId: item.itemId,
    title: item.title,
    areaPath: item.areaPath,
    disposition: item.disposition,
    fieldValues: {
      goal: item.title,
      implementation: item.execution.status,
      test: item.validation.status,
      alignment: item.alignment.status,
      attention: item.attention,
    },
    evidenceRefs: [...new Set([...(item.decision.evidenceRefs || []), ...(item.execution.evidenceRefs || []), ...(item.validation.evidenceRefs || []), ...(item.alignment.evidenceRefs || [])])].sort(),
    updatedAt: item.timestamps.updatedAt,
  };
}

function currentSourceRevision(root, participant = null) {
  const local = participant || localParticipant(root).participant;
  const rebuilt = rebuildState(root, { write: false });
  return sha256({ projectId: local.projectId, items: rebuilt.state.items.map(exportItem), quadrants: rebuilt.state.quadrants });
}

function exportSyncBundleImpl(rootValue, { linkId = null, tombstones = [], extra = {} } = {}) {
  const { root, participant } = localParticipant(rootValue);
  const manifest = activeManifest(root, linkId);
  assertLocal(participant, manifest.local, "active link local");
  const rebuilt = rebuildState(root, { write: false });
  const eventsPath = safeWritePath(root, ".clarity/events.jsonl");
  const eventBytes = existsSync(eventsPath) ? readFileSync(eventsPath, "utf8") : "";
  const sequence = eventBytes.split(/\r?\n/u).filter(Boolean).length;
  const claims = Object.fromEntries(Object.entries(manifest.authorityProfile.fields).filter(([, rule]) => rule.kind === "primary" && rule.primary === manifest.localRole).map(([field]) => [field, manifest.localRole]));
  const bundle = {
    kind: "clarity-sync-bundle",
    schemaVersion: CLARITY_SCHEMA_VERSION,
    linkSchemaVersion: LINK_SCHEMA_VERSION,
    linkId: manifest.linkId,
    source: manifest.local,
    target: manifest.peer,
    sourceRole: manifest.localRole,
    manifestDigest: manifest.manifestDigest,
    authorityProfile: manifest.authorityProfile,
    authorityClaims: claims,
    sourceSequence: sequence,
    sourceRevision: currentSourceRevision(root, participant),
    parentRevision: readImportMeta(root, manifest.linkId)?.sourceRevision || null,
    exportedAt: nowIso(),
    items: rebuilt.state.items.map(exportItem),
    tombstones: [...new Set(tombstones)].sort(),
    ...structuredClone(extra),
  };
  noSensitiveData(bundle, "sync bundle");
  bundle.bundleDigest = sha256(bundle);
  return { status: "exported", changed: false, bundle, networkCalls: 0, externalWrites: 0 };
}

function validateBundle(bundle) {
  fail(bundle?.kind === "clarity-sync-bundle" && Number.isInteger(bundle.schemaVersion), "sync-bundle-invalid", "sync bundle schemaが不正です。");
  fail(/^cl_[a-f0-9]{20}$/u.test(bundle.linkId || ""), "link-id-invalid", "sync bundleのlink IDが不正です。");
  normalizeParticipant(bundle.source, "sync bundle source");
  normalizeParticipant(bundle.target, "sync bundle target");
  fail(LINK_ROLES.has(bundle.sourceRole), "link-role-invalid", "sync bundle roleが不正です。");
  validateAuthorityProfile(bundle.authorityProfile);
  fail(Number.isInteger(bundle.sourceSequence) && bundle.sourceSequence >= 0, "sync-bundle-invalid", "sync bundle sequenceが不正です。");
  fail(Array.isArray(bundle.items) && Array.isArray(bundle.tombstones), "sync-bundle-invalid", "sync bundle items／tombstonesが不正です。");
  fail(bundle.bundleDigest === digestEnvelope(bundle, "bundleDigest"), "sync-bundle-tampered", "sync bundle digestが一致しません。");
  noSensitiveData(bundle, "sync bundle");
  return bundle;
}

function importRoot(root, linkId) {
  return `.clarity/imports/${linkId}`;
}

function readImportMeta(root, linkId) {
  const path = safeWritePath(root, `${importRoot(root, linkId)}/meta.json`);
  return existsSync(path) ? readJson(path, "sync-import-invalid", "import metaがJSONではありません。") : null;
}

function localFieldIndex(root) {
  const state = rebuildState(root, { write: false }).state;
  return new Map(state.items.map((item) => [item.itemId, exportItem(item).fieldValues]));
}

function conflictId(linkId, type, itemId, field, left, right) {
  return stableId("cf", `${linkId}:${type}:${itemId || "project"}:${field || "none"}:${canonical(left)}:${canonical(right)}`);
}

function conflictAttention(conflicts) {
  const severity = { critical: 4, high: 3, medium: 2, low: 1 };
  const items = conflicts.map((conflict) => ({
    conflictId: conflict.conflictId,
    itemId: conflict.itemId || null,
    reason: conflict.type,
    reasonLabel: conflict.type === "authority_conflict" ? "authority conflict" : conflict.type === "tombstone_conflict" ? "delete conflict" : "sync conflict",
    level: conflict.level,
    field: conflict.field || null,
    choices: ["secretary", "repo", "new-decision", "split", "defer", "unlink"],
  })).sort((a, b) => (severity[b.level] || 0) - (severity[a.level] || 0) || a.conflictId.localeCompare(b.conflictId, "en"));
  return {
    activeCount: items.length,
    top: items.map((item, index) => ({ ...item, rank: index + 1 })),
    otherCount: 0,
    ranking: "level-desc-conflict-id-asc",
  };
}

function previewSyncImpl(rootValue, bundleInput) {
  const bundle = validateBundle(structuredClone(bundleInput));
  const { root, participant } = localParticipant(rootValue);
  const manifest = activeManifest(root, bundle.linkId);
  assertLocal(participant, bundle.target, "sync target");
  fail(sameParticipant(bundle.source, manifest.peer), "link-peer-mismatch", "sync bundleのpeer identityがactive manifestと一致しません。");
  fail(bundle.sourceRole === manifest.peerRole, "link-role-mismatch", "sync bundle roleがactive manifestと一致しません。");
  if (canonical(bundle.authorityProfile) !== canonical(manifest.authorityProfile)) {
    return {
      status: "authority-change-preview",
      changed: false,
      writeCount: 0,
      linkId: bundle.linkId,
      authorityChange: { current: manifest.authorityProfile, proposed: bundle.authorityProfile },
      confirmationRequired: true,
      reason: "authority profileの変更はpreviewと人間の明示確認が必要です",
      conflicts: [],
      attention: conflictAttention([]),
      writes: [],
      networkCalls: 0,
      externalWrites: 0,
    };
  }
  const meta = readImportMeta(root, bundle.linkId);
  const conflicts = [];
  let authorityInvalid = false;
  try { validateAuthorityProfile(bundle.authorityProfile); }
  catch (error) {
    if (error?.code !== "authority-primary-conflict") throw error;
    authorityInvalid = true;
    conflicts.push({ conflictId: conflictId(bundle.linkId, "authority", null, error.details?.field, null, error.details?.primary), type: "authority_conflict", level: "critical", field: error.details?.field || null, reason: "同じfieldのPrimaryが重複しています" });
  }
  for (const [field, claimant] of Object.entries(bundle.authorityClaims || {})) {
    const rule = manifest.authorityProfile.fields[field];
    if (!rule || rule.kind !== "primary" || rule.primary !== claimant || claimant !== manifest.peerRole) {
      conflicts.push({ conflictId: conflictId(bundle.linkId, "authority", null, field, rule, claimant), type: "authority_conflict", level: "critical", field, reason: "authorityに反するPrimary claimです" });
    }
  }
  const localFields = localFieldIndex(root);
  for (const item of bundle.items) {
    fail(item && /^ci_[a-f0-9]{20}$/u.test(item.itemId || "") && item.fieldValues && typeof item.fieldValues === "object", "sync-item-invalid", "sync itemが不正です。");
    const local = localFields.get(item.itemId);
    if (!local) continue;
    for (const [field, remoteValue] of Object.entries(item.fieldValues)) {
      const rule = manifest.authorityProfile.fields[field];
      if (rule?.kind === "primary" && canonical(local[field]) !== canonical(remoteValue) && Object.hasOwn(bundle.authorityClaims || {}, field)) {
        conflicts.push({ conflictId: conflictId(bundle.linkId, "authority", item.itemId, field, local[field], remoteValue), type: "authority_conflict", level: "critical", itemId: item.itemId, field, reason: rule.primary === manifest.localRole ? "local Primaryとpeer claimが競合しています" : "peer Primaryの変更とlocal値が競合しています" });
      }
    }
  }
  const localRevision = currentSourceRevision(root, participant);
  if (bundle.parentRevision && bundle.parentRevision !== localRevision) {
    conflicts.push({ conflictId: conflictId(bundle.linkId, "sync", null, "parentRevision", localRevision, bundle.parentRevision), type: "sync_conflict", level: "high", field: "parentRevision", reason: "双方が前回import後に変更されています" });
  }
  for (const itemId of bundle.tombstones) {
    if (meta?.itemIds?.includes(itemId)) conflicts.push({ conflictId: conflictId(bundle.linkId, "tombstone", itemId, null, "present", "deleted"), type: "tombstone_conflict", level: "high", itemId, reason: "peer deletionは黙って削除せず確認します" });
  }
  const duplicateIds = bundle.items.map((item) => item.itemId).filter((id, index, all) => all.indexOf(id) !== index);
  fail(!duplicateIds.length, "sync-duplicate-item", "sync bundleに重複Itemがあります。", { duplicateIds: [...new Set(duplicateIds)] });
  const incompatible = bundle.schemaVersion > CLARITY_SCHEMA_VERSION;
  const stale = Boolean(meta && bundle.sourceSequence < meta.sourceSequence);
  const unchanged = Boolean(meta && bundle.sourceRevision === meta.sourceRevision && bundle.bundleDigest === meta.bundleDigest);
  const status = incompatible ? "incompatible" : stale ? "stale" : conflicts.length ? "conflict" : unchanged ? "unchanged" : "ready";
  const projection = {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    linkId: bundle.linkId,
    sourceProjectId: bundle.source.projectId,
    sourceRepositoryIdentity: bundle.source.repositoryIdentity,
    sourceRevision: bundle.sourceRevision,
    sourceSequence: bundle.sourceSequence,
    importedAt: null,
    items: bundle.items,
    tombstones: bundle.tombstones,
    unknownFields: Object.fromEntries(Object.entries(bundle).filter(([key]) => !new Set(["kind", "schemaVersion", "linkSchemaVersion", "linkId", "source", "target", "sourceRole", "manifestDigest", "authorityProfile", "authorityClaims", "sourceSequence", "sourceRevision", "parentRevision", "exportedAt", "items", "tombstones", "bundleDigest"]).has(key))),
  };
  return {
    status,
    changed: false,
    writeCount: 0,
    linkId: bundle.linkId,
    sourceRevision: bundle.sourceRevision,
    lastImportedRevision: meta?.sourceRevision || null,
    changes: { newItems: bundle.items.filter((item) => !meta?.itemIds?.includes(item.itemId)).map((item) => item.itemId), updatedItems: bundle.items.filter((item) => meta?.itemIds?.includes(item.itemId)).map((item) => item.itemId), tombstones: bundle.tombstones },
    conflicts,
    attention: conflictAttention(conflicts),
    authorityInvalid,
    stale,
    incompatible,
    newerSchema: incompatible,
    unknownFieldsPreserved: Object.keys(projection.unknownFields),
    writes: status === "ready" ? [`${importRoot(root, bundle.linkId)}/bundle.json`, `${importRoot(root, bundle.linkId)}/meta.json`, `.clarity/projections/linked/${bundle.linkId}.json`, ".clarity/events.jsonl"] : [],
    projection,
    resolutionChoices: ["secretary", "repo", "new-decision", "split", "defer", "unlink"],
    networkCalls: 0,
    externalWrites: 0,
  };
}

function applySyncImpl(rootValue, bundleInput) {
  const preview = previewSync(rootValue, bundleInput);
  if (preview.status === "unchanged") return { ...preview, status: "unchanged", changed: false, writeCount: 0 };
  fail(preview.status === "ready", `sync-${preview.status}`, preview.status === "conflict" ? "sync conflictを解消するまでapplyしません。" : preview.status === "stale" ? "stale bundleはapplyしません。" : "未対応schemaのbundleはapplyしません。", { preview });
  const bundle = validateBundle(structuredClone(bundleInput));
  const { root } = localParticipant(rootValue);
  const importedAt = nowIso();
  const projection = { ...preview.projection, importedAt };
  const meta = { schemaVersion: 1, linkId: bundle.linkId, sourceRevision: bundle.sourceRevision, sourceSequence: bundle.sourceSequence, bundleDigest: bundle.bundleDigest, itemIds: bundle.items.map((item) => item.itemId).sort(), importedAt };
  writeJson(root, `${importRoot(root, bundle.linkId)}/bundle.json`, bundle);
  writeJson(root, `${importRoot(root, bundle.linkId)}/meta.json`, meta);
  writeJson(root, `.clarity/projections/linked/${bundle.linkId}.json`, projection);
  linkEvent(root, "sync.applied", bundle.linkId, { sourceRevision: bundle.sourceRevision, bundleDigest: bundle.bundleDigest, itemCount: bundle.items.length, tombstoneCount: bundle.tombstones.length });
  return { ...preview, status: "applied", changed: true, writeCount: 4, importedAt, projection };
}

function resolveSyncConflictImpl(rootValue, { linkId, conflictId: selectedConflictId, choice, note = null, apply = false } = {}) {
  fail(/^cl_[a-f0-9]{20}$/u.test(String(linkId || "")), "link-id-invalid", "link IDが不正です。");
  fail(/^cf_[a-f0-9]{20}$/u.test(String(selectedConflictId || "")), "conflict-id-invalid", "conflict IDが不正です。");
  fail(RESOLUTION_CHOICES.has(choice), "resolution-choice-invalid", "resolutionはSecretary側／Repo側／new Decision／split／defer／unlinkから選んでください。");
  const { root } = localParticipant(rootValue);
  const manifest = activeManifest(root, linkId);
  const result = { status: "resolution-preview", changed: false, linkId, conflictId: selectedConflictId, choice, note: note ? String(note).slice(0, 200) : null, writes: choice === "unlink" ? [`.clarity/links/${linkId}.json`, ".clarity/project.json", ".clarity/events.jsonl"] : [".clarity/events.jsonl"], networkCalls: 0, externalWrites: 0 };
  noSensitiveData(result, "resolution");
  if (!apply) return result;
  if (choice === "unlink") {
    const disabled = manifestFor({ ...manifest, state: "disabled", occurredAt: nowIso() });
    writeJson(root, `.clarity/links/${linkId}.json`, disabled);
    updateProjectLink(root, disabled);
    linkEvent(root, "sync.conflict.detected", linkId, { conflictId: selectedConflictId });
    linkEvent(root, "link.disabled", linkId, { conflictId: selectedConflictId, choice });
    return { ...result, status: "disabled", changed: true, manifest: disabled };
  }
  linkEvent(root, "sync.conflict.detected", linkId, { conflictId: selectedConflictId });
  const event = linkEvent(root, "sync.conflict.resolved", linkId, { conflictId: selectedConflictId, choice, note: result.note, relation: choice === "split" ? { type: "split-from-conflict", conflictId: selectedConflictId } : null });
  return { ...result, status: choice === "defer" ? "deferred" : "resolved", changed: event.changed, event: event.event };
}

function setLocalLinkMappingImpl(rootValue, { linkId, peerRoot, apply = false } = {}) {
  const local = localParticipant(rootValue);
  const manifest = activeManifest(local.root, linkId);
  const peer = currentRoot(peerRoot, { legacyLocatorError: true });
  const peerProject = clarityProject(peer.root).project;
  assertLocal({ projectId: peerProject.clarityProjectId, repositoryIdentity: peer.identityRef }, manifest.peer, "local mapping peer");
  const mapping = { schemaVersion: 1, links: { [linkId]: { peerRoot: realpathSync(peer.root), peerProjectId: peerProject.clarityProjectId, peerRepositoryIdentityId: peer.identityRef.identityId, verifiedAt: nowIso() } } };
  const ownerRoot = owningGitRoot(local.root);
  const result = { status: "mapping-preview", changed: false, linkId, tracked: false, storage: ".git/clarity-links.json", peer: { projectId: peerProject.clarityProjectId, repositoryIdentityId: peer.identityRef.identityId } };
  if (!apply) return result;
  const peerBeforeWrite = currentRoot(peer.root);
  const peerProjectBeforeWrite = clarityProject(peerBeforeWrite.root).project;
  assertLocal({ projectId: peerProjectBeforeWrite.clarityProjectId, repositoryIdentity: peerBeforeWrite.identityRef }, manifest.peer, "local mapping peer write preflight");
  const gitDir = safeWritePath(ownerRoot, ".git");
  fail(existsSync(gitDir) && lstatSync(gitDir).isDirectory() && !lstatSync(gitDir).isSymbolicLink(), "git-mapping-unavailable", "local mappingには通常のGit Repoが必要です。");
  const path = safeWritePath(ownerRoot, ".git/clarity-links.json");
  let existing = { schemaVersion: 1, links: {} };
  if (existsSync(path)) existing = readJson(path, "mapping-json-invalid", "local mappingがJSONではありません。");
  const next = { schemaVersion: 1, links: { ...(existing.links || {}), ...mapping.links } };
  if (existsSync(path) && stableJson(existing) === stableJson(next)) return { ...result, status: "mapped", changed: false };
  writeFileAtomicSafe(ownerRoot, ".git/clarity-links.json", stableJson(next), { encoding: "utf8" });
  return { ...result, status: "mapped", changed: true };
}

function linkDoctorImpl(rootValue, { linkId = null } = {}) {
  const { root, participant } = localParticipant(rootValue);
  const rows = listManifests(root).filter((row) => !linkId || row.linkId === linkId);
  if (!rows.length) return { status: "not-linked", healthy: true, stale: false, links: [], nextAction: "link prepareから開始できます" };
  let mappingPath = null;
  try { mappingPath = safeWritePath(owningGitRoot(root), ".git/clarity-links.json"); }
  catch { /* non-git Clarity remains usable through manual bundles */ }
  const mappings = mappingPath && existsSync(mappingPath) ? readJson(mappingPath, "mapping-json-invalid", "local mappingがJSONではありません。").links || {} : {};
  const links = rows.map((manifest) => {
    const issues = [];
    if (!sameParticipant(participant, manifest.local)) issues.push("local-identity-mismatch");
    if (manifest.state === "active" && !mappings[manifest.linkId]) issues.push("peer-unreachable");
    if (mappings[manifest.linkId] && mappings[manifest.linkId].peerRepositoryIdentityId !== manifest.peer.repositoryIdentity.identityId) issues.push("peer-identity-mismatch");
    const meta = readImportMeta(root, manifest.linkId);
    const stale = manifest.state === "active" && (!meta || (Date.now() - new Date(meta.importedAt).valueOf()) > 7 * 86_400_000);
    if (stale) issues.push("sync-stale");
    return { linkId: manifest.linkId, state: manifest.state, peerProjectId: manifest.peer.projectId, healthy: !issues.length, stale, issues, repairChoices: issues.length ? ["mappingを再確認する", "manual bundleでsyncする", "unlinkを検討する"] : [] };
  });
  const healthy = links.every((row) => row.healthy);
  return { status: healthy ? "healthy" : "broken", healthy, stale: links.some((row) => row.stale), links, nextAction: healthy ? "追加操作は不要です" : "原因を確認し、mapping再確認／manual sync／unlinkを選んでください" };
}

function runRootRequest(rootValue, operation) {
  return withClarityRootObservation(rootValue, (handle) => operation(handle.root));
}

export function inspectLinkIdentity(rootValue) { return runRootRequest(rootValue, inspectLinkIdentityImpl); }
export function prepareLink(rootValue, options = {}) { return runRootRequest(rootValue, (root) => prepareLinkImpl(root, options)); }
export function acceptLink(rootValue, requestInput, options = {}) { return runRootRequest(rootValue, (root) => acceptLinkImpl(root, requestInput, options)); }
export function finalizeLink(rootValue, input, options = {}) { return runRootRequest(rootValue, (root) => finalizeLinkImpl(root, input, options)); }
export function exportSyncBundle(rootValue, options = {}) { return runRootRequest(rootValue, (root) => exportSyncBundleImpl(root, options)); }
export function previewSync(rootValue, bundleInput) { return runRootRequest(rootValue, (root) => previewSyncImpl(root, bundleInput)); }
export function applySync(rootValue, bundleInput) { return runRootRequest(rootValue, (root) => applySyncImpl(root, bundleInput)); }
export function resolveSyncConflict(rootValue, options = {}) { return runRootRequest(rootValue, (root) => resolveSyncConflictImpl(root, options)); }
export function setLocalLinkMapping(rootValue, options = {}) { return runRootRequest(rootValue, (root) => setLocalLinkMappingImpl(root, options)); }
export function linkDoctor(rootValue, options = {}) { return runRootRequest(rootValue, (root) => linkDoctorImpl(root, options)); }

export function readOnlyGitHubAdapter({ allowed = false, bundle = null } = {}) {
  if (!allowed) return { status: "permission-required", changed: false, networkCalls: 0, externalWrites: 0, reason: "GitHub read-only取得も明示許可前は実行しません" };
  fail(bundle, "adapter-input-required", "明示許可済みread-only adapterには取得結果bundleが必要です。");
  const validated = validateBundle(structuredClone(bundle));
  return { status: "adapter-fixture-read", changed: false, networkCalls: 0, externalWrites: 0, verifiedExternal: false, bundle: validated, reason: "isolated adapter fixture。実GitHub取得をverifiedへ昇格しません" };
}
