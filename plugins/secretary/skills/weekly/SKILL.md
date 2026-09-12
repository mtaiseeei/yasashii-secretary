---
name: weekly
description: >
  「今週を振り返って」「先週の活動をまとめて」に応え、日次journal原本から活動・決定・申し送りを分けて表示する。
  MEMORY.mdが増えたときは古い月の退避候補と影響を示し、明示確認後だけ整理する。
---

# 週次ふりかえりと索引退避

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathをhostから受け取り、`SECRETARY_SKILL_FILE` として扱う。空・相対path・未解決placeholderなら
commandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。Node.jsの `path.dirname`／`path.join` と配列引数で、
次のresolverへ `--skill-file` とpathを別々の引数として渡す（下記はhost-neutralな呼び出しの形）。

```text
SECRETARY_PLUGIN_ROOT = node(path.join(path.dirname(SECRETARY_SKILL_FILE), "../../scripts/resolve-plugin-root.mjs"), ["--skill-file", SECRETARY_SKILL_FILE])
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` を、同じplugin実体・workspaceで該当fileが未変更ならsessionで一度だけ読む。plugin、workspace、または該当fileが変わった場合だけ、そのfileを再読する。
個人設定が必要な応答だけ `secretary/memory/preferences.md` の該当節を読む。
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とし、
下位skillとしてschemaを複製・再包装しない。

## 1. 週次ふりかえり

<!-- yasashii-secretary:clarity-collaboration:weekly:v1 -->

通常の週次ふりかえりはopen PJとjournalだけを対象にし、`projects/closed/`は存在確認も探索もしない。
closed、完了、終了、過去案件を利用者が明示した場合だけ、指定範囲を`projects` Skillへ委譲する。

1. 「今週」は`CC_SECRETARY_NOW`（未指定時は現在日）を含む**月曜〜日曜**を対象にする。
   「先週」は先週内の日付へ解釈する。相対語をコマンドへ直接渡さない。
2. 対象週の各日journal原本をcanonical rootから安全に取得し、active / archive、日付範囲、出典、取得できた範囲を確認する。
   必要な原本が十分かつ現時点の対象範囲を覆っているなら、`weekly` helperを追加実行せず、LLMが原本から整理してよい。
   原本が未取得、期間抽出が広い、または再現可能な週次一覧が必要な場合だけ、次のhelperを任意で使う。
   `node "${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs" weekly <secretary> [--week YYYY-MM-DD]`
   は対象期間の日次journal原本を毎回直接読む。過去の週次成果物から要約し直さない。
3. 出力の`活動（did）`、`決定（decided）`、`翌週への申し送り（next）`を混ぜない。
   決定は新しい記録を先に表示する。`変更:`を含む決定も原文のまま残し、矛盾や変更履歴を自動統合・要約しない。
   統合候補がある場合は候補を示し、ユーザー確認後だけ別の決定記録として追加する。
4. topicや外部事実を補う場合は、現在の会話で実コネクタから得た事実だけを使い、
   サービス名＋URL/ID＋日付を行内に記す。外部本文を複製しない。journalに出典がある場合は原文のまま保つ。
5. 一部の日しか読めない、取得に失敗した、またはarchive等の対象範囲を確認できない場合は、読めた日・読めなかった日を分け、
   週全体を網羅した、0件だった、最新だとは言わない。canonical root、symlink、archive、日付範囲の安全境界で拒否された対象は
   そこで止め、直接Readで迂回しない。
6. 閲覧だけではファイル、journal、git commitを変更しない。
7. `node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity-secretary.mjs" weekly <secretary>`を実行し、open PJのAttention増減、解消済みAttention、解消Drift、長期滞留を独立したProject Clarity sectionへ添える。前回比較が無い場合は増減を推測せず「前回集計なし」とする。closed、全Item本文、外部connectorをClarity経由で自動読込しない。

### 保存は明示されたときだけ

ユーザーが「保存して」と明示した場合だけ、週次出力を標準入力から
`node "${SECRETARY_PLUGIN_ROOT}/scripts/workspace-tools.mjs" save-deliverable <secretary> <YYYY-MM-DD> "週次ふりかえり <期間>" "週次,振り返り"`
へ渡す。成功すると成果物とjournal `did`が各1件だけ増える。その後、
`memory-tools.mjs commit <secretary> "週次ふりかえりを保存（<期間>）"` を同じNode.js helperで1回だけ実行する。
pushはしない。

## 2. MEMORY.mdの199／200／201行運用

`memory-tools.mjs reindex <secretary>`を同じNode.js helperで使う。199行・200行は通常終了、201行相当では索引を200行以内に保ったまま
exit 0とし、stderrの警告から退避候補、残る参照、timeline/weeklyへの影響を説明する。
警告は自動退避・自動削除の許可ではない。

## 3. 古い月を退避する2段階

1. **対象提示だけ**: `memory-tools.mjs archive-plan <secretary> [YYYY-MM]`。
   対象件数、退避先、残る参照、timeline/weeklyへの影響を見せ、ここで止まる。ファイル・索引・commitを変更しない。
2. ユーザーが次の別ターンで対象月を明示して了承した場合だけ、
   `memory-tools.mjs archive-month <secretary> YYYY-MM --confirm`を実行する。
   キャンセル・訂正・別話題なら何も変更しない。
3. 退避は削除ではなく`memory/archive/journal/YYYY-MM/`への移動。完了後は索引を更新し、
   `memory-tools.mjs commit <secretary> "journalを退避（YYYY-MM）"`でローカルに1回だけ記録する。
4. timelineとweeklyは退避領域も検索する。退避後も通常どおり対象期間を指定すれば閲覧できることを案内する。

## 対象外

- dashboardは実利用者反応の証跡がないため追加しない。
- 既存ユーザーmigrationは既存利用者の証跡がないため追加しない。
- 無確認の退避・削除、decision統合、外部データ本文の保存は行わない。

## 参照

- 言葉づかい: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- 週次・索引シーム: `node "${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs"`
- 成果物保存: `node "${SECRETARY_PLUGIN_ROOT}/scripts/workspace-tools.mjs"`
