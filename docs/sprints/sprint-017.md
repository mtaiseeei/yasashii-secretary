# Sprint 017 — G8前半 読むだけで分かる更新基盤

- Type: main
- 主眼: 配布版の整合、利用者向け変更説明、最小台帳を整え、「最新版にして」と頼まれても最初は何も変更せず、現在版・最新版・影響・衝突可能性を安心して判断できるようにする。
- 依存: sprint-016 done。配布チャネル非依存、MIT・単段クレジット・`forkedFrom`、既存機能と安全境界が全回帰で保護されていること。

## 外から見える成果

1. 利用者は自分の現在版と利用可能な最新版を確認できる。
2. CHANGELOGを読むと、誰に何が変わり、設定やファイルへ影響するか、必要な操作が分かる。
3. 「最新版にして」と頼んでも、最初は説明だけで、plugin、workspace、Git、設定は変わらない。
4. 自動更新を使える場合は、利点・注意点・利用者自身が行う設定方法が分かる。
5. 将来の更新判断に必要な最小情報だけを持ち、記憶、会話、私的内容、secretは台帳へ保存しない。

## スコープ

### A. versionとCHANGELOG

- marketplaceとplugin manifestのversionを同じ公開版へ揃え、不一致を配布前の機械検査で拒否する。
- 利用者向けCHANGELOGを版単位で持ち、「対象者」「変わること」「設定・ファイルへの影響」「必要な操作」「互換性上の注意」を平易に示す。
- CHANGELOGの最新公開版とmanifest versionが対応し、存在しない版や未公開の説明を最新版として見せない。

### B. 配布済み管理ファイルの最小台帳

- 管理対象path、導入済みversion、配布時の基準hash、明示的に許可した非機密のテンプレート変数だけを台帳項目とする。
- ファイル本文、差分本文、記憶、会話、成果物、外部データ、Chatwork本文、API Token、password、secret、資格情報、私的内容は保存しない。
- 私的内容になり得るテンプレート変数は値を保存せず、将来の更新時に `unknown-baseline` として確認対象へ回す。
- 新規配布・新規生成時には基準情報を持てるようにするが、更新診断を実行しただけで既存workspaceへ台帳を新設・更新しない。

### C. 読み取り専用の更新診断

- 「最新版にして」「更新ある？」では、現在版、最新版、CHANGELOGの要点、影響する設定・ファイル、必要操作、カスタマイズ衝突可能性を説明する。
- clean、customized、台帳なしを区別し、判定できないファイルを未変更と決めつけない。
- 最新版を確認できない場合は `latest-unverified` として、現在版と確認できなかった理由・次の確認方法を示す。推測で更新可能と報告しない。
- 診断中はplugin更新、workspace書込み、migration、commit、push、設定変更、reload／restartの実行を0件とする。

### D. 自動更新の案内

- 利用環境で自動更新を有効にできる場合、既定状態、利点、注意点、利用者自身が行う操作を説明する。
- 案内を読んだだけ、または「設定して」と明示していない状態で自動更新設定を変更しない。
- 自動更新だけではコピー済みworkspaceファイルが更新されない場合があることを隠さない。

## スコープ外

- pluginの実更新、workspaceファイルの変更、migration、保護commit、rollbackの実行。
- 自動更新設定の変更、reload／restartの実行。
- CHANGELOG以外の新機能追加、既存workspaceへの台帳bootstrap。
- push、remote変更、履歴書換え、force push。
- Google Chat、OAuth、Google Chat同期・設定画面。

## 受入基準

1. **version整合（C2/C10）**: marketplace、plugin manifest、CHANGELOGの公開versionが一致し、不一致、欠落、重複、逆順をfixtureで検出する。
2. **利用者向けCHANGELOG（C1/C4）**: 最新版の対象者、変更、設定・ファイルへの影響、必要操作、注意点を、一般の非エンジニアが内部実装を知らずに判断できる。
3. **最小台帳（C2/C5/C10）**: 許可field以外0件。syntheticな記憶、会話、外部本文、token、password、secret、資格情報、私的値が台帳・ログ・エラーへ0件。
4. **現在版／最新版（C1/C3）**: 同版、更新あり、現在版不明、最新版確認不能を区別し、推測で最新版・更新成功を報告しない。
5. **説明の完全性（C4/C7）**: 「最新版にして」で現在版、最新版、変更点、影響、必要操作、衝突可能性を順に示し、「確認だけ／実更新へ進む」を選べる。
6. **診断副作用0件（C5/C10）**: clean、customized、台帳なし、ネットワーク失敗、拒否、キャンセルの全fixtureで、plugin、workspace、Git、設定、migration、commit、push、reload／restart実行が前後snapshotで0件。
7. **自動更新は案内のみ（C4/C5/C10）**: 有効化の利点・注意点・操作方法とworkspace側の別管理を説明し、設定変更0件。
8. **新規配布時の基準情報（C2/C5）**: 新規生成対象だけが最小台帳の基準を持て、本文・私的内容・secretを含まず、既存workspace診断では台帳を作らない。
9. **既存境界と全回帰（C5/C6/C9）**: 記憶保護、single private workspace、Chatwork、一般PJ、別repo開発PJ、build、配布チャネル非依存、MIT、単段クレジット、`forkedFrom`を維持し、全回帰0 FAIL。
10. **実更新漏出0件（C6/C10）**: plugin update、migration apply、保護commit、rollback実行、workspace上書き、自動pushのコード経路・案内上の実行が0件。

## 評価証跡

- marketplace、plugin manifest、CHANGELOGのversion対応表と不一致fixture結果。
- CHANGELOGを一般利用者として読んだ時の「対象者・影響・必要操作」の確認。
- 台帳field一覧とsyntheticなsecret・私的値の非保存検査。
- 同版、更新あり、現在版不明、最新版確認不能の診断出力。
- clean、customized、台帳なし、拒否、キャンセル前後のplugin／workspace／Git／設定snapshot。
- 自動更新案内と設定変更0件の証拠。
- 実更新漏出0件と全回帰のPASS／FAIL集計。

## 参照

- `docs/spec/features.md` F30
- `docs/spec/constraints.md` 更新の安全境界
- `docs/spec/domain.md` 更新の状態モデル
- `docs/spec/ui.md` 更新の対話導線
- `docs/spec/rubric.md` C1/C2/C4/C5/C6/C7/C9/C10
