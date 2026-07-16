#!/usr/bin/env python3
"""Validate that plain-language.md is the only normal-report schema owner."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


OWNER_REL = Path("rules/plain-language.md")
PREFIX_GROUPS = {
    "done": ("やったこと", "実施内容", "実施したこと", "行ったこと", "対応内容"),
    "result": ("結果", "確認結果", "実行結果", "状態の要約", "どうなったか"),
    "next": ("次に何が起きるか", "次の対応", "次にやること", "次の一手", "次にできること"),
    "detail": ("補足", "追加情報"),
}


def user_surfaces(plugin: Path) -> list[Path]:
    surfaces = sorted((plugin / "skills").glob("*/SKILL.md"))
    surfaces.extend([plugin / "templates/AGENTS.md", plugin / "templates/CLAUDE.md"])
    surfaces.extend(sorted((plugin / "templates/tones").glob("*.md")))
    return surfaces


def normalize_markdown(line: str) -> str:
    value = line.strip()
    while True:
        previous = value
        value = re.sub(r"^>\s*", "", value)
        value = re.sub(r"^(?:[-+*]|\d+[.)])\s+", "", value)
        value = re.sub(r"^#{1,6}\s+", "", value)
        if value == previous:
            break
    return re.sub(r"[`*_~]", "", value).strip()


def prefix_kind(line: str) -> str | None:
    normalized = normalize_markdown(line)
    for kind, labels in PREFIX_GROUPS.items():
        for label in labels:
            if re.match(rf"^{re.escape(label)}\s*[:：]", normalized):
                return kind
    return None


def is_allowed_detail_choice(line: str) -> bool:
    stripped = line.lstrip()
    choice = bool(re.match(r"^>\s*[-+*]\s+", stripped) or stripped.startswith("|"))
    return choice and ("みじかく" in line or "くわしく" in line)


def has_line_count_ownership(line: str) -> bool:
    normalized = normalize_markdown(line)
    if is_allowed_detail_choice(line):
        return False
    patterns = (
        r"(?:3|三)\s*行(?:型|で|に|だけ|以内|へ|の報告|報告)",
        r"(?:4|四)\s*行(?:型|で|に|だけ|以内|へ|の報告|報告)",
        r"報告(?:を|は).{0,12}(?:3|三|4|四)\s*行",
    )
    return any(re.search(pattern, normalized) for pattern in patterns)


def has_synonymous_schema(line: str) -> bool:
    normalized = normalize_markdown(line)
    slash_parts = re.split(r"[／/]", normalized)
    if len(slash_parts) < 3:
        return False
    categories: set[str] = set()
    for part in slash_parts:
        for kind, labels in PREFIX_GROUPS.items():
            if kind == "detail":
                continue
            if any(label in part for label in labels):
                categories.add(kind)
    return {"done", "result", "next"}.issubset(categories)


def has_positive_intermediate_instruction(line: str) -> bool:
    normalized = normalize_markdown(line)
    if "途中メッセージ" not in normalized:
        return False
    negative = ("出さない", "出さず", "足さない", "含めない", "禁止", "無言", "しない", "破棄")
    return not any(word in normalized for word in negative)


def blockquote_runs(lines: list[str]) -> list[int]:
    starts: list[int] = []
    run_start = 0
    run_length = 0
    for number, line in enumerate(lines + [""], start=1):
        is_prose_quote = bool(re.match(r"^\s*>\s+\S", line)) and not bool(
            re.match(r"^\s*>\s+(?:[-+*]|\d+[.)])\s+", line)
        )
        if is_prose_quote:
            if run_length == 0:
                run_start = number
            run_length += 1
        else:
            if run_length >= 3:
                starts.append(run_start)
            run_length = 0
    return starts


def validate(plugin: Path) -> list[str]:
    errors: list[str] = []
    owner = plugin / OWNER_REL
    if not owner.is_file():
        return [f"serializer owner missing: {owner}"]

    owner_text = owner.read_text(encoding="utf-8")
    required_owner_lines = ("やったこと:", "結果:", "次に何が起きるか:", "補足:")
    for required in required_owner_lines:
        if required not in owner_text:
            errors.append(f"serializer owner lacks canonical field: {required}")
    if "最終応答serializer（通常報告の唯一の正本）" not in owner_text:
        errors.append("serializer owner lacks unique-owner declaration")

    surfaces = user_surfaces(plugin)
    if len(surfaces) != 17:
        errors.append(f"unexpected user-facing surface count: {len(surfaces)} (expected 17)")

    schema_owners = {owner}
    for path in surfaces:
        if not path.is_file():
            errors.append(f"surface missing: {path}")
            continue
        text = path.read_text(encoding="utf-8")
        lines = text.splitlines()
        if "plain-language.md" not in text or "最終応答serializer" not in text:
            errors.append(f"serializer reference missing: {path}")
        for number, line in enumerate(lines, start=1):
            if prefix_kind(line):
                schema_owners.add(path)
                errors.append(f"fixed or synonymous prefix outside owner: {path}:{number}")
            if has_line_count_ownership(line):
                errors.append(f"line-count schema outside owner: {path}:{number}")
            if has_synonymous_schema(line):
                errors.append(f"synonymous three-field schema outside owner: {path}:{number}")
            if has_positive_intermediate_instruction(line):
                errors.append(f"intermediate-message instruction outside owner: {path}:{number}")
        for start in blockquote_runs(lines):
            errors.append(f"completed blockquote report example outside owner: {path}:{start}")

    if schema_owners != {owner}:
        extras = ", ".join(str(path) for path in sorted(schema_owners - {owner}))
        errors.append(f"serializer schema owner is not unique: {extras}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin-root", required=True, type=Path)
    args = parser.parse_args()
    errors = validate(args.plugin_root.resolve())
    if errors:
        for error in errors:
            print(f"SCHEMA_ERROR {error}", file=sys.stderr)
        return 1
    print("SCHEMA_OK owner=rules/plain-language.md surfaces=17 conflicts=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
