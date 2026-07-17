# Sprint 015 評価結果

**初回判定:** 不合格
**初回失敗分類:** `implementation-issue`
**最新判定（Retry 1）:** 合格
**評価対象:** Sprint 015 — G6 継続する仕事をプロジェクトにする
**契約種別:** `Type: main`

専用回帰58件、全offline回帰298件、Chatwork回帰、`yasashii-harness` のonline参照はすべて成功した。一方、独立fixtureで、資格情報を一般PJへ保存できる安全違反と、完了済みPJを同一案件の候補提案から除外できない挙動を確認した。C2・C5・C6はゼロ許容であり、1軸でも閾値未達なら不合格となるため、Generatorへ差し戻す。

## スコア

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 3/5 | 4 | FAIL | 主要なライト／フル／別repo／完了・再開操作は成立したが、受入12・15・16が未達 |
| C2 構文・整合 | 4/5 | **5** | FAIL | JSON自体は有効だが、primary signalなしの候補外結果で `eligible: false` が欠落し、候補判定の構造化出力が入力により不揃い |
| C3 機能の実証 | 3/5 | 4 | FAIL | 固定時刻fixtureの大半は成功したが、completed PJの同一案件相当入力が再び `eligible: true` になった |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | 理由つき確認、次の入口、正式名称を保った説明は理解可能。候補外JSONの欠落は内部構造の問題としてC2で扱う |
| C5 安全・規律 | 3/5 | **5** | FAIL | 一般的なGitHub PAT形式の合成資格情報を `PROJECT.md` へ保存できた。資格情報0件の条件に違反 |
| C6 無回帰 | 4/5 | **5** | FAIL | 既存自動回帰は全成功したが、今回見つかった2件を検出する回帰assertがなく、「既知失敗0件」を満たさない |
| C7 やさしさ | 4/5 | 4 | PASS | 作成・昇格・完了・再開でユーザーの選択権を残し、押しつけや無断着手の文言はない |
| C8 wizard体験・デザイン | N/A | 4 | 対象外 | Sprint 015はUI変更なし。Chatwork画像は直接修正として別枠確認 |

## PASS / FAIL集計

- 受入基準: **PASS=12 / PARTIAL=1 / FAIL=3**
- Sprint 015専用回帰: **PASS=58 / FAIL=0**
- 全offline回帰（loopback利用可能な実行面）: **PASS=298 / FAIL=0**
- Chatwork初回設定回帰: **PASS=33 / FAIL=0**（内包fixture `PASS=35 / FAIL=0`）
- Chatwork運用回帰: **PASS=41 / FAIL=0**（内包fixture `PASS=59 / FAIL=0`）
- `yasashii-harness` online参照: **PASS**
- 独立追加fixture: **PASS=4 / FAIL=3**
  - PASS: PJ参照TODOの追加・持ち越し・完了、フルPJ決定＋状態、フルPJのarchive＋索引、README画像確認
  - FAIL: 合成GitHub PAT形式の保存拒否、completed PJの候補除外、候補外JSONの `eligible` 明示

## 実行コマンドと結果

### 1. Sprint 015専用回帰

```bash
bash scripts/sprint-015-regression.sh
```

- exit 0、`PASS=58 FAIL=0`。
- 候補／非候補、確認前副作用0、営業・Instagramマーケティング・新規事業のライト作成、path／symlink、ライト→フル、別repoポインタ、完了／再開、rollbackを確認した。

### 2. 全offline回帰

```bash
bash scripts/regression-check.sh
```

- sandbox内の初回実行は、Sprint 013・014のloopback bindが `listen EPERM: operation not permitted 127.0.0.1` となり、`PASS=296 FAIL=2`。失敗は2件ともloopback bindだけで、実装assertの失敗ではなかった。
- 同じコマンドをloopback利用可能な許可済み実行面で再実行し、exit 0、`PASS=298 FAIL=0`。
- 環境要因と実装不具合を分離した。今回の不合格理由はこのEPERMではなく、後述の独立fixture 2件である。

### 3. Chatwork回帰

```bash
bash scripts/sprint-013-regression.sh
bash scripts/sprint-014-regression.sh
```

- loopback利用可能な実行面で、Sprint 013は外側 `PASS=33 FAIL=0`・内包fixture `PASS=35 FAIL=0`。
- Sprint 014は外側 `PASS=41 FAIL=0`・内包fixture `PASS=59 FAIL=0`。
- build、Chatwork同期境界、Token入力面不在、schedule、manual sync、設定transactionに新規回帰はなかった。

### 4. `yasashii-harness` online参照

```bash
bash scripts/check-yasashii-harness-online.sh
```

結果:

```text
REFERENCE_OK repo=public,fork=false manifests=consistent metadata=exact
ONLINE=PASS repo=mtaiseeei/yasashii-harness
```

### 5. 構文・serializer・差分検査

```bash
node --check plugins/yasashii-secretary/scripts/project-tools.mjs
python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary
git diff --check
```

- Node構文: exit 0。
- serializer: `SCHEMA_OK owner=rules/plain-language.md surfaces=18 conflicts=0`。
- whitespace error: 0件。

## 独立fixtureの具体結果

### FAIL 1: 一般的な資格情報形式を保存できる

最小の一時 `secretary/` を作り、`create-light` の `--overview` に、実際には利用できないGitHub PAT形式の合成値（`ghp_` prefix＋固定文字列）を渡した。

```text
CC_SECRETARY_NOW=2026-07-17T10:30 \
node plugins/yasashii-secretary/scripts/project-tools.mjs create-light \
  <temporary-secretary> 資格情報確認 \
  --overview <GitHub-PAT形式の合成値> \
  --goal 安全に拒否する --success ファイルを作らない \
  --current 入力検査中 --next 結果確認 --confirm
```

期待値はexit 3、project・journal 0変更。実結果はexit 0で、`projects/資格情報確認/PROJECT.md` が作られ、合成値が本文へ保存された。

原因は `project-tools.mjs` の共通入力検査が `token=...`、`api_key: ...` 等のラベル付き形式だけを見るためである。GitHub PAT等、資格情報そのものに識別prefixがある一般的な形式は検出しない。そのまま `renderLight` へ渡る。受入12とC5の「資格情報0件」に違反する。

### FAIL 2: completed PJを候補検出から除外できない

1. 一般PJ「完了候補」を作成。
2. `complete ... --confirm` で `status: completed` に変更。
3. 同じ案件が複数行動＋繰り返し登場した相当の入力として、候補判定を実行。

```bash
node plugins/yasashii-secretary/scripts/project-tools.mjs \
  candidate-check --multiple-actions --repeated-topic
```

実結果:

```json
{
  "eligible": true,
  "signals": [
    "同じ成果に向けた複数行動",
    "繰り返し登場する同一案件"
  ],
  "question": "この内容は今後も続きそうです。プロジェクトとしてまとめますか？"
}
```

`list` がcompletedを進行中一覧から外すこと、`list --all`／`show`／timelineで明示参照できること、確認後だけreopenすること自体は成立した。しかし候補判定コマンドには `secretary`、project名、既存PJ照合の入力がなく、completed PJを除外できない。配布skillには除外する規約が書かれているだけで、受入16を実証する決定的な経路と回帰assertがない。

### FAIL 3: 候補外JSONで `eligible` が欠落する

```bash
node plugins/yasashii-secretary/scripts/project-tools.mjs \
  candidate-check --deadline --stakeholders
```

期待値は `eligible: false`。実結果は `reason` と `question: null` はあるが、`eligible` keyが存在しない。`primary` が `undefined` になり、`signals.length >= 2 && primary` も `undefined`、その値が `JSON.stringify` で省略されるためである。候補外である意味は読み取れるものの、構造化結果が入力によって不揃いになる。

## 成立した主要操作

- 候補となる「複数行動＋複数セッション」「複数行動＋関係者」と、単一signal／primaryなしの候補外判断。
- `--confirm`なしのライト作成、決定、昇格、archive、別repoポインタ、完了、再開はexit 3でproject・journal・commit・remote差分0。
- 営業、Instagramマーケティング、新規事業の各 `PROJECT.md` は `status: active`、実概要、ゴール、成功の測り方、日付つき状態、要確認、次の入口を保持。
- 同名、空、`..`、境界外symlink、PJ内symlinkを拒否。journal失敗時のproject rollbackも成立。
- 決定と `PROJECT.md` 状態の同時更新、一般memoryへの決定本文複製0。
- PJ参照つきTODOを `inbox/todo.md` へ追加し、持ち越し・完了後もPJ参照を保持。PJ内 `TODO.md` は0件。
- Decisions、メモ、作業ファイル、固有ガードレールの4昇格条件を検出。承認後だけ5ファイル、Start here、索引、CLAUDEポインタを生成。
- フルPJで決定を追加すると `DECISIONS.md` と `PROJECT.md` 状態が同時更新。作業文書をarchiveすると `PROJECT.md` の関連リンクと `AGENTS.md` のroot索引が更新。
- 別repo開発PJは確認後だけ `AGENTS.md` と `PROJECT.md` の2ファイルを作り、仕様・判断・Sprint状態・コード・成果物を複製しない。
- Google Chat、OAuth、外部同期一般化の新規skill／設定／workflow／README案内は配布面に0件。

## READMEのChatwork画像（Sprint合否とは別）

直接修正として次を確認し、問題なし。

- `docs/assets/chatwork-settings-review.jpg` が実在。JPEG 1425×950、SHA-256 `2e750f0c843ae7144e539472a849ffe270aafc7dc627cb248612517ddfaa09ca`。
- `README.md` から `docs/assets/chatwork-settings-review.jpg` を参照。
- `view_image` で、Chatwork設定の確認step、テスト用ルーム名、自動取得の間隔、非公開GitHubリポジトリ、同意checkboxを視認。
- API Token値、password、Repository Secret値、実メッセージ本文は画像にない。画像文字列検査でも資格情報候補0件。
- UI変更ではないため、Sprint 015用browser screenshotは追加していない。

## 受入基準の判定

1. 候補判定: **PARTIAL** — 候補／非候補の主要例は成立。primaryなし候補外で `eligible: false` が欠落。
2. 確認前副作用0件: **PASS**
3. 一般PJライト作成: **PASS**
4. 既存PJ保護: **PASS**
5. PJ決定と状態: **PASS**
6. TODO境界: **PASS**
7. ライト→フル確認: **PASS**
8. フル正本整合: **PASS**
9. 成果物と版管理: **PASS**
10. 開発build維持: **PASS**
11. 別repo開発PJ: **PASS**
12. 記憶・timeline・journal: **FAIL** — 一般的なGitHub PAT形式の合成資格情報をPROJECTへ保存できる。
13. 配布導線: **PASS**
14. スコープ外保護: **PASS**
15. 全回帰: **FAIL** — 既存自動回帰は0 FAILだが、上記2件を保護するassertがなく、独立評価後は既知失敗が残る。
16. 完了と再開: **FAIL** — status、一覧、明示参照、再開は成立。completed PJの同一案件候補除外だけ未成立。

## Generatorへの差し戻し要件

1. project入力の資格情報検査を、ラベル付き `token=...` だけでなく、少なくともGitHub PAT等の一般的な資格情報prefix・credential URL・既存commit前検査との共通境界まで含めて強化する。全project書込入力に同じ検査を通し、合成値でproject・journal 0変更をassertする。
2. 候補判定前に既存PJを照合できる決定的な経路を追加し、同一completed PJなら通常候補提案ではなく再開確認へ送る。completed→候補除外→明示参照→確認後reopenを1本の回帰で保護する。
3. `candidate-check` の `eligible` を常にbooleanで返し、primaryなし・signal不足の両方で明示的な `false` をassertする。
4. 上記修正後、専用回帰、全offline回帰、Chatwork回帰、online参照を再実行する。

## 最終判定

**不合格（`implementation-issue`）。** 仕様の矛盾ではなく、実装と回帰の不足である。資格情報0件はC5のゼロ許容条件、completed PJの候補除外は受入16の必須条件であり、既存回帰が全成功していても合格へ読み替えられない。

---

# Retry 1 再評価

**判定:** 合格
**失敗分類:** なし
**初回不合格の扱い:** 上記の初回評価・再現手順・差し戻し要件は履歴として保持する。

初回に検出した3件を、Generatorの追加回帰とは別の一時fixtureで再現した。資格情報は全保存経路で副作用なく拒否され、同一PJは状態に応じて既存PJまたは再開確認へ送られ、候補外の`eligible`は常にbooleanの`false`になった。受入基準16件とC2・C5・C6のゼロ許容条件を満たしたため、Retry 1を合格とする。

## Retry 1 スコア

| 基準 | スコア | 閾値 | 判定 | 根拠 |
|---|---:|---:|---|---|
| C1 完成度 | 5/5 | 4 | PASS | 受入基準16件がすべて成立。初回未達の受入12・15・16も独立再現で解消 |
| C2 構文・整合 | 5/5 | **5** | PASS | primary signalなし・単一signalの両方で、`eligible` keyが存在しbooleanの`false`。3つの`route`も一貫 |
| C3 機能の実証 | 5/5 | 4 | PASS | active・completed・未登録PJの分岐、全保存経路の拒否、完了／再開を実CLIで確認 |
| C4 非エンジニア体験 | 4/5 | 4 | PASS | completedは再開確認、activeは既存PJ継続へ案内し、重複作成を促さない |
| C5 安全・規律 | 5/5 | **5** | PASS | GitHub PAT、fine-grained PAT、credential URLを保存前に拒否。各拒否操作の前後で全ファイルdigest一致、保存痕跡0 |
| C6 無回帰 | 5/5 | **5** | PASS | 専用68/0、全offline 298/0、Chatwork 013・014、online参照、構文・schema・diff検査が最終的に全成功 |
| C7 やさしさ | 4/5 | 4 | PASS | 通常のGitHub説明文は誤検知せず、確認と選択権を維持 |
| C8 wizard体験・デザイン | N/A | 4 | 対象外 | Sprint 015はUI変更なし。README画像は別枠で再確認 |

## Retry 1 PASS / FAIL集計

- 受入基準: **PASS=16 / FAIL=0**
- Sprint 015専用回帰: **PASS=68 / FAIL=0**
- 全offline回帰: **PASS=298 / FAIL=0**
- Chatwork初回設定回帰: 外側 **PASS=33 / FAIL=0**、内包fixture **PASS=35 / FAIL=0**
- Chatwork運用回帰: 最終2回とも外側 **PASS=41 / FAIL=0**、内包fixture **PASS=59 / FAIL=0**
- `yasashii-harness` online参照: **PASS**
- 独立候補fixture: **PASS=6 / FAIL=0**
- 独立資格情報fixture: **PASS=31 / FAIL=0**
- 構文・schema・whitespace: **PASS**

## 初回3件の独立再現

### 1. 資格情報は全保存経路で副作用なく拒否

専用回帰が使うfixtureとは別に、一時`secretary/`を作って次を実行した。

- `create-light`: project名、概要、ゴール、成功条件、現在、次の入口、要確認事項
- `add-decision`: 決定、現在、次の入口
- `add-note`: メモ
- `add-todo`: TODO、根拠
- `save-work`／`save-output`: title、tags、標準入力本文
- `promote-full`: ガードレール
- `archive-file`: 対象path
- `complete`: 結果、残件
- `reopen`: 理由、次の入口
- `create-dev-pointer`: repo、最初に読むファイル、概要、現在

一般的な合成`ghp_`形式はすべてexit 3になり、各操作の直前・直後で`secretary/`配下の全ファイルdigestが一致した。合成値の保存痕跡も0件だった。`create-light`ではGitHub fine-grained PAT形式とcredential URLも同じく拒否した。

一方、「GitHub PATはGitHub上の安全な保管場所へ保存する」という説明文は保存できた。資格情報そのものを拒否し、通常の説明を過剰に拒否しない境界が成立した。

独立結果は **PASS=31 / FAIL=0**。

### 2. 同一PJは状態に応じた経路だけを返す

`candidate-check [<secretary> <project>]`を一時fixtureで実行し、次を確認した。

- active同一PJ: `eligible: false`、`route: existing-project`、`existingProject.status: active`
- completed同一PJ: `eligible: false`、`route: reopen`、`existingProject.status: completed`、質問は「このプロジェクトを再開しますか？」
- 未登録PJ: `eligible: true`、`route: create-project`
- active・completedの照合前後で全ファイルdigest一致

既存PJが通常の新規提案へ流れる経路はなくなった。

### 3. 候補外でも`eligible: false`を必ず返す

- primary signalなし（deadline＋stakeholders）
- 単一signal（multiple-actionsのみ）

両方で`eligible` keyが存在し、型はboolean、値は`false`だった。独立候補fixture全体は **PASS=6 / FAIL=0**。

## Retry 1 回帰・静的検査

```bash
bash scripts/sprint-015-regression.sh
bash scripts/regression-check.sh
bash scripts/sprint-013-regression.sh
bash scripts/sprint-014-regression.sh
bash scripts/check-yasashii-harness-online.sh
node --check plugins/yasashii-secretary/scripts/project-tools.mjs
bash -n scripts/sprint-015-regression.sh
python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary
git diff --check
```

結果:

- Sprint 015: `PASS=68 FAIL=0`
- 全offline: `PASS=298 FAIL=0`
- Sprint 013: 外側`PASS=33 FAIL=0`、内包`PASS=35 FAIL=0`
- Sprint 014: 外側`PASS=41 FAIL=0`、内包`PASS=59 FAIL=0`
- online: `REFERENCE_OK repo=public,fork=false manifests=consistent metadata=exact`、`ONLINE=PASS repo=mtaiseeei/yasashii-harness`
- schema: `SCHEMA_OK owner=rules/plain-language.md surfaces=18 conflicts=0`
- Node構文、shell構文、`git diff --check`: exit 0

Sprint 014の単独実行では、Retry 1評価中の最初の1回だけ`PASS=40 FAIL=1`になった。要約出力しか保持しておらず、その1件の項目名は確定できなかったため、同じコマンドを直後に2回再実行した。2回とも外側`41/0`・内包`59/0`であり、先に通した全offline回帰内でも同じSprint 014回帰は`41/0`だった。再現する既知失敗はないが、この一過性の観測は履歴として残す。

## READMEのChatwork画像（Sprint合否とは別）

Retry 1でも再確認し、問題なし。

- `README.md` 51行目から`docs/assets/chatwork-settings-review.jpg`を参照
- JPEG 1425×950、SHA-256 `2e750f0c843ae7144e539472a849ffe270aafc7dc627cb248612517ddfaa09ca`
- `view_image`で設定確認画面、テスト用ルーム名、自動取得間隔、非公開GitHubリポジトリ、同意checkboxを視認
- API Token値、password、Repository Secret値、実メッセージ本文は見当たらない

## Retry 1 最終判定

**合格。** 初回の3件はすべて修正され、専用回帰だけでなく独立fixtureでも再現できた。全offline・Chatwork・build参照に再現する既知失敗はなく、Google Chat／OAuthの追加もこのSprintには含まれていない。OrchestratorはSprint 015を`done`へ更新できる。
