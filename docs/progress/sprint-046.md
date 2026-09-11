# Sprint 046 — 更新migration修正のYasashii適応と `0.13.1` 公開

## 着手時の実装契約

- public Phase A PASS済み `05fcfa31ce5e76639cd1f4f492c1f26f2308c26d` / tree `53a3561c3f5eee68f556df6413aef1f48da6d11c` の共通runtime修正を固定入力とする。
- Yasashiiの実tag `v0.8.0`、`v0.9.0`、`v0.9.1`、`v0.9.2`、`v0.10.0`、`v0.10.1`、`v0.10.2`、`v0.10.3`、`v0.12.0`、`v0.13.0` からtemplate hashと管理節を導出する。
- `0.10.2→0.10.3` をcontent変更なし、`0.10.3→0.12.0` を実Yasashii markerによる管理節更新として構成し、graph全体でoperation IDを重複させない。
- `0.13.0→0.13.1` はcontent write、`changedPaths`、管理file bytes／mtimeを変えない空hopとする。
- pending session回復、rollback、CRLF、改ざん拒否、stale plan、scope／edition／root境界を既存安全条件のまま検証する。
- current release surface、案内、inventory、Windows update jobを`0.13.1`へ因果更新し、Yasashii固有copy、identity、edition marker、overlay、`0.12.0` historical pin、過去release履歴を保護する。

## 成功確認

- focused migration 46 PASS以上／0 FAIL、release 13 PASS以上／0 FAIL。
- Sprint 032 16 PASS以上／0 FAIL、Sprint 038 Patch 003 9 PASS以上／0 FAIL。
- release integrity、Git-free archive gate、collaboration inventory、protected snapshotが0 FAIL。
- exact candidateのWindows update jobをNode 22／Python 3.12／`PYTHONUTF8=1`で完走し、EvaluatorへSHA／tree／artifact digestとともに引き渡す。

## 実装内容

- public固定入力とbyte一致する共通runtimeを適用した。`conversation-migration.mjs`はCRLFとfile modeを保持し、`update-apply.mjs`は有限graph、operation ID一意性、未変更pending sessionの新target回復、rollback所有権を検証する。
- Yasashii実tagのtemplate SHA-256を使用した。`v0.10.1`はAGENTS `146ba636...`／CLAUDE `9a1299a1...`、同内容の`v0.10.2`／`v0.10.3`はAGENTS `0bd57ec9...`／CLAUDE `d1d60ccc...`、`v0.12.0`／`v0.13.0`はAGENTS `03e67fad...`／CLAUDE `3e81d323...`。
- `0.10.2→0.10.3`はempty、`0.10.3→0.12.0`はYasashii markerを使う4 operation、`0.12.0→0.13.0`と`0.13.0→0.13.1`はemptyにした。10 sourceすべてが`0.13.1`へ到達し、graph全体のoperation IDは重複しない。
- manifest、marketplace、CHANGELOG、release／host／collaboration inventory、README／更新ガイド、release／archive validatorを`0.13.1`へ揃えた。既存Windows workflowへNode 22／Python 3.12／UTF-8の専用update jobを追加した。
- Yasashii固有の現行Clarity markerは`yasashii-secretary:clarity-collaboration:workspace-template:v1`のまま保持した。保護snapshot 38 pathと`edition.json`の`secretary-update`、`rules/copy/yasashii.json`、overlayの`0.12.0` pinは変更していない。

## Mac自己検証

- `node scripts/sprint-056-patch-001-migration-test.mjs`: 89 PASS / 0 FAIL。
- `node scripts/sprint-056-patch-001-release-test.mjs`: 13 PASS / 0 FAIL。
- `node scripts/sprint-032-update-gate-test.mjs`: 16 PASS / 0 FAIL。
- `node scripts/sprint-038-patch-003-conversation-migration-test.mjs`: 9 PASS / 0 FAIL、Windows nativeはlocal OSのためNOT-RUN。
- `python3 scripts/check-release-integrity.py --root .`: PASS。
- `validateCollaborationInventory(process.cwd())`: 20 surfaces / 57 cases、digest／marker valid。
- `/private/tmp/secretary-0131-yas-protected.json`照合: 38 PASS / 0 FAIL。
- 重い検査開始前のhost Node数: 28（40未満）。

## 自己評価

| 基準 | スコア(1-5) | コメント |
|---|---:|---|
| 機能完全性 | 5 | 10 source、pending回復、empty hop、release面を実装した。 |
| 動作安定性 | 5 | Macの必須focused回帰はすべて0 FAIL。 |
| デザイン性 | 5 | UI変更なし。既存のやさしい案内構造を保った。 |
| 独自性 | 5 | Yasashii実tagとmarkerからedition差分を導出した。 |
| エラーハンドリング | 5 | partial、改ざん、stale、scope／edition／HEAD／backup不一致を拒否する。 |
| 回帰なし | 5 | 032、038 Patch 003、integrity、inventory、protected面がgreen。 |

## Evaluatorへの引き渡し

- 起動方法: CLI検査のみ。上記4つの`node` commandとrelease integrityをrepo rootで実行する。
- テスト対象URL: なし。
- 回帰チェック: 上記Mac 4 commandを順番に実行する。
- 確認シナリオ: `0.10.3`実tag由来migration、`0.10.1` pending回復→apply→rollback、`0.13.0` empty hop、Yasashii marker、CRLF asset、Git-free archiveを確認する。
- 外部確認待ち: exact candidateのWindows `windows-update-migration` jobと、candidate commitから作るGit-free tar digest／gate。
