# Sprint 028 — 0.7.0最終判定: 自動回帰＋両チャットlive gate＋後始末

- Type: main
- Risk: high（実OAuth、Repository Secret、Actions、remote push、外部後始末）
- 主眼: 同一の0.7.0 release candidateを自動回帰と専用private test workspaceの実サービスで検証し、全後始末完了を配布の正式条件にする。
- 依存: sprint-021〜027 done。F36〜F42、master offline／online、Git archive相当、0.7.0整合、UX／文書がすべて合格していること。

## 外から見える成果

1. 保守者は、0.7.0が自動テストだけでなくChatworkとGoogle Chatの実経路でも動くと確認できる。
2. Actionsが選択した非機密対象だけを取得し、commit・push・pull後検索・再実行の重複0件まで成立する。
3. 評価後にschedule、Repository Secret、対象選択、Google OAuth接続が残らない。

## 開始条件

- ユーザーが専用private test workspace、Chatwork test Token、組織所有test Cloud project、Internal OAuth、非機密test room／space、Secret、Actions、pushを明示許可している。
- 同一release candidateのcommit hashと0.7.0 versionを固定し、Sprint 026 master offline／onlineとGit archive相当が合格している。
- test workspaceはprivateで、秘書、通常project、両チャット設定・workflow・履歴を同じrepoに持つ。

## live gate

### A. Chatwork

- Repository Secret登録、room discovery、選択roomだけの初回取得、3時間schedule相当のActions、commit、push、pull後search found、同条件再実行の重複0件を確認する。

### B. Google Chat

- Internal OAuth、Desktop app、PKCE＋state＋一度限りcallback、3 Secret登録、`SPACE`選択、初回取得、3時間schedule相当のActions、commit、push、pull後search found、同条件再実行の重複0件を確認する。

### C. 後始末

- 両サービスのscheduleを停止し、Chatwork 1件とGoogle Chat 3件のSecretを削除し、room／space選択を解除する。
- Google OAuth grant／tokenを取消し、接続が残っていないことを確認する。
- 取得履歴とtest workspaceは、別の明示確認なしに削除しない。

## 非ゴール

- public配布repoへSecret、workflow、対象設定、履歴を置かない。
- 実業務room／space、DM／グループDM、機密本文を評価に使わない。
- 合成fixture、過去run、片方のサービスだけでlive gateを代替しない。

## 受入基準

1. **事前自動gate（C6/C12）**: 同一commitでmaster offline／online、Git archive相当、Sprint 021〜027専用回帰が0 FAIL、未実行0件。
2. **private single workspace（C5/C12）**: test repoがprivateで、秘書・通常PJ・両チャットを同居させ、チャット専用repo／public remote 0件。
3. **Chatwork接続（C3/C5/C12）**: Repository Secret経由で非機密test roomをdiscoveryし、選択roomだけを取得する。
4. **Chatwork Actions／Git／検索（C3/C12）**: 今回run成功、commit、push、pull後search found、再実行重複0件。
5. **Google OAuth（C5/C11/C12）**: 組織所有Internal OAuth、Desktop app、read-only 3 scope、PKCE＋state、一度限りcallback、3 Secret登録が実経路で成立する。
6. **Google Chat対象境界（C5/C11）**: 選択`SPACE`だけを取得し、DM／group DM／未選択space／添付本文0件。
7. **Google Actions／Git／検索（C3/C11/C12）**: 今回run成功、commit、push、pull後search found、再実行重複0件。
8. **run相関（C3/C12）**: 両サービスで今回dispatchに対応するrun ID／時刻を証跡化し、過去run採用0件。
9. **secret非露出（C5/C11）**: Token、OAuth値、認可URL、callback URL、本文、発言者名がtracked file、Action log、screenshot、feedbackへ0件。
10. **Chatwork後始末（C5/C12）**: schedule停止、`CHATWORK_API_TOKEN`削除、room選択解除を確認する。
11. **Google後始末（C5/C11/C12）**: schedule停止、Google Chat 3 Secret削除、space選択解除、OAuth grant／token取消を確認する。
12. **後始末失敗（C12）**: 1項目でも未完了なら `cleanup-required`で不合格とし、配布可能と宣言しない。
13. **証跡最小化（C5）**: private状態、0.7.0、伏せ字対象、Secret名、run状態、件数、commit hash、push／pull、検索、重複0件、cleanup状態だけを残す。
14. **最終判定（C1/C12）**: 監査指摘High〜Lowの対応表が全件verifiedで、既知失敗・未検証・後始末残り0件の場合だけrelease readinessを `ready` とする。

## 評価証跡

- 同一release candidate commitと自動gateの全結果。
- private状態、Secret名、伏せ字room／space、run ID／時刻／状態、件数、commit、push／pull、検索、重複0件。
- schedule、Secret、選択、OAuth grant／tokenの後始末前後snapshot。
- 監査指摘のHigh／Medium／Low全件とSprint 021〜028受入基準の対応表。
