# yasashii-secretary

Claude Codeを使う一般の非エンジニア向けAI秘書プラグイン
（Claude Code plugin / public / MIT）。一般的な技術用語は保ち、何が起きているかと次の行動を先に伝える。

## 正本

- 方針転換の引き継ぎ正本: `docs/proposal-2026-07-15-realignment.md`
- 恒久設計: `docs/DESIGN.md`
- 実装仕様: `docs/spec.md` と `docs/spec/`
- 進行状態: `docs/sprints/state.md`

## リポジトリ境界

- 秘書本体の配布物は `plugins/secretary/`。
- 開発ハーネスは別リポジトリ `mtaiseeei/yasashii-harness` が正本。本体には `harness/` や Planner / Generator / Evaluator のagentsを同梱しない。
- Harnessの上流情報は公式remote／APIまたは現在の利用者が参照対象として承認したcanonical checkoutから読み取る。
  名前やhome pathから別checkoutを推測せず、実pathと所有担当を確認する。read-only参照の承認を編集、
  checkout切替、commit、push、生成物作成へ広げない。別ownerの未承認操作とprivate内容の取り込みは禁止する。
- 秘書の記憶・成果物・通常のプロジェクト・選択したChatwork room履歴は、1つのprivate GitHub repoでGit管理する。Chatwork専用repoへ分離しない。
- Chatworkだけは、Repository SecretのAPI Tokenを使うGitHub Actions同期を許可する。その他の外部データは公式コネクタで都度参照し、同期層を作らない。
- 初回private repo作成・初回pushと、設定時に同意したChatwork schedule pushは製品フローに含む。それ以外の予期しないpushは実行前に確認する。

## 開発Harnessのruntime

- Harnessで開発するときは、役割分離と進行規則を `AGENTS.md`、runtime設定を `.harness/config.toml`、
  補足を `docs/harness-guidance.md` の正本から読む。Claude Codeは現在のmodel/effortを既定で継承する。
- Codexでは表示されたspawn schemaに `model`、`reasoning_effort`、`agent_type` が無くても、
  runtime parserが受理する可能性があるため、それだけで `inherit` に戻さない。resolverの
  `dispatch-attempt` にある正式なmodel / effortをbuilt-in/default Agentへ1回だけ直接渡す。
  旧custom-agent設定は非推奨warning付きで無視され、定義の作成は不要。この規則は明示された全role値に適用する。
- 子Agent作成前の `Unknown model` または不正effortだけをlaunch rejectionとしてresolverへ戻す。
  `unknown field` はその適用経路が使えないことを意味する。resolver出力だけでは実起動の証拠にならず、
  child host metadataが指定値と一致した場合だけ `launch-verified` とする。Terraや `codex exec` へ自動fallbackしない。
- 上限は現在の `.harness/config.toml` を正本とする。このrepoの `Lineage Dispatches` は10、同一Sprintの `Spec-Issue Count` は2で停止する。
  `verification-scope-issue` はproduct findingと分け、`AGENTS.md`の限定修理条件を満たす場合だけGeneratorへ1回戻せる。修理失敗・範囲不明・要求拡大はユーザーへ選択肢を返す。
  契約済み証拠をsafe harborとして、変更面だけ増分再評価し、同一candidateの有効な証拠を条件付きで再利用する。
  active Sprintの基準変更はユーザー承認が必要で、`done-by-user-decision` は未達を残した明示受入にだけ使う。

## 報告

既定は「やったこと／結果／次に何が起きるか」の3行。一般的な技術用語はそのまま使い、
馴染みの薄い語だけ初出で短く補足する。過度な平易化や幼稚なメタファーは使わない。
