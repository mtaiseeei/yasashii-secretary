# Sprint 028 Generator progress

## 結論

- 新しいrelease candidateは `bd23a8ad68c52765c9d7d630bdb0bd7212908a5a`（branch `codex/harness-v042-migration`、0.7.0）で固定済み。このcommitはSprint 026のarchive fixture限定修正を含み、同branchへpush済みである。EvaluatorはこのhashだけをSprint 028のcandidateとして扱う。
- 製品runtime本体は変更していない。release candidateに含まれるGeneratorの実装変更は `scripts/sprint-026-release-gate-test.mjs` のarchive fixture構築だけで、Generator正本としてこのprogress handoffを新candidateへ更新した。
- Generatorが自己検出したSprint 026 archive fixtureの実FAIL 1件は、新release candidateで修正済み。修正後はSprint 026が `21/0`・wrapper `3/0`、Sprint 027がcopy `66/0`・browser expression `6/0`・wrapper `5/0`、archive相当がassertions `81/0`でPASSした。一方、実行環境のloopback制限による未実行項目は残る。受入基準1・14を満たさないため、release readinessは引き続き`ready`ではない。
- 実サービスlive gateはEvaluator専用とし、GeneratorはChatwork／Google API、OAuth、Repository Secret、Actions dispatch、remote pushを実行していない。
- runtime targetはstrong tierのSol/highだが、role別model／effortの適用とlaunch metadataを確認できないため、実起動modelは`unverified`。

## 自動gate用の隔離fixture

- original repoのtracked一覧は列挙せず、明示allowlistだけを`git archive`で `/private/tmp` 配下の隔離checkoutへ展開した。
- allowlistは `.claude-plugin`、`.harness`、`plugins`、`scripts`、`README.md`、`AGENTS.md`、`CLAUDE.md`、`docs/spec`、`docs/sprints`、`docs/progress`、`docs/feedback`、`docs/guide`、`docs/assets`、`docs/harness-guidance.md` とした。
- `docs/evidence`はallowlistに含めず、参照・変更・stageしていない。
- original repoで未stageの`LICENSE`は参照・変更・stageせず、fixtureには元ファイルと無関係な合成MIT文面を置いた。そのため、下記archive gateは元の`LICENSE`本文そのものを検証した結果ではない。
- Sprint 025の初回実行は、合成`LICENSE`に期待されるcredit文字列が不足して1 FAILだった。fixtureだけを補正して再実行し、25/25 PASSとなった。製品側の失敗ではない。

## 事前自動gate結果

| 対象 | 結果 | 記録 |
|---|---|---|
| Sprint 021専用回帰 | PASS | `PASS=71 FAIL=0`、wrapper `8/0` |
| Sprint 022専用回帰 | PASS | `69/0`、wrapper `8/0` |
| Sprint 023専用回帰 | BLOCKED | dynamic security検査が `listen EPERM: operation not permitted 127.0.0.1` で停止。構文検査は通過したが、専用回帰全体は完了していない |
| Sprint 024専用回帰 | 未実行 | wrapperが同じloopback実行面に依存するため、Sprint 023の環境block後に続行しなかった |
| Sprint 025専用回帰 | PASS | fixture補正後 `25/0` |
| Sprint 026専用回帰 | 修正後PASS | 修正前 `20/1`・wrapper `2/1`。限定修正後 `21/0`・wrapper `3/0` |
| Sprint 027専用回帰 | PASS | copy `66/0`、browser expression `6/0`、wrapper `5/0` |
| Git archive相当 | PASS（制約あり） | `mode=archive status=pass`、suites `9`、required/passed/failed `3/3/0`、assertions `81/0`。`TMPDIR=/private/tmp`を明示。元の`LICENSE`本文は対象外 |
| master offline | 未実行 | Sprint 023と同じloopback制限が既に再現し、sandbox外実行の承認も得られなかったため未完了 |
| master online | 未実行 | offlineの開始条件が未成立で、認証preflightも不合格のため未実行 |

### Sprint 026 archive fixtureの実FAIL（修正済み）

- `scripts/sprint-026-release-gate-test.mjs` はarchive fixtureへ `.claude-plugin`、`plugins`、`scripts`、`LICENSE`、`README.md`だけをコピーする。
- 現在のarchive master gateはSprint 027も実行し、`scripts/sprint-027-copy-test.mjs`は`docs/guide/*.md`を必須入力として読む。
- そのため旧release candidateではSprint 026の `master gate runs archive-compatible suites` がFAILした。回帰fixtureと現行master gateの不整合であり、製品runtime本体のFAILではない。
- この実FAILはGeneratorの自己検出として記録し、同じSprint 028内で次の限定修正を行った。修正は新release candidate `bd23a8ad68c52765c9d7d630bdb0bd7212908a5a` に含まれている。

### Sprint 026 archive fixtureの限定修正

- `scripts/sprint-026-release-gate-test.mjs` の `fullArchive` 構築へ、現行のarchive-compatible suiteが必須入力とする `docs/guide` だけを追加した。
- `docs` 全体はコピーせず、公開guide以外の文書や監査証跡はfixtureへ追加していない。テスト削除、assert削除、閾値緩和、master gate変更は0件。
- コメントは、明示配布ディレクトリに加えてarchive-compatible suiteが必要とする公開guideだけを含む実態へ合わせた。

### 限定修正後の再確認

- original repoの `LICENSE` を読まず、明示allowlistの `.claude-plugin`、`plugins`、`scripts`、`README.md`、`docs/guide` だけから `/private/tmp` の隔離fixtureを作り、fixture専用の合成MIT文面を置いた。
- parser fixture用の一時Git checkoutで `node scripts/sprint-026-release-gate-test.mjs` を実行し、`SPRINT026_GATE_PASS=21 SPRINT026_GATE_FAIL=0`。
- 同じ隔離checkoutで `bash scripts/sprint-026-regression.sh` を実行し、wrapper `3/0`。内包する専用fixtureも `21/0`。
- 同じ隔離checkoutで `bash scripts/sprint-027-regression.sh` を実行し、copy `66/0`、browser expression `6/0`、wrapper `5/0`。
- 一時 `.git` を除去した同じ明示allowlist fixtureでarchive gateを実行し、archive validator `8/0`、required suites `3/3`、assertions `81/0`、`RELEASE_GATE mode=archive status=pass`。
- 上記限定修正はcommit `bd23a8ad68c52765c9d7d630bdb0bd7212908a5a` として固定し、branch `codex/harness-v042-migration`へpush済みである。記録済みの修正後結果はSprint 026 `21/0`・wrapper `3/0`、Sprint 027 copy `66/0`・browser expression `6/0`・wrapper `5/0`、archive相当assertions `81/0`で全てPASS。Evaluatorはこの同一commitで、未完了のSprint 021〜027全体、master offline／online、archive相当の最終gateを実行する。

### 実行環境block

- loopback listenを使う検査は、隔離fixture内でも `EPERM` となった。
- sandbox外でSprint 023〜027を再実行する申請は承認されなかったため、別手段で制限を迂回していない。
- これは製品FAILと断定する材料ではないが、受入基準が求める「0 FAIL、未実行0件」を証明できないため、最終gateとしては不合格である。

## read-only CLI／認証preflight

- `git`、`bash`、`node`、`python3`、`gh`、`gcloud` は実行可能だった。
- アカウント名やtokenを出力しない形で確認し、`gh auth status`、`gh api user`、`gcloud` active account確認はいずれもexit 1だった。
- したがって、この実行環境からGitHub Actions、private repo、Google Cloud／OAuthを扱う前提は確認できていない。
- canonical docsには既存の専用private test workspaceの正確なrepo名を残していない。Evaluatorは広いprivate repo列挙や実業務workspaceの試行をせず、所有者から正確な対象を再確認する必要がある。

## Evaluatorへの引渡し

### 開始前に解消が必要なblocker

1. 固定済みrelease candidate `bd23a8ad68c52765c9d7d630bdb0bd7212908a5a` をcheckoutし、評価対象hashが一致することを確認する。
2. loopback listen可能な評価環境で、master offline／onlineとSprint 021〜027専用回帰を同一commitに対して0 FAIL・未実行0件にする。
3. 正確な専用private test repo、非機密test room／space、組織所有Internal OAuth Desktop appを、値を証跡へ書かずに再確認する。
4. GitHubとGoogle Cloudのread-only auth preflightを通す。

上記が未解消の間は、Repository Secret登録、OAuth認可、Actions dispatch、remote pushを開始しない。

### 自動gate解消後のstart checklist

- candidate hash、0.7.0、private状態、single workspace構成を確認する。
- Chatwork test Token、Google Chat read-only 3 scope、非機密test room／`SPACE`、Actions、pushに対する明示許可の有効範囲を再確認する。
- 開始時点でschedule 0、Repository Secret 0、対象選択0、Google OAuth接続0であることを確認する。
- 今回dispatchのrun IDと時刻を記録できるようにし、過去runを採用しない。

### live gateで確認する順序

1. Chatwork: `CHATWORK_API_TOKEN`をRepository Secretへ登録し、room discovery、選択room限定取得、3時間schedule相当のActions、commit、push、別checkoutでpull後search found、同条件再実行の重複0件を確認する。
2. Google Chat: Internal OAuth Desktop app、PKCE＋state、一度限りcallback、read-only 3 scope、Google Chat 3 Secretを使い、選択`SPACE`限定取得、Actions、commit、push、pull後search found、再実行の重複0件を確認する。
3. 各runは今回dispatchのrun ID／時刻と対応付ける。Token、OAuth値、認可／callback URL、本文、発言者名はlog、screenshot、tracked file、feedbackへ残さない。

### cleanup checklist

- Chatwork／Google Chat両方のscheduleを停止する。
- `CHATWORK_API_TOKEN`とGoogle Chat 3 Secretを削除する。
- room／space選択を解除する。
- Google OAuth grant／tokenを取消し、接続0を確認する。
- 実行中runが残っていないことを確認する。
- 取得履歴と専用test workspaceは、別の明示確認なしに削除しない。
- 1項目でも未完了なら`cleanup-required`で不合格とし、`ready`と記録しない。

## 起動・再確認コマンド

- 固定release candidateのcommit確認: `git rev-parse HEAD`（期待値: `bd23a8ad68c52765c9d7d630bdb0bd7212908a5a`）
- 専用回帰: `bash scripts/sprint-021-regression.sh` から `bash scripts/sprint-027-regression.sh`
- master gate: `bash scripts/master-release-gate.sh --mode offline`、`bash scripts/master-release-gate.sh --mode online`
- archive相当: `TMPDIR=/private/tmp bash scripts/master-release-gate.sh --mode archive --root <explicit-allowlist-archive>`

## 安全境界

- 実Chatwork／Google API、Google OAuth、Repository Secret、GitHub Actions dispatch、remote pushは0件。
- このhandoff更新作業でtarget repoのgit add／commit／pushは0件。Git indexへ触れていない。archive fixture限定修正そのものは、事前にrelease candidate commitとしてpush済みである。
- `docs/evidence`とoriginal `LICENSE`には接触していない。
- 実装差分はSprint 026のarchive fixture構築だけで、製品runtime本体、テスト件数、合格閾値は変更していない。
- state、spec、Sprint契約、feedbackは変更していない。
