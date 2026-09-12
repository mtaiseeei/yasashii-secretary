# Astra instruction audit — Yasashii Sprint048 / historical Sprint047

## Sprint048 current source監査

current監査の対象は公開Yasashii `0.13.1`、17 Skills、Project Clarity、Secretary Voiceから作る
`0.13.2`候補である。旧Sprint047の`0.10.3`／16 Skills監査は意味上の発見だけを参照し、そのbytes、
件数、PASSをcurrent候補へ流用していない。

正式な限定同期入力は公開Agentic tag `v0.13.2` target
`cd4700c3d541525d00bb69732d7c0f94c11feb37`、tree
`282b7278220fd2acf0e6c8759435c6d6951fa286`。この入力のfresh Phase A／Phase B PASSは固定入力の根拠であり、
Yasashiiの独立評価結果ではない。開始Yasashiiは
`4bf0552200d432320b1ccd8f7365c158970062a2`／tree
`9f1bb13a0cab993572d0b8bf11265f785f4e045f`である。

### 15 seedのcurrent再分類

| 対象 | currentでの処置 |
|---|---|
| 1、2、3、4、11、12、13 | 17 Skills、rules、templates、routerと現在の回帰へ適応。current-first、setup/read、条件付きcontext、settings保存順、版/provenance、Windows-safe rootを修正した。 |
| 5、7、9、10、14 | Harness／root ownerのcanonical最新版を、既存の安全、role、counter、Yasashii identityを残す局所差分としてOrchestratorが適応済み。Secretary productへ検証基盤やstate所有を移していない。 |
| 6 | private my-vault固有surfaceは別owner。Yasashiiへ転記していない。 |
| 8 | Harness／host Hookは別owner。Secretary Hookを変更していない。 |
| 15 | slides／外部資料は別ownerで非該当。 |

追加findingもcurrent sourceで再確認した。現在依頼を任意resumeより先に扱い、接続診断と認可setupを分離し、
setup bookmarkはcapability確認後だけ既存workspaceへ置く。leaf rootはNode `path`で解決する。長いread-only処理は
開始と要所を報告する。明示設定は`pref-set → journal → commit`完了後だけsavedとし、partial retryは未完了effectだけを
再実行する。Yasashiiの文体、identity marker、Clarity、Voice、自由記述とpreferencesは維持した。

### root guidanceの安全な代替と所有外項目

- Agentic側でAGENTSとdocs/harness-guidanceの全面短縮が自動承認reviewに2回拒否された。重要な運用・安全・role・counter規則を大幅削除するため、承認された必要差分の範囲を超えるという理由だった。利用者は全面短縮を不要とし、安全を保持した局所修正を承認した。
- Yasashiiも同じ安全な代替を採用し、既存規則を残したまま、限定的な検証修理、条件付き再読／証拠再利用、micro条件、承認済みcanonical参照、固定Harness0.5.0案内の矛盾を修正。対象はroot AGENTS.md、CLAUDE.md、docs/harness-guidance.md。MacのNode40/60、lock、他PJ非接触、role/counter/model値を保持する。今回依頼に実害ある未修正矛盾の有無は独立Evaluatorが確定する。
- seed13のprivate my-vault model/path・research制約は別ownerで非該当。current表の適応は公開Yasashiiにも関係するhost-neutral root解決に限り、private Skillを追加しない。
- 元repoのroot3pathは開始hashを照合して必要差分だけ重ね、その他の開始dirtyは保持した。Yas元repoはClarity未初期化のためcheckpoint N/A。初期化を今回の合格条件に追加しない。installed private0.13.0とpublic Yas17 Skillsは別editionで、cache編集や実workspace一括更新は行わない。

### current限定同期と検証境界

- public変更plugin path 42件をbyte-equal 10、Yasashii-adapted 31、Agentic-only 1へ排他的に分類し、未分類0件。
- byte-equal 10 pathの共通SHA-256は
  `58d63032f2fcbd5511b879f314270c6ae9f985fbe70d675aeea01d74c60bdc82`。
- protected 17 pathのSHA-256は
  `c3fc2335aeb923f5ae295f1e5c26b6da83c6cc8b18d69b60c8f5a6854c714810`で開始版と一致。
- historical `secretary-overlay/upstream-base.json`の`0.12.0`／
  `767a7f3ecb15c0ffe6d2d8f71529c74bf671c154`と既存provenanceは不変。全量syncを行っていない。
- `0.13.1→0.13.2`は4 operationの内容変更migration。Yasashii `v0.13.1`由来hash／markerを使い、
  preview、apply、rerun、rollback、partial retry、LF／CRLF、mode、自由記述／設定保持を25 caseで確認した。
- Macの変更面はfocused 8/0、migration 25/0、011 73/0、029 25/0、035 15/0、042 20/0、
  Voice 3/0、inventory 20 surface／57 case、frontmatter 17/0、release/archive 13/0。
  generic PyYAMLは依存不足で`INCOMPLETE`、Windows nativeとfresh Yasashii Evaluatorは未実行でありPASSへ数えない。

current candidateの完全commit／tree、Git-free artifact、Windows runはOrchestratorのfreeze後に固定する。
Generatorの詳細receiptと実行入口は`docs/progress/sprint-048.md`を正本とする。

---

## Sprint047 historical監査

監査日: 2026-09-12

対象はこのリポジトリの Yasashii source 0.10.3 と、同版の `plugins/secretary/` instruction、rules、templates、
既存 helper です。対象外の Agentic 0.13.1、Clarity、private my-vault 機能をこの版へ取り込みません。
この文書は seed 15件の処置、追加で見つかった instruction 上の因果、検証範囲を記録します。

## 版・配布物の境界

- **source**: `plugins/secretary/.claude-plugin/plugin.json` の配布版 `0.10.3`、`plugins/secretary/edition.json` の `edition=yasashii-secretary` と同ファイルが記録する Harness baseline `0.5.1` を正本とした。版番号、observed commit、upstream provenance は変更していない。
- **installed**: `/Users/taisei/.codex/plugins/cache/agentic-secretary/agentic-secretary/0.13.0/` は `repository=agentic-secretary-my-vault` の private Agentic 版と確認した。Yas の source や公開版とは混同しない。指定された Codex/Claude の cache 配下には `*yasashii*` を検出しなかったが、全 host の未導入とは断定しない。
- **public**: `gh release view --repo mtaiseeei/yasashii-secretary --json tagName,publishedAt,url,isDraft,isPrerelease` は `Forbidden` (exit 1)、web `releases/latest` は cache miss だったため、公開 latest は未確認である。照会失敗を release 同期済みの根拠にしない。
- **overlay**: `secretary-overlay/upstream-base.json` と `upstream-tree.json` の base commit、accepted/current handoff、historical digest、upstream-tree/provenance は変更していない。今回の local candidate は instruction 適応であり、upstream sync や release-ready を主張しない。変更された local file の現在内容 checksum を将来の候補記録へ反映することは許容されるが、この監査では historical digest を書き換えていない。

## seed 15件の処置

| # | 判定・因果 | 処置と残した理由 | 対象位置 |
|---:|---|---|---|
| 1 | **product / 修正**。起動時に古い `_resume.md` を先に出すと、現在の依頼を止めて別作業の確認を求める。 | 現在の具体的な依頼を先に扱い、依頼が無い／再開指定時だけしおりを読む。別件では既存しおりを上書き・消去しない。 | `plugins/secretary/skills/secretary/SKILL.md` 起動・しおり節、`skills/memory-care/SKILL.md` 5、`rules/conversation-contract.md` 5 |
| 2 | **product / 修正**。明示した単一 reversible 設定に分類確認を重ね、保存報告を journal/commit より先に出すと、実状態と応答がずれる。 | `settings` は明示値を同じ turn で1回適用し、必要な journal/commit 後だけ `saved`。後段だけ失敗すれば実際の保存と未完処理を `partial` とし、retry は未完了処理だけ。memory-care の explicit memory と checkpoint retry 契約も維持。既存の helper の owner transaction/rollback を利用し、runtimeをYasへ新規移植しない。 | `skills/settings/SKILL.md` 途中変更、`skills/memory-care/SKILL.md` 1/7、`scripts/lib/conversation-contract.mjs` |
| 3 | **product / 修正**。接続確認だけの依頼を setup に送り、setupを自動開始すると、read と認可の安全境界が混ざる。 | secretary の routing、connections の状態診断、daily の単回 probe、Google/Microsoft/Notion setup の明示接続トリガーを分離。未確認・未接続・実エラーを分け、診断だけでは setup を自動ロードしない。 | `skills/secretary/SKILL.md` ふりわけ、`skills/connections/SKILL.md`、`skills/daily/SKILL.md`、`skills/setup-*.md` |
| 4 | **product / 修正**。各 leaf が全 rule/preferences を毎回読み直すと、長い読み取りの進捗も最終 serializer も重複する。 | `plain-language.md` を一依頼一回の入口とし、manifest依存を条件付きで解決。安全・証拠 rule は省略せず、preferences は設定変更／個人向け出力時だけ読む。短い Read は無言、複数資料・外部・長い read-only は開始と要所を示す。 | `rules/plain-language.md`、`rules/common-language.md`、`rules/styles/yasashii.md`、`templates/AGENTS.md`/`CLAUDE.md`、全16 skillの共通文 |
| 5 | **verification-infra / 保留（Harness owner）**。verification-infra/spec-issue の分類や独立 Evaluator は Harness の進行契約であり、Yas leaf の product instructionではない。 | root の Harness guidance と既存 dirty guidance を保持し、Yas から新しい collector・attestation・評価器を作らない。 | root `AGENTS.md`、`docs/harness-guidance.md`、`.harness/config.toml`（既存 dirty を保護） |
| 6 | **非該当（private my-vault）**。stale vault-search、schedule routing、private source は Yas 0.10.3 の16 skillに存在しない。 | `vault-search` や Clarity を公開 Yas に追加せず、対象外として記録。 | Yas `plugins/secretary/skills/` に該当なし |
| 7 | **verification-infra / 保留（Harness owner）**。Harness monolith／role ownership は root の loop契約であり、Yasの機能として分割・同期するものではない。 | root guidance に委譲。Yas 側へ Agentic の runtime や最新 role featureを持ち込まない。 | root Harness guidance、Yas `skills/build/SKILL.md` は入口だけ |
| 8 | **非該当（別 host の hooks）**。Claude hooks の導入・認可はこの Yas pluginの16 skillにない。 | hooksを追加せず、hostの既存導入状態を推測しない。 | Yas skill/sourceに該当なし |
| 9 | **verification-infra / 保留（Harness owner）**。小変更の micro patch 判定は Harness workflow の責務であり、今回の指示修正を別の製品機能へ広げない。 | root の小変更ルールを変更せず、Sprint047のinstruction surfaceだけを更新。 | root `AGENTS.md`、`docs/spec/`/`docs/sprints/` は所有境界に従い未変更 |
| 10 | **product + verification-infra / 分離**。leaf間の redundant read chain は Yas の実行指示に現れていたが、state/specを再読する Generator 契約は Harness owner。 | Yas側は shared context と conditional references を修正。Generatorのstate/spec再読契約、state.md は変更しない。 | Yas `rules/plain-language.md`、全16 `SKILL.md`；root generator contract/stateは保護 |
| 11 | **verification-infra / 保留（Harness owner）**。exact string に依存する既存検査は変更時に誤検知し得る。 | 今回のテストは意味・到達性・版境界を確認し、既存の歴史的契約テストは保持して別実行する。文字列だけのテストを実会話や副作用の証拠とは呼ばない。 | `scripts/sprint-047-audit-test.mjs`、既存 `scripts/sprint-029-rule-boundary-test.mjs`/`sprint-035-test.mjs` |
| 12 | **product/provenance / 修正と保留**。source、installed private Agentic、公開 latest の状態を混同すると、版外機能や未確認の同期を事実として案内する。 | edition `0.10.3`、Harness baseline `0.5.1`、historical overlay digestを保持。build は記録済み baseline と実 host capability を区別する。公開照会失敗は未確認として残す。 | `plugins/secretary/edition.json`、`skills/build/SKILL.md`、本監査の版境界・overlay節 |
| 13 | **product / 修正（一部）・Harness host情報は保留**。Bashの親path切出しやcwd推測は Windows／空白path で root を誤る。model/host routing はYasが所有しない。 | 全16 skillの root bootstrap を Node path + resolver成功stdoutの `SECRETARY_PLUGIN_ROOT` 代入へ統一し、失敗・空stdoutで停止。model tier等は root Harness ownerへ残す。 | 全16 `skills/*/SKILL.md` の plugin root 節、`scripts/resolve-plugin-root.mjs` |
| 14 | **verification-infra / 保留（root guidance owner）**。root/PJ guidance は共有正本で、Yas leafから複製・上書きすると所有境界を壊す。 | 既存 dirty `AGENTS.md`/`CLAUDE.md`/Harness guidanceを保護し、Yasの変更は必要な参照・命令だけ。 | root protected files、Yas `skills/projects/SKILL.md`（Node command path quotingのみ） |
| 15 | **非該当（外部資料作成）**。slides／外部文書の相談はこの instruction audit の対象でない。 | presentation skillや外部connectorを追加・呼出ししない。 | Yas sourceに該当なし |

## 追加で確認した因果と変更

- **setupのしおり**: capabilityと既存canonical workspaceのread-only確認を先に行う。workspace未解決時に新規 `secretary/` を作って書込みを迂回しない。認可画面で複数turnになる場合だけ既存workspaceへ任意のしおりを書き、既存しおりを上書きしない。このフロー自身のしおりだけを完了時に閉じる。対象は `skills/setup-google/SKILL.md`、`setup-microsoft/SKILL.md`、`setup-notion/SKILL.md` のステップ0と完了節。
- **接続状態の因果**: tool不可・未実施・結果なしは `未確認`、実コネクタの not-connected エラーだけ `未接続`、許可切れ等の実エラーは `エラー`。dailyは単回probe後もローカルTODOを続け、診断だけでsetupをロードしない。対象は `skills/connections/SKILL.md` と `skills/daily/SKILL.md`。
- **設定の因果**: `pref-set`→journal→commitの順で、全必須処理成功後だけ `saved`。途中失敗は実際の状態を `partial`/`error` に反映する。明示したプリセットや例文を同じturnで再確認しない。対象は `skills/settings/SKILL.md`。
- **内部routeの因果**: 安全に一意解決した接続設定・tool一覧・内部routeは再確認しないが、対象・値・宛先不足、曖昧な依頼、失効pending、自発的memory提案は副作用0の `question` に残す。対象は `rules/conversation-contract.md`。
- **pathと進捗の因果**: root resolverの成功stdoutを代入し、非0／空出力で停止する。短い読み取りは静かに、長い複数資料・外部read-onlyは開始と要所の進捗を示す。対象は全16 skill、`rules/common-language.md`、`rules/styles/yasashii.md`、templates。
- **プロジェクト command path**: spaceを含むplugin rootでも helper pathを一つの引数として渡せるよう、`skills/projects/SKILL.md` の `project-tools.mjs` 呼び出しを引用した。

## Source positions

行番号はこの候補の検査時点（2026-09-12）のもの。後続の文書整形で行が動いても、節見出しを併記したため対象を特定できる。

- current-first／resume: `plugins/secretary/skills/secretary/SKILL.md:45-75`（canonical判定、しおり条件）、`:82-96`（routing）；`plugins/secretary/skills/memory-care/SKILL.md:157-164`（5. 再起動しおり）；`plugins/secretary/rules/conversation-contract.md:68-76`（5. 現在の依頼を優先する）。
- settingsの順序・partial・preset: `plugins/secretary/skills/settings/SKILL.md:47-70`（途中変更の手順と失敗）、`:85-87`（プリセット）。
- setup preflight／bookmark境界: `plugins/secretary/skills/setup-google/SKILL.md:45-59,117-121`、`setup-microsoft/SKILL.md:45-59,118-122`、`setup-notion/SKILL.md:44-58,101-105`。
- connection／dailyの状態因果: `plugins/secretary/skills/connections/SKILL.md:31-44,46-81`；`plugins/secretary/skills/daily/SKILL.md:61-70`。
- shared context／進捗: `plugins/secretary/rules/plain-language.md:5-17,26`、`rules/common-language.md:35-38`、`rules/styles/yasashii.md:46-51,86-87`、`templates/AGENTS.md:1,96-101,143-146`、`templates/CLAUDE.md:19-20`、`templates/memory/preferences.md:3`。
- Node root bootstrap／edition baseline: 全16 `plugins/secretary/skills/*/SKILL.md:11-24`；`plugins/secretary/skills/build/SKILL.md:25-32`；`plugins/secretary/skills/projects/SKILL.md:42-180`。
- historical overlay: `secretary-overlay/upstream-base.json`、`secretary-overlay/upstream-tree.json`（固定JSONの各base／digestフィールド）。`scripts/sprint-047-audit-test.mjs:105-121` が代表digestを照合する。

## 検証と独立 Evaluator への引き継ぎ

`scripts/sprint-047-audit-test.mjs` は静的な source check であり、実会話・外部接続・副作用の証拠とは扱わない。16 skillの root contract、current-first/resume、setup/read routing、settings partial、版境界、historical overlay provenanceを確認する。実際の helper の保存／rollback／Windows path semantics は既存の対象 regressionを別途実行する。

Generatorが実行した結果（すべて `python3 /private/tmp/astra-secretary-heavy.py` 経由）は次のとおり。

- `node scripts/sprint-047-audit-test.mjs` — `PASS=8 FAIL=0`
- `node scripts/sprint-029-rule-boundary-test.mjs` — `SPRINT029_RULE_PASS=25 SPRINT029_RULE_FAIL=0`
- `node scripts/sprint-035-test.mjs` — `SPRINT035_PASS=15 SPRINT035_FAIL=0`
- `node scripts/sprint-038-test.mjs` — `SPRINT038_PASS=67 SPRINT038_FAIL=0`
- `node scripts/sprint-038-patch-002-windows-test.mjs` — `SPRINT038_PATCH002_WINDOWS_PASS=12 FAIL=0 OS=darwin`
- `git diff --check -- plugins/secretary` — exit 0。全体差分の `AGENTS.md:126` 末尾空行は既存のprotected dirtyであり、触れていない。

メイン担当から受け取った別検査として、Ruby/Psych の `/private/tmp/astra-secretary-frontmatter.rb` は Yas の16 skillを `PASS` とした。generic skill の結果 `INCOMPLETE` は別の汎用入力の判定であり、Yas 0.10.3 の失敗件数へ合算しない。Yas 16件の frontmatter 合格と generic INCOMPLETE を同一の版・対象として解釈しない。

実行予定・結果は Generator progress に記録する。独立 Evaluator は、少なくとも次を別に確認する。

1. 既存 `_resume.md` がある状態で新しい具体的依頼を出し、依頼が先に処理され、しおりが変更されないこと。
2. 単一の明示設定、journal/commit失敗後の `partial`、owner-name transactionのrollbackを、実fileとjournal/commit件数で確認する。
3. 接続tool不可／実 not-connected／実許可エラーを分け、診断だけでsetupや新規workspace書込みを始めず、local TODOを返すこと。
4. 空白・日本語を含む disposable fixture pathで resolverと既存 Windows regressionを確認する。
5. Yas 0.10.3の16 skill、Harness 0.5.1の記録値、historical overlayのbase/provenanceを維持し、Agentic/Clarity/private my-vault機能が漏れていないこと。

保護確認としてメイン担当が `/private/tmp/astra-secretary-baseline.json` と比較し、Agentic 1,483 files、Yas 4 filesの既存baseline hashesがすべて一致した。本作業もその保護対象へ書き込んでいない。

この監査は release-ready sync の判定を行わない。公開 latest未確認、host capability未確認、historical upstreamとの差分はそのまま残る。

## 独立評価後の局所修正（2026-09-12）

- 状況: `plugins/secretary/skills/secretary/SKILL.md:74` に旧「3. 再起動しおり」が残り、正本 `skills/memory-care/SKILL.md` の「5」と不一致。初回独立評価はAC5のproduct findingとしてFAILを記録した。
- 修正: 参照を「5」へ訂正。`scripts/sprint-047-audit-test.mjs` はmemory-careの実見出しを読み、secretaryから同じ節を参照することを確認する。
- 検証: root実行 `python3 /private/tmp/astra-secretary-heavy.py node scripts/sprint-047-audit-test.mjs` はexit0、`SPRINT047_AUDIT_PASS=8 FAIL=0`、Node39→38。未変更面の既存成功証拠を引き継ぎ、独立再評価結果は `docs/feedback/sprint-047.md` に記録する。

最終状態: fresh独立増分再評価PASS、今回対象の未解消finding 0。初回FAILと解消根拠は `docs/feedback/sprint-047.md` に保持し、`docs/sprints/state.md` でSprint 047をdoneとした。
