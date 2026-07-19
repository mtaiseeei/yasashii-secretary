# Sprint 027 — 0.7.0仕上げ: focus、操作領域、公開説明

- Type: main
- 主眼: wizardのkeyboard／touch操作を完成させ、README、onboarding、`.mcp.json`、公開ガイドを0.7.0の現行機能へ揃える。
- 依存: sprint-026 done。機能・version・master gateが確定し、文書が参照する事実が固定されていること。

## 外から見える成果

1. keyboardやスクリーンリーダー利用者は、画面遷移後の現在地をすぐ把握できる。
2. mobileでも主要ボタン、link、details、選択肢を押しやすい。
3. README等を読んだ利用者は、対応済みサービス、更新、同期、0.7.0の現在状態を誤解しない。

## スコープ

- Chatwork／Google Chat wizardの全画面遷移、非同期結果、失敗、キャンセル、再試行、入力中再描画を対象にfocusを定義する。
- primary／secondary button、外部link、summary、checkbox／radioとlabelを44px相当以上にする。
- `.mcp.json`、onboarding skill、README、docs/guideの対応サービス、導線、version、更新、live gate説明を棚卸しする。
- Claude plugin manifestのauthor／由来説明を利用者向け公開面と矛盾させない。

## 非ゴール

- wizardのデザインテーマやstep構成を再設計しない。
- 新しいconnector、同期サービス、OAuth scopeを追加しない。
- live gateの実行はSprint 028。

## 受入基準

1. **画面遷移focus（C8/C12）**: Chatwork／Google Chatの全step、成功、失敗、キャンセル、設定変更後に、新画面のheadingまたはmainへfocusが移る。
2. **入力focus保持（C8）**: 検索入力、選択、details開閉等の同一画面更新で、入力中focusとcaretを不必要に失わない。
3. **スクリーンリーダー（C8）**: focus先のaccessible name、画面名、結果状態が対象サービス込みで分かる。
4. **44px操作領域（C8/C12）**: button、link、summary、checkbox／radio labelの主要操作がdesktop／mobile／200%で44px相当以上。
5. **誤操作防止（C8）**: 隣接hit areaの重なり、横overflow、pointerだけ／hoverだけの操作が0件。
6. **`.mcp.json`整合（C2/C4）**: Microsoft／Notion／Google公式コネクタ、Chatwork／Google Chatの現行対応を正しく説明し、古い「後続対応予定」が0件。
7. **onboarding整合（C2/C4）**: private repo初回push、対応サービス、次の一手が現行導線と一致し、古い版・画面・手順が0件。
8. **README／guide整合（C2/C4/C9/C12）**: 0.7.0、更新、両チャット、Cloud準備、復元、配布前gateを対象読者に応じて正しく説明し、安全同意を削らない。
9. **validator公開面（C2/C9）**: author、MIT、単段クレジット、`forkedFrom`の配布metadataとREADME説明が一致する。
10. **全回帰（C6）**: browser desktop／mobile／200%、copy inventory、master offline／onlineが0 FAIL。

## 評価証跡

- 全画面のactive element、accessible name、遷移前後、input focus保持のbrowser log。
- desktop／mobile／200%のhit area計測とスクリーンショット。
- `.mcp.json`、onboarding、README、guideの現行事実inventoryと古い説明0件scan。
