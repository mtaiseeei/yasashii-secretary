#!/usr/bin/env node

import {
  REQUIRED_APIS,
  approveProjectConfirmation,
  executeApprovedPlan,
  gcloudPlan,
  inspectGcloud,
  projectConfirmation,
  projectProposal,
} from "../../../../plugins/yasashii-secretary/skills/google-chat/scripts/cloud-setup.mjs";

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    pass += 1;
    process.stdout.write(`PASS ${label}\n`);
    return;
  }
  fail += 1;
  process.stdout.write(`FAIL ${label}${detail ? ` :: ${detail}` : ""}\n`);
}

function runner(routes, calls = []) {
  return (command, args) => {
    const key = [command, ...args].join(" ");
    calls.push(key);
    const route = Object.entries(routes)
      .sort(([left], [right]) => right.length - left.length)
      .find(([prefix]) => key.startsWith(prefix));
    return route ? route[1] : { status: 97, stderr: `unexpected command: ${key}` };
  };
}

const proposal = projectProposal("hogehoge");
const adjusted = projectProposal("hogehoge", { collision: true });

function baseRoutes(overrides = {}) {
  return {
    "gcloud version": { status: 0, stdout: "{}" },
    "gcloud auth list": { status: 0, stdout: '[{"account":"staff@example.invalid"}]' },
    "gcloud organizations list": { status: 0, stdout: '[{"name":"organizations/123","displayName":"Example Workspace"}]' },
    [`gcloud projects describe ${proposal.projectId}`]: { status: 1, stderr: "NOT_FOUND 404" },
    "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"overallAccessState":"CAN_ACCESS"}' },
    ...overrides,
  };
}

function inspect(overrides = {}, options = {}) {
  const calls = [];
  const result = inspectGcloud({
    projectId: proposal.projectId,
    repoName: "hogehoge",
    organization: options.organization || "",
    runner: runner(baseRoutes(overrides), calls),
  });
  return { result, calls };
}

const auth403 = inspect({
  "gcloud auth list": { status: 1, stderr: "PERMISSION_DENIED 403" },
});
check("auth 403は準備完了にしない", auth403.result.status === "auth-lookup-failed" && auth403.result.changed === false);

const authBroken = inspect({
  "gcloud auth list": { status: 0, stdout: "{}" },
});
check("auth壊れた応答は準備完了にしない", authBroken.result.status === "auth-lookup-failed");

const org403 = inspect({
  "gcloud organizations list": { status: 1, stderr: "PERMISSION_DENIED 403" },
});
check("organization 403は準備完了にしない", org403.result.status === "permission-needed" && org403.result.changed === false);

const orgBroken = inspect({
  "gcloud organizations list": { status: 0, stdout: "{}" },
});
check("organization壊れた応答は準備完了にしない", orgBroken.result.status === "organization-lookup-failed");

const projectAbsent = inspect();
check("明確な404だけProject ID未使用と判断", projectAbsent.result.status === "preflight-ready");

const projectExists = inspect({
  [`gcloud projects describe ${proposal.projectId}`]: { status: 0, stdout: `{"projectId":"${proposal.projectId}"}` },
  [`gcloud projects describe ${adjusted.projectId}`]: { status: 1, stderr: "NOT_FOUND 404" },
});
check("同名Projectありは調整候補を再照会", projectExists.result.status === "preflight-ready" && projectExists.result.adjustedFrom === proposal.projectId && projectExists.result.projectId === adjusted.projectId);

const projectAllCollision = inspect({
  [`gcloud projects describe ${proposal.projectId}`]: { status: 0, stdout: `{"projectId":"${proposal.projectId}"}` },
  [`gcloud projects describe ${adjusted.projectId}`]: { status: 0, stdout: `{"projectId":"${adjusted.projectId}"}` },
});
check("調整候補も衝突なら準備完了にしない", projectAllCollision.result.status === "project-id-collision-unresolved");

const project403 = inspect({
  [`gcloud projects describe ${proposal.projectId}`]: { status: 1, stderr: "PERMISSION_DENIED 403" },
});
check("Project describe 403は未使用と判断しない", project403.result.status === "project-lookup-failed" && project403.result.changed === false);

const projectAmbiguous403 = inspect({
  [`gcloud projects describe ${proposal.projectId}`]: { status: 1, stderr: "PERMISSION_DENIED 403: project does not exist or caller lacks permission" },
});
check(
  "Project describeの403と不存在候補が同居しても未使用と判断しない",
  projectAmbiguous403.result.status === "project-lookup-failed" && projectAmbiguous403.result.changed === false,
  `actual=${projectAmbiguous403.result.status}`,
);

const permissionCannot = inspect({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"overallAccessState":"CANNOT_ACCESS"}' },
});
check("作成権限CANNOTは準備完了にしない", permissionCannot.result.status === "permission-needed" && permissionCannot.result.permission?.canCreate === false);

for (const state of ["UNKNOWN_INFO", "UNKNOWN_CONDITIONAL"]) {
  const unknown = inspect({
    "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: JSON.stringify({ overallAccessState: state }) },
  });
  check(`作成権限${state}は準備完了にしない`, unknown.result.status === "permission-check-inconclusive" && unknown.result.changed === false);
}

const permissionMissing = inspect({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"allowPolicyExplanation":{}}' },
});
check("作成権限field欠落は準備完了にしない", permissionMissing.result.status === "permission-check-inconclusive");

const permissionDisabled = inspect({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 1, stderr: "SERVICE_DISABLED: Policy Troubleshooter API has not been used" },
});
check("Policy Troubleshooter API未有効は安全停止", permissionDisabled.result.status === "permission-check-inconclusive" && permissionDisabled.result.error.code === "permission-check-api-unavailable");
check("Policy Troubleshooter APIを無断有効化しない", !permissionDisabled.calls.some((call) => call.includes("services enable") || call.includes("policytroubleshooter.googleapis.com")));

const permission403 = inspect({
  "gcloud policy-intelligence troubleshoot-policy iam": { status: 1, stderr: "PERMISSION_DENIED 403" },
});
check("権限確認403は安全停止", permission403.result.status === "permission-check-inconclusive" && permission403.result.changed === false);

const preflight = projectAbsent.result;
const confirmation = projectConfirmation({ repo: "/tmp/hogehoge", organization: "123", proposal, preflight });
const approval = approveProjectConfirmation({ confirmation, approved: true });
const plan = gcloudPlan({ ...proposal, organization: "123", approval });

check("作成前preflightは変更系command 0件", !projectAbsent.calls.some((call) => /projects create|services enable|config set project|billing/.test(call)));
check("承認済み正規planはProject作成と必要API 2件のみ", plan.length === 3 && REQUIRED_APIS.every((api) => JSON.stringify(plan).includes(api)) && !/billing|config set project|policytroubleshooter.googleapis.com/.test(JSON.stringify(plan)));

const noApprovalCalls = [];
const noApproval = executeApprovedPlan({ plan, approval, approved: false, runner: runner({}, noApprovalCalls) });
check("再承認前はCloud変更0件", noApproval.status === "confirmation-needed" && noApproval.changed === false && noApprovalCalls.length === 0);

function unsafe(label, mutate) {
  const candidate = structuredClone(plan);
  mutate(candidate);
  let calls = 0;
  let error = null;
  try {
    executeApprovedPlan({ plan: candidate, approval, approved: true, runner: () => { calls += 1; return { status: 0 }; } });
  } catch (caught) {
    error = caught;
  }
  check(label, error?.code === "unsafe-command" && calls === 0, `code=${error?.code || "none"} calls=${calls}`);
}

unsafe("承認後の別APIはrunner 0件で拒否", (candidate) => { candidate[1].args[2] = "drive.googleapis.com"; });
unsafe("承認後の別Projectはrunner 0件で拒否", (candidate) => { candidate[2].args[4] = "another-project"; });
unsafe("承認後の別表示名はrunner 0件で拒否", (candidate) => { candidate[0].args[4] = "another-name"; });
unsafe("承認後の余分なcommandはrunner 0件で拒否", (candidate) => { candidate.push({ id: "extra", command: "gcloud", args: ["services", "enable", "drive.googleapis.com"] }); });
unsafe("承認後のcommand欠落はrunner 0件で拒否", (candidate) => { candidate.pop(); });
unsafe("承認後のcommand重複はrunner 0件で拒否", (candidate) => { candidate.push(structuredClone(candidate[1])); });
unsafe("承認後のcommand並べ替えはrunner 0件で拒否", (candidate) => { [candidate[0], candidate[1]] = [candidate[1], candidate[0]]; });

const validCalls = [];
const valid = executeApprovedPlan({
  plan,
  approval,
  approved: true,
  runner: (command, args) => {
    validCalls.push([command, ...args].join(" "));
    return { status: 0, stdout: "ok" };
  },
});
check("正規planだけ3件を順に実行", valid.status === "browser-step-needed" && validCalls.length === 3);
check("正規実行もBilling・既定Project・他API 0件", !validCalls.some((call) => /billing|config set project|drive.googleapis.com|policytroubleshooter.googleapis.com/.test(call)));

process.stdout.write(`INDEPENDENT_CLOUD_NEGATIVE_PASS=${pass} FAIL=${fail}\n`);
if (fail > 0) process.exit(1);
