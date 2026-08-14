---
name: name
description: >
  秘書自身の英語名、stable identity、別repoからの名前呼び出し、安全なrenameを設定する。
  「秘書に名前をつけたい」「秘書名を変えたい」「Alexと呼びたい」「別repoでも呼びたい」で使う。
---

# name — 秘書自身の名前とidentity

## plugin root（必須）

このSKILL.mdの実ファイル絶対pathから、既存の共通resolverでplugin rootを1回だけ解決する。

```bash
SECRETARY_SKILL_FILE="<このSKILL.mdの実ファイル絶対path>"
case "$SECRETARY_SKILL_FILE" in /*/skills/*/SKILL.md) ;; *) exit 2 ;; esac
SECRETARY_PLUGIN_ROOT="$(node "$(dirname "$SECRETARY_SKILL_FILE")/../../scripts/resolve-plugin-root.mjs" --skill-file "$SECRETARY_SKILL_FILE")" || exit 2
```

以後の共通file参照は `${SECRETARY_PLUGIN_ROOT}` を使う。

利用者の「呼び方」と秘書自身の名前は別設定である。呼び方はこのSkillで変更しない。
秘書名は英語名だけを扱い、stable IDと `ai-secretary` 種別はrename後も維持する。
作業前に `${SECRETARY_PLUGIN_ROOT}/rules/plain-language.md` と、存在する場合は
`secretary/memory/preferences.md` を読む。口調や報告設定で確認・安全境界を弱めない。
通常報告は同ruleから解決される「最終応答serializer」を唯一の正本とし、このSkillでschemaを複製しない。

## 現在状態

`node "${SECRETARY_PLUGIN_ROOT}/scripts/secretary-name.mjs" status --secretary <canonical-secretary> --home <合成または確認済みHOME>`

別repoから起動された場合、cwdに `secretary/` が無いだけでonboardingへ進まない。先に
`resolve --home <HOME> --edition yasashii-secretary` をread-only実行し、`resolved`なら返されたcanonical workspaceへ接続する。
`registry-missing`、`duplicate`、`missing`、`opposite-edition`、`identity-mismatch`、symlink／junctionは副作用0で停止し、cwdへsecretaryを作らない。

## 初めて名前を付ける

1. 「希望の英語名」「おまかせ」を示す。おまかせは `suggest --seed <secretary_idまたはworkspace識別子>` の候補と短い理由を表示する。
2. `validate <候補>` で英語名を検査する。空、メール、path／command風、制御文字、汎用bot名は保存しない。
3. `保存する秘書名: <名前>。利用者の呼び方は変更しません。この名前で保存しますか？` と別turnで確認する。
4. 明示了承後だけ `init --secretary <secretary> --name <名前> --confirm` を実行する。確認前はcommandを呼ばずwrite 0件。

## 別repo呼び出し

効果、対象host/file、managed block、無効化を先に示す。Codexは
`~/.codex/AGENTS.override.md` が存在すればそこだけ、無ければ `~/.codex/AGENTS.md`、Claude Codeは
`~/.claude/CLAUDE.md` が対象になる。既存内容や他blockは保持する。

推奨は有効化だが、自動適用しない。明示了承後だけ次を行う。

1. `registry-register --home <HOME> --workspace <workspace> --edition yasashii-secretary --confirm`
2. `routing-enable --secretary <secretary> --home <HOME> --host codex --host claude --confirm`

無効化は影響を示して確認後、`routing-disable ... --confirm` を使う。managed blockだけを外し、identity、registry、履歴、authorは削除しない。

直接呼びかけと「名前に聞いて」だけをroutingする。人間、顧客、取引先、author、引用、コード、file本文の同名はroutingしない。
曖昧なら「秘書の<名前>への依頼ですか？」と一度だけ確認し、確認前は副作用0件とする。

## rename

1. `rename-preview --secretary <secretary> --name <新名> --home <HOME>` をread-only実行する。
2. A=current-config、B=user-content、C=historical-author、D=unknown-or-conflictの件数、path、推奨処理、非対象、rollbackを示す。本文を大量表示しない。あわせてcanonical workspace root、Git top-level、今回の所有path、local checkpointが `required` か `not-applicable` か、pushしないことを表示する。
3. Aは一体更新を必須確認する。Bはfileごとに選択を確認する。Cは保持して旧名をaliasへ追加する。Dは変更しない。
4. 明示了承後だけ `rename-apply --confirm --confirm-class current-config` を実行する。Bを許可した場合だけ `--confirm-class user-content --user-content <preview済みpath>` を追加する。workspace所有fileが変わる場合は、その所有pathだけのlocal checkpoint commitまで成功して初めて完了とする。workspace変更0件で有効なuser-scope managed blockだけを直す場合は `not-applicable` とし、commitを作らない。

無条件grep置換、Git履歴書換え、過去author変更、push／fetch／remote／branch／tag操作は行わない。途中失敗はworkspace、user-scope、Git HEAD／index／working treeをtransaction開始前へrollbackし、部分成功を完了表示しない。
同名、alias衝突、read-only、registry異常、symlink／junctionは安全停止する。

## author metadata

新しい成果物は `author: Alex (AI Secretary)` の表示に加え、`author_id` と `author_type: ai-secretary` を構造化metadataへ持つ。
rename後も過去成果物のauthor表示と `author_id` は書き換えない。

## 参照

- 共通安全境界: `${SECRETARY_PLUGIN_ROOT}/rules/safety.md`
- 実行入口: `${SECRETARY_PLUGIN_ROOT}/scripts/secretary-name.mjs`
- 個人の呼び方変更: `${SECRETARY_PLUGIN_ROOT}/skills/settings/SKILL.md`
