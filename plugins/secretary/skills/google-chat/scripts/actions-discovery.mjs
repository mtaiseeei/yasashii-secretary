import { randomUUID } from "node:crypto";
import { dispatchCorrelatedWorkflow, watchCorrelatedWorkflow } from "../../../scripts/lib/actions-run.mjs";
import { runExternal } from "../../../scripts/lib/external-ops.mjs";
import { ingestGit } from "../../../scripts/lib/git-ingest.mjs";
import { GOOGLE_CHAT_SECRET_NAMES } from "./oauth-session.mjs";
import { GENERAL_DISCOVERY_RESULT, mergeDiscoveredSpaces, readDiscoveryResult } from "./discovery.mjs";

async function requiredSecretsPresent({ root, gh, secretNames }) {
  const listed = await runExternal(gh, ["secret", "list", "--json", "name"], {
    cwd: root,
    timeoutMs: Number(process.env.YASASHII_CLI_TIMEOUT_MS || 30_000),
    label: "Repository Secret確認",
  });
  let parsed;
  try { parsed = JSON.parse(listed.stdout || "[]"); } catch { parsed = []; }
  const available = new Set(Array.isArray(parsed) ? parsed.map((item) => String(item?.name || "")) : []);
  return secretNames.every((name) => available.has(name));
}

export async function discoverSpacesWithActions({
  root,
  knownSpaces,
  workflowFile = "google-chat-sync.yml",
  workflowName = "Google Chat sync",
  resultPath = GENERAL_DISCOVERY_RESULT,
  secretNames = GOOGLE_CHAT_SECRET_NAMES,
  gh = process.env.YASASHII_GH_BIN || "gh",
  git = process.env.YASASHII_GIT_BIN || "git",
  correlationId = randomUUID(),
  syntheticResult = null,
} = {}) {
  const failed = (code, stage, run = null) => ({
    correlationId,
    status: "failed",
    spaces: mergeDiscoveredSpaces(knownSpaces, { status: "failed", spaces: [] }).spaces,
    knownCount: Array.isArray(knownSpaces) ? knownSpaces.length : 0,
    added: 0,
    missingKnown: false,
    code,
    stage,
    run,
  });
  try {
    if (syntheticResult) {
      const result = readDiscoveryResult(syntheticResult.root, syntheticResult.path, correlationId);
      return { correlationId, ...mergeDiscoveredSpaces(knownSpaces, result), generatedAt: result.generatedAt, run: { synthetic: true } };
    }
    if (!await requiredSecretsPresent({ root, gh, secretNames })) return failed("secret-missing", "dispatch");
    const run = await dispatchCorrelatedWorkflow({
      root,
      workflowFile,
      workflowName,
      inputs: { mode: "discover" },
      gh,
      git,
      correlationId,
    });
    try { await watchCorrelatedWorkflow({ root, run, gh, timeoutMs: Number(process.env.YASASHII_GOOGLE_CHAT_ACTIONS_TIMEOUT_MS || 5 * 60_000) }); }
    catch (error) { return failed(error?.code || "actions-run-failed", "actions-run", { id: run.runId, workflow: run.workflowFile, branch: run.branch }); }
    try {
      await ingestGit({ root, branch: run.branch, git });
    } catch (error) {
      return failed(error?.code || "inspect-failed", "git-ingest", { id: run.runId, workflow: run.workflowFile, branch: run.branch });
    }
    try {
      const result = readDiscoveryResult(root, resultPath, correlationId);
      return { correlationId, ...mergeDiscoveredSpaces(knownSpaces, result), generatedAt: result.generatedAt, run: { id: run.runId, workflow: run.workflowFile, branch: run.branch }, code: null };
    } catch (error) {
      return failed(error?.code || error?.kind || "discovery-result-missing", "result-missing", { id: run.runId, workflow: run.workflowFile, branch: run.branch });
    }
  } catch (error) {
    return failed(error?.code || error?.kind || "discovery-failed", error?.stage || "dispatch", error?.correlatedRun ? { id: error.correlatedRun.runId, workflow: error.correlatedRun.workflowFile, branch: error.correlatedRun.branch } : null);
  }
}
