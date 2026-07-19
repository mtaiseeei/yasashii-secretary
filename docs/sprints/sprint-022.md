# Sprint 022 — 0.7.0安全性2: symlink境界と有限時間の外部処理

- Type: main
- Risk: high（workspace外書込み・削除、外部process）
- 主眼: Node／shellの全主要書込みを許可root内に閉じ、symlink削除で参照先本体を消さず、外部CLI／HTTPを有限時間で安全に停止する。
- 依存: sprint-021 done。Git所有変更とsecret gateが成立していること。

## 外から見える成果

1. workspace内の見かけ上のpathが外部を指していても、外部ファイル／ディレクトリは変更されない。
2. 利用者がworkspace内のsymlinkを削除すると、linkだけが消え、参照先本体は残る。
3. GitHub、Claude、Google、チャットAPI等が応答しない場合も、処理は時間切れとして終了し、後続の危険な操作へ進まない。
4. 確認済みの別repo開発PJをそのrepo自身のworking rootとして開いた場合は、repo内で通常の開発作業を続けられる。

## スコープ

- secret、memory、成果物、一般PJ、更新、Chatwork／Google Chat設定・履歴の書込み、作成、移動、削除を対象にする。
- root自身、途中ancestor、最終要素、未作成最終要素のsymlink境界を扱う。
- 秘書workspaceから別repoへ向くsymlink越しの拒否と、確認済み開発repoをそのrepo自身のworking rootとして開く正常系を区別する。
- 外部CLIと外部HTTPに有限timeout、timeout後の子process停止、未完了表示を求める。

## 非ゴール

- loopbackのOrigin／session防御はSprint 023。
- GitHub Actions runの因果相関はSprint 024。
- UIのfocus／操作領域はSprint 027。

## 受入基準

1. **Node書込み境界（C5/C12）**: root／途中／最終要素の外向きsymlinkで、workspace外の作成・上書き・renameが0件、拒否前の内部部分生成も0件。
2. **未作成path境界（C5）**: 未作成の深いpathでも最深の既存ancestorを基準に外向きsymlinkを拒否する。
3. **shell導線非回帰（C5/C6）**: memory、成果物、PJの既存path guardが同じ敵対fixtureを拒否し、正常pathは成功する。
4. **symlink削除（C5/C12）**: 許可root内のfile symlinkとdirectory symlinkを確認後に削除するとlinkだけが消え、参照先本体と内容が不変。
5. **通常削除（C3/C5）**: 通常ファイル／ディレクトリの2段階確認と境界拒否を維持し、symlink対応で無確認削除を増やさない。
6. **rollback境界（C5/C10）**: 更新・設定の失敗rollbackがsymlinkを辿って外部を復元／削除せず、安全に未完了を示す。
7. **CLI timeout（C3/C12）**: `git`、`gh`、`claude`、`gcloud`のhang fixtureが定義時間内にtimeoutし、後続commit／push／pull／削除0件。
8. **HTTP timeout（C3/C12）**: Chatwork、Google OAuth／Chat API、公式情報取得のhang fixtureがtimeoutし、空結果・成功・存在しないへ誤分類しない。
9. **process後始末（C5）**: timeout後に子process、listener、待機timerが残らず、同じ操作を安全に再試行できる。
10. **別repo開発PJの正常系（C5/C6）**: 同じ外部repoについて、秘書workspace内のsymlinkを経由する書込みは副作用0件で拒否される。一方、ユーザー確認後にそのrepo自身をworking rootとして開いた通常のbuild／開発導線では、repo内の作成・更新・rename・確認後の削除が成功し、workspace側へ正本を複製しない。
11. **既存全回帰（C6）**: 正常なwrite／delete／archive／更新／チャット取得と、Sprint 015で受け入れ済みの別repo開発PJ導線が維持され、全既存回帰0 FAIL。

## 評価証跡

- 外部sentinelのhash・metadataを含むsymlink敵対fixture前後snapshot。
- file／directory symlink削除後のlink不在・参照先不変結果。
- 同じ開発repoを秘書workspace内のsymlink経由で扱った拒否結果と、そのrepo自身をworking rootとして開いた正常な書込み結果の対比。
- 各外部処理のhang、timeout時間、終了状態、後続副作用0件、残process 0件。
