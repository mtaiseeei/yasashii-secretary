# Sprint 038 — Harness 0.5.1互換とYasashii Secretary 0.9.1公開

- Type: micro
- Risk: standard（review済み共通candidateのoverlay同期、配布metadata、互換案内、versionだけを更新し、製品機能・workspace schema・外部サービス接続は変更しない）
- 主眼: 公開済みAgentic Secretary 0.9.1を固定したreview済みupstream candidateとしてYasashii overlayへ同期し、Yasashii固有差分を保ったまま、対応HarnessをYasashii Harness 0.5.1へ更新してYasashii Secretary 0.9.1を独立評価・独立公開する。
- 依存: sprint-037 done。Agentic Secretary 0.9.1 merge commit `3a5a6c30ac4ad823b5535d290a46423e8e5d15d6` が独立評価PASS・公開後照合済み。Yasashii Harness 0.5.1 public commit `f50917e3cf9c24b6e4370adba547bd4891c85986` が公開済み。
- 絶対禁止境界: ローカル `<workspace-root>/agentic-harness` はread、list、status、HEAD、branch、remote確認を含め一切対象にしない。

## ユーザー決定とmicro判定

- Agentic側の合格済み完全SHAをreview済みupstream candidateとして使い、Yasashii側で共通実装を作り直さない。
- 変更は1つの配布互換面に閉じる。既存のoverlay、edition、release、archive、Harness互換回帰が自動保護しているため `Type: micro` とする。
- Yasashii固有の言葉遣い、identity、repository、Claude Code／Codex別install ID、manifest、marketplace、README、repo-owned docsをAgentic値へ戻さない。
- SecretaryはHarness本体、custom agent、skills、agents、commands、hooks、runtime script、vendor依存、Harness Git履歴を同梱せず、Harnessを暗黙自動installしない。
- 利用者workspace migration、installed plugin/cache更新、private版更新は行わない。
- 公開済み0.9.0以前のCHANGELOG、manifest fixture、migration、評価記録、Git履歴を遡及変更しない。
- Yasashiiの `upstream` はfetch専用・push disabledを維持し、upstreamへのpushは常に禁止する。

## 外から見える成果

Yasashii Secretary 0.9.1は、Claude CodeとCodexでYasashii Harness 0.5.1を正しい配布IDから案内し、導入済みなら同じHarnessループへ接続する。表示と配布identityは従来のYasashiiのままで、Harness本体やcustom agentはSecretaryへ含まれない。

## Scope

### A. review済みAgentic 0.9.1をoverlay同期する

- 同期元を完全SHA `3a5a6c30ac4ad823b5535d290a46423e8e5d15d6` に固定し、現在baseからのancestry、tree差分、追加・削除・変更pathを確認する。
- 固定candidateがAgentic側で独立評価PASS・公開後照合済みであることと、同期対象がHarness 0.5.1互換・Secretary 0.9.1配布面に限定されることを記録する。
- 全pathをcommon、metadata overlay、anchor overlay、upstream-only、downstream-owned、downstream-fileへ分類し、未分類0件にする。
- review後に限り `secretary-overlay/upstream-base.json` と `secretary-overlay/upstream-tree.json` を同じ固定candidateへ進める。
- 同じcandidateへoverlay check／apply／reapplyを行い、二回目の追加差分0件、repo-owned digest不変を確認する。

### B. Yasashii Harness 0.5.1へ互換参照を更新する

- GitHub read-only結果で `mtaiseeei/yasashii-harness` `main` のversion `0.5.1` と完全commit `f50917e3cf9c24b6e4370adba547bd4891c85986` を確認する。network不可や未観測をonline PASSにしない。
- edition metadata、build skill、README、Claude Code／Codexの導入案内、local互換検査、online互換検査を0.5.1へ揃える。
- Claude Codeは `yasashii-harness`／`harness@yasashii-harness`、Codexも `yasashii-harness`／`harness@yasashii-harness` を正式値として保持し、Agentic側のrepository、marketplace、install IDへ置換しない。
- Harness 0.5.1のcustom-agent経路は対応Harness側の機能として扱う。Secretaryへagent定義やglobal config生成処理を複製しない。

### C. Yasashii Secretary 0.9.1配布面を整合する

- Claude／Codexのplugin manifestとmarketplace、edition設定、正本CHANGELOG、旧raw CHANGELOG互換file、README、公開ガイド、release検査の現行versionを `0.9.1` に一致させる。
- 0.9.1 CHANGELOGは、対応Harnessが0.5.1になったこと、Harnessは別Pluginであること、利用者workspace migrationが不要であることを平易に示す。
- 旧raw CHANGELOGは正本とbyte-for-byte一致させるが、0.9.0以前のentryは書き換えない。
- Agenticのcopy、identity、repository、marketplace、install ID、edition値をYasashiiの公開面へ残さない。

### D. 独立評価と公開

- Generatorは同期・実装・回帰・progress handoffまでを行い、独立EvaluatorのPASS前にreleaseしない。
- Evaluatorは同一candidateに対して機能完全性、動作安定性、回帰なしを各5/5で採点する。1項目でも5未満なら不合格とする。
- 独立Evaluator PASS後、ユーザーが承認済みの範囲でYasashii originへのbranch push、PR、merge、tag／release、公開manifest照合を行う。upstreamへのpushは行わない。

## Non-scope

- Harness本体、custom agent、global agent config、Harness skills／agents／commands／hooks／runtime／vendor／Git履歴の同梱・改造・release。
- Agentic共通実装のYasashii専用再実装、未分類overlay差分、Yasashii固有copy／identity／repository／install IDの削除。
- 利用者workspace migration、既存workspace書込み、plugin install／update、installed cache、private版、他repoへの反映。
- 0.9.0以前のCHANGELOG entry、manifest fixture、migration、評価記録、Git履歴の遡及編集。
- 実OAuth、Repository Secret、GitHub Actions、Chatwork／Google Chat API、チャット本文、資格情報。
- upstream remoteのpush有効化、upstreamへのpush、local `<workspace-root>/agentic-harness` の操作。
- 新しいcollector、統一attestation、approval manifest、外部署名、UI／wizard／workspace schemaの変更。

## Acceptance Criteria

1. Agentic同期元が完全SHA `3a5a6c30ac4ad823b5535d290a46423e8e5d15d6` に固定され、独立評価PASS・公開後照合済みであること、現在baseからの差分、tree、全path分類をreviewした記録がある。
2. `upstream-base.json` と `upstream-tree.json` が同じ固定candidateを表し、overlay check／apply／reapplyが成功する。二回目追加差分、未分類path、anchor不在、allowlist外変更は全て0件である。
3. upstreamのfetch URLはAgentic Secretary、push URLはdisabledのままであり、同期前後でupstream push可能化とupstream writeが0件である。
4. Yasashii固有copy、identity、edition値、repository、Claude／Codex manifest・marketplace、host別install ID、README、repo-owned docsがAgentic値へ戻らず、宣言済み差分以外のcommon pathは固定candidateと一致する。
5. edition metadata、build、README、Claude／Codex導入案内、local／online互換検査がYasashii Harness `0.5.1`、public commit `f50917e3cf9c24b6e4370adba547bd4891c85986`、Yasashii固有repository／install IDに一致する。network不可、誤version、誤commit、誤host ID、missing manifestをPASSにしない。
6. Secretary配布物とGit履歴にHarness本体、custom agent、Harness skills／agents／commands／hooks／runtime／vendor、Harness Git履歴、manifest暗黙依存、自動install処理が0件である。
7. Yasashii SecretaryのClaude／Codex manifest・marketplace、edition設定、正本／旧raw CHANGELOG、README、公開ガイド、release検査が `0.9.1` で一致し、旧raw CHANGELOGは正本とbyte一致する。
8. 0.9.0以前のCHANGELOG entry、manifest fixture、migration、評価記録、Git履歴に遡及変更0件であり、利用者workspace migration、installed cache、private版、他repoの変更0件である。
9. 既存overlay、edition、release、archive、build、local／online Harness互換回帰と本Sprint追加回帰が0 FAILである。online未実行またはnetwork不可はoffline成功と分ける。
10. 独立Evaluatorが同一candidateを機能完全性5/5、動作安定性5/5、回帰なし5/5と採点し、product finding、verification-infra blocker、未検証の必須内部項目が0件である。
11. 公開操作は独立評価PASS後の承認済み範囲だけで行い、Yasashii originのPR／merge／tag／release／公開manifestを同一candidateへ結びつける。upstream push、Secret、Actions、OAuth、実外部API操作は0件である。

## 必須回帰

- overlay check／apply／reapplyとedition境界検査。
- Secretary release、archive、manifest／marketplace、CHANGELOG byte一致、version整合検査。
- build skillとHarness local互換検査。
- GitHub read-onlyのHarness online互換検査。offline結果と別集計する。
- 0.9.0以前の履歴保護、Harness／custom agent非同梱、Agentic identity混入、upstream push disabledの負検査。
- `git diff --check`。

Generatorは実行command、exit、assert／suite集計、同期元／対象candidate、変更path、online観測値、外部操作 `not-run` をprogressへ記録する。

## Evidence safe harbor

- Agentic同期元完全SHA、Yasashii開始HEAD／candidate、ancestry・tree・path分類、overlay check／apply／reapply結果、repo-owned digest。
- Yasashii HarnessのGitHub read-only応答にあるversion、commit、Claude／Codex manifest・marketplace、repository／homepage、host別install ID。
- 0.9.1のmanifest／marketplace／edition／CHANGELOG／README／release検査と、0.9.0以前の履歴保護diff。
- Harness／custom agent非同梱inventory、upstream fetch／push設定、Yasashii固有surfaceの前後digest、Agentic値混入0件。
- 必須回帰のcommand、exit、assert／suite集計、online／offline別結果。
- 独立Evaluatorの3項目スコアとfinding一覧、公開後のmerge commit／tag／release／manifest照合。
- UI変更はないためbrowser操作とscreenshotを必須にしない。
- 上記で十分とし、新しいcollector、統一attestation、approval manifest、外部署名を追加の合格条件にしない。

## External live gate

GitHub read-only確認は外部writeではない。Yasashii originへのbranch push、PR、merge、tag／release、公開後照合は、独立Evaluator PASS後に限り、今回ユーザーが承認したYasashii Secretary 0.9.1公開範囲で実施できる。upstreamへのpush、remote設定変更、Secret、Actions、OAuth、実API、plugin install／update、installed cache、workspace migration、private版更新は許可対象に含めない。
