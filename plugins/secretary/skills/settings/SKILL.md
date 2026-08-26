---
name: settings
description: >
  利用者の呼び方、仕事・役割、口調、専門用語、報告の詳しさ、決定確認を初回または途中で安全に変更する。
  「設定変えたい」「もっとフランクに」「専門用語そのままで」「私の呼び方を変えて」で使う。
---

# settings — その人に合わせる設定

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

初回と途中変更を同じ入口で扱う。ユーザーに話しかける前に
`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は `secretary/memory/preferences.md` を毎回読み直す。
preferences が無い・空・一部欠損なら、丁寧（標準）／専門用語=ふつう／報告=みじかく／決定確認=都度を使う。
output stylesには依存しない。

「秘書自身の名前を付けたい／変えたい」「Alexと呼びたい」「別repoから名前で呼びたい」はこのSkillで
利用者の呼び方へ誤適用せず、`${SECRETARY_PLUGIN_ROOT}/skills/name/SKILL.md` へ案内する。

## 全設定で上書きできない出力・許可・根拠

例文確認や変更結果の内容・口調・安全条件だけをrouterへ返し、通常報告を独自に包装しない。
最終出力形は `plain-language.md` から解決される「最終応答serializer」だけを正本とする。
口調・専門用語・役割は、同ruleのpush許可条件と外部事実の証跡条件を上書きしない。

## 初回

オンボーディングの5問を使う。呼び方は同Skillの共通契約どおり「あなた」「アカウント名」
「指定の名前」とhost標準の「その他」を使う。host UIが自動付与する「その他」は重複表示しない。
「アカウント名」を選んだ後だけ共通の `name-candidates.mjs` を使い、host-task-context→Git→OSの順、
同じ正規化・除外・重複・推奨規則で扱う。任意の過去会話や生session logは検索しない。
呼び方、主に使うサービス、任せたいこと、お仕事・役割、説明の詳しさを聞く。
口調は聞かず丁寧（標準）で開始する。完了時に「いつでも『設定変えたい』で変更できます」と伝える。

## 途中変更の手順

必ず次の順で進める。

1. 現在のpreferencesを読み、変更対象を1項目に絞る。categorical設定を「秘書のメモ」へ埋めない。
2. 変更項目と値が現在の依頼で明示され、単一のreversibleな部分更新なら、同じturnで部分更新シームを1回呼ぶ。
3. 値を推測する必要がある場合は変更後の短い例文を見せ、`この設定で反映しますか: <変更項目>=<値>` と1問だけ聞き、副作用0で止まる。
4. 全置換、内容喪失、外部反映を伴う場合は対象と影響を示して明示確認後だけ実行する。
   - 呼び方:
     `node "${SECRETARY_PLUGIN_ROOT}/scripts/owner-name-transaction.mjs" <secretary> "<確認済みの値>"`
   - それ以外:
     `node "${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs" pref-set <secretary> "<セクション>" "<キー>" "<値>"`
5. `こう覚えました: <変更項目>=<値>` と宣言する。他項目を変えていないことも短く伝える。
6. 呼び方以外は、宣言後に `journal-add <secretary> did "設定を変更: <変更項目>=<値>"` を1回だけ呼ぶ。
7. 呼び方以外は、最後に `commit <secretary> "設定を変更（<変更項目>: <値>）"` を呼ぶ。
   呼び方の更新シームは `preferences.md`、`AGENTS.md`、`MEMORY.md` の現役表示、journal 1件、
   local commit 1件を一つのtransaction、つまり途中失敗時に全変更を元へ戻す一組の処理として完了する。
   初回decisionは変更しない。どちらの経路もpushしない。

失敗時はjournalやcommitへ進まない。呼び方更新の失敗では3正本、journal、commitに部分変更を残さない。
英語エラーは何が起きたかと直し方を日本語で先に説明する。

## 変更できる項目

| セクション | キー | 値 |
|---|---|---|
| 基本 | 呼び方 | 短い自由入力（内部設定は1件1record） |
| 基本 | お仕事・役割 | 短い自由入力（内部設定は1件1record） |
| 基本 | 主に使うサービス | 短い自由入力（内部設定は1件1record） |
| 言葉遣い | 口調 | 丁寧（標準）／フランク／きっちり敬語 |
| 言葉遣い | 専門用語 | ふつう／ことば添え／そのままOK |
| 言葉遣い | 報告の詳しさ | みじかく／くわしく |
| 言葉遣い | 決定の確認 | 都度／まとめて |
| 口調のお手本 | NG / OK | 短い例文（内部設定は1件1record） |

口調プリセットは `${SECRETARY_PLUGIN_ROOT}/templates/tones/standard.md`、`friendly.md`、`formal.md` の3種。
濃いキャラクターは使わない。プリセットのNG/OKを複写する場合も、適用前に例文を見せて確認する。

## 秘書のメモ

「その言い方いいね」等、保存操作が明示されない内容を自発的に覚える場合は、先に
`この内容を秘書のメモに残しますか: <短い内容>` という短い段落で確認する。確認ターンは副作用0とする。
了承後だけ `pref-note-add <secretary> "<確認済みの内容>"` を呼ぶ。現在の依頼で保存内容と操作が明示された低リスクな追記は同じturnで1回実行する。
この確認は自発提案だけに適用する。利用者が「この好みを覚えて」と明示した場合は、memory scopeの許可を
内部分類のために取り直さず、同じturnで正規シームを1回実行する。推量や留保は内容属性として残す。
`pref-note-add` は末尾追記だけに使い、既存メモを置換・削除しない。

## 設定の適用

- 「報告の詳しさ」は値をそのまま最終応答serializerへ渡す。settings側では項目数、prefix、Markdown構造、前後の包装を再定義しない。
- 口調のお手本は内容の言い回しだけへ適用し、最終応答serializerを再包装しない。
- 「ことば添え」は一般技術用語を置換せず、対象語に短い補足を足す。「そのままOK」でも安全説明は省かない。
- お仕事・役割は題材の写像に使う。営業→商談メモ、講師→講義資料、経営→数字のまとめ。設定に無い事実は作らない。
- 「決定の確認: 都度」は決定ごとの短い確認文を維持する。
- 「決定の確認: まとめて」は決定候補を未確認のまま記録せず、会話の締めで候補を列挙して一括確認する。了承後に各候補を正規シームへ渡す。当日decidedが0件なら拾い漏れ確認も省略しない。

## 参照

- 共通ルール: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- preferences雛形: `${SECRETARY_PLUGIN_ROOT}/templates/memory/preferences.md`
- 呼び方候補: `${SECRETARY_PLUGIN_ROOT}/scripts/name-candidates.mjs`
- 呼び方の3正本同期・journal・local commit: `${SECRETARY_PLUGIN_ROOT}/scripts/owner-name-transaction.mjs`
- その他の部分更新・追記・journal・commit: `node "${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs"`
