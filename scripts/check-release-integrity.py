#!/usr/bin/env python3
"""Validate manifests, the neutral plugin path, and legacy CHANGELOG compatibility."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
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
    "build", "chatwork", "clarity", "connections", "daily", "google-chat", "memory-care", "name",
    "onboarding", "projects", "secretary", "settings", "setup-google", "setup-microsoft",
    "setup-notion", "update", "weekly",
}
SUPPORTED_UPDATE_SOURCES = ["0.8.0", "0.9.0", "0.9.1", "0.9.2", "0.10.0", "0.10.1", "0.10.2", "0.10.3", "0.12.0", "0.13.0"]
MANAGED_MIGRATION_PATHS = {"secretary/AGENTS.md", "secretary/CLAUDE.md"}


def version_key(value: str) -> tuple[int, int, int]:
    return tuple(int(part) for part in value.split("."))


def validate_migration_graph(root: Path, current_version: str | None) -> list[str]:
    errors: list[str] = []
    migration_root = root / "plugins/secretary/migrations"
    try:
        supported = json.loads((migration_root / "supported.json").read_text())
    except (OSError, json.JSONDecodeError) as error:
        return [f"migration supported-source declaration is unreadable: {error}"]
    if supported != {"schemaVersion": 1, "currentFamilyMinimum": "0.13.0", "supportedFrom": SUPPORTED_UPDATE_SOURCES}:
        errors.append("migration supported-source declaration is invalid")

    edges: dict[str, list[str]] = {}
    seen_edges: set[tuple[str, str]] = set()
    operation_ids: set[str] = set()
    pattern = re.compile(r"^(\d+\.\d+\.\d+)-to-(\d+\.\d+\.\d+)\.json$")
    for path in sorted(migration_root.glob("*-to-*.json")):
        match = pattern.fullmatch(path.name)
        if not match:
            errors.append(f"migration filename is invalid: {path.name}")
            continue
        from_version, to_version = match.groups()
        edge = (from_version, to_version)
        if edge in seen_edges:
            errors.append(f"duplicate migration edge: {from_version}->{to_version}")
        seen_edges.add(edge)
        if version_key(from_version) >= version_key(to_version):
            errors.append(f"migration edge must move forward: {from_version}->{to_version}")
        edges.setdefault(from_version, []).append(to_version)
        try:
            manifest = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"migration manifest is unreadable: {path.name}: {error}")
            continue
        operations = manifest.get("operations")
        if manifest.get("schemaVersion") != 1 or manifest.get("fromVersion") != from_version or manifest.get("toVersion") != to_version or not isinstance(operations, list):
            errors.append(f"migration metadata is invalid: {path.name}")
            continue
        content_changed = manifest.get("contentChanged")
        if content_changed is not None and not isinstance(content_changed, bool):
            errors.append(f"migration contentChanged is invalid: {path.name}")
        if content_changed is True and not operations:
            errors.append(f"migration with managed content changes has no operations: {path.name}")
        if content_changed is False and operations:
            errors.append(f"migration without managed content changes has operations: {path.name}")
        for operation in operations:
            operation_id = operation.get("id") if isinstance(operation, dict) else None
            if not isinstance(operation_id, str) or not operation_id.strip() or operation_id in operation_ids:
                errors.append(f"migration operation id is invalid or duplicate: {path.name}")
                continue
            operation_ids.add(operation_id)
            operation_type = operation.get("type")
            if operation.get("path") not in MANAGED_MIGRATION_PATHS or operation_type not in {"append-section", "replace-section"}:
                errors.append(f"migration operation is outside the managed surface: {path.name}:{operation_id}")
            for field in ("marker", "asset"):
                value = operation.get(field)
                if not isinstance(value, str) or not value.strip():
                    errors.append(f"migration operation field is invalid: {path.name}:{operation_id}:{field}")
            if operation_type == "replace-section":
                for field in ("oldAsset", "endMarker", "templateFingerprint"):
                    value = operation.get(field)
                    if not isinstance(value, str) or not value.strip():
                        errors.append(f"migration replace field is invalid: {path.name}:{operation_id}:{field}")
            for field in (["asset"] if operation_type == "append-section" else ["asset", "oldAsset"]):
                value = operation.get(field)
                if not isinstance(value, str) or not value.strip():
                    errors.append(f"migration asset field is invalid: {path.name}:{operation_id}:{field}")
                    continue
                candidate = (migration_root / value).resolve()
                try:
                    candidate.relative_to(migration_root.resolve())
                except ValueError:
                    errors.append(f"migration asset escapes the distribution: {path.name}:{operation_id}:{field}")
                    continue
                if not candidate.is_file():
                    errors.append(f"migration asset is missing: {path.name}:{operation_id}:{field}")
            old_asset_hash = operation.get("oldAssetSha256")
            if old_asset_hash is not None:
                old_asset = (migration_root / str(operation.get("oldAsset", ""))).resolve()
                if not re.fullmatch(r"[a-f0-9]{64}", str(old_asset_hash)) or not old_asset.is_file():
                    errors.append(f"migration old asset fingerprint is invalid: {path.name}:{operation_id}")
                else:
                    digest = hashlib.sha256(old_asset.read_text().rstrip().encode()).hexdigest()
                    if digest != old_asset_hash:
                        errors.append(f"migration old asset fingerprint differs: {path.name}:{operation_id}")

    visiting: set[str] = set()
    visited: set[str] = set()
    def visit(version: str) -> None:
        if version in visiting:
            errors.append(f"migration graph contains a cycle at {version}")
            return
        if version in visited:
            return
        visiting.add(version)
        for target in edges.get(version, []):
            visit(target)
        visiting.remove(version)
        visited.add(version)
    for version in list(edges):
        visit(version)

    if isinstance(current_version, str) and SEMVER.fullmatch(current_version):
        for source in SUPPORTED_UPDATE_SOURCES:
            queue = [source]
            reached = {source}
            while queue:
                version = queue.pop(0)
                if version == current_version:
                    break
                for target in edges.get(version, []):
                    if target not in reached:
                        reached.add(target)
                        queue.append(target)
            if current_version not in reached:
                errors.append(f"supported migration source cannot reach current version: {source}->{current_version}")

    if (root / ".git").exists():
        tags = subprocess.run(["git", "-C", str(root), "tag", "--list"], capture_output=True, text=True, check=False)
        if tags.returncode != 0:
            errors.append("published update-source tags could not be checked")
        else:
            published = set(tags.stdout.splitlines())
            for source in SUPPORTED_UPDATE_SOURCES:
                if f"v{source}" not in published:
                    errors.append(f"supported migration source has no published tag: {source}")
    return errors


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
        changelog = changelog_bytes.decode().replace("\r\n", "\n")
        legacy_changelog = legacy_changelog_bytes.decode().replace("\r\n", "\n")
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
    if codex_plugin.get("version") != "0.13.1":
        errors.append("Codex plugin manifest version must be 0.13.1")
    if codex_plugin.get("skills") != "./skills/":
        errors.append("Codex plugin manifest skills must be ./skills/")
    if codex_plugin.get("author", {}).get("name") != AUTHOR:
        errors.append("Codex plugin manifest author is missing or invalid")
    if codex_plugin.get("repository") != REPOSITORY or codex_plugin.get("homepage") != REPOSITORY:
        errors.append("Codex plugin manifest homepage/repository is missing or invalid")
    if codex_plugin.get("license") != "MIT":
        errors.append("Codex plugin manifest license must be MIT")
    if any(field in codex_plugin for field in ("apps", "mcpServers")):
        errors.append("Codex plugin manifest declares a nonexistent or unsupported companion")
    if codex_plugin.get("hooks") != "./hooks/hooks.json":
        errors.append("Codex plugin manifest must reference the common Hook manifest")
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
    if len(skill_names) != 17:
        errors.append(f"Codex plugin must reference the 17 unique shared skills (found {len(skill_names)})")
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

    errors.extend(validate_migration_graph(root, plugin_version if isinstance(plugin_version, str) else None))

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
