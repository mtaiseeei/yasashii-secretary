# Sprint 029 — edition分離準備: rule境界と可変copy集約

- Type: main
- Risk: medium
- 主眼: 現行の動作と表示を変えず、安全・証拠・文体ruleを分離し、edition差分を入れられる4面のcopyだけを集約する。
- 依存: sprint-028 done。`docs/spec/editions.md` が正本化されていること。

## 外から見える成果

利用者の会話、wizard、更新、同期は従来どおり動く。保守者は「変更してはいけない安全契約」と「editionで変えられる表現」を別々に確認できる。

## Scope

- `rules/plain-language.md` の内容を、安全、証拠、共通表現、yasashii styleの責任へ分ける。
- 会話、診断、報告、developer handoffのedition可変copyを宣言的な1か所へ集約する。
- 現在のyasashii文言を新しい参照経路から使い、出力を変えない。
- 安全ruleがstyle ruleより優先され、styleから上書きできない検査を追加する。
- Chatwork／Google Chat wizard copyをinventoryで除外し、common by designとして固定する。

## Non-scope

- edition ID、marker、ledger schema、path移動、agentic文体の実装。
- wizard copy、OAuth、同期、skill／command名、workspace構造の変更。
- 外部repo、remote、push、公開。

## 受入基準

1. 安全・証拠・styleの参照関係と所有者が機械的に検査でき、循環・欠落0件。
2. edition可変copyは4面だけ。wizardのheading、body、label、CTA、error／success copyは含まれない。
3. 現行の模擬会話、diagnose、報告、developer handoffの観測出力が変更前fixtureと意味・順序・安全情報まで一致する。
4. styleを壊した負テストでも記憶保護、secret、根拠、確認、push境界を弱められない。
5. 既存全回帰、master offline、Git archive相当が0 FAIL。

## 回帰保護

- `scripts/regression-check.sh`、`scripts/master-release-gate.sh --offline`、archive gateを実行する。
- Chatwork／Google Chat wizard copy inventoryのdigestと主要DOM構造が不変であることを追加検査する。
- 3行報告、plain-language、安全ruleの既存模擬会話を再実行する。

## 手動・browser証跡

- desktop／mobileで両wizardの開始、選択、確認、完了／失敗を操作し、Sprint前後の可視copyとfocusに差分0件を記録する。
- yasashii会話、診断失敗、更新前確認、developer handoffを各1件実行し、集約前後の意味と安全情報を比較する。

## External live gate

外部変更は不要。repo作成、remote変更、push、plugin install／update、公開を行わない。これらが必要になった場合は本Sprintを止め、ユーザーへ別途明示許可を求める。
