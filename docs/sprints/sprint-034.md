# Sprint 034 — yasashii-secretary下流overlay

- Type: main
- Risk: high（upstream remote、同期境界、下流公開物）
- 主眼: `agentic-secretary` をfetch専用上流とし、yasashii差分を狭い・宣言的・冪等なoverlayに限定する。
  あわせて、Sprint 032 Patch 002から延期した設定確認の `key=value` 表現改善を
  yasashii固有の表現調整として実施する。
- 依存: sprint-033 done。agenticの共通baseが固定されていること。

## 外から見える成果

yasashii利用者の現在体験は維持され、共通の安全修正を上流から取り込める。edition固有の計画・証跡は互いに混ざらない。

## Scope

- `yasashii-secretary` の `upstream` fetch先を `mtaiseeei/agentic-secretary` とし、push URLを無効化する。
- upstream base、mapping、anchors、metadata allowlist、downstream-owned／downstream-files、sync／regression script。
- overlay対象を共通pluginのyasashii style、共通安全回帰、会話可読性のedition適用、旧raw CHANGELOG等のrelease checkへ限定する。
- `docs/spec/`、Sprint、progress、feedback、evidence、edition固有README／mapping／LICENSEをrepo-ownedとして分類する。
- 二回applyのdigest一致、未分類追加・削除、anchor不在、allowlist外変更、upstream advance警告を検査する。

### 設定確認の `key=value` 表現改善（Sprint 032 Patch 002から延期した確定事項）

設定確認・設定表示の機械的な `key=value` 形式を、yasashii固有の表現調整として読みやすくする。
次の条件をすべて満たす。

- 機械的な `key=value` の羅列を、利用者が読み分けられる表示（項目名の日本語化・段落・箇条書き等）へ改善する。
- 正式なkey名は失わない。内部設定keyは補助表示または詳細として参照できる状態を保つ。
- agenticへ同じ表現制約を強制しない。agenticの技術的に直接的な表示はそのまま維持する。
- 設定値やsecret値を会話へ露出しない。既存のsecret非露出境界を表現改善の理由で緩めない。
- この表現差がyasashii overlayの範囲に収まり、共通本体へ漏れないことを検査する
  edition分離テストを追加する。

## Non-scope

- agentic上流fileの直接編集、upstream push、両repoのdocs統合。
- wizard差分、安全rule緩和、edition switching。
- same-version bootstrap bridge、公開済み `0.7.0` のin-place差替え、version downgrade／equal update。
- 旧0.7.0利用者向けexternal recovery／bootstrapと、未検証の標準live update互換の主張。

## 受入基準

1. originはyasashii、upstream fetchはagentic、upstream pushは無効。指定外remote変更0件。
2. 記録baseがyasashii HEADの祖先で、sync check／apply／再applyが同一結果。
3. overlay許可外のcommon file変更、未分類file、削除、anchor不在、metadata field超過を負テストで拒否する。
4. repo-owned docs／evidenceはsync前後でbyte単位不変。
5. yasashii styleを適用してもcommon safety、wizard、OAuth scope、同期、新規0.8.0導入、equal／downgrade副作用0停止が全て合格する。未検証の旧0.7.0 live updateを成功扱いしない。
6. README／mappingがagentic上流関係、別repo、fetch専用、MIT／単段クレジットを正確に説明する。
7. upstreamとoverlay後のcandidate／latest／manifest／CHANGELOG／ledgerは `0.8.0` で整合し、公開済み `0.7.0` の記録・fixture・履歴はbyte単位で不変である。
8. yasashiiの全会話面が段落・改行・必要な箇条書きを維持し、Chatwork wizardの `Name`／`Secret` 入力案内がagenticと共通である。edition固有の平易さは失われない。
9. 設定確認の `key=value` 表現がyasashiiで読みやすく改善され、正式なkey名を失わず、
   設定値・secret値の会話露出が0件である。agenticには同じ表現制約が強制されず、
   edition分離テストがこの差をoverlay範囲内として確認する。

## 回帰保護

- offline sync／regression、common master、yasashii edition、archive、legacy raw CHANGELOG、新規0.8.0導入、equal／downgrade、反対editionsuiteを実行する。
- upstream tree追加／削除、allowlist外編集、二重overlay、repo-owned docs差分の負テストを実行する。

## 手動・browser証跡

- yasashii会話、診断、3行報告、handoffを実行し、Sprint 029の内容差とSprint 032 Patch 001のMarkdown可読性を維持する。
- 両wizardをdesktop／mobileで操作し、agenticとのDOM／copy／scope parityを記録する。

## External live gate

remote追加／変更、fetch、push URL無効化、GitHub参照、pushはそれぞれ対象を示してユーザーへ再確認する。upstreamへのpushは許可対象にせず常に禁止する。許可なしはlocal fixtureで設計を検証し、実remote gateは `external-live-gate-unavailable` とする。
