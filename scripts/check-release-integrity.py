#!/usr/bin/env python3
"""Validate manifests, the neutral plugin path, and legacy CHANGELOG compatibility."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")
HEADING = re.compile(r"^## \[(\d+\.\d+\.\d+)\](?: - \d{4}-\d{2}-\d{2})?$", re.M)
REQUIRED = ["対象者", "変わること", "設定・ファイルへの影響", "必要な操作", "互換性上の注意"]
PLUGIN_NAME = "yasashii-secretary"
PLUGIN_SOURCE = "./plugins/secretary"
REPOSITORY = "https://github.com/mtaiseeei/yasashii-secretary"
FORKED_FROM = "https://github.com/Shin-sibainu/cc-company"
AUTHOR = "mtaiseeei"


def version_key(value: str) -> tuple[int, int, int]:
    return tuple(int(part) for part in value.split("."))


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    try:
        market = json.loads((root / ".claude-plugin/marketplace.json").read_text())
        plugin = json.loads((root / "plugins/secretary/.claude-plugin/plugin.json").read_text())
        changelog_path = root / "plugins/secretary/CHANGELOG.md"
        legacy_root = root / "plugins/yasashii-secretary"
        legacy_changelog_path = legacy_root / "CHANGELOG.md"
        changelog_bytes = changelog_path.read_bytes()
        legacy_changelog_bytes = legacy_changelog_path.read_bytes()
        changelog = changelog_bytes.decode()
        legacy_changelog = legacy_changelog_bytes.decode()
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return [f"release surface unreadable: {error}"]

    legacy_entries = sorted(path.name for path in legacy_root.iterdir())
    if legacy_entries != ["CHANGELOG.md"]:
        errors.append("legacy plugin path must contain only CHANGELOG.md")
    if changelog_bytes != legacy_changelog_bytes:
        errors.append("legacy CHANGELOG differs byte-for-byte from canonical CHANGELOG")

    entries = [item for item in market.get("plugins", []) if item.get("name") == PLUGIN_NAME]
    market_version = entries[0].get("version") if len(entries) == 1 else None
    plugin_version = plugin.get("version")
    if market.get("name") != PLUGIN_NAME:
        errors.append("marketplace name is missing or invalid")
    if market.get("owner") != {"name": AUTHOR}:
        errors.append("marketplace owner is missing or invalid")
    if len(entries) != 1:
        errors.append("marketplace must contain exactly one yasashii-secretary entry")
    else:
        entry = entries[0]
        if entry.get("source") != PLUGIN_SOURCE:
            errors.append("marketplace plugin source is missing or invalid")
        if entry.get("author") != {"name": AUTHOR}:
            errors.append("marketplace plugin author is missing or invalid")
        if entry.get("license") != "MIT":
            errors.append("marketplace plugin license must be MIT")
        if entry.get("forkedFrom") != FORKED_FROM:
            errors.append("marketplace plugin forkedFrom is missing or invalid")

    if plugin.get("name") != PLUGIN_NAME:
        errors.append("plugin manifest name is missing or invalid")
    if plugin.get("author") != {"name": AUTHOR}:
        errors.append("plugin manifest author is missing or invalid")
    if plugin.get("license") != "MIT":
        errors.append("plugin manifest license must be MIT")
    if plugin.get("homepage") != REPOSITORY or plugin.get("repository") != REPOSITORY:
        errors.append("plugin manifest homepage/repository is missing or invalid")

    source_root = (root / PLUGIN_SOURCE).resolve()
    expected_root = (root / "plugins/secretary").resolve()
    if source_root != expected_root or not source_root.is_dir():
        errors.append("marketplace plugin source does not resolve to the distributed plugin")

    migration_path = root / "plugins/secretary/migrations/0.7.0-to-0.8.0.json"
    try:
        migration = json.loads(migration_path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"0.7.0 to 0.8.0 migration is unreadable: {error}")
    else:
        if migration.get("schemaVersion") != 1 or migration.get("fromVersion") != "0.7.0" or migration.get("toVersion") != "0.8.0" or not isinstance(migration.get("operations"), list):
            errors.append("0.7.0 to 0.8.0 migration metadata is invalid")

    try:
        license_text = (root / "LICENSE").read_text()
    except OSError as error:
        errors.append(f"LICENSE unreadable: {error}")
    else:
        if not license_text.startswith("MIT License\n"):
            errors.append("root LICENSE is not MIT")
        credit = "Shin-sibainu/cc-company (MIT)"
        if license_text.count(credit) != 1 or license_text.count("inherits credit from the original author") != 1:
            errors.append("LICENSE must keep one direct original-author credit")

    if not isinstance(market_version, str) or not SEMVER.fullmatch(market_version):
        errors.append("marketplace version is missing or not semver")
    if not isinstance(plugin_version, str) or not SEMVER.fullmatch(plugin_version):
        errors.append("plugin version is missing or not semver")
    if market_version != plugin_version:
        errors.append("marketplace and plugin versions differ")

    matches = list(HEADING.finditer(changelog))
    versions = [match.group(1) for match in matches]
    legacy_versions = HEADING.findall(legacy_changelog)
    if legacy_versions != versions:
        errors.append("legacy and canonical CHANGELOG version entries differ")
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
