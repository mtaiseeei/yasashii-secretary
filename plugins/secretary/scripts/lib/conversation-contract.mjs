const INTENTS = new Set(["explicit", "inferred", "ambiguous", "destructive", "external"]);
const RESPONSES = new Set(["answered", "question", "saved", "error", "partial"]);

export function classifyIntent(input = {}) {
  if (input.destructive) return "destructive";
  if (input.external) return "external";
  if (input.quote || input.hearsay || input.hypothetical || input.correction || input.cancellation || input.pastInquiry) return input.ambiguous ? "ambiguous" : "inferred";
  if (input.explicit && input.operation && input.target && input.destination) return "explicit";
  return input.ambiguous ? "ambiguous" : "inferred";
}

export function requiresConfirmation(input = {}) {
  const intent = input.intent ?? classifyIntent(input);
  const bulk = input.bulkUnknown || Number(input.bulkCount ?? 0) >= 10 || input.multipleRepos || input.multipleRecipients;
  return intent === "destructive" || intent === "external" || bulk || input.secret === true;
}

export function planOperations(operations, options = {}) {
  if (!Array.isArray(operations) || operations.length === 0) throw new Error("operations-required");
  const normalized = operations.map((operation, index) => ({ id: operation.id ?? `op-${index + 1}`, ...operation }));
  const boundary = normalized.findIndex((operation) => requiresConfirmation(operation));
  if (boundary < 0) return { execute: normalized, hold: [], response: "saved" };
  if (options.atomic || options.batch || normalized.some((operation) => operation.dependsOn)) return { execute: [], hold: normalized, response: "question" };
  return { execute: normalized.slice(0, boundary), hold: normalized.slice(boundary), response: boundary === 0 ? "question" : "partial" };
}

export function createOperationLedger(completed = []) {
  const seen = new Set(completed);
  return {
    run(id, operation) {
      if (!id || typeof operation !== "function") throw new Error("invalid-operation");
      if (seen.has(id)) return { executed: false, duplicate: true };
      const value = operation();
      seen.add(id);
      return { executed: true, duplicate: false, value };
    },
    completed() { return [...seen]; },
  };
}

export function validateOutcome(outcome) {
  if (!INTENTS.has(outcome?.intent)) return { ok: false, reason: "invalid-intent" };
  if (!RESPONSES.has(outcome?.response)) return { ok: false, reason: "invalid-response" };
  const count = outcome.sideEffectCount;
  if (!(count === "partial" || (Number.isInteger(count) && count >= 0 && count <= 1))) return { ok: false, reason: "invalid-side-effect-count" };
  if (["answered", "question", "error"].includes(outcome.response) && count !== 0) return { ok: false, reason: "response-side-effect-conflict" };
  if (outcome.response === "saved" && count !== 1) return { ok: false, reason: "saved-without-one-side-effect" };
  if (outcome.response === "partial" && count !== "partial") return { ok: false, reason: "partial-count-required" };
  return { ok: true };
}

export function meaningTuple(value = {}) {
  return {
    subject: value.subject ?? null,
    date: value.date ?? null,
    action: value.action ?? null,
    target: value.target ?? null,
    negationCondition: value.negationCondition ?? null,
    destination: value.destination ?? null,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyChanges(snapshot, changes = []) {
  const next = clone(snapshot);
  for (const change of changes) {
    if (!Object.hasOwn(next, change.key)) throw new Error(`unknown-snapshot-key:${change.key}`);
    if (Object.hasOwn(change, "delta")) next[change.key] += change.delta;
    else next[change.key] = change.value;
  }
  return next;
}

export function executeConversation(input = {}) {
  const intent = classifyIntent(input.classifierInput);
  const beforeSnapshot = clone(input.beforeSnapshot ?? {});
  let response;
  let sideEffectCount = 0;
  let afterSnapshot = clone(beforeSnapshot);
  const target = input.classifierInput?.target ?? "対象";
  const destination = input.classifierInput?.destination ?? "指定先";

  if (input.simulateError) {
    response = "error";
  } else if (input.operations) {
    const plan = planOperations(input.operations, input.options);
    response = plan.response;
    if (plan.execute.length > 0) {
      afterSnapshot = applyChanges(afterSnapshot, input.changes);
      sideEffectCount = plan.hold.length > 0 ? "partial" : 1;
    }
  } else if (input.readOnly || input.nonOperative) {
    response = "answered";
  } else if (requiresConfirmation({ ...input.classifierInput, intent })) {
    response = "question";
  } else if (intent === "ambiguous" || intent === "inferred") {
    response = "question";
  } else {
    response = "saved";
    afterSnapshot = applyChanges(afterSnapshot, input.changes);
    sideEffectCount = 1;
  }

  const responseText = input.responseText?.[response] ?? {
    answered: `${target}について確認しました。変更はしていません。`,
    question: `${target}を${destination}で扱う前に、対象と影響を確認してもよいですか？`,
    saved: `${target}を${destination}へ保存しました。`,
    error: `${target}の処理でエラーが起きたため、保存していません。`,
    partial: `${target}のうち低リスク操作は保存しました。確認が必要な操作は未実行です。`,
  }[response];

  return {
    intent,
    response,
    responseText,
    sideEffectCount,
    beforeSnapshot,
    afterSnapshot,
    meaning: meaningTuple(input.classifierInput?.meaning),
  };
}

export function compareMeaning(expected, observed) {
  const left = meaningTuple(expected);
  const right = meaningTuple(observed);
  const fields = Object.keys(left);
  const differences = fields.filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]));
  return { ok: differences.length === 0, differences, expected: left, observed: right };
}
