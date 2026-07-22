# Sprint 035 Patch 001 — 共通チャットwizardの下流同期とIME安全な検索

- Type: regular patch
- Risk: standard（固定済み共通wizard修正の同期と下流回帰に限定し、OAuth、同期、保存schema、外部writeは変更しない）
- 主眼: Agenticで成立したChatwork／Google ChatのIME安全な検索修正を宣言済みoverlayで取り込み、Yasashii固有copy／identityを壊さず同じ操作品質にする。
- 依存: sprint-035 done-by-user-decision。`agentic-secretary` の対応する `sprint-035-patch-001` がPASSし、同期元candidateが固定されていること。

## 背景

Chatwork／Google Chatのwizardは共通coreであり、Yasashiiだけの手修正を持たない。
共有検索入力の修正はAgenticを正本として取り込み、下流では同期境界、IME挙動、edition固有surfaceの不変を独立に確認する。

## 外から見える成果

Yasashii利用者も、両wizardの一覧を日本語IMEと英数字で自然に検索できる。
入力位置や選択済み項目が失われず、画面と案内は従来のYasashiiらしい表現とidentityを保つ。

## Scope

- 固定したAgentic candidateからChatwork／Google Chatの共有wizard assetと必要な共通回帰だけを宣言済みoverlayで同期する。
- composition中の全画面再描画を避け、確定後の絞り込み、focus／caret、checkbox選択保持をYasashii candidateで確認する。
- 日本語IME、英数字、Backspace、途中挿入、検索語全削除を両wizardで扱う。
- overlayを2回適用して追加差分0件とし、未分類asset、anchor不在、allowlist外変更を拒否する。
- Yasashii固有の会話、診断、報告、developer handoff、`key=value`表現改善、identity、manifest、README、repo-owned docsを保持する。
- OAuth、loopback session、Secret非露出、SPACE／DM境界、選択確定、cancel 0変更、responsive／accessibilityを回帰保護する。

## Non-scope

- Agentic共通coreへの別実装、upstream push、下流だけのwizard分岐。
- my-vault固有の接続済み判定、room／space discovery、config／workflow adapter。
- wizard step、可視copy、色、OAuth scope、保存schema、履歴形式、同期scheduleの変更。
- Chatwork API、Google OAuth／API、Repository Secret、GitHub Actions、remote push、release。
- 新しい統一collector、attestation、approval manifest、外部署名の作成。

## 受入基準

1. 同期元がAgenticの合格済みPatch candidateに固定され、共有wizard assetは宣言済み同期結果と一致する。overlayの二回適用で追加差分0件、未分類変更0件である。
2. Chatworkのルーム選択とGoogle Chatの通常スペース選択を、desktop、mobile、200%表示の3条件で実ブラウザ操作し、各条件で検索入力が継続できる。
3. 各wizardで日本語IMEのcomposition開始、変換中の複数input、候補確定を再現し、composition中に検索欄を含む画面全体が再生成されず、未確定文字列とfocusが失われない。確定後は確定文字列で一覧が絞り込まれる。
4. 各wizardで英数字入力、連続入力、Backspace、途中挿入、検索語全削除を行い、入力値、focus、caret位置が意図した位置に保たれ、結果一覧が検索条件と一致する。
5. 検索前に複数のcheckboxを選択し、選択対象が一時的に非表示になる検索と再表示を行っても選択状態が保持される。絞り込みだけで選択解除、重複選択、別項目への選択移動が起きない。
6. 6条件（2 wizard × desktop／mobile／200%）で、横overflow、操作不能、focus消失、未処理例外、console errorが0件である。
7. Agenticとの共有wizard DOM、可視copy、検索・選択挙動、OAuth scope、session／CSRF境界、Secret非露出、SPACE限定、cancel 0変更が一致する。
8. Yasashii固有の会話copy、identity、manifest／marketplace、README、`key=value`表現改善、repo-owned `docs/` の開始前後digestが一致し、Agentic値による上書き0件である。
9. Patch専用IME／検索回帰、既存の両wizard browser回帰、overlay／edition回帰、Yasashii会話回帰が0 FAILである。assertは入力値・composition状態・focus／caret・結果ID・選択IDを検証する。
10. 実Chatwork／Google API、OAuth、Secret、Actions、upstream／origin remote writeは0件で `not-run` と表示し、synthetic／local browser成功をlive接続成功へ読み替えない。

## 評価シナリオ

1. 同期をcheck、apply、再applyし、共有asset一致とedition固有surface不変を確認する。
2. 各wizardで項目を2件以上選択してから、日本語を未確定のまま複数回変換し、確定後の結果と選択保持を確認する。
3. 各wizardで英数字を入力し、caretを文字列途中へ移動して挿入・削除し、値と結果が一致することを確認する。
4. desktop、390px相当mobile、200%表示でTab移動、検索、checkbox操作、全解除、戻る／進むを行い、consoleを確認する。
5. Yasashiiの代表的な会話、診断、3行報告、developer handoff、設定表示を確認し、edition差分が残ることを確認する。

## 証跡のsafe harbor

- 実行command、終了コード、assert数、Agentic同期元commit、Yasashii candidate commit、変更path一覧。
- overlay check／apply／再apply結果、共有assetとedition固有surfaceの開始前後digest。
- 6条件の実URL、DOM操作記録、入力値、compositionイベント順、focus element、selectionStart／selectionEnd、表示結果ID、選択ID。
- desktop／mobile／200%の各wizard screenshot。IME候補window自体の画像化は必須にせず、compositionイベントとDOM状態の記録でよい。
- browser console error件数、横overflow、既存wizard／overlay／edition／会話回帰の結果。
- 上記を満たせば、新しいcollector、統一証跡schema、approval manifest、外部署名を追加の必須条件にしない。

## External live gate

本Patchは固定upstream candidate、local overlay、synthetic fixture、local browserで完結する。upstream／originへのpush、
実Chatwork API、Google OAuth／API、Repository Secret、GitHub Actions、releaseは行わない。
必要になった場合は対象、副作用、cleanupを示した別の明示確認を得る。upstreamへのpushは常に禁止する。
