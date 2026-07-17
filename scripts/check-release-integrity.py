#!/usr/bin/env python3
"""Validate that the two manifests and distributed CHANGELOG describe one release."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
HEADING = re.compile(r"^## \[(\d+\.\d+\.\d+)\](?: - \d{4}-\d{2}-\d{2})?$", re.M)
REQUIRED = ["対象者", "変わること", "設定・ファイルへの影響", "必要な操作", "互換性上の注意"]


def version_key(value: str) -> tuple[int, int, int]:
    return tuple(int(part) for part in value.split("."))


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    try:
        market = json.loads((root / ".claude-plugin/marketplace.json").read_text())
        plugin = json.loads((root / "plugins/yasashii-secretary/.claude-plugin/plugin.json").read_text())
        changelog = (root / "plugins/yasashii-secretary/CHANGELOG.md").read_text()
    except (OSError, json.JSONDecodeError) as error:
        return [f"release surface unreadable: {error}"]

    entries = [item for item in market.get("plugins", []) if item.get("name") == "yasashii-secretary"]
    market_version = entries[0].get("version") if len(entries) == 1 else None
    plugin_version = plugin.get("version")
    if not isinstance(market_version, str) or not SEMVER.fullmatch(market_version):
        errors.append("marketplace version is missing or not semver")
    if not isinstance(plugin_version, str) or not SEMVER.fullmatch(plugin_version):
        errors.append("plugin version is missing or not semver")
    if market_version != plugin_version:
        errors.append("marketplace and plugin versions differ")

    matches = list(HEADING.finditer(changelog))
    versions = [match.group(1) for match in matches]
    if not versions:
        errors.append("CHANGELOG has no release heading")
        return errors
    if len(versions) != len(set(versions)):
        errors.append("CHANGELOG has duplicate release headings")
    if versions != sorted(versions, key=version_key, reverse=True):
        errors.append("CHANGELOG releases are not newest-first")
    if plugin_version and versions[0] != plugin_version:
        errors.append("latest CHANGELOG release differs from manifest version")

    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(changelog)
        body = changelog[match.end():end]
        headings = re.findall(r"^### (.+)$", body, re.M)
        for required in REQUIRED:
            count = headings.count(required)
            if count != 1:
                errors.append(f"CHANGELOG {match.group(1)} requires one heading: {required} (found {count})")
        known = [heading for heading in headings if heading in REQUIRED]
        if known != REQUIRED:
            errors.append(f"CHANGELOG {match.group(1)} required headings are out of order")
        for required in REQUIRED:
            section = re.search(
                rf"^### {re.escape(required)}\n(?P<body>.*?)(?=^### |\Z)", body, re.M | re.S
            )
            if section and not re.search(r"^- .+", section.group("body"), re.M):
                errors.append(f"CHANGELOG {match.group(1)} section is empty: {required}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors = validate(args.root.resolve())
    if errors:
        for error in errors:
            print(f"FAIL {error}")
        return 1
    print("PASS release integrity: manifests and CHANGELOG are consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
