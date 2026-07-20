export const INTERVALS = Object.freeze({
  "30m": { label: "30分", runs: 1440, cron: "17,47 * * * *" },
  "1h": { label: "1時間", runs: 720, cron: "17 * * * *" },
  "3h": { label: "3時間", runs: 240, cron: "17 */3 * * *" },
  "6h": { label: "6時間", runs: 120, cron: "17 */6 * * *" },
  "12h": { label: "12時間", runs: 60, cron: "17 */12 * * *" },
  manual: { label: "手動のみ", runs: 0, cron: null },
});

export function scheduleFor(interval, enabled) {
  const selected = INTERVALS[interval];
  if (!selected) throw new Error("自動取得の間隔を選び直してください。");
  return enabled && selected.cron ? selected.cron : null;
}

export function renderWorkflow(interval, enabled, identity = {}) {
  const cron = scheduleFor(interval, enabled);
  const botName = identity.botName || "secretary[bot]";
  const botEmail = identity.botEmail || "secretary[bot]@users.noreply.github.com";
  const schedule = cron ? ["  schedule:", `    - cron: '${cron}'`] : [];
  return [
    "name: Chatwork sync",
    "run-name: Chatwork sync [${{ inputs.correlation_id || github.event_name }}]",
    "",
    "on:",
    ...schedule,
    "  workflow_dispatch:",
    "    inputs:",
    "      mode:",
    "        description: discover、initial、sync のいずれか",
    "        required: true",
    "        default: discover",
    "        type: choice",
    "        options:",
    "          - discover",
    "          - initial",
    "          - sync",
    "      correlation_id:",
    "        description: 今回の開始操作とrunを対応づける識別子",
    "        required: false",
    "        type: string",
    "",
    "permissions:",
    "  contents: write",
    "",
    "concurrency:",
    "  group: chatwork-sync-${{ github.repository }}",
    "  cancel-in-progress: false",
    "",
    "jobs:",
    "  sync:",
    "    if: github.event.repository.private == true",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "        with:",
    "          fetch-depth: 0",
    "      - name: Chatworkから取得",
    "        id: chatwork",
    "        continue-on-error: true",
    "        env:",
    "          CHATWORK_API_TOKEN: ${{ secrets.CHATWORK_API_TOKEN }}",
    "          CHATWORK_TRIGGER: ${{ github.event_name }}",
    "        run: node chatwork/scripts/chatwork-sync.mjs \"${{ github.event_name == 'schedule' && 'sync' || inputs.mode }}\" \"$GITHUB_WORKSPACE\"",
    "      - name: 結果を同じrepoへ記録",
    "        if: steps.chatwork.outcome == 'success'",
    "        run: |",
    "          git config user.name \"" + botName + "\"",
    "          git config user.email \"" + botEmail + "\"",
    "          git add chatwork/rooms.json chatwork/state chatwork/history",
    "          if git diff --cached --quiet; then",
    "            echo \"更新はありません\"",
    "          else",
    "            git commit -m \"Chatworkの選択room履歴を更新\"",
    "            git push",
    "          fi",
    "      - name: 取得失敗を通知",
    "        if: steps.chatwork.outcome != 'success'",
    "        run: |",
    "          echo \"Chatworkの取得に失敗しました。前回の履歴と取得位置は保持しています。\" >&2",
    "          exit 1",
    "",
  ].join("\n");
}
