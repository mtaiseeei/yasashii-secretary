# Sprint 025 — 0.7.0更新配布: version整合とplugin／workspace完全復元

- Type: main
- Risk: high（公開version、既存利用者更新、plugin rollback）
- 主眼: 公開面を `0.7.0`へ揃え、既存 `0.6.0`利用者が安全に更新・再実行・復元でき、Claude配布validatorの必須metadataを満たす。
- 依存: sprint-024 done。配布前の安全・データ保護修正が確定していること。

## 外から見える成果

1. `0.6.0`利用者は、0.7.0の変更・影響・必要操作を確認してから更新できる。
2. 更新失敗時はworkspaceだけでなくpluginも0.6.0へ戻し、主要機能を再確認できる。
3. marketplaceで作者・由来・versionが正しく表示され、validator不一致を配布前に検出できる。

## スコープ

- marketplace、plugin manifest、CHANGELOG、更新診断、最小台帳、0.6.0→0.7.0 migration、公開ガイドのversionを整合させる。
- 0.6.0 fixtureでdiagnosis、protection、dry-run、apply、reload、verify、retry、rollbackを扱う。
- author、MIT、単段クレジット、`forkedFrom`、name、source、versionを配布validatorの必須条件にする。

## 非ゴール

- 0.6.0以前の公開履歴やGit履歴を書き換えない。
- force push、rebase、filter-repoを行わない。
- master suite全体の編成はSprint 026。

## 受入基準

1. **version一致（C2/C10/C12）**: marketplace、plugin manifest、CHANGELOG最新、診断最新版、migration到達版、公開説明がすべて `0.7.0`。
2. **CHANGELOG（C4/C10）**: 0.7.0が対象者、変わること、設定・ファイルへの影響、必要な操作、互換性上の注意を自然な日本語で示す。
3. **0.6.0診断（C10）**: 現在版0.6.0、最新版0.7.0、影響、衝突、復元を読み取り専用で示し、確認だけでは全副作用0件。
4. **migration dry-run（C3/C10）**: 追加・変更・維持対象が本実行と一致し、記憶、一般PJ、チャット履歴・設定、secretを対象にしない。
5. **カスタマイズ保護（C5/C10）**: customized／unknown-baselineは現状維持が既定で、明示選択だけを更新する。
6. **冪等性（C3/C10）**: 同じ0.6.0 workspaceへ0.7.0更新を再実行して追加変更0件、台帳重複0件。
7. **plugin rollback（C10/C12）**: 更新後検証失敗でpluginを0.6.0の同じscopeへ戻し、versionと主要skillを実確認する。
8. **workspace rollback（C10）**: migration途中／検証失敗で管理対象を保護地点へ戻し、利用者の後続commitや既存変更を上書きしない。
9. **部分復元表示（C4/C10）**: plugin／workspaceの片方しか戻らない場合は未完了を示し、実行可能な旧版、scope、操作、確認手順を出す。
10. **validator（C2/C9/C12）**: author、MIT、単段クレジット、`forkedFrom`、name／source／versionの欠落・不正fixtureをすべて拒否する。
11. **archive互換準備（C2）**: version／validator検査がGit履歴に不必要に依存せず、Sprint 026のarchive gateから呼べる。
12. **全回帰（C6）**: Sprint 017／018、配布チャネル非依存、更新、安全、両チャットの既存回帰0 FAIL。

## 評価証跡

- 全version面の一覧とvalidator正負fixture。
- 実0.6.0相当workspaceの診断、dry-run、apply、retry、version、台帳、主要機能。
- plugin／workspace別の失敗fixture、復元前後snapshot、0.6.0再確認結果。
