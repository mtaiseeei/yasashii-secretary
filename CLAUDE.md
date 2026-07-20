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
- `/Users/taisei/workspace/agentic-harness` と `~/workspace/agentic-harness` は、**読み取りを含む全面接触禁止**。
  編集、存在確認、一覧、status / HEAD / branch / remote 確認、checkout / switch、commit、生成物作成、
  複製元利用、symlink 経由、当該 checkout を対象にしたコマンド実行を行わない。
  上流情報は GitHub 上の `mtaiseeei/agentic-harness` の remote / API だけを参照する。
- 秘書の記憶・成果物・通常のプロジェクト・選択したChatwork room履歴は、1つのprivate GitHub repoでGit管理する。Chatwork専用repoへ分離しない。
- Chatworkだけは、Repository SecretのAPI Tokenを使うGitHub Actions同期を許可する。その他の外部データは公式コネクタで都度参照し、同期層を作らない。
- 初回private repo作成・初回pushと、設定時に同意したChatwork schedule pushは製品フローに含む。それ以外の予期しないpushは実行前に確認する。

## 開発Harnessのruntime

- Harnessで開発するときは、役割分離と進行規則を `AGENTS.md`、runtime設定を `.harness/config.toml`、
  補足を `docs/harness-guidance.md` の正本から読む。Claude Codeは現在のmodel/effortを既定で継承する。
- Codexでは表示されたspawn schemaに `model`、`reasoning_effort`、`agent_type` が無くても、
  runtime parserが受理する可能性があるため、それだけで `inherit` に戻さない。resolverの
  `dispatch-attempt` にある正式な値を実roleへ1回だけ渡し、custom agentには `agent_role` ではなく
  `agent_type` を使う。この規則はLuna/Solだけでなく、設定またはユーザーが選んだ全model/effortに適用する。
- 子Agent作成前の `Unknown model` または不正effortだけをlaunch rejectionとしてresolverへ戻す。
  `unknown field` はその適用経路が使えないことを意味する。resolver出力だけでは実起動の証拠にならず、
  child host metadataが指定値と一致した場合だけ `launch-verified` とする。Terraや `codex exec` へ自動fallbackしない。

## 報告

既定は「やったこと／結果／次に何が起きるか」の3行。一般的な技術用語はそのまま使い、
馴染みの薄い語だけ初出で短く補足する。過度な平易化や幼稚なメタファーは使わない。
