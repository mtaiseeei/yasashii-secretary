# Sprint 033 — 4環境対応のagentic-secretary完成品

- Type: main
- Risk: high（別directory／GitHub repo、remote、push、4環境への実導入）
- 主眼: 共通祖先と全Git履歴を持つ別repo `agentic-secretary` を、技術者向けにそのまま配布できる
  完成品として成立させる。正式対象4環境（Claude Code Desktop App / Claude Code CLI /
  Codex App / Codex CLI）それぞれで、共通本体＋host adapterの構成により導入・会話・安全境界を
  検証する。
- 依存: sprint-032-patch-002 done。neutralization commit、未配布段階の `0.8.0` release preparation、
  会話可読性・Chatwork Secret入力案内・実会話回帰の安全化・ホスト非依存の共通会話／テスト層が
  合格していること。

## 外から見える成果

エンジニア／AI活用に慣れた利用者が、自分の使うホスト（Claude Code Desktop App、
Claude Code CLI、Codex App、Codex CLIのいずれでも）へ `agentic-secretary` を導入し、
共通の安全性とwizardを保ったまま、技術的に直接的な会話・診断・報告・handoffを使える。
どのホストが検証済みで、どれが未検証かを利用者が正確に読める。

## 正式対象環境

1. Claude Code Desktop App（Claude desktop app内のClaude Code実行面）
2. Claude Code CLI
3. Codex App（macOS）
4. Codex CLI

その他のコーディングエージェントは、共通本体を再利用しやすくする設計対象に含めるが、
公式受入対象・配布保証・実環境検証必須対象には含めない（正本: `docs/spec/editions.md`）。

## Scope

### Repo成立とGit系譜

- `/Users/taisei/workspace/agentic-secretary` の別directoryを、neutralization commitの
  Git履歴から作る。全Git履歴を継承し、1 commitへ潰さない。
- GitHubの別repoは `mtaiseeei/agentic-secretary`。yasashii内のmonorepo／subdirectoryにしない。
- agentic用marketplace／external plugin ID／repository／update／ledger／session／
  commit prefix／Harness設定。
- README／mappingで上流関係、対象ユーザー、共通面、edition差分、4環境の対応状況、
  MIT／単段クレジットを説明する。

### 技術者向け完成品

- 会話、診断、報告、developer handoffのtechnical style。
- Repo分割前に共通実装したMarkdown可読性、Chatwork Secret入力案内、serializer正本構造、
  wizard進捗一貫性を、そのままagenticへ継承する。
- 技術者が追加の手直しなしで導入・利用できる配布状態（3コマンド導入相当の明確な導入手順を
  ホストごとに持つ）。

### 共通本体とhost adapter

- 共通本体（ホスト非依存）: skillsの意味内容、会話ルール、Markdown可読性、edition別style、
  診断方針、完了報告契約、developer handoff契約、安全ルール、workspace境界、secret保護、
  Chatwork／Google Chatデータ処理、wizard本体、OAuth scope、同期境界、
  ホスト非依存fixture・validator。
- host adapter（ホスト固有）: plugin manifest、marketplace／導入経路、plugin root解決、
  skill発見方法、command／slash command、構造化質問UI、更新経路、reload／restart経路、
  ブラウザ検証面、実会話runner、host metadata、インストール検証、official validator。
- 同じ機能を4コピーしない。共通本体の二重実装を負テストで拒否する。

### 4環境それぞれの検証

hostごとに次を確認する。確認方式は正式配布形式（Claude系はplugin manifest／marketplace、
Codex系はconfig.toml／AGENTS.md／skillsの公式面）に従い、公式に存在しない機構を
推測実装しない。

1. hostごとのmanifestまたは正式配布形式の整合（official validatorがあるhostはvalidator PASS）。
2. 新規導入（未導入状態からの導入手順が実際に成立する）。
3. skill／rules読込（共通本体のrules・skillsがそのhostで読まれる）。
4. 基本会話、複雑な一般回答、完了報告、状態報告、診断、developer handoff。
5. wizard起動（Chatwork／Google Chatの共通wizardへの導線）。
6. workspace境界（許可root外への書込み0件）。
7. secret非露出（会話・ログ・証跡への実値0件）。
8. 更新経路の成立、または「このhostでは更新未対応」の安全な明示表示。
9. ホスト固有回帰（そのhost用runner／検証scriptの0 FAIL）。
10. 実環境証跡または公式validator証跡。

### 集計と正直な表示

- 4環境の検証結果を個別に集計する。1環境のPASSを他環境へ流用しない。
- 1環境でも必須項目が未達ならSprint不合格とする（外部準備不足は
  `external-live-gate-unavailable` として実装不具合と区別する）。
- 未対応・未検証の環境を「対応済み」と表示した場合に失敗するnegative testを持つ。

### 共通性の維持

- Chatwork・Google Chat wizardは4環境から同じ共通実装へ到達し、copy・flow・DOMを
  edition・hostで分岐しない。
- OAuth scope・同期境界は全hostで共通。hostによってscopeや同期条件を変えない。
- edition差は会話・診断・報告・developer handoffの4表現面へ限定する既存方針を維持する。
- 4環境すべてでMarkdown可読性（F51）の最低基準を維持する。

## Non-scope

- wizard copy／flow／OAuth scope／同期、skill／command名、workspace root、
  migration filenameのagentic分岐。
- yasashii overlayの実装（Sprint 034）、edition switching、co-installation。
- `forkedFrom` の推測変更。
- same-version bootstrap bridge、公開済み `0.7.0` のin-place差替え、version downgrade／equal update。
- 旧0.7.0利用者向けexternal recovery／bootstrapと、未検証の標準live update互換の主張。
- 4環境以外のコーディングエージェントの受入検証・配布保証。
- 公開release（Sprint 035まで行わない）。

## 受入基準

1. agenticは指定の別directory／別repoで、neutralization commitが両repoのmerge-baseとして
   到達可能。履歴を1 commitへ潰していない。
2. 共通plugin pathは `plugins/secretary/`、外部IDはagentic固有で、yasashii IDの漏れを
   allowlist外で検出する。
3. 技術差分は4表現面だけ。wizard file／DOM／copy、OAuth scope、同期、安全ruleのdigestが
   neutral baseと一致する。
4. technical styleは正式名称、command、path、error、証拠、残課題を示すが、
   確認・secret・根拠規律を弱めない。
5. 共通本体とhost adapterが分離され、manifest・導入・更新・plugin root・実会話runner等の
   host固有部分だけがadapterにある。共通機能の4コピー・二重実装が0件である。
6. 4環境それぞれで「4環境それぞれの検証」1〜10が個別に確認され、hostごとの結果が
   host名・runner名・実行面つきで別集計される。1環境でも必須未達なら不合格。
7. 未対応・未検証環境を「対応済み」と表示しないことがnegative testで確認できる。
8. Chatwork・Google Chat wizardの共通性、OAuth scope・同期境界の共通性が4環境で維持される。
9. agenticの全回帰、archive、official validator（存在するhost分）が0 FAIL。
   LICENSEと単段クレジットが存在する。
10. 外部操作は明示許可されたものだけで、無許可のrepo作成／remote／push／導入／公開が0件。
11. agentic側のcandidate／latest／manifest／CHANGELOG／ledgerが `0.8.0` で整合し、
    旧 `0.7.0` の記録・fixture・履歴を変更していない。同一版とdowngradeは副作用0件で停止する。
12. 全会話面のMarkdown可読性とChatwork wizardの `Name`／`Secret` 入力案内が共通baseから
    継承され、technical styleを保ったまま改行なし平文へ戻っていない。4環境すべてで
    表示崩れなく読める。

## 回帰保護

- neutral baseとagentic treeの差分allowlistを検査する。
- common master suiteとagentic edition suiteを実行し、yasashii用fixtureの反対edition停止も確認する。
- wizard assets、copy inventory、OAuth scope、safety ruleのdigest parityを検査する。
- 共通本体の二重実装検出と、未検証host誤表示のnegative testを実行する。
- host別runner／検証scriptを4環境分実行し、実行できない環境は `unverified`／
  `external-live-gate-unavailable` として集計する。

## 手動・browser証跡

- agenticの会話、diagnose、報告、developer handoffを各hostで少なくとも1件実行し、
  段落・改行・必要な箇条書きのレンダリングとhost・runner記録を確認する。
- Chatwork／Google Chat wizardをdesktop／mobile／200%で操作し、neutral／yasashii基準との
  可視差分0件を記録する。
- 4環境の導入手順を実環境screenshotまたはコマンド証跡で記録する（秘密情報・アカウント名・
  固有IDは伏せ字化する）。

## External live gate

次の各操作は、それぞれ**実行直前**に対象と副作用を示してユーザーへ個別に再確認する。
過去の包括承認だけで実行しない。一部だけ許可された場合はその範囲だけ実行し、
残りは `external-live-gate-unavailable` とする。

1. 別directory `/Users/taisei/workspace/agentic-secretary` の作成
2. GitHub repo `mtaiseeei/agentic-secretary` の作成
3. remote追加
4. remote変更
5. push
6. plugin install（配布形式の実導入全般）
7. Claude Code Desktop Appへの導入
8. Claude Code CLIへの導入
9. Codex Appへの導入
10. Codex CLIへの導入
11. public設定
12. release公開

公開releaseはSprint 035まで行わない。
