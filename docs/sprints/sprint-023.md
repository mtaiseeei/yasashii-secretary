# Sprint 023 — 0.7.0安全性3: OAuth callbackとloopback session保護

- Type: main
- Risk: high（OAuth、Repository Secret、local HTTP）
- 主眼: OAuth callbackを一度限りにし、loopback wizardの状態変更を正当な同一session操作だけに限定し、後始末失敗を隠さない。
- 依存: sprint-022 done。filesystem境界と外部処理timeoutが成立していること。

## 外から見える成果

1. OAuth画面のreloadやcallback再送があっても、認証・Secret登録・初回取得は重複しない。
2. 別Webページからloopback wizardへ勝手に設定変更できない。
3. OAuth取消やSecret削除に失敗した場合、残っているものと次の操作が分かる。

## スコープ

- Google Chat OAuth sessionの `client-ready` から `closed`までを扱う。
- Chatwork／Google Chat wizardの状態変更requestに、同一origin、同一session、正しいContent-Typeを必須化する。
- callback再送、同時再入、完了後アクセス、取消、network断、Secret部分登録を扱う。

## 非ゴール

- Google Chat Markdown履歴とActions run相関はSprint 024。
- Cloud project作成手順やscopeの追加は行わない。
- 外部公開callback serverへ変更しない。

## 受入基準

1. **callback一度限り（C5/C11/C12）**: 同じcode／stateを順次・並行再送してもtoken交換、3 Secret登録、初回取得が各1回以下。
2. **完了後再入（C5）**: connected／failed／closed後のcallbackで状態が巻き戻らず、副作用0件。
3. **部分登録cleanup（C5/C11）**: Secret 1件目／2件目で失敗した場合、作成済み対象を後始末し、残存時は `cleanup-required`で対象名だけを示す。
4. **revoke失敗（C5/C11/C12）**: OAuth revoke失敗、Secret削除失敗、両方失敗を成功と表示せず、再実行可能な次の操作を示す。
5. **Origin gate（C5/C12）**: cross-origin、許可外Origin、必要なOrigin欠落の状態変更requestが副作用0件で拒否される。
6. **session gate（C5/C12）**: session確認値なし／不一致／別sessionのrequestが、設定・Secret・OAuth・履歴・Git変更0件で拒否される。
7. **Content-Type gate（C2/C5）**: JSON状態変更は正しいContent-Typeだけを受け付け、form／text／不正JSONを安全に拒否する。
8. **GET無副作用（C5）**: 静的配信と状態参照以外のGETで設定・認証・cleanupを変更しない。
9. **loopback限定（C5/C11）**: Chatwork／Google Chat serverとOAuth callbackが外部interfaceへbindせず、公開URLを生成しない。
10. **秘密非露出（C5/C11）**: session確認値、OAuth state、認可code、callback URL、tokenがURL、ログ、DOM、screenshot、feedbackへ0件。
11. **browser非回帰（C8）**: 別タブOAuth、popup拒否、タブ閉鎖、同意拒否、再試行、成功後SPACE選択をrunning wizardで完走する。
12. **全回帰（C6）**: Sprint 019／020／020-patch-001／002、Chatwork、全offline／online回帰0 FAIL。

## 評価証跡

- callbackの並列／再送回数とtoken交換・Secret登録・初回取得call count。
- Origin／session／Content-Type／method matrixと全副作用snapshot。
- cleanup全分岐の残存対象、次の操作、秘密非露出scan、browser screenshot。
