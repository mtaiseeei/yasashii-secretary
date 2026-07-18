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

function baseRoutes(projectResponse) {
  return {
    "gcloud version": { status: 0, stdout: "{}" },
    "gcloud auth list": { status: 0, stdout: '[{"account":"workspace-user@example.invalid"}]' },
    "gcloud organizations list": { status: 0, stdout: '[{"name":"organizations/123","displayName":"Example Workspace"}]' },
    [`gcloud projects describe ${proposal.projectId}`]: projectResponse,
    "gcloud policy-intelligence troubleshoot-policy iam": { status: 0, stdout: '{"overallAccessState":"CAN_ACCESS"}' },
  };
}

function inspectProject(projectResponse) {
  const calls = [];
  const preflight = inspectGcloud({
    projectId: proposal.projectId,
    repoName: "hogehoge",
    organization: "123",
    runner: runner(baseRoutes(projectResponse), calls),
  });
  const confirmation = projectConfirmation({ repo: "/tmp/hogehoge", organization: "123", proposal, preflight });
  const approval = approveProjectConfirmation({ confirmation, approved: true });
  let plan = null;
  try {
    plan = gcloudPlan({ ...proposal, organization: "123", approval });
  } catch (error) {
    plan = error;
  }
  const mutationCalls = calls.filter((call) => /projects create|services enable|config set project|billing/i.test(call));
  return { preflight, confirmation, approval, plan, calls, mutationCalls };
}

const permissionMixedCases = [
  ["403 + 404", { status: 1, stderr: "HTTP 403 followed by HTTP 404" }],
  ["403 + does not exist", { status: 1, stderr: "403: project does not exist" }],
  ["PERMISSION_DENIED + NOT_FOUND", { status: 1, stderr: "PERMISSION_DENIED: NOT_FOUND" }],
  ["forbidden + 404", { status: 1, stderr: "forbidden; 404" }],
  ["denied + NOT_FOUND", { status: 1, stderr: "denied because NOT_FOUND" }],
  ["stdout permission / stderr missing", { status: 1, stdout: "FoRbIdDeN", stderr: "404" }],
  ["stdout missing / stderr permission", { status: 1, stdout: "not_found", stderr: "PeRmIsSiOn DeNiEd" }],
  ["case-insensitive 403/does not exist", { status: 1, stdout: "DoEs NoT ExIsT", stderr: "pErMiSsIoN_dEnIeD 403" }],
];

for (const [label, response] of permissionMixedCases) {
  const result = inspectProject(response);
  check(`${label}: project-lookup-failed`, result.preflight.status === "project-lookup-failed", `actual=${result.preflight.status}`);
  check(`${label}: permission code`, result.preflight.error?.code === "project-lookup-permission-needed", `actual=${result.preflight.error?.code}`);
  check(`${label}: confirmation blocked`, result.confirmation.status === "preflight-needed", `actual=${result.confirmation.status}`);
  check(`${label}: plan blocked`, result.plan?.code === "plan-incomplete", `actual=${result.plan?.code || "none"}`);
  check(`${label}: mutating runner zero`, result.mutationCalls.length === 0, `calls=${result.mutationCalls.length}`);
}

for (const [label, response] of [
  ["plain not found", { status: 1, stderr: "project not found" }],
  ["plain does not exist", { status: 1, stdout: "project does not exist" }],
]) {
  const result = inspectProject(response);
  check(`${label}: ambiguous wording fails closed`, result.preflight.status === "project-lookup-failed", `actual=${result.preflight.status}`);
  check(`${label}: confirmation blocked`, result.confirmation.status === "preflight-needed");
  check(`${label}: plan blocked`, result.plan?.code === "plan-incomplete");
  check(`${label}: mutating runner zero`, result.mutationCalls.length === 0);
}

for (const [label, response] of [
  ["pure 404", { status: 1, stderr: "HTTP 404" }],
  ["pure NOT_FOUND", { status: 1, stdout: "NOT_FOUND" }],
  ["pure not_found lower-case", { status: 1, stdout: "not_found" }],
]) {
  const result = inspectProject(response);
  check(`${label}: preflight-ready`, result.preflight.status === "preflight-ready", `actual=${result.preflight.status}`);
  check(`${label}: confirmation available`, result.confirmation.status === "cloud-project-confirmation-needed");
  check(`${label}: canonical plan available`, Array.isArray(result.plan) && result.plan.length === 3);
  check(`${label}: preflight mutation zero`, result.mutationCalls.length === 0);
}

const available = inspectProject({ status: 1, stderr: "HTTP 404" });
const approval = available.approval;
const plan = available.plan;
check("canonical plan has exactly required APIs", Array.isArray(plan) && plan.length === 3 && REQUIRED_APIS.every((api) => JSON.stringify(plan).includes(api)));

function unsafe(label, mutate) {
  const candidate = structuredClone(plan);
  mutate(candidate);
  let calls = 0;
  let caught = null;
  try {
    executeApprovedPlan({
      plan: candidate,
      approval,
      approved: true,
      runner: () => {
        calls += 1;
        return { status: 0, stdout: "ok" };
      },
    });
  } catch (error) {
    caught = error;
  }
  check(label, caught?.code === "unsafe-command" && calls === 0, `code=${caught?.code || "none"} calls=${calls}`);
}

unsafe("different API rejected before runner", (candidate) => { candidate[1].args[2] = "drive.googleapis.com"; });
unsafe("different Project rejected before runner", (candidate) => { candidate[2].args[4] = "another-project"; });
unsafe("different displayName rejected before runner", (candidate) => { candidate[0].args[4] = "another-display-name"; });
unsafe("extra command rejected before runner", (candidate) => { candidate.push({ id: "extra", command: "gcloud", args: ["services", "enable", "drive.googleapis.com"] }); });
unsafe("missing command rejected before runner", (candidate) => { candidate.pop(); });
unsafe("duplicate command rejected before runner", (candidate) => { candidate.push(structuredClone(candidate[1])); });
unsafe("reordered commands rejected before runner", (candidate) => { [candidate[0], candidate[1]] = [candidate[1], candidate[0]]; });

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
check("valid approved plan executes exactly three commands", valid.status === "browser-step-needed" && validCalls.length === 3);
check("valid plan excludes Billing/default/other APIs", !validCalls.some((call) => /billing|config set project|drive.googleapis.com|policytroubleshooter.googleapis.com/i.test(call)));

process.stdout.write(`INDEPENDENT_RETRY2_NEGATIVE_PASS=${pass} FAIL=${fail}\n`);
if (fail > 0) process.exit(1);
