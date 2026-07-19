export const GOOGLE_CHAT_INTERVALS = Object.freeze({
  "1h": { label: "1時間", runs: 720, cron: "23 * * * *" },
  "3h": { label: "3時間", runs: 240, cron: "23 */3 * * *" },
  "6h": { label: "6時間", runs: 120, cron: "23 */6 * * *" },
  "12h": { label: "12時間", runs: 60, cron: "23 */12 * * *" },
  manual: { label: "手動のみ", runs: 0, cron: null },
});

export function googleChatScheduleFor(interval, enabled) {
  const selected = GOOGLE_CHAT_INTERVALS[interval];
  if (!selected) throw Object.assign(new Error("自動取得の間隔を選び直してください。"), { code: "interval-invalid" });
  return enabled && selected.cron ? selected.cron : null;
}

export function renderGoogleChatWorkflow(interval, enabled) {
  const cron = googleChatScheduleFor(interval, enabled);
  const schedule = cron ? ["  schedule:", `    - cron: '${cron}'`] : [];
  return [
    "name: Google Chat sync",
    "run-name: Google Chat sync [${{ inputs.correlation_id || github.event_name }}]",
    "",
    "on:",
    ...schedule,
    "  workflow_dispatch:",
    "    inputs:",
    "      correlation_id:",
    "        description: 今回の開始操作とrunを対応づける識別子",
    "        required: false",
    "        type: string",
    "",
    "permissions:",
    "  contents: write",
    "",
    "concurrency:",
    "  group: google-chat-sync-${{ github.repository }}",
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
    "      - name: Google Chatから取得",
    "        id: google_chat",
    "        continue-on-error: true",
    "        env:",
    "          GOOGLE_OAUTH_CLIENT_ID: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}",
    "          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}",
    "          GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT: ${{ secrets.GOOGLE_OAUTH_REFRESH_TOKEN_GCHAT }}",
    "          GOOGLE_CHAT_TRIGGER: ${{ github.event_name }}",
    "        run: node google-chat/scripts/continuous-sync.mjs \"$GITHUB_WORKSPACE\"",
    "      - name: 取得結果を同じrepoへ記録",
    "        if: always() && steps.google_chat.outcome != 'skipped'",
    "        run: |",
    "          git config user.name \"yasashii-secretary[bot]\"",
    "          git config user.email \"yasashii-secretary[bot]@users.noreply.github.com\"",
    "          git add google-chat/state",
    "          if [ -d google-chat/history ]; then",
    "            git add google-chat/history",
    "          fi",
    "          if git diff --cached --quiet; then",
    "            echo \"更新はありません\"",
    "          else",
    "            git commit -m \"Google Chatの選択スペース履歴を更新\"",
    "            git push",
    "          fi",
    "      - name: 取得失敗を通知",
    "        if: steps.google_chat.outcome != 'success'",
    "        run: |",
    "          echo \"Google Chatの取得に失敗しました。前回の履歴と取得位置は保持しています。\" >&2",
    "          exit 1",
    "",
  ].join("\n");
}
