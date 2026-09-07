import { randomUUID } from "node:crypto";
import { runExternal } from "./external-ops.mjs";

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function configured(explicit, environment, fallback) {
  if (explicit !== undefined) return finitePositive(explicit, fallback);
  if (environment !== undefined) return finitePositive(environment, fallback);
  return fallback;
}

export function resolveRunDiscoveryTiming({ discoveryTimeoutMs, pollIntervalMs, pollMaxIntervalMs, env = process.env } = {}) {
  const timeout = configured(discoveryTimeoutMs, env.YASASHII_RUN_DISCOVERY_TIMEOUT_MS, 60_000);
  const pollMax = configured(pollMaxIntervalMs, env.YASASHII_RUN_POLL_MAX_MS, 2_000);
  return {
    discoveryTimeoutMs: timeout,
    pollIntervalMs: Math.min(configured(pollIntervalMs, env.YASASHII_RUN_POLL_MS, 250), pollMax),
    pollMaxIntervalMs: pollMax,
  };
}

function failureReason(error) {
  const source = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
  if (/google_chat_error=(?:reauthorization-needed|reauth-required)/.test(source)) return "google-reauthorization-needed";
  if (/google_chat_error=scope-insufficient/.test(source)) return "google-scope-insufficient";
  if (/google_chat_error=(?:admin-blocked|admin-or-scope-blocked)/.test(source)) return "google-admin-blocked";
  if (/google_chat_error=audience-mismatch/.test(source)) return "google-audience-mismatch";
  if (/google_chat_error=api-disabled/.test(source)) return "google-api-disabled";
  if (/google_chat_error=permission-denied/.test(source)) return "google-permission-denied";
  if (/google_chat_error=rate-limit|失敗種別:\s*rate-limit|利用上限/.test(source)) return "rate-limit";
  if (/google_chat_error=network|失敗種別:\s*network|接続できません/.test(source)) return "service-network";
  if (/失敗種別:\s*auth|api token/.test(source)) return "chatwork-auth";
  if (/失敗種別:.*(?:server|api|unknown)|一部または全部のroom/.test(source)) return "chatwork-partial";
  return undefined;
}

function sanitizedActionsError(error, stage, fallbackCode) {
  let code = fallbackCode;
  if (error?.code === "run-list-invalid") code = "run-list-invalid";
  else if (error?.code === "timeout" || error?.code === "ETIMEDOUT") code = `${stage}-timeout`;
  else if (error?.killed || error?.signal) code = `${stage}-killed`;
  else {
    const source = `${error?.stdout || ""}\n${error?.stderr || ""}`.toLowerCase();
    if (/authentication|not logged|auth token|http 401|bad credentials|resource not accessible|forbidden|http 403/.test(source)) code = `${stage}-auth`;
    else if (["ENOENT", "ECONNRESET", "ENETUNREACH", "EAI_AGAIN"].includes(error?.code) || /network|connection|could not resolve|http 5\d\d/.test(source)) code = `${stage}-transport`;
  }
  const clean = Object.assign(new Error("GitHub Actionsとの通信または実行確認に失敗しました。"), { code, stage });
  return clean;
}

function commandFailureDiagnostic(...failures) {
  const errors = failures.filter(Boolean);
  const timeout = errors.find((error) => error?.code === "timeout" || error?.code === "ETIMEDOUT");
  const coded = timeout || errors.find((error) => error?.code);
  return {
    code: coded?.code,
    killed: errors.some((error) => error?.killed),
    signal: errors.find((error) => error?.signal)?.signal,
    // GitHub CLI自体の診断だけを使う。workflow本文はfailureReason専用で、
    // ghの認証・通信分類へ混ぜない。
    stderr: errors.map((error) => String(error?.stderr || "")).join("\n"),
  };
}

function workflowConclusionError({ run, conclusion, logs }) {
  const clean = Object.assign(new Error("GitHub Actionsのworkflowが失敗しました。"), {
    code: "workflow-conclusion-failure",
    stage: "actions-run",
    conclusion,
    correlatedRun: run,
  });
  const reason = failureReason(logs);
  if (reason) clean.reason = reason;
  return clean;
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

async function command(binary, argv, { root, timeoutMs, label, runner = runExternal }) {
  return runner(binary, argv, {
    cwd: root,
    timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    label,
    shell: false,
  });
}

export async function currentGitBranch({ root, git = process.env.YASASHII_GIT_BIN || "git", timeoutMs = Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000), runner = runExternal }) {
  const result = await command(git, ["branch", "--show-current"], { root, timeoutMs, label: "Git branch確認", runner });
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
  runner = runExternal,
}) {
  const listed = await command(gh, [
    "run", "list",
    "--workflow", workflowFile,
    "--branch", branch,
    "--event", "workflow_dispatch",
    "--limit", "100",
    "--json", "databaseId,status,conclusion,createdAt,headBranch,workflowName,displayTitle",
  ], { root, timeoutMs, label: "GitHub Actions実行一覧", runner });
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
  discoveryTimeoutMs,
  pollIntervalMs,
  pollMaxIntervalMs,
  now = () => Date.now(),
  wait: waitFn = wait,
  runner = runExternal,
  correlationId = randomUUID(),
}) {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(correlationId)) {
    throw Object.assign(new Error("GitHub Actionsの相関IDを作成できませんでした。"), { code: "correlation-id-invalid", stage: "dispatch", actionsStarted: false });
  }
  let branch;
  try { branch = await currentGitBranch({ root, git, timeoutMs: cliTimeoutMs, runner }); }
  catch (error) {
    if (error?.code === "branch-unconfirmed") throw Object.assign(error, { stage: "dispatch", actionsStarted: false });
    throw sanitizedActionsError(error, "dispatch", "dispatch-failed");
  }
  let before;
  try { before = await listCorrelatableWorkflowRuns({ root, workflowFile, branch, gh, timeoutMs: cliTimeoutMs, runner }); }
  catch (error) { throw sanitizedActionsError(error, "dispatch", "dispatch-failed"); }
  const baselineIds = new Set(before.map(runId).filter(Boolean));
  // GitHubのcreatedAtは秒精度なので、同じ秒の今回runを除外しないよう秒境界を使う。
  const dispatchedAt = Math.floor(now() / 1000) * 1000;
  const displayTitle = `${workflowName} [${correlationId}]`;
  const inputArgs = Object.entries({ ...inputs, correlation_id: correlationId }).flatMap(([name, value]) => ["-f", `${name}=${String(value)}`]);
  try { await command(gh, ["workflow", "run", workflowFile, "--ref", branch, ...inputArgs], { root, timeoutMs: cliTimeoutMs, label: "GitHub Actions開始", runner }); }
  catch (error) { throw sanitizedActionsError(error, "dispatch", "dispatch-failed"); }

  const timing = resolveRunDiscoveryTiming({ discoveryTimeoutMs, pollIntervalMs, pollMaxIntervalMs });
  const discoveryTimeout = timing.discoveryTimeoutMs;
  let pollInterval = timing.pollIntervalMs;
  const deadline = now() + discoveryTimeout;
  do {
    let runs;
    try { runs = await listCorrelatableWorkflowRuns({ root, workflowFile, branch, gh, timeoutMs: cliTimeoutMs, runner }); }
    catch (error) {
      const clean = sanitizedActionsError(error, "run-correlation", "run-correlation-failed");
      clean.branch = branch;
      throw clean;
    }
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
    await waitFn(Math.min(pollInterval, remaining));
    pollInterval = Math.min(pollInterval * 2, timing.pollMaxIntervalMs);
  } while (now() <= deadline);

  throw Object.assign(new Error("今回開始したGitHub Actionsの実行を確認できませんでした。古い成功結果は使わず停止しました。Actions画面で今回の実行を確認してから再実行してください。"), {
    code: "run-correlation-unconfirmed",
    stage: "run-correlation",
    workflowFile,
    branch,
  });
}

export async function watchCorrelatedWorkflow({
  root,
  run,
  gh = process.env.YASASHII_GH_BIN || "gh",
  timeoutMs = 5 * 60_000,
  runner = runExternal,
}) {
  try {
    await command(gh, ["run", "watch", String(run.runId), "--exit-status"], { root, timeoutMs, label: "GitHub Actions完了待ち", runner });
    return run;
  } catch (watchError) {
    let viewed;
    try {
      viewed = await command(gh, ["run", "view", String(run.runId), "--json", "status,conclusion"], { root, timeoutMs, label: "GitHub Actions実行結果", runner });
    } catch (viewError) {
      const clean = sanitizedActionsError(commandFailureDiagnostic(watchError, viewError), "actions-run", "actions-run-failed");
      clean.correlatedRun = run;
      throw clean;
    }

    let parsed;
    try { parsed = JSON.parse(viewed.stdout || "{}"); }
    catch { parsed = null; }
    const failedConclusions = new Set(["failure", "cancelled", "timed_out", "action_required", "stale"]);
    if (parsed?.status === "completed" && failedConclusions.has(parsed?.conclusion)) {
      let logs;
      try {
        logs = await command(gh, ["run", "view", String(run.runId), "--log-failed"], { root, timeoutMs, label: "GitHub Actions失敗log", runner });
      } catch { /* conclusionは確認済みなので、log取得失敗でもworkflow失敗として返す。 */ }
      throw workflowConclusionError({ run, conclusion: parsed.conclusion, logs });
    }

    const clean = sanitizedActionsError(commandFailureDiagnostic(watchError, viewed), "actions-run", "actions-run-failed");
    clean.correlatedRun = run;
    throw clean;
  }
}
