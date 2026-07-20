# Sprint 031 — 共通plugin pathと旧CHANGELOG互換

- Type: main
- Risk: high（配布path、全回帰、旧更新URL）
- 主眼: plugin本体を `plugins/secretary/` へ中立化し、旧0.7.0 CHANGELOG URLを壊さず、全回帰・release gateを新pathへ揃える。
- 依存: sprint-030 done。

## 外から見える成果

新しい配布物は中立pathから動き、旧0.7.0の更新診断は従来のURLから最新版CHANGELOGを読める。

## Scope

- `plugins/yasashii-secretary/` のplugin本体を `plugins/secretary/` へ移す。
- marketplace／plugin manifest、scripts、tests、archive、master gate、文書参照を新pathへ更新する。
- 旧 `plugins/yasashii-secretary/CHANGELOG.md` を長期互換fileとして残す。
- 新旧CHANGELOGのbyte一致とversion entry一致をrelease gateで強制する。
- edition configから外部plugin IDを解決し、内部pathと外部IDを混同しない。
- 公式Claude plugin／marketplace validator相当を実行し、結果を記録する。

## Non-scope

- agentic別repo作成、yasashii overlay、外部公開。
- `forkedFrom` の推測変更。validatorが変更を要求した場合は証拠を残し、Plannerへ戻す。

## 受入基準

1. 配布plugin本体は `plugins/secretary/` の1系統で、旧pathに実装の重複コピーがない。
2. 旧CHANGELOG fileは完全なCHANGELOG contentを持ち、新正本とbyte-for-byte一致する。
3. 旧0.7.0相当のdiagnoseが旧raw URL fixtureから最新版、変更点、影響を読める。
4. pathをhardcodeしていた全回帰／release scriptが新pathで動き、壊したpath／旧CHANGELOG不一致を検出する。
5. Git checkoutと `.git`なしarchive相当でmaster gateが0 FAIL。
6. 公式validator、MIT、author、単段クレジット、manifest name／source／versionが合格。`forkedFrom` は証拠なしに変更されていない。

## 回帰保護

- `scripts/regression-check.sh`、master offline／onlineの許可不要部分、archive gate、Sprint 015〜030の必要suiteを実行する。
- `rg`だけでなく実manifest load、plugin command起動、更新diagnoseを新旧pathから検査する。

## 手動・browser証跡

- local pluginを新pathから読み、主要skillと両wizardを起動する。
- desktop／mobileで両wizardの主要画面とcopy不変、focus、44px操作領域を確認する。

## External live gate

remote raw URLのread-only確認は許可された範囲だけで行う。実plugin install／update、remote変更、push、公開は行わず、必要時は操作ごとの明示許可を求める。liveの0.7.0直接更新はSprint 032で行う。
