---
name: weekly
description: >
  「今週を振り返って」「先週の活動をまとめて」に応え、日次journal原本から活動・決定・申し送りを分けて表示する。
  MEMORY.mdが増えたときは古い月の退避候補と影響を示し、明示確認後だけ整理する。
---

# 週次ふりかえりと索引退避

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と `secretary/memory/preferences.md` を読む。
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とし、
下位skillとしてschemaを複製・再包装しない。

## 1. 週次ふりかえり

通常の週次ふりかえりはopen PJとjournalだけを対象にし、`projects/closed/`は存在確認も探索もしない。
closed、完了、終了、過去案件を利用者が明示した場合だけ、指定範囲を`projects` Skillへ委譲する。

1. 「今週」は`CC_SECRETARY_NOW`（未指定時は現在日）を含む**月曜〜日曜**を対象にする。
   「先週」は先週内の日付を`--week YYYY-MM-DD`へ渡す。相対語をコマンドへ直接渡さない。
2. `${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.sh weekly <secretary> [--week YYYY-MM-DD]`
   を実行する。このシームは、対象期間の各日journal原本を毎回直接読み、過去の週次成果物を入力にしない。
3. 出力の`活動（did）`、`決定（decided）`、`翌週への申し送り（next）`を混ぜない。
   決定は新しい記録を先に表示する。`変更:`を含む決定も原文のまま残し、矛盾や変更履歴を自動統合・要約しない。
   統合候補がある場合は候補を示し、ユーザー確認後だけ別の決定記録として追加する。
4. topicや外部事実を補う場合は、現在の会話で実コネクタから得た事実だけを使い、
   サービス名＋URL/ID＋日付を行内に記す。外部本文を複製しない。journalに出典がある場合は原文のまま保つ。
5. 閲覧だけではファイル、journal、git commitを変更しない。

### 保存は明示されたときだけ

ユーザーが「保存して」と明示した場合だけ、週次出力を標準入力から
`${SECRETARY_PLUGIN_ROOT}/scripts/workspace-tools.sh save-deliverable <secretary> <YYYY-MM-DD> "週次ふりかえり <期間>" "週次,振り返り"`
へ渡す。成功すると成果物とjournal `did`が各1件だけ増える。その後、
`memory-tools.sh commit <secretary> "週次ふりかえりを保存（<期間>）"` を1回だけ実行する。
pushはしない。

## 2. MEMORY.mdの199／200／201行運用

`memory-tools.sh reindex <secretary>`を使う。199行・200行は通常終了、201行相当では索引を200行以内に保ったまま
exit 0とし、stderrの警告から退避候補、残る参照、timeline/weeklyへの影響を説明する。
警告は自動退避・自動削除の許可ではない。

## 3. 古い月を退避する2段階

1. **対象提示だけ**: `memory-tools.sh archive-plan <secretary> [YYYY-MM]`。
   対象件数、退避先、残る参照、timeline/weeklyへの影響を見せ、ここで止まる。ファイル・索引・commitを変更しない。
2. ユーザーが次の別ターンで対象月を明示して了承した場合だけ、
   `memory-tools.sh archive-month <secretary> YYYY-MM --confirm`を実行する。
   キャンセル・訂正・別話題なら何も変更しない。
3. 退避は削除ではなく`memory/archive/journal/YYYY-MM/`への移動。完了後は索引を更新し、
   `memory-tools.sh commit <secretary> "journalを退避（YYYY-MM）"`でローカルに1回だけ記録する。
4. timelineとweeklyは退避領域も検索する。退避後も通常どおり対象期間を指定すれば閲覧できることを案内する。

## 対象外

- dashboardは実利用者反応の証跡がないため追加しない。
- 既存ユーザーmigrationは既存利用者の証跡がないため追加しない。
- 無確認の退避・削除、decision統合、外部データ本文の保存は行わない。

## 参照

- 言葉づかい: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- 週次・索引シーム: `${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.sh`
- 成果物保存: `${SECRETARY_PLUGIN_ROOT}/scripts/workspace-tools.sh`
