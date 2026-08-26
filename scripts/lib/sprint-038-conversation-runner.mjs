import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executeConversation } from "../../plugins/secretary/scripts/lib/conversation-contract.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));

function initialState(input, precondition) {
  if (input.includes("口調をフランク")) return { tone: "丁寧" };
  if (input.includes("全部消して")) return { decisionCount: 4 };
  if (input.includes("originへpush")) return input.includes("メモ") ? { fileCount: 0, pushCount: 0 } : { pushCount: 0 };
  if (input.includes("保存とpush")) return { fileCount: 0, pushCount: 0 };
  if (input.includes("TODOを完了")) return { open: 1, done: 0 };
  if (input.includes("TODOを明日")) return { date: "2026-07-31" };
  if (input.includes("古いresume") || precondition.includes("古いresume")) return { docs: 0, resume: 1 };
  if (input.includes("Gmail")) return { writes: 0 };
  if (input.includes("予定とvault")) return { writes: 0 };
  if (input.includes("今日はここまで")) return { decisions: 0 };
  if (input.includes("保存済み") || input.includes("前に保存") || precondition.includes("実行済み") || input.includes("完了済み")) return { count: 1 };
  if (input.includes("覚えといたほう") || input.includes("Rokunabe") || input.includes("田中さんから") || input.includes("訂正して保存")) return { count: 0 };
  if (input.includes("タスク") || input.includes("起票") || input.includes("請求する")) return input.includes("見積を送るタスク") ? { taskCount: 0 } : { tasks: 0 };
  if (input.includes("決定として") || input.includes("会議は対面") || input.startsWith("もし決まったら")) return { decisionCount: 0 };
  return { count: 0 };
}

function meaning(subject, date, action, target, negationCondition, destination) {
  return { subject, date, action, target, negationCondition, destination };
}

function understand(input, precondition) {
  const quoted = /[『「].*(保存|記録).*[』」].*(言って|話して)/.test(input);
  const hearsay = /(?:担当者|同僚).*(?:言っていた|と言っていた)/.test(input);
  if (quoted) return { intent: "inferred", response: "answered", text: "伝聞として確認しました。保存はしていません。", meaning: meaning("colleague", null, "said", "会議は対面", "quoted", null) };
  if (hearsay) return { intent: "inferred", response: "answered", text: "伝聞として確認しました。保存はしていません。", meaning: meaning("staff", null, "said", "保存する", "hearsay", null) };
  if (/^もし/.test(input)) return { intent: "inferred", response: "answered", text: "条件が成立していないため、まだ保存しません。", meaning: meaning("user", null, "save", "future decision", "if decided", "memory/decisions") };
  if (/前に保存して.*内容は何/.test(input)) return { intent: "inferred", response: "answered", text: "過去の記録を回答します。変更はしていません。", meaning: meaning("user", null, "read", "past request", null, "memory") };
  if (/さっきの保存は取り消して/.test(input) && precondition.includes("未保存")) return { intent: "inferred", response: "answered", text: "未保存なので変更はありません。", meaning: meaning("user", null, "cancel", "pending save", "not saved", "memory") };
  if (/保存済み.*取り消して/.test(input)) return { intent: "destructive", response: "question", text: "削除前に対象を確認します。保存済みの決定は元に戻せません。削除してよいですか？", meaning: meaning("user", null, "delete", "saved decision", null, "memory") };
  if (/覚えといたほうがいいかも/.test(input)) return { intent: "ambiguous", response: "question", text: "この企画を記憶に残しますか？", meaning: { ...meaning("user", null, "propose save", "企画", null, "memory"), source: null, certainty: null, correctionOf: null, correctionReason: null } };
  if (/Rokunabeだと思う。覚えて/.test(input)) return { intent: "explicit", response: "saved", text: "Rokunabeだと思う、という推量のままmemoryへ保存しました。", meaning: { ...meaning("user", null, "remember", "Rokunabe", null, "memory"), source: "user", certainty: "speculation", correctionOf: null, correctionReason: null }, mutate: (state) => ({ ...state, count: state.count + 1 }), operation: { id: "content-memory-rokunabe-speculation", type: "save", target: "Rokunabe", destination: "memory" } };
  if (/田中さんから開始は9月と聞いた。覚えて/.test(input)) return { intent: "explicit", response: "saved", text: "開始は9月と田中さんから聞いた内容としてmemoryへ保存しました。", meaning: { ...meaning("user", "2026-09", "remember", "開始", null, "memory"), source: "田中", certainty: "hearsay", correctionOf: null, correctionReason: null }, mutate: (state) => ({ ...state, count: state.count + 1 }), operation: { id: "content-memory-start-september-hearsay-tanaka", type: "save", target: "開始は9月", destination: "memory" } };
  if (/ではなく.*訂正して保存/.test(input)) return { intent: "explicit", response: "saved", text: "明日から金曜への訂正として保存しました。", meaning: { ...meaning("user", "2026-08-07", "save", "予定", "not tomorrow", "memory"), source: null, certainty: null, correctionOf: "明日", correctionReason: "利用者訂正" }, mutate: (state) => ({ ...state, count: state.count + 1 }), operation: { id: "content-memory-schedule-friday-corrects-tomorrow", type: "save", target: "予定", destination: "memory" } };
  if (/全部消して/.test(input)) return { intent: "destructive", response: "question", text: "7月の決定を削除すると元に戻せません。対象を確認してよいですか？", meaning: meaning("user", "2026-07", "delete", "decisions", null, "memory/decisions") };
  if (/API token.*保存/.test(input)) return { intent: "external", response: "question", text: "Secretは保存しません。Repository Secretへの安全な登録方法を確認しますか？", meaning: meaning("user", null, "save", "Secret", "prohibited", "Repository Secret") };
  if (/担当者へ通知/.test(input)) return { intent: "external", response: "question", text: "通知の送信先と内容を確認してよいですか？", meaning: meaning("user", null, "notify", "staff", null, "Chat") };
  if (/この変更をoriginへpush/.test(input)) return { intent: "external", response: "question", text: "originへpushする対象と公開範囲を確認してよいですか？", meaning: meaning("user", null, "push", "current branch", null, "origin") };
  if (/メモを保存してからoriginへpush/.test(input)) return { intent: "explicit", response: "partial", text: "メモは保存しました。originへのpushは未実行です。対象と影響を確認します。", meaning: meaning("user", null, "save then push", "memo", null, "docs then origin"), mutate: (state) => ({ ...state, fileCount: 1 }), operation: { id: "save-1", type: "save", target: "memo", destination: "docs" }, operations: [{ id: "save-1", operation: "save", target: "memo", destination: "docs" }, { id: "push-1", operation: "push", target: "current branch", destination: "origin", external: true }] };
  if (/保存とpushを一括/.test(input)) return { intent: "explicit", response: "question", text: "一括操作にはpushが含まれます。最初の保存前に対象と影響を確認してよいですか？", meaning: meaning("user", null, "atomic save and push", "memo", null, "docs and origin"), operations: [{ id: "save-1", operation: "save", target: "memo", destination: "docs" }, { id: "push-1", operation: "push", target: "current branch", destination: "origin", external: true }], options: { atomic: true } };
  if (/7月31日の決定として/.test(input)) return { intent: "explicit", response: "saved", text: "会議は対面開催、という決定をmemory/decisionsへ保存しました。", meaning: meaning("user", "2026-07-31", "save", "会議は対面開催", null, "memory/decisions"), mutate: (state) => ({ ...state, decisionCount: state.decisionCount + 1 }), operation: { id: "decision-2026-07-31-meeting", type: "save", target: "会議は対面開催", destination: "memory/decisions" } };
  if (input === "会議は対面にしよう") return { intent: "inferred", response: "question", text: "会議は対面、という決定を記録しますか？", meaning: meaning("user", null, "decide", "会議は対面", null, null) };
  if (/口調をフランク/.test(input)) return { intent: "explicit", response: "saved", text: "口調をフランクに変更しました。", meaning: meaning("user", null, "update", "口調=フランク", null, "preferences.md"), mutate: (state) => ({ ...state, tone: "フランク" }), operation: { id: "setting-tone-frank", type: "update", target: "tone", destination: "preferences.md" } };
  if (/8月5日に見積を送るタスク/.test(input)) return { intent: "explicit", response: "saved", text: "8月5日に見積を送るタスクをNotion TaskDBへ保存しました。", meaning: meaning("user", "2026-08-05", "create task", "見積を送る", null, "Notion TaskDB"), mutate: (state) => ({ ...state, taskCount: state.taskCount + 1 }), operation: { id: "task-estimate-2026-08-05", type: "create-task", target: "見積を送る", destination: "Notion TaskDB" } };
  if (input === "これを保存して") return { intent: "ambiguous", response: "question", text: "どこへ保存するか教えてください。", meaning: meaning("user", null, "save", "これ", null, null) };
  if (input === "決定を保存して" && precondition.includes("失敗")) return { intent: "explicit", response: "error", text: "atomic writeでエラーが起きたため、決定は保存していません。", meaning: meaning("user", null, "save", "決定", null, "memory/decisions") };
  if (/同じTODOを追加/.test(input)) return { intent: "explicit", response: "answered", text: "同じoperation idの重複のため追加しません。", meaning: meaning("user", null, "create", "TODO", "duplicate", "inbox/todo.md"), operation: { id: "todo-existing", type: "create", target: "TODO", destination: "inbox/todo.md" }, duplicate: true };
  if (/見積TODOを完了/.test(input)) return { intent: "explicit", response: "saved", text: "見積TODOを完了にしました。", meaning: meaning("user", null, "complete", "estimate TODO", null, "inbox/todo.md"), mutate: (state) => ({ ...state, open: 0, done: 1 }), operation: { id: "todo-estimate-complete", type: "complete", target: "estimate TODO", destination: "inbox/todo.md" } };
  if (/見積TODOを明日/.test(input)) return { intent: "explicit", response: "saved", text: "見積TODOを明日へ持ち越しました。", meaning: meaning("user", "2026-08-01", "carry", "estimate TODO", null, "inbox/todo.md"), mutate: (state) => ({ ...state, date: "2026-08-01" }), operation: { id: "todo-estimate-carry", type: "carry", target: "estimate TODO", destination: "inbox/todo.md" } };
  if (/完了済みA案件を見せて/.test(input)) return { intent: "explicit", response: "answered", text: "projects/closedを照合し、完了済みA案件を表示します。", meaning: meaning("user", null, "read", "A project", "closed", "projects/closed") };
  if (/今日はここまで/.test(input)) return { intent: "inferred", response: "answered", text: "お疲れさまでした。", meaning: meaning("user", "2026-07-31", "close conversation", "today", "no missed decision", null) };
  if (/Gmailを使いたい/.test(input) && precondition.includes("接続済み")) return { intent: "explicit", response: "answered", text: "Gmailは接続済みです。そのまま利用できます。", meaning: meaning("user", null, "use", "Gmail", "already connected", "connector") };
  if (/Gmailを使いたい/.test(input)) return { intent: "ambiguous", response: "question", text: "接続状態を確認できません。read-only診断を先に行いますか？", meaning: meaning("user", null, "use", "Gmail", "connection unknown", "connector") };
  if (/今は見積を作って/.test(input)) return { intent: "explicit", response: "saved", text: "現在の依頼を優先し、見積を作成しました。", meaning: meaning("user", null, "create", "estimate", "ignore stale resume", "docs"), mutate: (state) => ({ ...state, docs: 1 }), operation: { id: "document-estimate", type: "create", target: "estimate", destination: "docs" } };
  if (/2番を起票/.test(input)) return { intent: "explicit", response: "saved", text: "番号承認を再確認なしで起票しました。", meaning: meaning("user", null, "create task", "candidate-2", "already approved", "Notion TaskDB"), mutate: (state) => ({ ...state, tasks: 1 }), operation: { id: "notion-candidate-2", type: "create-task", target: "candidate-2", destination: "Notion TaskDB" } };
  if (/この内容をタスクにして/.test(input)) return { intent: "explicit", response: "saved", text: "この内容をタスクにしました。", meaning: meaning("user", null, "create task", "this content", null, "Notion TaskDB"), mutate: (state) => ({ ...state, tasks: 1 }), operation: { id: "notion-this-content", type: "create-task", target: "this content", destination: "Notion TaskDB" } };
  if (/8月10日に請求する/.test(input)) return { intent: "explicit", response: "saved", text: "将来の実行行動としてNotion TaskDBへ保存しました。", meaning: meaning("user", "2026-08-10", "create task", "invoice", null, "Notion TaskDB"), mutate: (state) => ({ ...state, tasks: 1 }), operation: { id: "notion-invoice-2026-08-10", type: "create-task", target: "invoice", destination: "Notion TaskDB" } };
  if (/予定とvaultを一緒に調べて/.test(input)) return { intent: "explicit", response: "answered", text: "Calendarとvaultの統合結果を返します。どちらにも書き込んでいません。", meaning: meaning("user", null, "read", "Calendar and vault", "read-only", "answer") };
  if (/これを起票して/.test(input)) return { intent: "ambiguous", response: "question", text: "どのTaskDBですか？候補を1つ選んでください。", meaning: meaning("user", null, "create task", "this", "destination ambiguous", null) };
  return { intent: "inferred", response: "question", text: "実行対象をもう少し具体的に教えてください。", meaning: meaning("user", null, null, input, null, null) };
}

export function createScenarioWorkspace(input, precondition, root = null) {
  const workspace = root ?? mkdtempSync(join(tmpdir(), "sprint-038-conversation-"));
  mkdirSync(workspace, { recursive: true });
  const statePath = join(workspace, "state.json");
  const logPath = join(workspace, "operations.jsonl");
  if (!existsSync(statePath)) writeFileSync(statePath, `${JSON.stringify(initialState(input, precondition), null, 2)}\n`);
  if (!existsSync(logPath)) writeFileSync(logPath, "");
  if (precondition.includes("同一operation id実行済み") && readFileSync(logPath, "utf8") === "") appendFileSync(logPath, `${JSON.stringify({ id: "todo-existing", status: "completed" })}\n`);
  return workspace;
}

function runtimeDecision(classifierInput, execution, understood) {
  if (!classifierInput) {
    return {
      intent: understood.intent,
      response: understood.response,
      sideEffectCount: understood.response === "partial" ? "partial" : understood.mutate ? 1 : 0,
    };
  }
  const observed = executeConversation({
    classifierInput,
    readOnly: execution?.readOnly,
    nonOperative: execution?.nonOperative,
    simulateError: execution?.simulateError,
    operations: understood.operations,
    options: understood.options,
    beforeSnapshot: { writes: 0 },
    changes: [{ key: "writes", delta: 1 }],
  });
  return { intent: observed.intent, response: observed.response, sideEffectCount: observed.sideEffectCount };
}

export function runConversationScenario({ input, precondition, classifierInput = null, execution = {}, workspace = null }) {
  if (typeof input !== "string" || typeof precondition !== "string") throw new Error("natural-language-input-and-precondition-required");
  const root = createScenarioWorkspace(input, precondition, workspace);
  const statePath = join(root, "state.json");
  const logPath = join(root, "operations.jsonl");
  const beforeSnapshot = JSON.parse(readFileSync(statePath, "utf8"));
  const understood = understand(input, precondition);
  const decision = runtimeDecision(classifierInput, execution, understood);
  let afterSnapshot = clone(beforeSnapshot);
  const existing = readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const duplicate = understood.operation && existing.some((entry) => entry.id === understood.operation.id);
  const executableResponse = decision.sideEffectCount === 1 || decision.sideEffectCount === "partial";
  if (understood.mutate && executableResponse && !duplicate) {
    afterSnapshot = understood.mutate(clone(beforeSnapshot));
    writeFileSync(statePath, `${JSON.stringify(afterSnapshot, null, 2)}\n`);
    appendFileSync(logPath, `${JSON.stringify({ ...understood.operation, status: "completed" })}\n`);
  }
  const response = duplicate ? "answered" : decision.response;
  const responseText = duplicate
    ? "同じoperation idの重複のため追加しません。"
    : response === understood.response
      ? understood.text
      : "対象と影響を確認してもよいですか？";
  const sideEffectCount = duplicate ? 0 : decision.sideEffectCount;
  return {
    intent: decision.intent,
    response,
    responseText,
    sideEffectCount,
    beforeSnapshot,
    afterSnapshot,
    meaning: understood.meaning,
    operationLog: readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)),
    workspace: root,
  };
}
