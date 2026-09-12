---
name: settings
description: >
  利用者の呼び方、仕事・役割、口調、一人称、専門用語、報告の詳しさ、決定確認を初回または途中で安全に変更する。
  「設定変えたい」「もっとフランクに」「一人称を変えて」「私の呼び方を変えて」で使う。
---

# settings — その人に合わせる設定

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathをhostから受け取り、`SECRETARY_SKILL_FILE` として扱う。空・相対path・未解決placeholderなら
commandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。Node.jsの `path.dirname`／`path.join` と配列引数で、
次のresolverへ `--skill-file` とpathを別々の引数として渡す（下記はhost-neutralな呼び出しの形）。

```text
SECRETARY_PLUGIN_ROOT = node(path.join(path.dirname(SECRETARY_SKILL_FILE), "../../scripts/resolve-plugin-root.mjs"), ["--skill-file", SECRETARY_SKILL_FILE])
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

初回と途中変更を同じ入口で扱う。`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` を、同じplugin実体・workspaceで該当fileが未変更なら
sessionで一度だけ読み、plugin、workspace、または該当fileが変わった場合だけ再読する。現在の設定値が必要なときに `secretary/memory/preferences.md` の該当節を読む。
preferences が無い・空・一部欠損なら、丁寧（標準）／一人称=私／専門用語=ふつう／報告=みじかく／決定確認=都度を使う。
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
呼び方、主に使うサービス、任せたいこと、お仕事・役割、説明の詳しさを聞く。一人称は既定の「私」で開始し、希望が明示されたときだけ途中変更する。
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
5. 部分更新の結果を確認する。更新に失敗したら `error` とし、journal／commitへ進まず、保存済みとは書かない。
6. 呼び方以外は、更新成功後に `journal-add <secretary> did "設定を変更: <変更項目>=<値>"` を1回だけ呼ぶ。
7. journal成功後に `commit <secretary> "設定を変更（<変更項目>: <値>）"` を呼ぶ。両方の必須効果が成功するまで
   `saved` と報告せず、成功後に `こう覚えました: <変更項目>=<値>` と宣言する。他項目を変えていないことも短く伝える。
   呼び方の更新シームは `preferences.md`、`AGENTS.md`、`MEMORY.md` の現役表示、journal 1件、
   local commit 1件を一つのtransaction、つまり途中失敗時に全変更を元へ戻す一組の処理として完了する。
   初回decisionは変更しない。どちらの経路もpushしない。

設定更新後にjournalまたはcommitが失敗した場合は、更新済みの項目、未完了のjournal／commit、実際の影響を
`partial` として返す。再試行では更新済みの項目を繰り返さず、未完了の効果だけを順に行う。
呼び方更新の失敗では3正本、journal、commitに部分変更を残さない。
英語エラーは何が起きたかと直し方を日本語で先に説明する。

## 変更できる項目

| セクション | 日本語の項目名 | 内部の正式key | 入力の種類 |
|---|---|---|---|
| 基本 | 呼び方 | `基本.呼び方` | 短い自由入力 |
| 基本 | お仕事・役割 | `基本.お仕事・役割` | 短い自由入力 |
| 基本 | 主に使うサービス | `基本.主に使うサービス` | 短い自由入力 |
| 言葉遣い | 口調 | `言葉遣い.口調` | 定義済みの選択肢 |
| 言葉遣い | 一人称 | `言葉遣い.一人称` | 1〜16 Unicode code pointの改行なし文字列 |
| 言葉遣い | 専門用語 | `言葉遣い.専門用語` | 定義済みの選択肢 |
| 言葉遣い | 報告の詳しさ | `言葉遣い.報告の詳しさ` | 定義済みの選択肢 |
| 言葉遣い | 決定の確認 | `言葉遣い.決定の確認` | 定義済みの選択肢 |
| 口調のお手本 | NG / OK | `口調のお手本.NG` / `口調のお手本.OK` | 短い例文 |

口調プリセットは `${SECRETARY_PLUGIN_ROOT}/templates/tones/standard.md`、`friendly.md`、`formal.md` の3種。
濃いキャラクターは使わない。利用者がプリセットまたはNG/OK例を明示的に選んだ場合は同じturnで反映し、
選択されていない例文や追加内容を推測する場合だけ、適用前に短い例文を見せて1問確認する。

## 秘書のメモ

「その言い方いいね」等、保存操作が明示されない内容を自発的に覚える場合は、先に
`この内容を秘書のメモに残しますか: <短い内容>` という短い段落で確認する。確認ターンは副作用0とする。
了承後だけ `pref-note-add <secretary> "<確認済みの内容>"` を呼ぶ。現在の依頼で保存内容と操作が明示された低リスクな追記は同じturnで1回実行する。
この確認は自発提案だけに適用する。利用者が「この好みを覚えて」と明示した場合は、保存するか自体の確認を
memory-careへ取り直さず、settingsの明示された値として同じturnで正規シームを1回実行する。推量や留保は内容属性として残す。
`pref-note-add` は末尾追記だけに使い、既存メモを置換・削除しない。

## 設定の適用

- 「報告の詳しさ」は値をそのまま最終応答serializerへ渡す。settings側では項目数、prefix、Markdown構造、前後の包装を再定義しない。
- 「一人称」は `preferences.md` の値を会話の話者として参照する。欠損・空・旧形式は「私」へ戻し、名前・実行状態・安全ruleが優先される。値の意味はLLMが判断し、口調や秘書名から推測しない。
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
