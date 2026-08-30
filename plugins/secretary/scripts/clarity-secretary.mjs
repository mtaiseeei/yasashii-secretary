#!/usr/bin/env node

// yasashii-secretary:clarity-secretary-adapter:v1

import { readFileSync } from "node:fs";
import {
  applySecretaryProjectClarity,
  dailyClarityRollup,
  decideSecretaryProject,
  portfolioRollup,
  previewSecretaryProjectClarity,
  routeClarityTask,
  secretaryProjectClarityStatus,
  weeklyClarityRollup,
} from "./lib/clarity-secretary.mjs";
import { ClarityError } from "./lib/clarity-core.mjs";
import { resolveClarityRoot, rootPolicyFor, withClarityRootRequest } from "./lib/clarity-root.mjs";

function usage(message = "") {
  throw new ClarityError("usage", `${message ? `${message}\n\n` : ""}使い方:
  clarity-secretary init <secretary> <project> [--apply] [--json]
  clarity-secretary status <secretary> <project> [--closed] [--json]
  clarity-secretary portfolio <secretary> [--json]
  clarity-secretary daily <secretary> --mode <morning|evening> [--json]
  clarity-secretary weekly <secretary> [--previous-json <file>] [--json]
  clarity-secretary decide <secretary> <project> --decision <text> --current <text> --next <text> [--item-id <id>] [--operation-id <id>] [--json]
  clarity-secretary task-route <secretary> <project> --item-id <id> --target <local-todo|downstream-task> [--explicit] [--json]`, 2);
}

function parse(argv) {
  const positional = [];
  const options = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) { positional.push(value); continue; }
    if (["--apply", "--closed", "--explicit", "--json"].includes(value)) { options.set(value, true); continue; }
    if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) usage(`${value}の値を指定してください。`);
    options.set(value, argv[index + 1]);
    index += 1;
  }
  return { positional, options };
}

function attentionLines(item) {
  const reasons = item.reasonLabels?.join("／") || "理由を確認してください";
  const evidence = item.evidence?.map((row) => row.summary).join("／") || "根拠不足（未検証）";
  const choices = item.choices?.join("／") || "詳細を確認する";
  return `- ${item.project}: ${item.conclusion || item.title}\n  理由: ${reasons}\n  根拠: ${evidence}\n  選択: ${choices}\n`;
}

function render(command, result, asJson) {
  if (asJson) { process.stdout.write(`${JSON.stringify({ ok: true, command, ...result }, null, 2)}\n`); return; }
  if (command === "init") {
    process.stdout.write(`Secretary-local Clarity: ${result.status}\n- mode: secretary-local\n- 対象: ${result.target}\n- 変更: ${result.changed ? "あり" : "なし"}\n`);
    if (result.status === "preview") process.stdout.write("明示確認後だけ --apply を付けて実行します。\n");
    return;
  }
  if (command === "status") {
    process.stdout.write(`Project Clarity: ${result.initialized ? "利用中" : "未初期化"}\n- mode: ${result.mode}\n- Attention: ${result.attention.activeCount}件\n- link health: ${result.linkHealth}\n`);
    const observation = result.canonicalObservation;
    if (observation?.reason !== "development-pointer-missing") process.stdout.write(`- 正本repo: ${observation.availability}（${observation.observedAt}観測、freshness=${observation.freshness}${observation.reason ? `、理由=${observation.reason}` : ""}）\n`);
    return;
  }
  if (command === "portfolio") {
    process.stdout.write(`Portfolio: open Project ${result.projectCount}件、Attention ${result.attention.activeCount}件\n`);
    for (const item of result.attention.top) process.stdout.write(attentionLines(item));
    if (result.attention.otherCount) process.stdout.write(`- その他 ${result.attention.otherCount}件\n`);
    if (!result.attention.activeCount) process.stdout.write("- 現在判断不要です\n");
    if (result.unverifiedSources.length) process.stdout.write(`- 未確認: ${result.unverifiedSources.length}件\n`);
    for (const project of result.projects.filter((row) => row.canonicalObservation?.reason !== "development-pointer-missing")) process.stdout.write(`- ${project.name} 正本repo: ${project.canonicalObservation.availability} / ${project.canonicalObservation.freshness}${project.canonicalObservation.reason ? ` / ${project.canonicalObservation.reason}` : ""}\n`);
    return;
  }
  if (command === "daily" && result.mode === "morning") {
    process.stdout.write(`## ${result.section}\n\n${result.conclusion}\n`);
    for (const item of result.items) process.stdout.write(attentionLines(item));
    if (result.otherCount) process.stdout.write(`- その他 ${result.otherCount}件\n`);
    if (result.unverifiedSources.length) process.stdout.write(`- 未確認範囲: ${result.unverifiedSources.map((row) => row.project).join("、")}\n`);
    for (const row of result.canonicalObservations || []) if (row.observation?.reason !== "development-pointer-missing") process.stdout.write(`- ${row.project} 正本repo: ${row.observation.availability} / ${row.observation.freshness}${row.observation.reason ? ` / ${row.observation.reason}` : ""}\n`);
    return;
  }
  if (command === "daily") {
    process.stdout.write(`## ${result.section}\n\n- Decision: ${result.decisions.length}件\n- 実装観測: ${result.execution.length}件\n- 候補: ${result.candidates.length}件\n- Drift: ${result.drift.length}件\n- 持越しAttention: ${result.carriedAttention.length}件\n`);
    return;
  }
  if (command === "weekly") {
    process.stdout.write(`## ${result.section}\n\n- Attention: ${result.attention.activeCount}件（${result.attention.comparison}${result.attention.change === null ? "" : `、増減 ${result.attention.change >= 0 ? "+" : ""}${result.attention.change}`}）\n- lag確認: ${result.lag.length}件\n- 長期滞留: ${result.longRunning.length}件\n- 解消済みAttention: ${result.resolvedAttention}件\n- 解消Drift: ${result.resolvedDrift}件\n`);
    for (const row of result.canonicalObservations || []) if (row.observation?.reason !== "development-pointer-missing") process.stdout.write(`- ${row.project} 正本repo: ${row.observation.availability} / ${row.observation.freshness}${row.observation.reason ? ` / ${row.observation.reason}` : ""}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const [command, ...rawArgs] = process.argv.slice(2);
try {
  if (!command) usage();
  const { positional, options } = parse(rawArgs);
  const [secretary, project] = positional;
  if (!secretary) usage("secretary rootを指定してください。");
  withClarityRootRequest(() => {
  let result;
  if (command === "init") {
    if (!project) usage("Project名を指定してください。");
    result = options.get("--apply") ? applySecretaryProjectClarity(secretary, project) : previewSecretaryProjectClarity(secretary, project);
  } else if (command === "status") {
    if (!project) usage("Project名を指定してください。");
    result = secretaryProjectClarityStatus(secretary, project, { closedOnly: Boolean(options.get("--closed")) });
  } else if (command === "portfolio") result = portfolioRollup(secretary);
  else if (command === "daily") result = dailyClarityRollup(secretary, { mode: options.get("--mode") || "morning" });
  else if (command === "weekly") {
    let previous = null;
    if (options.get("--previous-json")) previous = JSON.parse(readFileSync(options.get("--previous-json"), "utf8"));
    result = weeklyClarityRollup(secretary, previous);
  } else if (command === "decide") {
    if (!project) usage("Project名を指定してください。");
    result = decideSecretaryProject(secretary, project, { itemId: options.get("--item-id"), operationId: options.get("--operation-id"), decision: options.get("--decision"), current: options.get("--current"), next: options.get("--next") });
  } else if (command === "task-route") {
    if (!project) usage("Project名を指定してください。");
    result = routeClarityTask(secretary, project, { itemId: options.get("--item-id"), target: options.get("--target") || "local-todo", explicit: Boolean(options.get("--explicit")) });
  } else usage(`不明なcommandです: ${command}`);
  const resolvedRoot = resolveClarityRoot(secretary).root;
  result = { ...result, rootPolicy: rootPolicyFor(resolvedRoot) };
  render(command, result, Boolean(options.get("--json")));
  });
} catch (error) {
  const known = error instanceof ClarityError || typeof error?.code === "string";
  const details = known && error.details && typeof error.details === "object" ? error.details : {};
  process.stderr.write(`${JSON.stringify({
    ok: false,
    ...details,
    code: known ? error.code : "unexpected-error",
    message: error instanceof Error ? error.message : String(error),
    changed: details.changed === true,
  }, null, 2)}\n`);
  process.exit(known ? (error.exitCode || 3) : 3);
}
