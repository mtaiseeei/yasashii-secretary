---
name: memory-care
description: >
  秘書の記憶を安全に育て、守り、続きから再開できるようにする。覚えて／記憶／消して／振り返り／前回の続き
  などの言い回しで呼び出す。記憶の追加・保護（空上書き拒否・削除前の確認）・再起動しおり・振り返りを扱う。
---

# 記憶ケア（memory-care）

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

秘書の「記憶」を安全に育てるスキル。記憶はユーザーの `secretary/memory/` 配下に置く。
決定・活動・確認済みの相談要点を役割別に覚え、うっかり消えないように守り、中断しても続きから再開できるようにする。

`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。記憶操作の結果と安全条件だけをrouterへ返し、
通常報告を独自に包装しない。最終出力形は同rule入口から解決される「最終応答serializer」だけを正本とする。

## 記憶の置き場所（`secretary/memory/`・フラット構造）

```
secretary/memory/
├── MEMORY.md      ← 記憶の目次（1行1記憶。増減に必ず追従させる）
├── decisions/     ← 決まったことの記録（YYYY-MM-DD-decisions.md）
├── journal/       ← 成功した活動の記録（YYYY-MM-DD.md・追記専用）
├── topics/        ← 確認済みの相談要点（案件メモ）
├── preferences.md ← 基本・言葉遣い・口調のお手本・秘書のメモ
└── _resume.md     ← 再起動しおり（中断時だけ作る一時ファイル。終わったら消す）
```

部署フォルダ・隠しフォルダ・`case-NNN`・`patterns/` は作らない（フラットな構成を保つ）。

## 決定的な操作はヘルパーに任せる（大切）

索引の追従・空上書きの拒否・削除前の確認・しおりの読み書き・節目コミットは、**必ず**次のヘルパーを使う。
自前で `rm` したり空ファイルを書いたりしない（事故防止）。ヘルパーは同じ入力なら同じ結果になる。

ヘルパー: `node "${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs"`

以下の `memory-tools.mjs` は、すべて上記のように `node` で実行する。WindowsでもBashは使わない。

| やりたいこと | コマンド |
|---|---|
| 決定を記録（＋目次追従） | `memory-tools.mjs remember-decision <secretary> <YYYY-MM-DD> "<本文>"` |
| 活動をjournalへ追記 | `memory-tools.mjs journal-add <secretary> <did\|decided\|next\|note> "<本文>"` |
| 確認済みの相談要点を案件メモへ追加 | `memory-tools.mjs topic-add <secretary> "<トピック名>" "<要点>"` |
| 明示memory依頼を保存しlocal checkpoint | `memory-tools.mjs save-memory <secretary> <decision\|topic> <YYYY-MM-DD> "<題名>" '<意味tuple JSON>' "<表示要点>" [--checkpoint] [--fail-at stage\|commit\|post-commit]` |
| 活動・決定を時系列表示 | `memory-tools.mjs timeline <secretary> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--type decisions\|journal\|all] [--grep "<キーワード>"]` |
| 週次ふりかえり | `memory-tools.mjs weekly <secretary> [--week YYYY-MM-DD]` |
| 古い月の退避候補 | `memory-tools.mjs archive-plan <secretary> [YYYY-MM]` |
| 確認済みの月を退避 | `memory-tools.mjs archive-month <secretary> YYYY-MM --confirm` |
| preferencesの指定行だけを変更 | `memory-tools.mjs pref-set <secretary> "<セクション>" "<キー>" "<値>"` |
| 確認済みの秘書メモを末尾追記 | `memory-tools.mjs pref-note-add <secretary> "<本文>"` |
| 目次を作り直す（増減に追従） | `memory-tools.mjs reindex <secretary>` |
| 記憶を安全に書き換える（空・範囲外は拒否） | `memory-tools.mjs guarded-write <secretary> <memory相対パス>`（本文は標準入力） |
| 記憶を消す（要確認） | `memory-tools.mjs delete <secretary> <memory相対パス> [--confirm]` |
| しおりを書く | `memory-tools.mjs resume-write <secretary> "<進行中>" "<次にやること>" "<未確定>"` |
| しおりの有無を見る | `memory-tools.mjs resume-check <secretary>` |
| しおりを読む／閉じる | `memory-tools.mjs resume-read <secretary>` / `resume-clear <secretary>` |
| 節目コミット（日本語・push しない） | `memory-tools.mjs commit <secretary> "<日本語メッセージ>"` |

`<secretary>` は作業中フォルダの `secretary/`。相対日付（「きのう」等）は必ず絶対日付（`YYYY-MM-DD`）に直してから渡す。

## 1. 記憶の追加・更新

<!-- yasashii-secretary:clarity-collaboration:memory:v1 -->

Project固有DecisionとClarity Event／Evidenceは一般memoryへ複製しない。確認済みPJのDecisionは既存の
`project-tools.mjs add-decision`、Clarityの状態遷移はClarity Eventが正本であり、memory-careは同じ本文を
`decisions/`や`topics/`へ二重保存しない。「覚えて」が明示された場合も、既にこれらの正本へ保存済みなら
新しい一般memoryを作らず、その参照と保存済み状態を返す。自然会話のmemory選択をHookへ移さない。

- 現在の利用者が低リスクな内容を「覚えて」と明示した場合、user-visible scope `memory`だけで十分な許可とする。
  decision／topicの内部分類、保存先file、要約案を聞き返さず、同じturnで `save-memory` を1回だけ呼ぶ。
- 「覚えといたほうがいいかも」のように保存操作自体が曖昧なrequest hedgeは、contentとscopeを示して副作用0で1問確認する。
  対象やscopeに不足がある場合も、結果を変える不足だけを1問で確認する。
  「Xだと思う。覚えて」「YさんからXと聞いた。覚えて」の推量・伝聞や、留保・否定・条件・訂正はcontent hedgeであり、
  明示依頼を取り消さない。情報源、確実性、否定条件、訂正関係を意味tupleへ残し、確定事実へ変えない。
- 依頼語の引用、現在依頼ではない仮定、依頼の取消、過去依頼の照会はwrite 0件とする。保存済み取消は削除二段階へ進める。
- `remember-decision` は過去の決定を直さず、新しい日付ファイルへ追加する。変更時は `変更: 「旧決定」(旧日付) → 「新決定」（理由）` の形で新しい行を足す。
- 結論が出ていない相談を秘書から保存提案する場合は「要点を案件メモに残しますか」という短い段落で確認し、
  同じ話題の了承後だけ保存する。利用者が現在「覚えて」と明示した場合は提案フローへ戻さない。
  pendingは1件だけで、別話題が介在したら失効する。「はい、ただしX」はXへ直した内容を同じturnで保存し、再確認しない。
  会話全文、依頼語、完全な逐語copy、外部データ本文は保存しない。
- 好み・呼び方・役割・言葉遣いはsettingsの確認フローを通し、指定行だけを`pref-set`で更新する。
  `preferences.md`全体を`guarded-write`で組み直さない。確認済みの自由メモだけ`pref-note-add`で末尾追記する。
- 記憶ファイルを足したり消したりしたら、`MEMORY.md`（目次）が自動で追従する（ヘルパーが `reindex` する）。目次は「1行1記憶」を保つ。

### journal の扱い

- journalは正規のシームが成功した事実だけを、確認を増やさず1件1行で追記する。過去行の更新・削除コマンドは提供しない。
- typeは `did`（実行済み）、`decided`（確認済み決定）、`next`（申し送り）、`note`（補足事実）の4つだけ。
- `_resume.md` は中断中の作業、journalの `next` は翌日以降への申し送り。役割を混ぜない。
- 日付を固定する検証では `CC_SECRETARY_NOW` を使う。未指定時だけ現在時刻を使う。

## 2. timeline（いつ何をしたか・決めたか）

質問を絶対日付と絞り込みへ変換してから、決定的な`timeline`を実行する。出力はLLMで作り直さず、
日付・種類・本文を保ったまま提示する。

| 言い方 | 呼び出し方 |
|---|---|
| 「今日やったこと」 | 今日の絶対日付を`--from`と`--to`に指定し、`--type journal` |
| 「先週なにしてた」 | 先週の開始日・終了日を絶対日付で指定し、`--type journal` |
| 「いつ決めた」 | `--type decisions` |
| 「7月に決まったこと」 | 7月の初日・末日を指定し、`--type decisions` |
| 「Zoomの件いつ決めた」 | `--type decisions --grep "Zoom"` |

- `--from` / `--to`は両端を含む。`--grep`は文字列をそのまま検索し、正規表現として解釈しない。
- `all`はdecision正本を優先し、journalの対応する`decided`を二重表示しない。
- 変更決定は新しい日付が先に出て「決定・変更（最新を優先）」と分かる。過去の決定は消さない。
- 0件なら「該当する記録はありません」と伝え、期間・種類・キーワードの見直しを案内する。
- timelineの閲覧だけではファイルを作らない。ユーザーが「保存して」と明示した場合だけ、ルーターの
  `save-deliverable`を使い、表示結果を成果物として保存する。

## 3. 節目プロトコル（決定・相談文脈）

### 決定のintentを判定して記録する

1. 「覚えて」「決定として残して」等の保存操作と対象が現在の依頼で明示されていれば、行き先はuser-visible scope `memory`で十分として `explicit` とする。
2. `explicit` なら同じassistant turnで`save-memory`をちょうど1回呼び、保存した内容、日付、内部分類された保存先を過去形で返す。
3. 「〜にしよう」だけで保存操作が明示されない場合や、指示対象が曖昧なら副作用0で、記録するかを1問だけ聞く。
4. 依頼語の引用、現在依頼ではない仮定、取り消し、過去依頼の質問は現在の保存指示にしない。
   伝聞・推量・留保・否定・条件・訂正は明示保存がある場合の内容属性として保持する。保存済み決定の取り消しは削除の二段階確認へ進める。
5. 会話の締めで、当日の`--type decisions --from <今日> --to <今日>`が0件なら会話を読み返す。
   決定候補が1件なら短い段落で確認し、複数件なら箇条書きでまとめて確認する。無ければ「今日は新しい決定はありませんでした」と伝える。確認は1回だけにする。

決定の検出はLLMによるため完全自動ではない。明示保存と締めの拾い漏れ確認の二段構えで補う。
`preferences.md` の「決定の確認」が「都度」なら曖昧な候補をその場で確認する。「まとめて」なら候補を未確認のまま記録せず、
会話の締めで候補を列挙して一括確認する。了承後に各候補を記録し、decidedが0件の日の拾い漏れ確認はどちらでも省略しない。

### 結論のない相談は要点だけ確認する

相談が一区切りし、背景・経緯・固有名詞が今後も役立つため秘書から保存を提案する場合だけ、
`要点を案件メモに残しますか: <短い要点>`と1段落で確認する。同じ話題の了承後だけ実行する。
利用者の明示memory依頼はそのturnで実行する。topic訂正は旧eventを編集・削除せず、訂正前後と理由・不確実性を持つ
新eventとして追記する。逐語ログ、会話全文、外部データ本文は保存しない。

## 4. 保護規則（不変条件・必ず守る）

1. **空で上書きしない**: 中身が空・空白だけの上書きは `guarded-write` が拒否する。「整理して」と言われても、消すのではなく別ファイルに要約を作り、元は残す。
2. **消す前に必ず確認**: 削除は `delete`（`--confirm` なし）でまず「何を消すか」を日常語で見せて**止まる**。ユーザーが「はい消して」と明言したときだけ `--confirm` を付けて実行する。安易に削除を代行しない。
3. **目次を最新に**: 記憶の増減後は目次を必ず追従させる（ヘルパーが実施）。個別ファイルが万一消えても、目次に要点が残っていれば大枠を復元できる。

削除の警告は日常語で、失うものを具体的に伝える。例:
> これから消すのは「7月8日の決めごとメモ」です。消すと元に戻せません。本当に消してよいですか？ 一部だけ残すこともできます。

## 5. 再起動しおり（`_resume.md`）

- 「Claude を再起動してください」と案内する**直前**や、作業を中断するときは、`resume-write` で `_resume.md` に付箋を残す（進行中の作業・次にやること・未確定のこと）。
- 秘書として起動したら、**まず** `resume-check` でしおりの有無を見る（ルーターがこれを最優先で行う）。あれば `resume-read` で読み、日常語で「前回の続き」を提案する。例:
  > おかえりなさい。前回は「企画書づくり」の途中でした。次は「見出しを決める」からですね。始めてよいですか？
- その作業が終わったら `resume-clear` でしおりを閉じる（中途半端に残さない）。

## 6. オンデマンド振り返り

- 「今週を振り返って」「先週を振り返って」はweeklyを段階ロードする。
  読み込む: `${SECRETARY_PLUGIN_ROOT}/skills/weekly/SKILL.md`。
- 週次は毎回、対象週の日次journal原本を直接読み、過去の週次成果物から要約し直さない。
- `MEMORY.md`の上限警告では、退避候補と影響を提示して止まり、別ターンの明示了承後だけ月単位で退避する。
- 自動で `case-NNN` を作ったり `patterns/` に統合したり、decision変更履歴を統合したりしない。

## 7. 節目コミット（自動コミットの一般化）

- 記憶を更新した節目で、`commit` を使って `secretary/` 内をローカルに記録する（日本語メッセージ、何をしたかがわかる粒度）。
- **push はしない**（インターネットには送らない）。現在の会話でユーザーが対象と送信先を含めて「pushして」とその操作を明示した場合だけ実行できる。「共有したい」はpush指示として扱わず、別途確認する。
- コミットメッセージ例: `記憶を更新（企画方針の決定を記録）` / `好みを更新（呼び方の変更）`。

memory本体とjournalが保存済みでlocal checkpointだけ失敗した場合は`partial`と伝える。retryは同じcontent keyを
実fileから確認してcommitだけを行い、memory、journal、indexを増やさない。commit成功後の再retryは全副作用0件とする。

<!-- explicit-memory-request=run-once -->
<!-- content-uncertainty=preserve -->
<!-- retry-after-checkpoint-failure=commit-only -->

## 参照

- 言葉づかいルール（必読）: `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`
- 決定的シームのヘルパー: `node "${SECRETARY_PLUGIN_ROOT}/skills/memory-care/scripts/memory-tools.mjs"`
