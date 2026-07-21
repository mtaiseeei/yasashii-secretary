# Sprint 033 — 4環境対応のagentic-secretary完成品

## ゴール

private `origin/main` のcommit `4670438` をSprint 033の完成候補として固定し、
Claude Code Desktop App／Claude Code CLI／Codex App／Codex CLIの4環境で、
正式配布面、Agentic identity、会話、wizard、安全性、更新手順、回帰が実用上出荷できる状態であることを受け入れる。

Sprint 033ではpublic化もRelease作成も行わない。公開可否の最終判断はSprint 035に残す。

## 種別

Main Sprint

## 含む機能

F52、F53

## 依存と対象

- 依存: sprint-032-patch-002 done。
- Harness正本: `/Users/taisei/workspace/yasashii-secretary`。
- target repo: `/Users/taisei/workspace/agentic-secretary`。
- 完成候補: private `origin/main` の `4670438`。
- `/Users/taisei/workspace/agentic-harness` は、存在確認、path列挙、read、write、Git操作、複製元利用、
  コマンド対象化を含め一切対象にしない。

## 2026-07-21の受入再整理

### 決定

4 hostの製品動作と安全性を確認する目的に対し、schema v2／v3のproduction collector／driver／attestor、
期限つきapproval、challenge、二層artifact、12×8 exact resultまでを製品必須にしたことは過剰だった。
Sprint 033の必須受入を、利用者が実際に使う面と出荷判断に直接必要な証拠へ戻す。

これは品質を弱める変更ではない。次は引き続き必須である。

- 4 hostそれぞれのcurrent-bytes実機smoke。
- Claude／Codexの正式manifest／marketplace。
- `0.8.0`、Agentic identity、正本skillの一意読込。
- 実会話8面のMarkdown可読性とwizard導線。
- 対象workspace変更0件、Secret露出0件。
- 更新／再導入手順、全回帰、Gitなしarchive、利用可能な公式validator。

製品scopeから外すのは証明基盤であり、製品の動作・安全性・配布整合ではない。

### 完成候補へ含める修正

`4670438` には少なくとも次のSprint 033修正が含まれる。

1. `1dfe276`: `update-ledger.mjs` の新規Agentic台帳edition誤判定修正。
2. `1228d59`: Codex正式Plugin manifest／marketplaceと導入・更新面。
3. `014680e`: read-only環境の `resume-check` 三値化とpath guard修正。
4. `4670438`: Chatwork／Google Chat wizardのproduct identity修正。

### 完成候補へ含めない修正

- 未push commit `f285120` のschema v3 production collector／driver／attestor。
- 未push commit `b9c0f3e` のschema v3 archive向け修正。
- 上記2 commitにだけ存在するformal gate用schema、template、手順、集約器、回帰。

targetの出荷候補treeは `4670438` と一致させる。schema v3実装を別の形で再同梱しない。

## 製品構成

### 共通本体

次は `plugins/secretary/` の共通実装を4 hostで共有する。

- skills、会話ルール、Markdown可読性、Agentic style。
- 診断、完了報告、状態報告、developer handoff。
- workspace境界、Secret保護、更新の安全性。
- Chatwork／Google Chatのwizard、OAuth scope、同期境界。
- ホスト非依存のfixture、validator、回帰。

hostごとに共通機能を複製しない。

### host adapter

host adapterへ置いてよいのは次だけである。

- plugin manifest、marketplace、導入経路、plugin root解決、skill発見。
- command／slash command、構造化質問UI。
- 更新／再導入、reload／restart、新しいchat／sessionへの反映。
- 実会話runner、browser／CLI検証面、host metadata、利用可能な公式validator。

## 正式配布面

### Claude Code

- repo rootの `.claude-plugin/marketplace.json` と
  `plugins/secretary/.claude-plugin/plugin.json` を維持する。
- Claude Code Desktop App／CLIから同じ `plugins/secretary/skills/` を利用する。

### Codex

- `plugins/secretary/.codex-plugin/plugin.json` を正式manifestとする。
- repo rootの `.agents/plugins/marketplace.json` を正式marketplaceとする。
- manifestのskillsは `./skills/`、marketplaceの `source.path` はrepo root基準の
  `./plugins/secretary` とする。
- plugin／marketplace nameは `agentic-secretary` とする。
- Claude marketplaceのlegacy-compatible読込、`.agents/skills`、`AGENTS.md`、`config.toml`、
  skills手動コピーは互換／authoring／test補助／fallbackであり、正式Codex配布の代替にしない。
- Claude／Codexの両manifestは同じ正本skillsを参照し、15 skillを重複discoverさせない。

## 4 hostの実用smoke

4 hostは別々に確認し、1 hostの結果を別hostへ流用しない。ホストの性質に合う証拠を使う。

| host | 主な証拠面 | 必須smoke |
|---|---|---|
| Claude Code Desktop App | 実UI、AX tree、screenshot、host-owned session | current bytes、0.8.0、Agentic identity、skill、会話8面、wizard |
| Claude Code CLI | 実command、session output、cache／install確認 | current bytes、0.8.0、Agentic identity、skill、会話8面、wizard、更新／再導入 |
| Codex App | 実UI、task／session record、screenshot | current bytes、0.8.0、Agentic identity、skill、会話8面、wizard |
| Codex CLI | 実command、session output、cache／install確認 | current bytes、0.8.0、Agentic identity、skill、会話8面、wizard、更新／再導入 |

会話8面は次を対象にする。

1. `basic-answer`
2. `complex-answer`
3. `completion-report`
4. `status-report`
5. `diagnosis`
6. `developer-handoff`
7. `partial-failure`
8. `markdown-rendering`

一般回答へ固定3項目を強制しない。完了・状態報告は既存契約どおり、必要項目と順序を維持する。

## 既取得証拠の再利用

`4670438` と同じcurrent bytesについて、既に次の4 host固有証拠が取得済みである。

- 4 hostすべての `0.8.0`、Agentic identity、正本skill。
- 4 hostすべての実会話8面のMarkdown。
- Codex App固有task／session record。CLI結果の流用ではない。
- Claude Code Desktop Appのcurrent bytes再導入後の実UI／AX tree。
- 更新済みcacheからのChatwork／Google Chat wizard実起動とAgentic identity。
- 対象workspace変更0件、Secret露出0件。

fresh Evaluatorは、証拠を無条件に信頼するのではなく、次の整合を確認したうえで再利用する。

1. target commit／treeが `4670438` と一致する。
2. manifest、marketplace、version、identity、skillが証拠取得時のcurrent bytesと一致する。
3. host名、App／CLI実行面、sessionが区別され、App証拠がCLI結果だけで作られていない。
4. 証拠内にSecret実値、不要なaccount／workspace識別子、無関係taskが残っていない。
5. 証拠と現行実装に矛盾がない。

上記が満たされる場合、4 hostのinstall・8会話・wizardをすべて再実行する必要はない。
不一致、証拠欠落、対象bytesの違いがある面だけ、fresh Evaluatorが軽量に再確認する。

## 自動runnerを使う場合の安全条件

実会話runnerを新たに自動実行する場合は、Sprint 032 Patch 002で確定した次の安全条件を維持する。

- runner所有の合成HOMEを使い、実HOMEを子processへ渡さない。
- sourceとdigest一致のread-only plugin copyを使い、source／copyの前後不変を確認する。
- env allowlist、最小tool、workspace内fixtureだけを使う。
- OS sandboxまたはhostのpath-scoped permissionで書込み範囲を限定する。
- 制御されたworkspace外canaryへのWrite／Editが実際に拒否されることを確認する。
- 合成credentialを子processへ伝播させず、成功・失敗の両方で一時物をcleanupする。
- 保持証拠をサニタイズし、Secret実値、実HOME、不要な絶対path、account／workspace識別子を残さない。

このrunner安全条件をGUI Appの手動smokeへ同じ形で強制しない。GUI Appは実UIのread-only smoke、
workspace前後不変、Secret非露出で評価できる。

## 更新／再導入

- source、marketplace snapshot、installed cache、新しいchat／sessionを区別する。
- Codex CLIはGit marketplace refreshと、現行hostで成立する再install手順を案内する。
- Codex AppはPlugins Directoryの実際の更新／再導入操作に従う。
- Claude Code Desktop App／CLIも、current bytesへ更新した後の新しいchat／sessionで確認する。
- cache directoryを直接編集する手順を利用者へ案内しない。
- `update-ledger.mjs` は新規Agentic台帳をyasashii editionと誤判定しない。
- read-onlyの `resume-check` は、しおり有り=0、無し=1、guard拒否=3を区別する。
- wizardはChatwork／Google Chatとも `agentic-secretary` identityを表示する。

## 必須のローカル検査

target `4670438` で、少なくとも次を0 FAILで完走する。

1. Sprint 033専用回帰。
2. Codex正式Plugin／marketplace回帰。
3. 全Agentic回帰。
4. Gitなしarchive gate。
5. release integrity／version整合。
6. Claude公式validator。
7. 利用可能なCodex validator。利用不能なvalidatorは、未実行理由と代替検査を明記し、
   実行していないものをPASSと表示しない。
8. `git diff --check`。

## Non-scope

- schema v2／v3のproduction collector／driver／attestor。
- production approval／result schema、期限つきapproval、challenge、二層artifact、12×8 exact result。
- formal resultの4件集約、専用operator手順、配布Pluginへのformal QA基盤同梱。
- 未push `f285120`、`b9c0f3e` の製品採用。
- public設定、Release作成、tag、公開案内。Sprint 035まで行わない。
- OAuth認可、Repository Secret作成／変更、Chatwork／Google Chat実API送信。
- 旧0.7.0利用者向けexternal recovery／bootstrap、same-version bridge、downgrade更新。
- 4 host以外のコーディングエージェントの正式保証。
- Chatwork／Google Chat wizard本体、OAuth scope、同期境界、edition思想の変更。

schema v2／v3の証明基盤は将来のoptional internal QAとして別に検討できるが、
Sprint 033の受入、不合格理由、配布Pluginの必須構成へ戻さない。

## 受け入れ基準（Evaluatorが検証する）

- [ ] targetの完成候補がprivate `origin/main` の `4670438` であり、target treeに
      `f285120`／`b9c0f3e` のschema v3製品実装が含まれない。
- [ ] `1dfe276`、`1228d59`、`014680e`、`4670438` の4修正がcandidate履歴に含まれる。
- [ ] Claude／Codexの正式manifest／marketplaceが存在し、`0.8.0`、`agentic-secretary`、
      共通skills参照、Codex `source.path=./plugins/secretary` が整合する。
- [ ] 正本skill 15件が各hostで一意に発見され、legacy／manual-only経路や重複discoverで合格を作っていない。
- [ ] 4 hostそれぞれにcurrent-bytesのhost固有実機smoke証拠があり、AppとCLIを区別できる。
- [ ] 4 hostすべてで `0.8.0`、Agentic identity、正本skill、会話8面のMarkdownが確認できる。
- [ ] Chatwork／Google Chat wizardがcurrent bytesで起動し、`agentic-secretary` identityを表示する。
- [ ] 対象workspaceの変更が0件であり、Secret実値が会話、ログ、repo、保持証拠へ0件である。
- [ ] 更新／再導入の手順がhost別に実用可能で、source／snapshot／cache／新sessionの違いを誤説明しない。
- [ ] 新規Agentic台帳のedition判定、read-only `resume-check` 三値、wizard identityが専用回帰で保護される。
- [ ] Sprint 033専用、Codex Plugin、全Agentic回帰、Gitなしarchive、release integrity、
      Claude公式validator、利用可能なCodex validator、`git diff --check` が0 FAILである。
- [ ] 既取得証拠を再利用する場合、fresh Evaluatorがcommit／version／identity／skill／sessionとの整合を確認する。
- [ ] 新たに自動runnerを使った場合だけ、合成HOME、read-only copy、env allowlist、最小tool、
      sandbox／path-scoped permission、workspace外canary拒否、Secret非伝播、cleanupを確認する。
- [ ] schema v2／v3 attestationの欠落を不合格理由にせず、optional internal QAとして製品scope外に扱う。
- [ ] public／release／OAuth／Repository Secret／実API送信が0件である。
- [ ] Chatwork／Google Chat wizard、OAuth scope、同期境界、安全rule、editionの4表現面に不要な変更がない。

## Generator handoff

1. target repoの現在HEADとprivate `origin/main` を確認し、出荷候補treeを `4670438` に揃える。
   未push `f285120`／`b9c0f3e` は完成候補へ含めない。既存履歴を破壊する方法を既定にしない。
2. schema v3実装を削除した結果、回帰一覧、archive gate、README／guide、progress handoffに
   存在しないformal gateを必須として残さない。
3. `4670438` の製品修正と正式配布面を変えず、必要なローカル検査だけを再実行する。
4. progressにはcandidate commit、実行command／結果、既取得4 host証拠の場所と対応、
   workspace変更0件、Secret露出0件、禁止外部操作0件を記録する。
5. target実装の変更が不要なら、不要であることと根拠を記録し、証明基盤を作り直さない。

## Evaluator handoff

1. Generatorとは別のfresh Evaluatorが、target `4670438`、manifest／marketplace、version／identity／skill、
   専用・全回帰・archive・validatorを独立確認する。
2. 既取得の4 host固有証拠を、host、App／CLI実行面、session、current bytesとの対応で確認する。
   証拠が整合すれば再利用し、全smokeのやり直しを要求しない。
3. GUI Appは実UI証拠、CLIはcommand／session証拠で評価する。同一approval、challenge、digest、
   二層artifact、exact schemaを要求しない。
4. 必要な軽量再確認だけを実施し、公開、Release、OAuth、Secret、実API送信は行わない。
5. C15は `docs/spec/rubric.md` の現実的な5/5定義で採点する。schema v2／v3 attestationの欠落を
   機能完全性、回帰なし、C15の減点理由にしない。

## External gate

既に許可・実施済みのprivate repo、push、plugin install／再導入、read-only会話確認の証拠は再利用できる。
それを超えるexternal writeは本Sprintの受入に不要であり、行わない。
public化とRelease作成はSprint 035の明示許可まで禁止する。
