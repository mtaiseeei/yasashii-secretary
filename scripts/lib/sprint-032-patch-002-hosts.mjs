// Sprint 032 Patch 002: 対応対象ホストと検証済みホストを別集計するホスト非依存の記録層。
// 共通会話validator（scripts/lib/sprint-032-patch-001-conversation.mjs）はホストを知らない。
// host固有なのはrunner（例: scripts/sprint-032-patch-001-conversation-smoke.mjs = Claude Code CLI）だけで、
// このfileは「どのホストが対象で、どのホストで実際に検証できたか」を集計する契約を持つ。
//
// 原則:
// - 1ホストのPASSを他ホストへ昇格させない。
// - 未実行ホストは常に `unverified` として明示する。
// - 存在しないホストAPIを推測実装しない（runner未実装のホストは runner: null のまま）。

export const HOST_STATUS = Object.freeze({
  PASS: "pass",
  FAIL: "fail",
  UNVERIFIED: "unverified",
});

// live conversation gate（実plugin sessionの会話出力の回帰確認）はoffline回帰・構文チェック・
// master gateから分離した明示的なgateで、scenarioごとに三値で集計する。
// 未実行・未認証・隔離未実証は「未完了（incomplete）」であり、pass（実会話回帰の保証）へ数えない。
export const LIVE_GATE_STATUS = Object.freeze({
  PASS: "pass",
  FAIL: "fail",
  INCOMPLETE: "incomplete",
});

// scenarios: [{ kind, status: pass|fail|incomplete, reason? }]
// 空（未実行）は常にincomplete。passは「1件以上の実会話がpassし、failもincompleteも0件」の場合だけ。
export function summarizeLiveConversationGate(scenarios = []) {
  const counts = { pass: 0, fail: 0, incomplete: 0 };
  const entries = scenarios.map((scenario) => {
    if (!Object.values(LIVE_GATE_STATUS).includes(scenario.status)) {
      throw new Error(`invalid live conversation gate scenario status: ${scenario.status}`);
    }
    counts[scenario.status] += 1;
    return { kind: scenario.kind ?? null, status: scenario.status, reason: scenario.reason ?? null };
  });
  let status;
  if (counts.fail > 0) status = LIVE_GATE_STATUS.FAIL;
  else if (counts.incomplete > 0 || counts.pass === 0) status = LIVE_GATE_STATUS.INCOMPLETE;
  else status = LIVE_GATE_STATUS.PASS;
  return {
    schemaVersion: 1,
    gate: "live-conversation",
    status,
    counts,
    scenarios: entries,
    // offline回帰のPASS・runnerの構文チェック・master gateの合格は実会話の回帰保証として数えない。
    offlineChecksCountAsEvidence: false,
    note: "pass以外は実会話回帰の保証にならない。未実行・未認証・隔離未実証はincomplete（未完了）として保持する。",
  };
}

function unexecutedLiveGate() {
  return {
    schemaVersion: 1,
    gate: "live-conversation",
    status: LIVE_GATE_STATUS.INCOMPLETE,
    counts: { pass: 0, fail: 0, incomplete: 0 },
    scenarios: [],
    offlineChecksCountAsEvidence: false,
    note: "live conversation gateは未実行（incomplete）。実会話回帰の保証は存在しない。",
  };
}

// 正式な必須対象環境（docs/spec/editions.md「正式対象ホストとhost adapter」の4環境）。
export const SUPPORTED_HOSTS = Object.freeze([
  Object.freeze({ id: "claude-code-desktop-app", label: "Claude Code Desktop App", surface: "app", runner: null }),
  Object.freeze({ id: "claude-code-cli", label: "Claude Code CLI", surface: "cli", runner: "sprint-032-patch-001-conversation-smoke" }),
  Object.freeze({ id: "codex-app", label: "Codex App", surface: "app", runner: null }),
  Object.freeze({ id: "codex-cli", label: "Codex CLI", surface: "cli", runner: null }),
]);

export function hostById(id) {
  const host = SUPPORTED_HOSTS.find((entry) => entry.id === id);
  if (!host) throw new Error(`unknown host id: ${id}`);
  return host;
}

// records: [{ hostId, runner, surface, status: pass|fail, detail? }]
// 実行済みホストのrecordだけを受け取り、record が無いホストは自動的に unverified。
// liveGate: summarizeLiveConversationGate() の結果。省略時は「未実行（incomplete）」として扱い、
// live conversation gateがpassでない限り、どのホストもpass（検証済み）として記録できない。
export function summarizeHostVerification(records = [], liveGate = null) {
  const gate = liveGate ?? unexecutedLiveGate();
  if (!Object.values(LIVE_GATE_STATUS).includes(gate.status)) {
    throw new Error(`invalid live conversation gate status: ${gate.status}`);
  }
  const byHost = new Map();
  for (const record of records) {
    const host = hostById(record.hostId);
    if (![HOST_STATUS.PASS, HOST_STATUS.FAIL].includes(record.status)) {
      throw new Error(`invalid executed-host status for ${host.id}: ${record.status}`);
    }
    if (record.status === HOST_STATUS.PASS && gate.status !== LIVE_GATE_STATUS.PASS) {
      throw new Error(
        `live conversation gate is ${gate.status}; host ${host.id} cannot be recorded as verified without a passing live conversation gate`,
      );
    }
    if (byHost.has(host.id)) throw new Error(`duplicate record for host: ${host.id}`);
    byHost.set(host.id, {
      hostId: host.id,
      label: host.label,
      surface: record.surface ?? host.surface,
      runner: record.runner ?? host.runner,
      status: record.status,
      detail: record.detail ?? null,
    });
  }
  const hosts = SUPPORTED_HOSTS.map((host) =>
    byHost.get(host.id) ?? {
      hostId: host.id,
      label: host.label,
      surface: host.surface,
      runner: host.runner,
      status: HOST_STATUS.UNVERIFIED,
      detail: host.runner ? "not executed in this run" : "runner not implemented yet (Sprint 033)",
    });
  const verifiedHosts = hosts.filter((host) => host.status === HOST_STATUS.PASS).map((host) => host.hostId);
  const failedHosts = hosts.filter((host) => host.status === HOST_STATUS.FAIL).map((host) => host.hostId);
  const unverifiedHosts = hosts.filter((host) => host.status === HOST_STATUS.UNVERIFIED).map((host) => host.hostId);
  return {
    schemaVersion: 1,
    supportedHosts: SUPPORTED_HOSTS.map((host) => host.id),
    hosts,
    verifiedHosts,
    failedHosts,
    unverifiedHosts,
    // live conversation gateの三値状態。incompleteは総合表示から隠さず、passへも数えない。
    liveConversationGate: gate,
    // 全ホスト対応済みと言えるのは、4ホストすべてが個別にPASSした場合だけ。
    allHostsVerified: verifiedHosts.length === SUPPORTED_HOSTS.length,
  };
}
