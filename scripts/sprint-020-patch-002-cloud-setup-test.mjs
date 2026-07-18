#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_APIS, acknowledgeManualStep, approveProjectConfirmation, discoverRepository, executeApprovedPlan, gcloudPlan,
  inspectGcloud, manualStep, officialLinks, projectConfirmation, projectProposal, resumeState,
} from "../plugins/yasashii-secretary/skills/google-chat/scripts/cloud-setup.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;
function check(label, condition, detail = "") {
  if (condition) { pass += 1; process.stdout.write(`  PASS ${label}\n`); }
  else { fail += 1; process.stderr.write(`  FAIL ${label}${detail ? `: ${detail}` : ""}\n`); }
}

function fixtureRunner(routes, calls = []) {
  return (command, args, options = {}) => {
    calls.push({ command, args: [...args], cwd: options.cwd });
    const key = `${command} ${args.join(" ")}`;
    const match = Object.entries(routes).find(([pattern]) => key.includes(pattern));
    return match ? (typeof match[1] === "function" ? match[1]({ command, args, options }) : match[1]) : { status: 1, stderr: `fixtureにないコマンド: ${key}` };
  };
}

const rootRunner = fixtureRunner({
  "git rev-parse --show-toplevel": { status: 0, stdout: "/tmp/hogehoge\n" },
});
const repository = discoverRepository({ cwd: "/tmp/hogehoge/subdir", runner: rootRunner });
check("サブディレクトリからGit repo root名を使う", repository.status === "repository-ready" && repository.root === "/tmp/hogehoge" && repository.repoName === "hogehoge");
check("repo名からProject表示名とID初期案を作る", projectProposal(repository.repoName).displayName === "hogehoge-google-chat" && projectProposal(repository.repoName).projectId === "hogehoge-google-chat");

let mutations = 0;
const noRepo = discoverRepository({ cwd: "/tmp/no-repo", runner: () => { mutations += 1; return { status: 128, stderr: "not a repository" }; } });
check("no repoはProject作成へ進まない", noRepo.status === "repository-needed" && noRepo.changed === false && mutations === 1);

const adjusted = projectProposal("株式会社_とても長い営業マーケティングプロジェクト");
check("Project ID制約は理由つきで安全に調整", adjusted.displayName.endsWith("-google-chat") && adjusted.projectId.length <= 30 && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(adjusted.projectId) && adjusted.reasons.length > 0, JSON.stringify(adjusted));
const collision = projectProposal("hogehoge", { collision: true });
check("全体重複時だけ識別子を足す", collision.projectId !== "hogehoge-google-chat" && collision.reasons.some((item) => item.includes("使用済み")));

const missingCalls = [];
const missing = inspectGcloud({ runner: fixtureRunner({}, missingCalls) });
check("gcloud未導入は公式・無料・変更能力・承認待ちを示す", missing.status === "cli-install-confirmation-needed" && missing.changed === false && missing.official && missing.installationCost.includes("無料") && missing.caution.includes("設定を変更") && missing.caution.includes("承認後"));
check("gcloud確認はversionだけで外部変更0件", missingCalls.length === 1 && missingCalls[0].args[0] === "version");

const proposal = projectProposal("hogehoge");
const adjustedCollision = projectProposal("hogehoge", { collision: true });
function readyRoutes(overrides = {}) {
  return {
    "gcloud version": { status: 0, stdout: "{}" },
    "gcloud auth list": { status: 0, stdout: '[{"account":"staff@example.invalid"}]' },
    "gcloud organizations list": { status: 0, stdout: '[{"name":"organizations/123","displayName":"Example Workspace"}]' },
    [`gcloud projects describe ${proposal.projectId} --format=json`]: { status: 1, stderr: "NOT_FOUND 404" },
    "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"overallAccessState":"CAN_ACCESS"}' },
    ...overrides,
  };
}

const cliCalls = [];
const cliReady = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes(), cliCalls) });
check("auth・組織・Project未使用・作成権限を変更なしで確認", cliReady.status === "preflight-ready" && cliReady.activeAccounts.length === 1 && cliReady.organizations[0].id === "123" && cliReady.project.available && cliReady.permission.canCreate && cliCalls.length === 5);
check("権限確認は対象組織・active account・create permissionを明示", cliCalls[4].args.includes("//cloudresourcemanager.googleapis.com/organizations/123") && cliCalls[4].args.includes("--principal-email=staff@example.invalid") && cliCalls[4].args.includes("--permission=resourcemanager.projects.create"));

const authFailure = inspectGcloud({ projectId: proposal.projectId, runner: fixtureRunner({ "gcloud version": { status: 0, stdout: "{}" }, "gcloud auth list": { status: 1, stderr: "network unavailable" } }) });
check("auth lookup失敗をlogin済みと扱わない", authFailure.status === "auth-lookup-failed" && authFailure.error.code === "auth-lookup-failed");

const noLogin = inspectGcloud({ runner: fixtureRunner({
  "gcloud version": { status: 0, stdout: "{}" }, "gcloud auth list": { status: 0, stdout: "[]" },
}) });
check("未ログインを推測で越えない", noLogin.status === "login-needed" && noLogin.changed === false);
const multiOrg = inspectGcloud({ runner: fixtureRunner({
  "gcloud version": { status: 0, stdout: "{}" }, "gcloud auth list": { status: 0, stdout: '[{"account":"staff@example.invalid"}]' }, "gcloud organizations list": { status: 0, stdout: '[{"name":"organizations/1"},{"name":"organizations/2"}]' },
}) });
check("複数組織は利用者選択を待つ", multiOrg.status === "organization-selection-needed" && multiOrg.organizations.length === 2);
const noOrganization = inspectGcloud({ runner: fixtureRunner({
  "gcloud version": { status: 0, stdout: "{}" }, "gcloud auth list": { status: 0, stdout: '[{"account":"staff@example.invalid"}]' }, "gcloud organizations list": { status: 0, stdout: "[]" },
}) });
check("Workspace組織0件をcli-readyにしない", noOrganization.status === "organization-needed");

const org403 = inspectGcloud({ projectId: proposal.projectId, runner: fixtureRunner({
  "gcloud version": { status: 0, stdout: "{}" }, "gcloud auth list": { status: 0, stdout: '[{"account":"staff@example.invalid"}]' }, "gcloud organizations list": { status: 1, stderr: "PERMISSION_DENIED 403" },
}) });
check("organization list 403をcli-readyにしない", org403.status === "permission-needed" && org403.error.code === "organization-lookup-permission-needed");

const projectLookupFailure = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  [`gcloud projects describe ${proposal.projectId} --format=json`]: { status: 1, stderr: "backend unavailable" },
})) });
check("Project lookup失敗を空きIDと扱わない", projectLookupFailure.status === "project-lookup-failed" && projectLookupFailure.error.code === "project-lookup-failed");
const project403 = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  [`gcloud projects describe ${proposal.projectId} --format=json`]: { status: 1, stderr: "PERMISSION_DENIED 403" },
})) });
check("Project describe 403は存在・権限を推測せず空きIDにしない", project403.status === "project-lookup-failed" && project403.error.code === "project-lookup-permission-needed" && project403.changed === false);

const collisionPreflight = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  [`gcloud projects describe ${proposal.projectId} --format=json`]: { status: 0, stdout: `{"projectId":"${proposal.projectId}","name":"same-name"}` },
  [`gcloud projects describe ${adjustedCollision.projectId} --format=json`]: { status: 1, stderr: "NOT_FOUND 404" },
})) });
check("同名Projectありは理由つき候補を作り調整後IDも再確認", collisionPreflight.status === "preflight-ready" && collisionPreflight.adjustedFrom === proposal.projectId && collisionPreflight.projectId === adjustedCollision.projectId && collisionPreflight.adjustmentReasons.some((item) => item.includes("使用済み")));

const allCollision = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  [`gcloud projects describe ${proposal.projectId} --format=json`]: { status: 0, stdout: `{"projectId":"${proposal.projectId}"}` },
  [`gcloud projects describe ${adjustedCollision.projectId} --format=json`]: { status: 0, stdout: `{"projectId":"${adjustedCollision.projectId}"}` },
})) });
check("調整後も全体衝突なら作成可能と扱わない", allCollision.status === "project-id-collision-unresolved" && allCollision.error.code === "adjusted-project-id-collision");

const permissionDenied = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"overallAccessState":"CANNOT_ACCESS"}' },
})) });
check("Project作成権限なしを事前に止める", permissionDenied.status === "permission-needed" && permissionDenied.error.code === "project-create-permission-needed" && permissionDenied.permission.canCreate === false);

const permissionApiDisabled = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 1, stderr: "SERVICE_DISABLED: Policy Troubleshooter API has not been used" },
})) });
check("権限確認API未有効を無断有効化せずinconclusive", permissionApiDisabled.status === "permission-check-inconclusive" && permissionApiDisabled.error.code === "permission-check-api-unavailable");
const permission403 = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 1, stderr: "PERMISSION_DENIED 403" },
})) });
check("permission lookup 403をcli-readyにしない", permission403.status === "permission-check-inconclusive" && permission403.error.code === "permission-check-not-allowed");
const permissionUnknown = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"overallAccessState":"UNKNOWN_INFO"}' },
})) });
check("権限UNKNOWNをcli-readyにしない", permissionUnknown.status === "permission-check-inconclusive" && permissionUnknown.error.code === "permission-check-inconclusive");
const permissionMissingField = inspectGcloud({ projectId: proposal.projectId, repoName: "hogehoge", runner: fixtureRunner(readyRoutes({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"allowPolicyExplanation":{}}' },
})) });
check("権限field欠落をcli-readyにしない", permissionMissingField.status === "permission-check-inconclusive" && permissionMissingField.error.code === "permission-check-invalid-response");

const confirmation = projectConfirmation({ repo: "/tmp/hogehoge", organization: "123", proposal, preflight: cliReady });
check("作成前確認はProject・組織・API・Billing非接続を含む", confirmation.status === "cloud-project-confirmation-needed" && confirmation.changed === false && confirmation.apis.join(",") === REQUIRED_APIS.join(",") && confirmation.billingAccount.includes("自動接続しません"));
const missingPreflight = projectConfirmation({ repo: "/tmp/hogehoge", organization: "123", proposal });
check("preflightなしでは作成確認へ進まない", missingPreflight.status === "preflight-needed");

const adjustedProposal = { ...proposal, projectId: collisionPreflight.projectId, adjusted: true, reasons: collisionPreflight.adjustmentReasons };
const adjustedConfirmation = projectConfirmation({ repo: "/tmp/hogehoge", organization: "123", proposal: adjustedProposal, preflight: collisionPreflight });
check("衝突調整後は旧ID・理由・最終IDを再提示", adjustedConfirmation.status === "cloud-project-confirmation-needed" && adjustedConfirmation.adjustedFrom === proposal.projectId && adjustedConfirmation.projectId === adjustedCollision.projectId && adjustedConfirmation.adjustmentReasons.length > 0);

const rejectedApproval = approveProjectConfirmation({ confirmation: adjustedConfirmation, approved: false });
let rejectedPlan = null;
try { rejectedPlan = gcloudPlan({ ...adjustedProposal, organization: "123", approval: rejectedApproval }); } catch (error) { rejectedPlan = error; }
check("調整後の再承認前はplan生成・Cloud変更0件", rejectedApproval.changed === false && rejectedPlan?.code === "plan-incomplete");
let bypassCalls = 0;
const bypass = executeApprovedPlan({
  plan: [
    { id: "create-project", command: "gcloud", args: ["projects", "create", adjustedProposal.projectId, "--name", adjustedProposal.displayName, "--organization", "123"] },
  ],
  approval: rejectedApproval,
  approved: true,
  runner: () => { bypassCalls += 1; return { status: 0 }; },
});
check("手作りplanでも再承認なしは外部変更0件", bypass.status === "confirmation-needed" && bypass.changed === false && bypassCalls === 0);

const approval = approveProjectConfirmation({ confirmation, approved: true });
const plan = gcloudPlan({ ...proposal, organization: "123", approval });
const serializedPlan = JSON.stringify(plan);
check("CLI planはProject作成と必要API 2件だけ", plan.length === 3 && REQUIRED_APIS.every((api) => serializedPlan.includes(api)) && !serializedPlan.includes("billing") && !serializedPlan.includes("config set project") && !serializedPlan.includes("policytroubleshooter"));
check("全コマンドは対象Projectまたは組織を明示", plan.every((item) => item.args.includes("--project") || item.args.includes("--organization")));

const deniedCalls = [];
const denied = executeApprovedPlan({ plan, approved: false, runner: fixtureRunner({}, deniedCalls) });
check("明示承認前・拒否はCloud変更0件", denied.status === "confirmation-needed" && denied.changed === false && deniedCalls.length === 0);

const approvedCalls = [];
const approved = executeApprovedPlan({ plan, approval, approved: true, runner: fixtureRunner({ "gcloud ": { status: 0, stdout: "ok" } }, approvedCalls) });
check("承認後だけProjectとAPIを順に準備", approved.status === "browser-step-needed" && approved.completed.length === 3 && approved.next === "audience" && approvedCalls.length === 3);
check("CLI完了後の手動案内はAudienceから始まる", manualStep({ projectId: proposal.projectId, completed: approved.completed }).step === "audience");

function checkUnsafePlan(label, candidate) {
  let calls = 0;
  let result = null;
  try {
    result = executeApprovedPlan({
      plan: candidate,
      approval,
      approved: true,
      runner: () => { calls += 1; return { status: 0, stdout: "ok" }; },
    });
  } catch (error) {
    result = error;
  }
  check(label, result?.code === "unsafe-command" && calls === 0);
}

const clonePlan = () => JSON.parse(JSON.stringify(plan));
const anotherApi = clonePlan();
anotherApi[1].args[2] = "drive.googleapis.com";
checkUnsafePlan("承認後でも別APIへの差し替えは実行0件", anotherApi);
const anotherProject = clonePlan();
anotherProject[1].args[4] = "another-project";
checkUnsafePlan("承認後でも別Projectへの差し替えは実行0件", anotherProject);
const anotherDisplayName = clonePlan();
anotherDisplayName[0].args[4] = "another-display-name";
checkUnsafePlan("承認後でも表示名の差し替えは実行0件", anotherDisplayName);
const extraCommand = clonePlan();
extraCommand.push({ id: "enable-extra-api", command: "gcloud", args: ["services", "enable", "drive.googleapis.com", "--project", proposal.projectId] });
checkUnsafePlan("承認後でも余分なcommandは実行0件", extraCommand);
checkUnsafePlan("承認後でもcommand欠落は実行0件", clonePlan().slice(0, 2));
const duplicateCommand = clonePlan();
duplicateCommand.splice(2, 0, JSON.parse(JSON.stringify(duplicateCommand[1])));
checkUnsafePlan("承認後でもcommand重複は実行0件", duplicateCommand);
const reorderedCommands = clonePlan();
[reorderedCommands[0], reorderedCommands[1]] = [reorderedCommands[1], reorderedCommands[0]];
checkUnsafePlan("承認後でもcommand並べ替えは実行0件", reorderedCommands);

let apiCount = 0;
const partial = executeApprovedPlan({ plan, approval, approved: true, runner: (command, args) => {
  if (args.includes("services")) apiCount += 1;
  if (args.includes("people.googleapis.com")) return { status: 1, stderr: "permission denied" };
  return { status: 0, stdout: "ok" };
} });
check("API片方失敗は完了済みと未完了を分ける", partial.status === "cloud-preparing" && partial.completed.includes("enable-chat-api") && !partial.completed.includes("enable-people-api") && partial.next === "enable-people-api" && partial.error.code === "permission-needed" && apiCount === 2);
const collisionResult = executeApprovedPlan({ plan, approval, approved: true, runner: () => ({ status: 1, stderr: "already exists 409" }) });
check("Project ID衝突を区別する", collisionResult.error.code === "project-id-collision" && collisionResult.next === "create-project");

const links = officialLinks("hogehoge-google-chat");
check("API・Audience・Clientsリンクは対象Projectを指定", [links.chatApi, links.peopleApi, links.audience, links.clients].every((url) => url.includes("project=hogehoge-google-chat")));
const firstStep = manualStep({ projectId: "hogehoge-google-chat", completed: [] });
check("手動案内は一度に一画面一操作", firstStep.status === "browser-step-needed" && firstStep.step === "project" && firstStep.label && firstStep.action && firstStep.done && firstStep.prompt.includes("できました"));
check("できました前は次工程へ進まない", acknowledgeManualStep({ projectId: "hogehoge-google-chat", completed: [], reply: "まだです" }).step === "project");
check("できました後だけ次工程へ進む", acknowledgeManualStep({ projectId: "hogehoge-google-chat", completed: [], reply: "できました" }).step === "chat-api");
check("JSON取得完了後だけwizard状態になる", manualStep({ projectId: "hogehoge-google-chat", completed: ["project", "chat-api", "people-api", "audience", "desktop-client", "client-json"] }).status === "client-file-ready");

const safeResume = resumeState({ repo: "/tmp/hogehoge", displayName: proposal.displayName, projectId: proposal.projectId, organization: "123", completed: ["create-project", "enable-chat-api", "unknown"], next: "people-api", clientSecret: "must-not-remain", accessToken: "must-not-remain" });
const resumeText = JSON.stringify(safeResume);
check("再開情報は許可fieldと完了工程だけ", safeResume.completed.length === 2 && !resumeText.includes("must-not-remain") && !Object.hasOwn(safeResume, "clientSecret") && !Object.hasOwn(safeResume, "accessToken"));

const skill = readFileSync(join(repo, "plugins/yasashii-secretary/skills/google-chat/SKILL.md"), "utf8");
const app = readFileSync(join(repo, "plugins/yasashii-secretary/skills/google-chat/assets/wizard/app.js"), "utf8");
const server = readFileSync(join(repo, "plugins/yasashii-secretary/skills/google-chat/scripts/wizard-server.mjs"), "utf8");
const readme = readFileSync(join(repo, "README.md"), "utf8");
const router = readFileSync(join(repo, "plugins/yasashii-secretary/skills/secretary/SKILL.md"), "utf8");
const guidePath = join(repo, "plugins/yasashii-secretary/skills/google-chat/assets/wizard/google-cloud-setup-guide.svg");
const userSurface = `${skill}\n${app}\n${readme.slice(readme.indexOf("### Google Chatをつなぐ"), readme.indexOf("## できること"))}`;
check("利用者向けGoogle Chat面はGoogle Workspace版を明示", userSurface.includes("Google Workspace版Google Chat") && userSurface.includes("Audience `Internal`"));
check("対象外アカウント・Audienceの利用者向け分岐0件", !/個人Google|無料版Google|External|Test users|公開審査/.test(userSurface));
check("自然文からGoogle Chat skillへ段階ロード", router.includes("Google Chatを設定したい") && router.includes("skills/google-chat/SKILL.md"));
check("skillは未準備時にwizardを先に開かない", skill.includes("未設定時はwizardを先に開かない") && skill.includes("接続用JSONをダウンロードできたと確認してから"));
check("skillはProject 403・権限UNKNOWNを推測成功にしない", skill.includes("403、通信失敗、結果を読み取れない場合") && skill.includes("UNKNOWN_INFO") && skill.includes("Policy Troubleshooter APIは無断で有効にしない"));
check("Browser拡張を必要条件にしない", skill.includes("Browser Use、Chrome拡張機能、特定ブラウザは必要条件にしない") && !/拡張機能をインストール/.test(userSurface));
check("wizardはJSON選択から開始", app.includes('else renderPrepareFile();') && app.includes("まだ接続用JSONがない場合") && app.includes("Google Chatを設定したい"));
check("wizardのCloud準備3画面を撤去", !app.includes('show("prepare-cloud"') && !app.includes('show("prepare-access"') && !app.includes("Google Cloud準備 1 / 3"));
check("Cloud案内画像と配信参照を撤去", !existsSync(guidePath) && !app.includes("google-cloud-setup-guide") && !server.includes("google-cloud-setup-guide") && !readme.includes("google-cloud-setup-guide"));
check("READMEはAI主導線と手動公式リンクを持つ", readme.includes("AIへ **「Google Chatを設定したい」**") && readme.includes("AIを使わずGoogle Cloudを準備する場合") && readme.includes("console.cloud.google.com/auth/clients"));
check("READMEはBilling非接続とgcloud安心説明を持つ", readme.includes("Google公式の管理ツール") && readme.includes("インストール自体は無料") && readme.includes("Billing Accountを自動接続しません"));
check("OAuthはJSON後の明示ボタン・別タブ・SPACE自動選択を維持", app.includes("Googleの確認画面を開く") && app.includes('window.open("/api/oauth/authorize", "yasashii-google-chat-oauth")') && app.includes("await discoverSpaces()"));
check("一体型確定・3時間推奨・完了CTAを維持", app.includes('actions("この設定で始める")') && app.includes('interval: "3h"') && app.includes("設定を終了する") && !app.includes("自動取得を設定する"));
check("Chatwork実装は本Patchで変更対象外", existsSync(join(repo, "plugins/yasashii-secretary/skills/chatwork/assets/wizard/app.js")));

process.stdout.write(`SPRINT020_PATCH002_PASS=${pass} FAIL=${fail}\n`);
if (fail) process.exit(1);
