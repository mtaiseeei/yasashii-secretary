# Sprint 015 — G6 継続する仕事をプロジェクトにする

## 着手時の契約

- 複数行動・複数セッションを含む候補シグナルが2つ以上ある仕事だけを理由つきで提案し、確認前・拒否・キャンセルでは副作用を出さない。
- 一般PJは同じprivate workspaceの`secretary/projects/<project>/PROJECT.md` 1枚から始める。
- 状態、判断、事実、TODO、成果物、旧版の正本を分け、情報量が増えたときだけ確認後にフル運用へ昇格する。
- 開発依頼は既存buildを維持し、別repo正本ではworkspace側に参照ポインタだけを置く。
- 一般PJの完了・再開は確認後だけ行い、過去の完了記録を保持する。
- Google ChatとChatwork設定画面の変更は本Sprintへ含めない。

## 実装結果

- `skills/projects/SKILL.md`を追加し、候補シグナル、構造化質問、ライト作成、正本境界、昇格、完了・再開、別repo開発PJの対話手順を配布した。
- `scripts/project-tools.mjs`を追加し、次の決定的シームを実装した。
  - 読み取りのみの候補判定、進行中／全PJ一覧、明示参照。
  - 確認後のライトPJ作成、決定＋状態の同時更新、恒久事実、PJ参照つきTODO。
  - 作業文書、確定成果物、確認つき旧版archive。
  - 4種類の昇格トリガー検出と、確認後の5ファイル構成への移行。
  - 別repo開発PJの`AGENTS.md`＋`PROJECT.md`参照ポインタ。
  - 確認後の完了・再開と、完了記録の保持。
- 全更新を`secretary/`内へ封じ込めた。空入力、同名PJ、境界外path、基点／途中symlink、資格情報らしき値を拒否する。
- PJ更新は一時stageから入れ替え、journalまたは索引更新に失敗した場合はPJ変更も元へ戻す。成功時だけjournalへ1回記録し、commit・push・remote変更は行わない。
- `secretary`ルーター、`daily`、`build`、配布`templates/AGENTS.md`へ最小接続した。開発依頼は一般PJへ吸収せずbuildを維持する。
- 新skill追加に合わせ、serializer検査とSprint 011回帰のuser-facing surface数を13 skills／18 surfacesへ更新した。
- READMEのChatwork画像と`docs/assets`はGeneratorでは変更していない。READMEのprojects案内は、承認済み直接修正を保持したままオーケストレーター側で追加された。

## 安全と正本の判断

- 候補判定はLLM判断で完全自動ではないため、対話規約と副作用のない`candidate-check`を組み合わせた。候補検出を作成許可として扱わない。
- `--confirm`は、ユーザーが構造化質問または別ターンで了承した後だけ付ける。tool単体でも確認なしではexit 3となり、ファイル・journalを変更しない。
- 一般PJは`projectType: general`、別repo開発PJは`projectType: development-pointer`で区別し、一般PJ用の更新を開発ポインタへ誤適用しない。
- status欠落はactiveとして扱い、completedを誤って非表示にしない。completedは進行中一覧から外すが、`--all`と`show`では引き続き見つかる。
- フル運用では`AGENTS.md`にStart hereとファイル索引を持たせ、`INDEX.md`を作らない。ファイル保存・archive時は同じ操作で索引と関連リンクを更新する。
- PJ内にsymlinkが1件でもある場合は更新前に拒否し、stageへの複製後にsymlinkをたどる経路を作らない。

## 検証結果

- Sprint 015専用回帰: `bash scripts/sprint-015-regression.sh` → `PASS=58 FAIL=0`。
  - 候補／非候補、確認前0変更、営業・マーケティング・新規事業のライトPJ、同名・空・path・symlink拒否を確認。
  - 決定＋状態、一般memory重複0、PJ参照TODO、PJ内TODO 0、成果物／outputs／archiveを確認。
  - Decisions、メモ、ファイル数、固有ガードレールの4昇格トリガー、拒否0変更、5ファイル移行、索引・リンク整合を確認。
  - 別repoポインタ2ファイル限定、完了・再開、status欠落、journal rollback、timeline再発見、資格情報非保存を確認。
- 全offline回帰: `bash scripts/regression-check.sh`をloopback bind可能な実行環境で実行 → `PASS=298 FAIL=0`。
- Chatwork初回設定回帰: `bash scripts/sprint-013-regression.sh` → `PASS=33 FAIL=0`。
- Chatwork運用回帰: `bash scripts/sprint-014-regression.sh` → `PASS=41 FAIL=0`。
- serializer／settings回帰: `bash scripts/sprint-011-regression.sh` → `PASS=67 FAIL=0`。
- 最終監査回帰: `bash scripts/sprint-012-patch-001-regression.sh` → `PASS=19 FAIL=0`。
- buildのonline参照: `bash scripts/check-yasashii-harness-online.sh` → `REFERENCE_OK`、`ONLINE=PASS repo=mtaiseeei/yasashii-harness`。
- `node --check plugins/yasashii-secretary/scripts/project-tools.mjs`、`python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary`、`git diff --check`は成功した。
- sandbox内の全回帰初回では、既存Chatwork fixtureの`127.0.0.1` bindが`EPERM`になった。loopbackを許可した同じローカル環境で再実行し、上記のとおり全件成功した。実装不具合ではなくsandbox制約だった。

## 起動方法・テストURL

- 常設アプリ／Web UIはないため、起動コマンドとテストURLはN/A。
- 一時fixtureでの主要操作例:

```bash
CC_SECRETARY_NOW=2026-07-17T10:30 \
node plugins/yasashii-secretary/scripts/project-tools.mjs candidate-check \
  --multiple-actions --multiple-sessions

bash scripts/sprint-015-regression.sh
```

## Evaluator向け具体的シナリオ

1. 複数行動＋複数セッション、複数行動＋関係者を候補にし、単発成果物・1 TODO・同一会話完結を候補外にする。
2. ライト作成、決定、昇格、完了、再開、別repoポインタを`--confirm`なしで実行し、ファイル・journal・commit・remote差分0を確認する。
3. 営業・Instagramマーケティング・新規事業の各fixtureを作り、`status: active`、概要、ゴール、成功基準、日付つき現状、要確認、次の入口を確認する。
4. 同名、空入力、`..`、外向きsymlink、PJ内symlink、資格情報らしき値を拒否し、境界外と既存内容が不変であることを確認する。
5. PJ決定を追加し、ライト／フルの判断正本と`PROJECT.md`が同時更新され、一般memoryに決定本文が複製されないことを確認する。
6. PJ参照つきTODOを追加し、`inbox/todo.md`だけが実行タスクの正本で、PJ内`TODO.md`がないことを確認する。
7. 4種類の昇格トリガーを各fixtureで確認し、拒否時不変、承認時に5ファイル、Start here、索引、CLAUDEポインタ、Decisions／メモ移行が成立することを確認する。
8. 作業文書、確定成果物、旧版を定義先へ置き、フル運用では索引と関連リンクが同時更新されることを確認する。
9. 開発依頼がbuildへ進む文言とonline参照を確認し、別repoポインタは2ファイルだけで正本を複製していないことを確認する。
10. 完了後に進行中一覧から外れ、`--all`／`show`／timelineでは見つかること、再開確認後だけactiveへ戻り過去完了記録が残ることを確認する。

## 自己評価

- C1 完成度: 5/5。Sprint契約の候補、ライト、正本境界、4昇格条件、別repoポインタ、完了・再開を一つの決定的シーム群として実装した。
- C2 構文・整合: 5/5。13 skills／18 surfaces、frontmatter、5ファイル構成、索引、参照path、build online導線が整合した。
- C3 機能の実証: 5/5。固定時刻の一時`secretary/`で全操作と副作用を58 assertで実行した。
- C4 非エンジニア体験: 4/5。理由つきの短い確認、正式名称を残した説明、次の入口を配布した。最終的な自然さはEvaluatorの模擬会話で確認する。
- C5 安全・規律: 5/5。確認前0変更、封じ込め、symlink、資格情報、正本重複、rollback、commit／remote非操作を回帰で確認した。
- C6 無回帰: 5/5。専用58件、全offline 298件、Chatwork、serializer、online build参照がすべて成功した。
- C7 やさしさ: 4/5。候補理由を1〜2点に絞り、作成・昇格・完了・再開の選択権を残した。対話の押しつけ感はEvaluatorの独立確認へ渡す。

## 残件・既知の問題

- 実装上の既知失敗はない。
- 候補検出は会話文脈を読むLLM判断であり、完全自動保証ではない。候補基準と確認前副作用0はtool／skill両面で固定した。
- UI変更はないため、browser screenshotとテストURLは評価対象外。EvaluatorはCLIによる実操作と模擬会話を中心に確認する。

## Retry 1 — Evaluator差し戻し対応

### 対応した実装不具合

1. 共通入力検査を強化し、ラベル付き資格情報に加えてGitHub PAT、GitHub fine-grained PAT、GitLab Token、AWS Access Key、Slack Token、credential URL、秘密鍵形式を保存前に拒否するようにした。作成、判断、メモ、TODO、成果物、archive対象path、昇格ガードレール、別repoポインタ、完了、再開の保存入力は同じ検査を通る。
2. `candidate-check [<secretary> <project>]`を追加した。同名のcompleted PJは`eligible: false`・`route: reopen`で再開確認へ送り、active PJは`route: existing-project`で既存PJへ続ける。該当PJがない場合だけ通常の新規候補判定を返す。照合は読み取りのみである。
3. 候補判定の`eligible`を常にbooleanにした。primary signalなし、signal不足のどちらもkeyを省略せず`false`を返す。
4. 配布`projects/SKILL.md`へ、同じ案件名が分かる場合は通常の新規提案より先に既存PJ照合を行う手順と、3つの`route`の扱いを追加した。

### Retry 1 回帰追加

- Sprint 015専用回帰を58件から68件へ拡張した。
- primary signalなし・単一signalで、`eligible` keyの存在、boolean型、`false`をassertした。
- completed→同一案件候補照合→`route: reopen`→明示参照→確認後reopenを一続きで確認し、候補照合前後の全ファイルdigest一致もassertした。
- active同一PJは`existing-project`、未登録案件は`create-project`になる境界を追加した。
- ライトPJの全保存欄で合成GitHub PATを拒否し、project・journalの副作用0をassertした。fine-grained PAT、credential URL、既存PJの主要保存経路、別repoポインタも拒否した。
- 「GitHub PATはGitHub上の安全な保管場所へ保存する」という通常の説明文は許可し、過剰な誤検知を避ける境界を追加した。

### Retry 1 検証結果

- Sprint 015専用回帰: `bash scripts/sprint-015-regression.sh` → `PASS=68 FAIL=0`。
- 全offline回帰: `bash scripts/regression-check.sh` → `PASS=298 FAIL=0`。
- Chatwork初回設定回帰: `bash scripts/sprint-013-regression.sh` → 外側`PASS=33 FAIL=0`、内包fixture`PASS=35 FAIL=0`。
- Chatwork運用回帰: `bash scripts/sprint-014-regression.sh` → 外側`PASS=41 FAIL=0`、内包fixture`PASS=59 FAIL=0`。
- buildのonline参照: `bash scripts/check-yasashii-harness-online.sh` → `REFERENCE_OK`、`ONLINE=PASS repo=mtaiseeei/yasashii-harness`。
- `node --check plugins/yasashii-secretary/scripts/project-tools.mjs`、`bash -n scripts/sprint-015-regression.sh`、`python3 scripts/check-report-schema.py --plugin-root plugins/yasashii-secretary`、`git diff --check`は成功した。

### Retry 1 Evaluator向け再現シナリオ

1. `create-light --overview`へ利用不能な合成`ghp_`形式を渡し、exit 3、project・journal 0変更、値の保存0件を確認する。fine-grained PATとcredential URLでも同じ結果を確認する。
2. 一般文「GitHub PATはGitHub上の安全な保管場所へ保存する」は通常どおり保存できることを確認する。
3. PJをcompletedにした後、`candidate-check <secretary> <project> --multiple-actions --repeated-topic`を実行し、`eligible: false`、`route: reopen`、再開確認文、副作用0を確認する。
4. 同じPJを`show`で明示参照でき、`reopen`は確認前に不変、`--confirm`後だけactiveへ戻り過去の完了記録を保持することを確認する。
5. `candidate-check --deadline --stakeholders`と`candidate-check --multiple-actions`で、`eligible`が省略されずbooleanの`false`であることを確認する。
