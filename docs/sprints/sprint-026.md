# Sprint 026 — 0.7.0回帰: portableなmaster release gate

- Type: main
- 主眼: 受入済みの必要回帰を1つのmaster gateから実行し、Git checkoutと `.git`なしGit archive相当の両方で配布物を検証できるようにする。
- 依存: sprint-025 done。0.7.0 version、migration、validatorが確定していること。

## 外から見える成果

1. 保守者は1つのmaster commandで、配布前の自動回帰の合否と失敗suiteを確認できる。
2. project管理とGoogle Cloud準備を含む受入済み機能が、実際に実行されたことを証跡で確認できる。
3. GitHubのsource archive等、`.git`がない配布物でも実行可能な検査が正常に動く。

## スコープ

- master offline suiteへSprint 015、Sprint 020 Patch 002、F36〜F41の専用回帰を含む必要suiteを実行順つきで登録する。
- 子suiteの開始、終了、assert数、PASS／FAIL、未実行を集約し、1件の失敗または未実行で非ゼロ終了する。
- Git checkout専用検査とarchive対応検査を区別し、archiveではmanifest、参照、配布ファイル、secret、version、validator等の検査を実行する。

## 非ゴール

- live serviceを使う最終gateはSprint 028。
- UI／文書の残りはSprint 027。
- 過去のprogress／feedbackを編集しない。

## 受入基準

1. **Sprint 015実行（C6/C12）**: master gateからproject候補、ライト／フル、完了／再開、資格情報拒否のSprint 015 suiteを実行し、存在確認だけで終わらない。
2. **Patch 002実行（C6/C11/C12）**: master gateからGoogle Cloud準備、途中再開、一体型wizardのSprint 020 Patch 002 suiteを実行する。
3. **新規hardening（C5/C6/C12）**: Sprint 021〜025のsecret、Git、symlink、timeout、OAuth、marker、run相関、0.7.0更新・rollbackの専用回帰を実行する。
4. **失敗集約（C6）**: 子suiteのFAIL、signal終了、未実行、timeoutをmaster FAILとし、最後の成功で上書きしない。
5. **実行証跡（C3/C6）**: suite名、開始／終了、assert数、結果、合計を機械可読・人間可読の両方で確認できる。
6. **Git checkout（C2/C6）**: checkoutではGit履歴・tracked母集団を含む全対象gateが0 FAIL。
7. **Git archive（C2/C12）**: `.git`なしのarchive相当で対応gateがPASSし、Git履歴専用項目は理由つきで分離され、全体の偽PASSに使われない。
8. **version／validator（C2/C9）**: archiveでも0.7.0、author、MIT、単段クレジット、`forkedFrom`、source、参照実在を検査する。
9. **online分離（C2/C6）**: network不可をonline PASSにせずoffline／onlineの結果を分ける。
10. **全回帰（C6）**: master offline／onlineの既知失敗0件、未実行0件。

## 評価証跡

- masterのsuite inventory、実行順、各assert数、合計、終了コード。
- 意図的FAIL／未実行／timeout fixtureがmasterで失敗する負テスト。
- checkoutと生成したarchive相当の両方の実行結果、対象／除外理由。
