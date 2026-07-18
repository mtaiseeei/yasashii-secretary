#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export const REQUIRED_APIS = Object.freeze(["chat.googleapis.com", "people.googleapis.com"]);
export const MANUAL_STEPS = Object.freeze([
  "project",
  "chat-api",
  "people-api",
  "audience",
  "desktop-client",
  "client-json",
]);

function commandResult(value) {
  if (typeof value === "string") return { stdout: value, stderr: "", status: 0 };
  return { stdout: value?.stdout || "", stderr: value?.stderr || "", status: Number(value?.status || 0) };
}

function resultText(result) {
  return `${result.stderr}\n${result.stdout}`;
}

function isPermissionError(result) {
  return /permission|forbidden|denied|PERMISSION_DENIED|403/i.test(resultText(result));
}

function isNotFoundError(result) {
  return /not found|does not exist|NOT_FOUND|404/i.test(resultText(result));
}

function parseJson(result) {
  try {
    return { ok: true, value: JSON.parse(result.stdout || "null") };
  } catch {
    return { ok: false, value: null };
  }
}

export function systemRunner(command, args, options = {}) {
  try {
    return { stdout: execFileSync(command, args, { cwd: options.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), stderr: "", status: 0 };
  } catch (error) {
    return { stdout: String(error.stdout || ""), stderr: String(error.stderr || ""), status: Number(error.status || 1) };
  }
}

export function discoverRepository({ cwd = process.cwd(), runner = systemRunner } = {}) {
  const result = commandResult(runner("git", ["rev-parse", "--show-toplevel"], { cwd }));
  if (result.status !== 0 || !result.stdout.trim()) {
    return { status: "repository-needed", changed: false, message: "Google Chatを接続するGitリポジトリを確認できませんでした。対象のリポジトリを開いてから、もう一度お試しください。" };
  }
  const root = resolve(result.stdout.trim());
  return { status: "repository-ready", changed: false, root, repoName: basename(root) };
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 6);
}

export function projectProposal(repoName, { collision = false } = {}) {
  const displayName = `${repoName}-google-chat`;
  let projectId = displayName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  const reasons = [];
  if (projectId !== displayName) reasons.push("Project IDで使えない文字を安全な文字へ置き換えました");
  if (!/^[a-z]/.test(projectId)) {
    projectId = `p-${projectId}`;
    reasons.push("Project IDを英字で始めるため接頭辞を追加しました");
  }
  if (projectId.length > 30) {
    projectId = `${projectId.slice(0, 23).replace(/-+$/g, "")}-${shortHash(displayName)}`;
    reasons.push("Project IDの長さをGoogle Cloudの上限に合わせました");
  }
  if (projectId.length < 6) {
    projectId = `${projectId}-gchat`.slice(0, 30).replace(/-+$/g, "");
    reasons.push("Project IDの最小文字数に合わせました");
  }
  if (collision) {
    projectId = `${projectId.slice(0, 23).replace(/-+$/g, "")}-${shortHash(`${displayName}:collision`)}`;
    reasons.push("同じProject IDが使用済みのため識別子を追加しました");
  }
  return { displayName, projectId, adjusted: reasons.length > 0, reasons };
}

export function officialLinks(projectId = "") {
  const project = projectId ? `?project=${encodeURIComponent(projectId)}` : "";
  return {
    project: "https://console.cloud.google.com/projectcreate",
    chatApi: `https://console.cloud.google.com/apis/library/chat.googleapis.com${project}`,
    peopleApi: `https://console.cloud.google.com/apis/library/people.googleapis.com${project}`,
    audience: `https://console.cloud.google.com/auth/audience${project}`,
    clients: `https://console.cloud.google.com/auth/clients${project}`,
    install: "https://cloud.google.com/sdk/docs/install",
  };
}

export function projectConfirmation({ repo, organization, proposal, preflight }) {
  if (preflight?.status !== "preflight-ready"
    || preflight.projectId !== proposal.projectId
    || preflight.organization !== String(organization)
    || preflight.permission?.canCreate !== true
    || preflight.project?.available !== true) {
    return {
      status: "preflight-needed",
      changed: false,
      message: "Projectの既存確認と作成権限の確認を完了してから、作成内容を確認してください。",
    };
  }
  return {
    status: "cloud-project-confirmation-needed",
    changed: false,
    repo,
    organization,
    displayName: proposal.displayName,
    projectId: proposal.projectId,
    apis: [...REQUIRED_APIS],
    billingAccount: "自動接続しません",
    changes: ["Google Cloudプロジェクトを作成", "Google Chat APIを有効化", "People APIを有効化"],
    adjustedFrom: preflight.adjustedFrom || null,
    adjustmentReasons: [...(preflight.adjustmentReasons || [])],
    preflight: {
      status: preflight.status,
      projectId: preflight.projectId,
      organization: preflight.organization,
      account: preflight.account,
      projectAvailable: true,
      canCreate: true,
    },
  };
}

export function approveProjectConfirmation({ confirmation, approved = false } = {}) {
  if (confirmation?.status !== "cloud-project-confirmation-needed") {
    return { status: "preflight-needed", changed: false };
  }
  if (!approved) {
    return {
      status: "confirmation-needed",
      changed: false,
      projectId: confirmation.projectId,
      organization: String(confirmation.organization),
    };
  }
  return {
    status: "cloud-project-approved",
    changed: false,
    projectId: confirmation.projectId,
    displayName: confirmation.displayName,
    organization: String(confirmation.organization),
    preflight: { ...confirmation.preflight },
  };
}

function preflightFailure(status, code, message, extra = {}) {
  return { status, changed: false, error: { code, message }, ...extra };
}

function inspectProjectId({ cwd, runner, projectId }) {
  const result = commandResult(runner("gcloud", ["projects", "describe", projectId, "--format=json"], { cwd }));
  if (result.status === 0) {
    const parsed = parseJson(result);
    if (!parsed.ok || !parsed.value || Array.isArray(parsed.value)) {
      return preflightFailure("project-lookup-failed", "project-lookup-invalid-response", "Project IDの確認結果を読み取れませんでした。", { projectId });
    }
    return { status: "project-id-collision", changed: false, projectId, existingProject: { projectId: parsed.value.projectId || projectId, name: parsed.value.name || null } };
  }
  if (isNotFoundError(result)) return { status: "project-id-available", changed: false, projectId };
  const code = isPermissionError(result) ? "project-lookup-permission-needed" : "project-lookup-failed";
  return preflightFailure("project-lookup-failed", code, "Project IDが使用できるか確認できませんでした。Cloudは変更していません。", { projectId });
}

export function inspectGcloud({ cwd = process.cwd(), runner = systemRunner, projectId = "", repoName = "", organization = "" } = {}) {
  const version = commandResult(runner("gcloud", ["version", "--format=json"], { cwd }));
  if (version.status !== 0) {
    return {
      status: "cli-install-confirmation-needed",
      changed: false,
      official: true,
      installationCost: "インストール自体は無料です",
      caution: "Google公式の管理ツールですが、Google Cloudの設定を変更できます。インストール方法と実行予定を確認し、承認後だけ導入します。",
      fallback: officialLinks().install,
    };
  }
  const accounts = commandResult(runner("gcloud", ["auth", "list", "--filter=status:ACTIVE", "--format=json"], { cwd }));
  if (accounts.status !== 0) {
    return preflightFailure("auth-lookup-failed", isPermissionError(accounts) ? "auth-lookup-permission-needed" : "auth-lookup-failed", "ログイン中のGoogleアカウントを確認できませんでした。");
  }
  const parsedAccounts = parseJson(accounts);
  if (!parsedAccounts.ok || !Array.isArray(parsedAccounts.value)) {
    return preflightFailure("auth-lookup-failed", "auth-lookup-invalid-response", "ログイン中のGoogleアカウントの確認結果を読み取れませんでした。");
  }
  const activeAccounts = parsedAccounts.value.filter((item) => item?.account).map((item) => ({ account: item.account }));
  if (activeAccounts.length === 0) return { status: "login-needed", changed: false, activeAccounts: [] };
  if (activeAccounts.length > 1) return { status: "account-selection-needed", changed: false, activeAccounts };

  const organizations = commandResult(runner("gcloud", ["organizations", "list", "--format=json"], { cwd }));
  if (organizations.status !== 0) {
    const permission = isPermissionError(organizations);
    return preflightFailure(permission ? "permission-needed" : "organization-lookup-failed", permission ? "organization-lookup-permission-needed" : "organization-lookup-failed", "Google Workspace組織を確認できませんでした。組織の確認権限または接続状態を確認してください。", { activeAccounts });
  }
  const parsedOrganizations = parseJson(organizations);
  if (!parsedOrganizations.ok || !Array.isArray(parsedOrganizations.value)) {
    return preflightFailure("organization-lookup-failed", "organization-lookup-invalid-response", "Google Workspace組織の確認結果を読み取れませんでした。", { activeAccounts });
  }
  const availableOrganizations = parsedOrganizations.value.map((item) => ({ id: String(item.name || "").replace(/^organizations\//, ""), displayName: item.displayName || "名称未取得" })).filter((item) => item.id);
  if (availableOrganizations.length === 0) return { status: "organization-needed", changed: false, activeAccounts, organizations: [] };
  if (!organization && availableOrganizations.length > 1) return { status: "organization-selection-needed", changed: false, activeAccounts, organizations: availableOrganizations };
  const selectedOrganization = String(organization || availableOrganizations[0].id);
  if (!availableOrganizations.some((item) => item.id === selectedOrganization)) {
    return preflightFailure("permission-needed", "organization-not-visible", "選択したGoogle Workspace組織を現在のアカウントで確認できませんでした。", { activeAccounts, organizations: availableOrganizations });
  }
  if (!projectId) return { status: "project-id-needed", changed: false, activeAccounts, organizations: availableOrganizations, organization: selectedOrganization };

  const initialLookup = inspectProjectId({ cwd, runner, projectId });
  if (initialLookup.status === "project-lookup-failed") return { ...initialLookup, activeAccounts, organizations: availableOrganizations, organization: selectedOrganization };
  let finalProjectId = projectId;
  let adjustedFrom = null;
  let adjustmentReasons = [];
  if (initialLookup.status === "project-id-collision") {
    if (!repoName) return { ...initialLookup, status: "project-id-collision", activeAccounts, organizations: availableOrganizations, organization: selectedOrganization };
    const adjusted = projectProposal(repoName, { collision: true });
    const adjustedLookup = inspectProjectId({ cwd, runner, projectId: adjusted.projectId });
    if (adjustedLookup.status === "project-lookup-failed") return { ...adjustedLookup, activeAccounts, organizations: availableOrganizations, organization: selectedOrganization, adjustedFrom: projectId };
    if (adjustedLookup.status === "project-id-collision") {
      return preflightFailure("project-id-collision-unresolved", "adjusted-project-id-collision", "調整したProject IDも使用済みでした。別の候補を確認してください。", { activeAccounts, organizations: availableOrganizations, organization: selectedOrganization, projectId: adjusted.projectId, adjustedFrom: projectId, adjustmentReasons: adjusted.reasons });
    }
    finalProjectId = adjusted.projectId;
    adjustedFrom = projectId;
    adjustmentReasons = adjusted.reasons;
  }

  const account = activeAccounts[0].account;
  const permission = commandResult(runner("gcloud", [
    "policy-intelligence", "troubleshoot-policy", "iam",
    `//cloudresourcemanager.googleapis.com/organizations/${selectedOrganization}`,
    `--principal-email=${account}`,
    "--permission=resourcemanager.projects.create",
    "--format=json",
  ], { cwd }));
  if (permission.status !== 0) {
    const text = resultText(permission);
    const code = /SERVICE_DISABLED|has not been used|API.+not enabled/i.test(text) ? "permission-check-api-unavailable"
      : isPermissionError(permission) ? "permission-check-not-allowed"
        : "permission-check-failed";
    return preflightFailure("permission-check-inconclusive", code, "Project作成権限を確認できませんでした。APIを無断で有効にせず、管理者確認または手動支援へ切り替えてください。", { activeAccounts, organizations: availableOrganizations, organization: selectedOrganization, account, projectId: finalProjectId, adjustedFrom, adjustmentReasons });
  }
  const parsedPermission = parseJson(permission);
  if (!parsedPermission.ok || !parsedPermission.value?.overallAccessState) {
    return preflightFailure("permission-check-inconclusive", "permission-check-invalid-response", "Project作成権限の確認結果を読み取れませんでした。Cloudは変更していません。", { activeAccounts, organizations: availableOrganizations, organization: selectedOrganization, account, projectId: finalProjectId, adjustedFrom, adjustmentReasons });
  }
  if (parsedPermission.value.overallAccessState !== "CAN_ACCESS") {
    const inconclusive = ["UNKNOWN_INFO", "UNKNOWN_CONDITIONAL"].includes(parsedPermission.value.overallAccessState);
    return preflightFailure(inconclusive ? "permission-check-inconclusive" : "permission-needed", inconclusive ? "permission-check-inconclusive" : "project-create-permission-needed", inconclusive ? "Project作成権限を最後まで確認できませんでした。管理者へ確認してください。" : "このGoogle Workspace組織でProjectを作成する権限がありません。", { activeAccounts, organizations: availableOrganizations, organization: selectedOrganization, account, projectId: finalProjectId, adjustedFrom, adjustmentReasons, permission: { canCreate: false, state: parsedPermission.value.overallAccessState } });
  }
  return {
    status: "preflight-ready",
    changed: false,
    activeAccounts,
    organizations: availableOrganizations,
    organization: selectedOrganization,
    account,
    projectId: finalProjectId,
    adjustedFrom,
    adjustmentReasons,
    project: { available: true },
    permission: { canCreate: true, state: "CAN_ACCESS" },
    confirmationRequired: true,
  };
}

export function gcloudPlan({ projectId, displayName, organization, approval }) {
  if (!projectId || !displayName || !organization
    || approval?.status !== "cloud-project-approved"
    || approval.projectId !== projectId
    || String(approval.organization) !== String(organization)
    || approval.preflight?.status !== "preflight-ready"
    || approval.preflight?.projectId !== projectId
    || String(approval.preflight?.organization) !== String(organization)
    || approval.preflight?.projectAvailable !== true
    || approval.preflight?.canCreate !== true) {
    throw Object.assign(new Error("既存Projectと作成権限を確認し、最終Project IDを承認してください。"), { code: "plan-incomplete" });
  }
  return [
    { id: "create-project", command: "gcloud", args: ["projects", "create", projectId, "--name", displayName, "--organization", String(organization)] },
    { id: "enable-chat-api", command: "gcloud", args: ["services", "enable", REQUIRED_APIS[0], "--project", projectId] },
    { id: "enable-people-api", command: "gcloud", args: ["services", "enable", REQUIRED_APIS[1], "--project", projectId] },
  ];
}

export function executeApprovedPlan({ plan = [], approval, approved = false, cwd = process.cwd(), runner = systemRunner, completed = [] } = {}) {
  const create = plan.find((item) => item.id === "create-project");
  const projectId = create?.args?.[2];
  const organizationIndex = create?.args?.indexOf("--organization") ?? -1;
  const organization = organizationIndex >= 0 ? String(create.args[organizationIndex + 1] || "") : "";
  const validApproval = approval?.status === "cloud-project-approved"
    && approval.projectId === projectId
    && String(approval.organization) === organization
    && approval.preflight?.status === "preflight-ready"
    && approval.preflight?.projectId === projectId
    && String(approval.preflight?.organization) === organization
    && approval.preflight?.projectAvailable === true
    && approval.preflight?.canCreate === true;
  if (!approved || !validApproval) return { status: "confirmation-needed", changed: false, completed: [...completed], next: plan.find((item) => !completed.includes(item.id))?.id || null };
  const expectedPlan = gcloudPlan({
    projectId: approval.projectId,
    displayName: approval.displayName,
    organization: approval.organization,
    approval,
  });
  if (!isDeepStrictEqual(plan, expectedPlan)) {
    throw Object.assign(new Error("承認した内容と異なるCloud操作を拒否しました。"), { code: "unsafe-command" });
  }
  const allowed = new Set(["create-project", "enable-chat-api", "enable-people-api"]);
  const done = new Set(completed);
  for (const item of plan) {
    if (!allowed.has(item.id) || item.command !== "gcloud") throw Object.assign(new Error("予定外のCloud操作を拒否しました。"), { code: "unsafe-command" });
    if (done.has(item.id)) continue;
    const result = commandResult(runner(item.command, item.args, { cwd }));
    if (result.status !== 0) {
      const text = `${result.stderr}\n${result.stdout}`;
      const code = /already exists|already in use|409/i.test(text) ? "project-id-collision"
        : /permission|forbidden|denied|403/i.test(text) ? "permission-needed"
          : item.id === "create-project" ? "project-create-failed" : "api-enable-failed";
      return { status: "cloud-preparing", changed: done.size > completed.length, completed: [...done], next: item.id, error: { code, message: "Google Cloudの準備を途中で止めました。完了済みの工程は保持し、次の操作を確認してください。" } };
    }
    done.add(item.id);
  }
  return { status: "browser-step-needed", changed: true, completed: [...done], next: "audience" };
}

export function resumeState(input = {}) {
  const completed = [...new Set((input.completed || []).filter((step) => [...MANUAL_STEPS, "create-project", "enable-chat-api", "enable-people-api"].includes(step)))];
  const next = input.next && [...MANUAL_STEPS, "create-project", "enable-chat-api", "enable-people-api", "wizard"].includes(input.next) ? input.next : null;
  return {
    repo: input.repo || null,
    displayName: input.displayName || null,
    projectId: input.projectId || null,
    organization: input.organization || null,
    completed,
    next,
    checkedAt: input.checkedAt || new Date().toISOString(),
  };
}

export function manualStep({ projectId, completed = [] } = {}) {
  const links = officialLinks(projectId);
  const done = new Set(completed);
  if (done.has("create-project")) done.add("project");
  if (done.has("enable-chat-api")) done.add("chat-api");
  if (done.has("enable-people-api")) done.add("people-api");
  const definitions = {
    project: { link: links.project, label: "Google Cloudでプロジェクトを作る", action: "Project IDを確認してプロジェクトを作成します。", done: "作成したプロジェクトを選択できれば完了です。" },
    "chat-api": { link: links.chatApi, label: "Google Chat APIを有効にする", action: "「有効にする」を押します。", done: "APIが有効と表示されれば完了です。" },
    "people-api": { link: links.peopleApi, label: "People APIを有効にする", action: "「有効にする」を押します。", done: "APIが有効と表示されれば完了です。" },
    audience: { link: links.audience, label: "Audienceを内部（Internal）にする", action: "Audienceで「内部（Internal）」を選び、保存します。", done: "AudienceがInternalと表示されれば完了です。" },
    "desktop-client": { link: links.clients, label: "Desktop appの接続設定を作る", action: "ClientsでApplication type「Desktop app」を選び、作成します。", done: "Desktop appのClientが一覧に出れば完了です。" },
    "client-json": { link: links.clients, label: "接続用JSONをダウンロードする", action: "作成したDesktop appを開き、JSONをダウンロードします。", done: "接続用JSONがこのPCに保存されれば完了です。" },
  };
  const next = MANUAL_STEPS.find((step) => !done.has(step));
  if (!next) return { status: "client-file-ready", next: "wizard", message: "接続用JSONを確認できました。ローカル設定画面を開けます。" };
  return { status: "browser-step-needed", step: next, projectId, ...definitions[next], prompt: "できたら「できました」と返信してください。" };
}

export function acknowledgeManualStep({ projectId, completed = [], reply = "" } = {}) {
  const current = manualStep({ projectId, completed });
  if (current.status === "client-file-ready") return current;
  if (String(reply).trim() !== "できました") return current;
  return manualStep({ projectId, completed: [...completed, current.step] });
}

function parseArgs(argv) {
  const parsed = { command: argv[2] || "inspect" };
  for (let i = 3; i < argv.length; i += 2) parsed[String(argv[i]).replace(/^--/, "")] = argv[i + 1];
  return parsed;
}

if (resolve(process.argv[1] || "") === resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv);
  const repo = discoverRepository({ cwd: args.root || process.cwd() });
  let output = repo;
  if (args.command === "inspect" && repo.status === "repository-ready") {
    const proposal = projectProposal(repo.repoName);
    const preflight = inspectGcloud({ cwd: repo.root, projectId: proposal.projectId, repoName: repo.repoName, organization: args.organization });
    const finalProposal = preflight.projectId && preflight.projectId !== proposal.projectId
      ? { ...proposal, projectId: preflight.projectId, adjusted: true, reasons: [...(preflight.adjustmentReasons || proposal.reasons)] }
      : proposal;
    output = { repository: repo, preflight, proposal: finalProposal };
  }
  if (args.command === "links") output = officialLinks(args.project || "");
  if (args.command === "plan") {
    if (repo.status !== "repository-ready") output = repo;
    else {
      const initialProposal = projectProposal(repo.repoName);
      const preflight = inspectGcloud({ cwd: repo.root, projectId: initialProposal.projectId, repoName: repo.repoName, organization: args.organization });
      const proposal = preflight.status === "preflight-ready"
        ? { ...initialProposal, projectId: preflight.projectId, adjusted: Boolean(preflight.adjustedFrom), reasons: [...preflight.adjustmentReasons] }
        : initialProposal;
      const confirmation = projectConfirmation({ repo: repo.root, organization: preflight.organization || args.organization, proposal, preflight });
      const approval = approveProjectConfirmation({ confirmation, approved: args.confirmed === "true" });
      output = { preflight, confirmation, approval, commands: approval.status === "cloud-project-approved" ? gcloudPlan({ ...proposal, organization: approval.organization, approval }) : [] };
    }
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
