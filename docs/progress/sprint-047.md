# Sprint 047 progress — Yasashii instruction audit

## 実装

2026-09-12時点で、Yas 0.10.3 の16 skill、Yas rules/templates、影響範囲テスト、監査表を更新した。

- 現在の具体的な依頼を先に扱い、依頼がない／明示的な再開時だけ `_resume.md` を読む。別件で既存しおりを上書き・消去しない。
- `plain-language` の共通入口と依存ruleの再読を一依頼一回へ整理した。未変更のplugin/workspace/rule/preferencesだけ再利用し、更新・設定変更後は該当部分を読む。安全・証拠ruleは省略しない。
- 短いReadは無言、複数資料・外部・長いread-onlyは開始と要所だけ進捗を示す。
- settings は `pref-set` → journal → local commit の順に実行し、必須処理成功後だけ `saved`。後段失敗は実際の保存状態を `partial` とし、retryは未完了処理だけに限定。明示プリセットの確認を繰り返さない。
- 接続診断・daily・Google/Microsoft/Notion setupを分離した。tool不可・未実施・結果なしは `未確認`、実 not-connected エラーだけ `未接続`。診断だけで setupや新規workspaceを開始しない。setupのしおりは既存canonical workspaceで複数turnになる場合だけ作成し、既存しおりを保護する。
- 全16 skillのroot bootstrapをNode path + resolver成功stdoutの `SECRETARY_PLUGIN_ROOT` 代入へ統一し、非0／空stdoutで停止する。projects helper pathもspaceを含むrootで安全に渡す。
- Harnessは記録済みYas baseline 0.5.1と実host capabilityを区別し、YasへAgentic 0.13.1、Clarity、private my-vault機能を追加していない。

seed 15件の処置と追加因果、source／installed／publicの区別、historical overlayの残置理由は
[`docs/astra-instruction-audit-20260912.md`](../astra-instruction-audit-20260912.md) に記録した。

## 検証

このSprintはinstruction/helperの監査で、起動するWebアプリやtest URLは **N/A（product UIなし）**。以下は全て指定 heavy wrapper 経由で実行した。wrapperは実行権限が無いため `python3` から呼び出した。

- `python3 /private/tmp/astra-secretary-heavy.py node scripts/sprint-047-audit-test.mjs` — `SPRINT047_AUDIT_PASS=8 FAIL=0`。
- `python3 /private/tmp/astra-secretary-heavy.py node scripts/sprint-029-rule-boundary-test.mjs` — `SPRINT029_RULE_PASS=25 SPRINT029_RULE_FAIL=0`。
- `python3 /private/tmp/astra-secretary-heavy.py node scripts/sprint-035-test.mjs` — `SPRINT035_PASS=15 SPRINT035_FAIL=0`。
- `python3 /private/tmp/astra-secretary-heavy.py node scripts/sprint-038-test.mjs` — `SPRINT038_PASS=67 SPRINT038_FAIL=0`。
- `python3 /private/tmp/astra-secretary-heavy.py node scripts/sprint-038-patch-002-windows-test.mjs` — `SPRINT038_PATCH002_WINDOWS_PASS=12 FAIL=0 OS=darwin`。
- `python3 /private/tmp/astra-secretary-heavy.py git diff --check -- plugins/secretary` — exit 0。全体 `git diff --check` は保護対象の既存 `AGENTS.md:126` の末尾空行で exit 2 となるため、そこは修正していない。

メイン担当の別検査では Ruby/Psych `/private/tmp/astra-secretary-frontmatter.rb` が Yas 16 skillを `PASS`。generic skill の `INCOMPLETE` は別対象として記録し、Yas のPASS/FAILへ合算していない。

最初の `sprint-038-test.mjs` は共通heavy lock busy (exit 75) だったが、編集を続けて後で再実行し PASS した。検査中の `NODE_BEFORE`/`NODE_AFTER` は32〜36で、wrapper後に増殖を残していない。

## 回帰チェックとEvaluator handoff

回帰コマンドは上記5コマンド。新規 `sprint-047-audit-test.mjs` は静的 source checkであり、実会話・外部認可・副作用の証拠ではない。独立Evaluatorは、current-first/resume、settingsの実file/journal/commit件数とpartial retry、接続tool不可／実not-connected／実エラー、空白・日本語fixture path、16 skillとYas版／overlay provenanceを別に確認する。

## 既知の保留

- 公開latestは `gh release view` の `Forbidden` とweb `releases/latest` のcache missにより未確認。公開同期やrelease-readyを宣言しない。
- `secretary-overlay/upstream-base.json`、`upstream-tree.json`、historical accepted/base/handoff/provenanceは更新していない。local candidate差分に対するupstream sync証明はこのSprintの完了条件に含めない。
- root Harness guidance、`.harness/config.toml`、`AGENTS.md`、`CLAUDE.md`、`docs/harness-guidance.md`、`docs/sprints/state.md` の既存dirty変更は所有者保護のため触れていない。
- メイン担当の baseline 比較では Agentic 1,483 files、Yas 4 filesの既存 hashesが全て一致。保護対象への書込みはない。
