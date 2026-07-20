import { randomUUID } from "node:crypto";
import { runExternal } from "./external-ops.mjs";

function finitePositive(value, fallback, minimum = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum ? number : fallback;
}

function parseRuns(stdout) {
  let parsed;
  try { parsed = JSON.parse(stdout || "[]"); }
  catch { throw Object.assign(new Error("GitHub Actionsの実行一覧を読み取れませんでした。"), { code: "run-list-invalid" }); }
  if (!Array.isArray(parsed)) throw Object.assign(new Error("GitHub Actionsの実行一覧を確認できませんでした。"), { code: "run-list-invalid" });
  return parsed;
}

function createdAtMillis(run) {
  const value = Date.parse(String(run?.createdAt || ""));
  return Number.isFinite(value) ? value : null;
}

function runId(run) {
  const value = String(run?.databaseId || "");
  return /^\d+$/.test(value) ? value : null;
}

async function command(binary, argv, { root, timeoutMs, label }) {
  return runExternal(binary, argv, {
    cwd: root,
    timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    label,
  });
}

export async function currentGitBranch({ root, git = process.env.YASASHII_GIT_BIN || "git", timeoutMs = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000) }) {
  const result = await command(git, ["branch", "--show-current"], { root, timeoutMs, label: "Git branch確認" });
  const branch = String(result.stdout || "").trim();
  if (!branch || /[\r\n\0]/.test(branch)) {
    throw Object.assign(new Error("現在のGit branchを確認できないため、GitHub Actionsを開始していません。branchを確認してから再実行してください。"), { code: "branch-unconfirmed" });
  }
  return branch;
}

export async function listCorrelatableWorkflowRuns({
  root,
  workflowFile,
  branch,
  gh = process.env.YASASHII_GH_BIN || "gh",
  timeoutMs = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
}) {
  const listed = await command(gh, [
    "run", "list",
    "--workflow", workflowFile,
    "--branch", branch,
    "--event", "workflow_dispatch",
    "--limit", "100",
    "--json", "databaseId,status,conclusion,createdAt,headBranch,workflowName,displayTitle",
  ], { root, timeoutMs, label: "GitHub Actions実行一覧" });
  return parseRuns(listed.stdout);
}

function isExactRun(run, { baselineIds, dispatchedAt, branch, workflowName, displayTitle }) {
  const id = runId(run);
  const createdAt = createdAtMillis(run);
  return Boolean(
    id
    && !baselineIds.has(id)
    && createdAt !== null
    && createdAt >= dispatchedAt
    && run?.headBranch === branch
    && run?.workflowName === workflowName
    && run?.displayTitle === displayTitle
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function dispatchCorrelatedWorkflow({
  root,
  workflowFile,
  workflowName,
  inputs = {},
  gh = process.env.YASASHII_GH_BIN || "gh",
  git = process.env.YASASHII_GIT_BIN || "git",
  cliTimeoutMs = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
  discoveryTimeoutMs = 5_000,
  pollIntervalMs = 250,
  now = () => Date.now(),
  correlationId = randomUUID(),
}) {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(correlationId)) {
    throw Object.assign(new Error("GitHub Actionsの相関IDを作成できませんでした。"), { code: "correlation-id-invalid" });
  }
  const branch = await currentGitBranch({ root, git, timeoutMs: cliTimeoutMs });
  const before = await listCorrelatableWorkflowRuns({ root, workflowFile, branch, gh, timeoutMs: cliTimeoutMs });
  const baselineIds = new Set(before.map(runId).filter(Boolean));
  // GitHubのcreatedAtは秒精度なので、同じ秒の今回runを除外しないよう秒境界を使う。
  const dispatchedAt = Math.floor(now() / 1000) * 1000;
  const displayTitle = `${workflowName} [${correlationId}]`;
  const inputArgs = Object.entries({ ...inputs, correlation_id: correlationId }).flatMap(([name, value]) => ["-f", `${name}=${String(value)}`]);
  await command(gh, ["workflow", "run", workflowFile, "--ref", branch, ...inputArgs], { root, timeoutMs: cliTimeoutMs, label: "GitHub Actions開始" });

  const discoveryTimeout = finitePositive(discoveryTimeoutMs, 5_000, 50);
  const pollInterval = finitePositive(pollIntervalMs, 250, 10);
  const deadline = now() + discoveryTimeout;
  do {
    const runs = await listCorrelatableWorkflowRuns({ root, workflowFile, branch, gh, timeoutMs: cliTimeoutMs });
    const candidates = runs.filter((run) => isExactRun(run, { baselineIds, dispatchedAt, branch, workflowName, displayTitle }));
    candidates.sort((left, right) => createdAtMillis(left) - createdAtMillis(right) || Number(runId(left)) - Number(runId(right)));
    if (candidates[0]) {
      return {
        runId: runId(candidates[0]),
        createdAt: candidates[0].createdAt,
        workflowFile,
        workflowName,
        branch,
        correlationId,
      };
    }
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await wait(Math.min(pollInterval, remaining));
  } while (now() <= deadline);

  throw Object.assign(new Error("今回開始したGitHub Actionsの実行を確認できませんでした。古い成功結果は使わず停止しました。Actions画面で今回の実行を確認してから再実行してください。"), {
    code: "run-correlation-unconfirmed",
    workflowFile,
    branch,
  });
}

export async function watchCorrelatedWorkflow({
  root,
  run,
  gh = process.env.YASASHII_GH_BIN || "gh",
  timeoutMs = 5 * 60_000,
}) {
  try {
    await command(gh, ["run", "watch", String(run.runId), "--exit-status"], { root, timeoutMs, label: "GitHub Actions完了待ち" });
    return run;
  } catch (error) {
    error.runId = run.runId;
    error.correlatedRun = run;
    throw error;
  }
}
