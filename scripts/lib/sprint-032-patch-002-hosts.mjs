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
export function summarizeHostVerification(records = []) {
  const byHost = new Map();
  for (const record of records) {
    const host = hostById(record.hostId);
    if (![HOST_STATUS.PASS, HOST_STATUS.FAIL].includes(record.status)) {
      throw new Error(`invalid executed-host status for ${host.id}: ${record.status}`);
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
    // 全ホスト対応済みと言えるのは、4ホストすべてが個別にPASSした場合だけ。
    allHostsVerified: verifiedHosts.length === SUPPORTED_HOSTS.length,
  };
}
