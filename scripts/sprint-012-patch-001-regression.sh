#!/usr/bin/env bash
# Sprint 012 Patch 001: repo境界、serializer唯一正本、構成正本の回帰

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="$ROOT/plugins/secretary"
VALIDATOR="$ROOT/scripts/check-report-schema.py"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0
ok(){ PASS=$((PASS+1)); printf 'PASS %s\n' "$1"; }
ng(){ FAIL=$((FAIL+1)); printf 'FAIL %s\n' "$1"; }
check(){ local label="$1"; shift; if "$@"; then ok "$label"; else ng "$label"; fi; }

schema_ok(){ python3 "$VALIDATOR" --plugin-root "$1" >/dev/null 2>&1; }
fixture(){ local name="$1"; local dir="$WORK/$name"; mkdir -p "$dir"; cp -R "$PLUGIN/." "$dir/"; printf '%s' "$dir"; }
expect_schema_failure(){ ! schema_ok "$1"; }

check "root規約は読み取りを含む全面接触禁止" \
  grep -q '読み取りを含む全面接触禁止' "$ROOT/CLAUDE.md"
check "root規約は存在・Git状態・symlink経由も禁止" \
  grep -q '存在確認、一覧、status / HEAD / branch / remote 確認' "$ROOT/CLAUDE.md"
check "root規約はGitHub remote/APIだけを許可" \
  grep -q 'GitHub 上の `mtaiseeei/agentic-harness` の remote / API だけ' "$ROOT/CLAUDE.md"
check "root規約に弱い読み取り専用表現が無い" \
  sh -c "! grep -Eq 'agentic-harness.*読み取り専用|読み取り専用.*agentic-harness' '$ROOT/CLAUDE.md'"

check "実配布面はserializer唯一正本・競合0" schema_ok "$PLUGIN"

BAD="$(fixture bare)"; printf '\nやったこと: 複製\n結果: 複製\n次に何が起きるか: 複製\n' >> "$BAD/skills/daily/SKILL.md"
check "裸prefix fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture blockquote)"; printf '\n> やったこと: 複製\n> 結果: 複製\n> 次に何が起きるか: 複製\n' >> "$BAD/skills/daily/SKILL.md"
check "blockquote fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture list)"; printf '\n- やったこと: 複製\n- 結果: 複製\n- 次に何が起きるか: 複製\n' >> "$BAD/skills/daily/SKILL.md"
check "箇条書きfixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture fence)"; printf '\n```text\nやったこと: 複製\n結果: 複製\n次に何が起きるか: 複製\n```\n' >> "$BAD/skills/daily/SKILL.md"
check "code fence fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture decorated)"; printf '\n  **やったこと:** 複製\n  **結果:** 複製\n  **次に何が起きるか:** 複製\n' >> "$BAD/skills/daily/SKILL.md"
check "indent・Markdown装飾fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture heading)"; printf '\n## 完了報告を3行で返す\n' >> "$BAD/skills/daily/SKILL.md"
check "独自行数見出しfixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture synonym)"; printf '\n実施内容: 複製\n確認結果: 複製\n次の対応: 複製\n' >> "$BAD/skills/daily/SKILL.md"
check "同義schema fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture quote-example)"; printf '\n> 完了しました。\n> 内容を確認しました。\n> 次へ進めます。\n' >> "$BAD/skills/daily/SKILL.md"
check "完成blockquote例fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture missing-reference)"; perl -pi -e 's/最終応答serializer/通常報告規約/g' "$BAD/skills/daily/SKILL.md"
check "serializer参照欠落fixtureを拒否" expect_schema_failure "$BAD"

BAD="$(fixture intermediate)"; printf '\n通常報告ではRead前に途中メッセージを出す。\n' >> "$BAD/skills/daily/SKILL.md"
check "serializer前の途中メッセージfixtureを拒否" expect_schema_failure "$BAD"

check "proposalはdaily内3モードを正本化" \
  grep -q '独立SKILLを新設せず、既存 `skills/daily/SKILL.md` 内の朝・日中・夕方モード' "$ROOT/docs/proposal-2026-07-15-realignment.md"
check "DESIGNの配布treeはdaily内3モード" \
  grep -q 'daily/.*morning / daily / evening の3モードを統合' "$ROOT/docs/DESIGN.md"
check "proposal/DESIGNは独立morning/evening directoryを現行要求しない" \
  sh -c "! grep -Eq 'skills/(morning|evening)/|├── (morning|evening)/' '$ROOT/docs/proposal-2026-07-15-realignment.md' '$ROOT/docs/DESIGN.md'"
check "実treeに独立morning/evening skillが無い" \
  sh -c "[ ! -e '$PLUGIN/skills/morning' ] && [ ! -e '$PLUGIN/skills/evening' ]"

printf 'PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
