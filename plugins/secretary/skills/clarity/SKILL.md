---
name: clarity
description: Project Clarityを安全に初期化し、人間が考える必要のあるAttention、決定×実行の現在状態、Markdown／Mermaid／Xmind投影、履歴、checkpoint、診断、schema移行を扱う。「クラリティを初期化」「今のClarity状態」「今考えること」「Clarity map」「決定を確定」「Clarity履歴」「Clarityを診断」で使う。
---

# Project Clarity

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathを `SECRETARY_SKILL_FILE` に入れ、最初に1回だけ解決する。
空・相対path・未解決placeholderならcommandへ渡さず停止し、cwdやhost固有の環境変数から推測しない。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

Project ClarityはTODO一覧ではありません。Decision、Execution、Validationと根拠を分け、「何が決まり、何が実行され、どこに人間の判断が要るか」を扱います。

<!-- yasashii-secretary:clarity-collaboration:clarity:v1 -->

Project作成・open／closed・完了・再開・`canonicalRepo`はprojects、予定／TODO／journalは既存Skill、
一般memoryはmemory-care、開発はbuild、plugin更新はupdate、外部サービスは各connectorが所有する。
Clarityのstatus、Item作成、Attention、projection、Hookだけからこれらを自動実行しない。タスク化、memory、開発、更新、
connectorが現在の依頼で明示された場合だけ、secretaryのcollaboration routerを通して既存入口へ委譲する。

通常の利用者向け応答は`${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md`を参照する。Secretary workspaceを扱う場合は既存の
`secretary/memory/preferences.md`を読み、最終応答serializerだけを正本にする。Clarity Skill独自の固定帳票へ包み直さない。

## 初期化

1. 最初は必ずread-only previewを実行する。

   ```bash
   node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" init "<repo-root>" --json
   ```

2. Project名、Repo identity、Item候補、作成予定path、競合、除外・未確認範囲を利用者へ示す。
3. 利用者が明示確認した後だけ `--apply` を付ける。取消では `--cancel` を使い、副作用0件で終える。
4. `.env`、credential、binary、巨大file、symlink先は候補本文として読まない。既存`CLARITY.md`は上書きしない。

## 手動fallback

Hookが無効・未信頼・失敗でも、次は完全に手動で使える。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" status "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" attention "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" review "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" attention-override "<repo-root>" --item-id "<item-id>" --level "<level>" --reason "<reason>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" history "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" checkpoint "<repo-root>" --operation-id "<stable-operation-id>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" rebuild "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" doctor "<repo-root>" --json
```

`rebuild`はEvent／EvidenceからStateを再生成します。Stateやquadrantの手編集をDecision確定として扱いません。

## Attentionと診断

- 通常表示は「結論→理由→根拠→選択」の順で、重要な3件までを先に示す。残りは件数と`.clarity/state.json`へのpathへ畳む。
- AI推定は「推定」、確認していない状態は「未検証」、根拠が足りない状態は「根拠不足」と明示する。不透明なscoreを利用者向けの理由にしない。
- `doctor`のHook／link等が未検証なら成功扱いしない。schema移行や古いruntime lockが必要な場合は、まずread-only previewを案内する。
- Codexで`/hooks`がtrust未承認を示した場合は、`doctor --host codex --hook-state untrusted --json`でdegraded状態とtrust確認方法を表示する。無効時は`disabled`、command失敗時は`failure`を渡す。1hostの結果を別hostのverifiedへ昇格しない。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" migrate "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" cleanup "<repo-root>" --json
```

previewの対象path、保持する履歴、削除候補を利用者が確認した後だけ、それぞれ`--apply`を付ける。migration失敗は旧schemaを利用可能な状態へ戻し、cleanupは所有確認済みの期限切れruntimeだけを削除する。

## generic projectのDecision確定

- 利用者が明示的に確定した内容だけを、既存projectsのDecision seamへ委譲する。
- `PROJECT.md`／`DECISIONS.md`がDecision正本、Clarity Eventは状態遷移です。同じ本文を一般memoryへ複製しません。
- partial時は成功済みと未完了を分け、同じoperationのretryでDecisionやEventを重複させません。
- AI推定、draft、superseded sourceは`confirmed`にしません。

## Decisionと実装のDrift確認

Decision／ADR／spec／顧客合意と、現在のcode／commit／test Evidenceを比較するときは、対象fileと行範囲を明示した小さなJSON manifestを使う。最初は必ずpreviewし、`unknown`、`aligned`、`possible_drift`、`drift`、`not_applicable`の結果と双方のlocatorを確認した後だけapplyする。全文検索や意味検索は行わず、各sourceは64KB・240行以内に限定される。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" drift "<repo-root>" --input-file "<comparison.json>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" drift "<repo-root>" --input-file "<comparison.json>" --apply --json
```

manifestは`schemaVersion: 1`、`itemId`、`decision`、`implementation`を持つ。双方にtype、working rootからの相対locator、比較対象の`claim.field`／`claim.value`、source内で確認できる1〜12件の`claim.markers`を指定する。生成物は`authority: "generated"`と`generatedFrom`で生成元を示し、生成元がなければ断定しない。古いcommitは履歴Evidenceとして残し、現在実装の一致とは扱わない。marker不足や同義表現を一意に判断できない場合は`possible_drift`に留める。

waiver、つまり理由付きの一時抑制はDriftを消去しない。理由・範囲・期限をpreviewし、明示applyでEventへ追加する。期限切れまたは`revoked`後はAttentionへ再出現でき、過去の比較・waiver履歴は保持される。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" drift-waiver "<repo-root>" --item-id "<id>" --reason "<reason>" --scope "<scope>" --expires-at "<ISO-8601>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" drift-waiver "<repo-root>" --item-id "<id>" --reason "<reason>" --scope "<scope>" --expires-at "<ISO-8601>" --apply --json
```

Clarity所有fileだけを明示commitする必要がある場合もpreviewを先に行う。`commit --apply`は`.clarity/`と`CLARITY.md`だけを対象にし、既存のdirty／stage／untracked、branch、remoteを変えず、pushしない。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" commit "<repo-root>" --message "<message>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" commit "<repo-root>" --message "<message>" --apply --json
```

## Markdown／Mermaid投影

同じcanonical Stateから、概要・Attention・マトリクスのMarkdownと、象限・Project構造・依存関係・状態遷移のraw Mermaidを生成する。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" project "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" project "<repo-root>" --apply --json
```

previewはwrite 0件。Mermaid rendererが使えなくても`.mmd`とMarkdownを保持し、構造図のmindmap構文を使えない場合は`--mindmap-failure`でflowchartへfallbackする。

## Linked External Repo

- linkは`prepare → accept → finalize`の順で行う。各段階で双方のClarity Project ID、Repo identity、link ID、digest、authority profileを確認し、既存Standalone／Secretary-localのProject IDを変えない。
- Link Request、reciprocal manifest、sync bundleへSecret、資格情報、absolute local path、顧客本文を入れない。local checkout mappingはtracked fileではなく各Repoの`.git/clarity-links.json`だけへ、previewと確認後に保存する。
- manual bundleが標準経路であり、networkなしで全link／sync semanticを完了できる。GitHub read-only adapterも明示許可前は0 callで停止し、許可があってもpush、fetch、pull、remote変更を行わない。
- sync previewはwrite 0件。applyは自Repoの`.clarity/imports/`、`.clarity/projections/linked/`と純追加Eventだけを更新し、相手Repo、remote、branch、Git状態を変更しない。
- authority Primary重複、identity／digest改ざん、stale、newer schema、tombstone、concurrent revisionは自動採用しない。last-write-winsを使わず、Secretary側／Repo側／new Decision／split／defer／unlinkから選び、resolutionをEventへ残す。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" link-identity "<repo-root>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" link-prepare "<secretary-project-clarity-root>" --target-project-id "<id>" --target-repo-identity-json '<JSON>' --role secretary --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" link-accept "<external-repo>" --input-file "<request-bundle.json>" --json
# previewを確認後だけ同じcommandへ--applyを付ける。finalizeも双方で同じ境界を守る。
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" link-export "<repo-root>" --link-id "<link-id>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" sync-preview "<repo-root>" --input-file "<manual-bundle.json>" --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" link-doctor "<repo-root>" --json
```

## Xmind provider

- Xmind設定は既定OFF。利用者が明示した場合だけ`xmind-setting --enabled on`とし、`off`で再停止できる。
- ON時にcreate/read/updateと色・配置を扱えるconnected Xmind MCPがあれば、必ず第1優先にする。設定値とruntime capabilityは別に表示する。
- MCPを使えない場合のlocal `.xmind`は第2優先。最初からlocalを指定された場合も、まずpreviewで対象path、create/update、既存mapへの影響、auth／credit見込み、再読込注意を示す。
- local writeはpreviewの`approvalDigest`に対する利用者の明示承認後だけ行う。拒否、取消、無回答、digest不一致ではwrite 0件。
- local archiveは既知のXMind Zen JSON ZIP内部構造として検査する。内部構造検査と「実Xmind Appで開けたか」を分け、App未確認時は`verified: false`のままにする。
- Xmind側の状態変更はproposalとして返す。承認前／拒否時はcanonical Stateを変更せず、明示承認後だけClarity Eventへ反映する。

```bash
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" xmind-setting "<repo-root>" --enabled on --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" xmind-resolve "<repo-root>" --capabilities-json '<JSON>' --json
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" xmind-local "<repo-root>" --target ".clarity/maps/clarity.xmind" --json
# previewのapprovalDigestと表示内容を人間が確認した後だけ:
node "${SECRETARY_PLUGIN_ROOT}/scripts/clarity.mjs" xmind-local "<repo-root>" --target ".clarity/maps/clarity.xmind" --apply --approval-digest "<sha256>" --json
```

## 安全境界

- preview／cancelではClarity canonical、Git、journal、runtimeを変更しない。
- root外write、network、未承認のXmind MCP／local `.xmind` write、connector、push、remote／branch変更、Hook、task自動作成を行わない。
- Evidenceは相対path／ID／日付／SHA等の最小locator、短いsummary、digestだけを保存し、本文やSecretを保存しない。
- Drift comparatorは明示locatorだけを読む。absolute path、traversal、symlink／junction、`.git`、runtime、credential／Secret／transcript候補をcanonical write前に拒否し、source本文をoutputやEvidenceへ含めない。
