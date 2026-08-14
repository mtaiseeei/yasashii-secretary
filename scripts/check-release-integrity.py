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
EXPECTED_SKILLS = {
    "build", "chatwork", "connections", "daily", "google-chat", "memory-care", "name",
    "onboarding", "projects", "secretary", "settings", "setup-google", "setup-microsoft",
    "setup-notion", "update", "weekly",
}


def version_key(value: str) -> tuple[int, int, int]:
    return tuple(int(part) for part in value.split("."))


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    try:
        market = json.loads((root / ".claude-plugin/marketplace.json").read_text())
        plugin = json.loads((root / "plugins/secretary/.claude-plugin/plugin.json").read_text())
        codex_market = json.loads((root / ".agents/plugins/marketplace.json").read_text())
        codex_plugin = json.loads((root / "plugins/secretary/.codex-plugin/plugin.json").read_text())
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
        errors.append(f"marketplace must contain exactly one {PLUGIN_NAME} entry")
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

    codex_entries = codex_market.get("plugins", [])
    if codex_market.get("name") != PLUGIN_NAME:
        errors.append("Codex marketplace name is missing or invalid")
    if codex_market.get("interface") != {"displayName": "Yasashii Secretary"}:
        errors.append("Codex marketplace interface is missing or invalid")
    if len(codex_entries) != 1:
        errors.append("Codex marketplace must contain exactly one plugin entry")
    else:
        codex_entry = codex_entries[0]
        if codex_entry.get("name") != PLUGIN_NAME:
            errors.append("Codex marketplace plugin name is missing or invalid")
        if codex_entry.get("source") != {"source": "local", "path": PLUGIN_SOURCE}:
            errors.append("Codex marketplace local source is missing or invalid")
        if codex_entry.get("policy") != {"installation": "AVAILABLE", "authentication": "ON_INSTALL"}:
            errors.append("Codex marketplace policy is missing or invalid")
        if codex_entry.get("category") != "Productivity":
            errors.append("Codex marketplace category is missing or invalid")

    if codex_plugin.get("name") != PLUGIN_NAME:
        errors.append("Codex plugin manifest name is missing or invalid")
    if codex_plugin.get("version") != "0.9.2":
        errors.append("Codex plugin manifest version must be 0.9.2")
    if codex_plugin.get("skills") != "./skills/":
        errors.append("Codex plugin manifest skills must be ./skills/")
    if codex_plugin.get("author", {}).get("name") != AUTHOR:
        errors.append("Codex plugin manifest author is missing or invalid")
    if codex_plugin.get("repository") != REPOSITORY or codex_plugin.get("homepage") != REPOSITORY:
        errors.append("Codex plugin manifest homepage/repository is missing or invalid")
    if codex_plugin.get("license") != "MIT":
        errors.append("Codex plugin manifest license must be MIT")
    if any(field in codex_plugin for field in ("apps", "mcpServers", "hooks")):
        errors.append("Codex plugin manifest declares a nonexistent or unsupported companion")
    codex_interface = codex_plugin.get("interface")
    if not isinstance(codex_interface, dict) or any(not codex_interface.get(field) for field in (
        "displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "defaultPrompt"
    )):
        errors.append("Codex plugin interface metadata is incomplete")

    skills_root = root / "plugins/secretary/skills"
    skill_names = {path.parent.name for path in skills_root.glob("*/SKILL.md")}
    for name in sorted(skill_names - EXPECTED_SKILLS):
        errors.append(f"unexpected formal Skill: {name}")
    for name in sorted(EXPECTED_SKILLS - skill_names):
        errors.append(f"expected formal Skill missing: {name}")
    if len(skill_names) != 16:
        errors.append(f"Codex plugin must reference the 16 unique shared skills (found {len(skill_names)})")
    if (root / ".agents/skills").exists():
        errors.append("repo-local .agents/skills duplicates the formal bundled skills")

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

    current_migration_path = root / "plugins/secretary/migrations/0.8.0-to-0.9.0.json"
    try:
        current_migration = json.loads(current_migration_path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"0.8.0 to 0.9.0 migration is unreadable: {error}")
    else:
        if current_migration.get("fromVersion") != "0.8.0" or current_migration.get("toVersion") != "0.9.0" or current_migration.get("operations", [{}])[0].get("type") != "replace-section":
            errors.append("0.8.0 to 0.9.0 migration metadata is invalid")

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
    if market_version != plugin_version or plugin_version != codex_plugin.get("version"):
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
