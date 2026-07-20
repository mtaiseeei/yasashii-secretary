# Sprint 032 — 未配布段階の0.8.0 release preparation

- Type: main
- Risk: high（release candidate、更新安全性、private test branch）
- 主眼: まだ利用者へ明示配布していない現状を前提に、複雑な旧版bootstrapを追加せず、次の配布候補を `0.8.0` へ最も単純に揃える。
- 依存: sprint-031 done。`0.8.0` として固定した同一release candidateの全offline／archive gateが合格していること。

## ユーザー決定

- `agentic-secretary` と今回の2 edition完成品は、まだ利用者へ明示配布していない。既存利用者向けの複雑なexternal recovery／bootstrapは実装しない。
- 次に配布するcandidate／latestは `0.8.0` とし、現行repoと配布物を直接この版へ揃える。
- `0.7.0` のrelease記録、manifest、migration、fixture、progress／feedback、Git履歴は過去の監査記録として変更しない。
- `0.7.0 → 0.8.0` の実利用workspace向けlive update成功は、今回の配布条件として主張しない。旧scannerで停止した事実をfixture削除、偽fixture、安全scan弱体化で隠さない。
- same-version bootstrap bridge、外部更新復旧導線、公開済みartifactのin-place差替えは作らない。同一versionとdowngradeは副作用0件で停止する。

## 外から見える成果

初回の明示配布に使うplugin、manifest、CHANGELOG、README、migration metadata、配布検査が `0.8.0` で一致する。利用者は複雑な旧版救済手順を経ず、0.8.0を新規導入できる。

## Scope

- marketplace、plugin manifest、正本／legacy CHANGELOG、edition設定、README、公開ガイドを、次に配布する `0.8.0` candidateとして整合させる。
- `plugins/yasashii-secretary/CHANGELOG.md` は長期raw互換fileとして正本CHANGELOGとbyte-for-byte一致させるが、未検証の旧版live update成功を説明しない。
- 新規または未導入状態からの0.8.0導入、neutral marker、edition付きledger、主要skill、Chatwork／Google Chat wizardを検証する。
- `0.8.0 → 0.8.0` と `0.8.0 → 0.7.0` が副作用0件で停止することを維持する。
- すでに実装済みのlegacy session読取やmigrationは、安全性と回帰を損なわない範囲で保持できる。ただし、その存在だけで旧0.7.0利用者のlive update対応済みと表示しない。
- 同一の0.8.0 candidate bytesでcheckout用gateと `.git` なしarchive用gateを完走する。
- Sprint 032で作成済みのprivate test branchは調査記録として保持し、追加のlive update、commit、push、branch削除を行わない。

## Non-scope

- 0.7.0 updaterを使ったGoogle Chat設定済みworkspaceの実更新、plugin＋workspace rollback、再updateのlive成功保証。
- external recovery／bootstrap、same-version bridge、旧scannerの安全境界緩和、既知の標準生成fileをfixtureから除いた偽の合格。
- 公開済み `0.7.0` のmanifest、migration、fixture、CHANGELOG履歴、progress／feedback、Git履歴の書換え。
- agentic repo作成、edition switching、公開release。
- 実業務workspace、実顧客データ、force push、履歴書換え。

## 受け入れ基準

1. marketplace、plugin manifest、正本／legacy CHANGELOG、edition設定、README、公開ガイドのcandidate／latestが `0.8.0` で整合する。
2. `0.7.0` のrelease記録、manifest、migration、fixture、progress／feedback、Git履歴は不変である。legacy CHANGELOGの過去entryも書き換えない。
3. 新規または未導入状態から0.8.0を導入でき、正本plugin path、neutral marker、edition付きledger、主要skillが整合する。
4. Chatwork／Google Chat wizard、安全rule、OAuth scope、同期境界がSprint 031までの合格状態から回帰しない。
5. 同一版 `0.8.0 → 0.8.0` とdowngrade `0.8.0 → 0.7.0` は、plugin、workspace、Git、設定、ledger、migrationへ副作用0件で停止する。
6. 旧scannerがGoogle Chat標準生成fileで停止した事実を保持し、旧0.7.0からのexternal live updateをPASS、対応済み、配布保証のいずれにも数えない。fixture削除、安全scan弱体化、既知pathの広い除外は0件である。
7. checkout用gateと `.git` なしarchive用gateが、同じ0.8.0 candidate bytesで全必須suite 0 FAILになる。repo所有の監査evidenceをarchiveへ混ぜない。
8. private test repoのdefault branchは開始時SHAから不変で、既存test branchへの追加commit／push、Actions、Secret、OAuth、API、公開、branch削除が0件である。
9. 公開面と会話は「未配布段階の0.8.0準備」と「過去0.7.0履歴」を区別し、未検証の標準 `0.7.0 → 0.8.0` live update／rollback／再updateを利用者へ約束しない。

## 回帰保護

- Sprint 017／018／025／030／031、master、archive、secret／Git安全suiteを、0.7.0の歴史的期待値を書き換えず実行する。
- 新規0.8.0導入、candidate version整合、legacy CHANGELOG byte一致、equal／downgrade副作用0を独立した正負回帰で保護する。
- 旧scanner blockerの再現または保持された証跡を、対応済みと誤集計しない回帰を持つ。

## 手動・browser証跡

- 0.8.0の新規導入結果と、同一版／downgrade停止の説明を実会話で確認する。
- Chatwork／Google Chat wizardをdesktop／mobileで操作し、copy／DOM／OAuth scope無回帰を記録する。
- 旧0.7.0 updateの停止を表示する場合は、未配布段階では再導入ではなく0.8.0を初回配布候補にする判断を、未検証の互換保証と混同せず示す。

## External live gate

Sprint 032の追加external writeは不要とする。既存private test branchは削除せず調査記録として残し、read-onlyでdefault branch SHA、test branch SHA、追加操作0件を確認する。追加commit／push、実plugin install／update、Actions、Secret、OAuth、API、公開、branch削除が必要になった場合は、対象と副作用を示してユーザーの新しい明示許可を得るまで実行しない。
