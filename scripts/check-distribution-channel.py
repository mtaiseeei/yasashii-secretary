#!/usr/bin/env python3
"""Current public/distribution surfaces must stay channel-neutral and releasable."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path


CURRENT_FILES = {
    "AGENTS.md": "project guidance",
    "CLAUDE.md": "project guidance",
    "LICENSE": "public license",
    "README.md": "public entrypoint",
    "docs/DESIGN.md": "current design",
    "docs/harness-guidance.md": "project guidance",
    "docs/proposal-2026-07-15-realignment.md": "current proposal",
    "docs/spec.md": "current specification index",
    "docs/sprints/state.md": "current orchestration state",
    "docs/sprints/sprint-018.md": "current sprint contract",
    "docs/progress/sprint-018.md": "current generator handoff",
}

TARGET_PREFIXES = {
    ".claude-plugin/": "distribution manifest",
    "docs/assets/": "public README asset",
    "docs/guide/": "public guide",
    "docs/spec/": "current specification",
    "docs/evidence/sprint-016/": "current sprint evidence",
    "plugins/yasashii-secretary/": "distributed plugin",
}

EXCLUDE_PREFIXES = {
    "backup/": "archived plan; preserved as an audit record",
    "docs/evidence/": "completed sprint evidence; preserved as an audit record",
    "docs/feedback/": "completed evaluator record; preserved as an audit record",
    "docs/progress/": "completed generator record; preserved as an audit record",
    "docs/sprints/": "completed sprint contract; preserved as an audit record",
    "scripts/": "development verification tooling; not a public or distributed user surface",
}


def forbidden_patterns() -> list[tuple[str, str, bool]]:
    # Split literals keep the checker itself out of naive repository-wide matches.
    return [
        ("legacy-channel-ja", "ゆる" + "AI", False),
        ("legacy-school-ja", "コーディング" + "塾", False),
        ("legacy-channel-en", "Yuru" + " AI" + " Coding" + " Juku", True),
        ("legacy-audience-heading", "受講者" + "・非エンジニア向け", False),
        ("legacy-audience", "受講者" + "向け", False),
        ("legacy-student-audience", "受講生" + "向け", False),
        ("legacy-cohort", "第" + "2期", False),
        ("legacy-lesson", "第" + "1回座学", False),
        ("legacy-curriculum-link", "カリキュラム" + "への導線", False),
        ("legacy-student-label", "塾" + "生", False),
    ]


def git_files(root: Path) -> list[str]:
    result = subprocess.run(
        [
            "git",
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ],
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
    )
    return sorted(item for item in result.stdout.decode().split("\0") if item)


def classify(path: str) -> tuple[bool, str, str]:
    if path in CURRENT_FILES:
        return True, "target", CURRENT_FILES[path]
    for prefix, reason in TARGET_PREFIXES.items():
        if path.startswith(prefix):
            return True, "target", reason
    for prefix, reason in EXCLUDE_PREFIXES.items():
        if path.startswith(prefix):
            return False, prefix, reason
    return False, "other", "repository metadata or development-only file outside current user surfaces"


def inventory(root: Path) -> tuple[list[tuple[str, str]], list[tuple[str, str, str]]]:
    targets: list[tuple[str, str]] = []
    excluded: list[tuple[str, str, str]] = []
    for path in git_files(root):
        is_target, rule, reason = classify(path)
        if is_target:
            targets.append((path, reason))
        else:
            excluded.append((path, rule, reason))
    return targets, excluded


def scan(root: Path, targets: list[tuple[str, str]]) -> tuple[list[str], list[str]]:
    findings: list[str] = []
    binaries: list[str] = []
    for relative, _reason in targets:
        path = root / relative
        if not path.is_file():
            findings.append(f"missing-target:{relative}")
            continue
        data = path.read_bytes()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            binaries.append(relative)
            continue
        for label, needle, ignore_case in forbidden_patterns():
            haystack = text.casefold() if ignore_case else text
            candidate = needle.casefold() if ignore_case else needle
            for line_number, line in enumerate(haystack.splitlines(), start=1):
                if candidate in line:
                    findings.append(f"{label}:{relative}:{line_number}")
    return findings, binaries


def report_inventory(
    targets: list[tuple[str, str]], excluded: list[tuple[str, str, str]], binaries: list[str]
) -> None:
    print(f"TARGET_COUNT={len(targets)}")
    for path, reason in targets:
        print(f"TARGET {path} :: {reason}")
    counts = Counter(rule for _path, rule, _reason in excluded)
    reasons = {rule: reason for _path, rule, reason in excluded}
    print(f"EXCLUDED_COUNT={len(excluded)}")
    for rule in sorted(counts):
        print(f"EXCLUDE_RULE {rule} count={counts[rule]} :: {reasons[rule]}")
    print(f"BINARY_TARGET_COUNT={len(binaries)}")
    for path in binaries:
        print(f"BINARY_TARGET {path} :: requires visual inspection")


def protected_history_changes(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--"],
        cwd=root,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )
    changed = [line for line in result.stdout.splitlines() if line]
    protected: list[str] = []
    for path in changed:
        if path.startswith(("backup/", "docs/evidence/", "docs/feedback/")):
            protected.append(path)
        elif path.startswith("docs/progress/") and path != "docs/progress/sprint-018.md":
            protected.append(path)
        elif path.startswith("docs/sprints/") and path not in {
            "docs/sprints/state.md",
            "docs/sprints/sprint-018.md",
        }:
            protected.append(path)
    return protected


def preservation_errors(root: Path) -> list[str]:
    errors: list[str] = []
    readme = (root / "README.md").read_text()
    license_text = (root / "LICENSE").read_text()
    market = json.loads((root / ".claude-plugin/marketplace.json").read_text())
    plugin = json.loads(
        (root / "plugins/yasashii-secretary/.claude-plugin/plugin.json").read_text()
    )
    entry = market.get("plugins", [{}])[0]

    if "MIT License" not in license_text or "MIT" not in readme:
        errors.append("MIT marker is missing")
    for surface, text in (("README", readme), ("LICENSE", license_text)):
        if "Shin-sibainu/cc-company" not in text:
            errors.append(f"{surface} lost the direct original-author credit")
        if "bootcamp-company" in text or "inoshinichi" in text:
            errors.append(f"{surface} introduced an additional credit layer")
    if entry.get("forkedFrom") != "https://github.com/Shin-sibainu/cc-company":
        errors.append("forkedFrom changed")
    if market.get("name") != "yasashii-secretary":
        errors.append("marketplace identity changed")
    if entry.get("name") != "yasashii-secretary" or plugin.get("name") != "yasashii-secretary":
        errors.append("plugin identity changed")
    if entry.get("source") != "./plugins/yasashii-secretary":
        errors.append("plugin source changed")
    release_version = entry.get("version")
    if release_version != plugin.get("version") or not re.fullmatch(r"\d+\.\d+\.\d+", str(release_version or "")):
        errors.append("release version is not a matching semver on both manifests")
    if not (root / "plugins/yasashii-secretary/CHANGELOG.md").is_file():
        errors.append("distributed CHANGELOG is missing")
    if not (root / "plugins/yasashii-secretary/skills/update/SKILL.md").is_file():
        errors.append("read-only update skill is missing")
    for required in ("update-diagnose.mjs", "update-ledger.mjs", "update-apply.mjs"):
        if not (root / "plugins/yasashii-secretary/scripts" / required).is_file():
            errors.append(f"update support script is missing: {required}")
    if not (root / "plugins/yasashii-secretary/migrations/0.3.0-to-0.4.0.json").is_file():
        errors.append("version-specific workspace migration is missing")

    public_paths = [
        root / "README.md",
        root / "CLAUDE.md",
        root / ".claude-plugin/marketplace.json",
        root / "plugins/yasashii-secretary",
        root / "docs/guide",
    ]
    future_terms = ("Google" + " Chat", "GOOGLE" + "_CHAT")
    for candidate in public_paths:
        files = [candidate] if candidate.is_file() else sorted(candidate.rglob("*"))
        for path in files:
            if not path.is_file():
                continue
            try:
                text = path.read_text()
            except UnicodeDecodeError:
                continue
            if any(term in text for term in future_terms):
                errors.append(f"future integration leaked into {path.relative_to(root)}")
    errors.extend(f"protected record changed:{path}" for path in protected_history_changes(root))
    return errors


def run_self_test() -> list[str]:
    errors: list[str] = []
    forbidden = "ゆる" + "AI" + "コーディング" + "塾"
    with tempfile.TemporaryDirectory(prefix="sprint-016-fixture-") as temp:
        root = Path(temp)
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        (root / "README.md").write_text("# 一般の非エンジニア向け\n")
        audit = root / "docs/progress/sprint-001.md"
        audit.parent.mkdir(parents=True)
        audit.write_text(forbidden + "\n")
        subprocess.run(["git", "add", "."], cwd=root, check=True)
        targets, _excluded = inventory(root)
        findings, _binaries = scan(root, targets)
        if findings:
            errors.append("excluded audit fixture caused a false positive")

        (root / "README.md").write_text(forbidden + "\n")
        targets, _excluded = inventory(root)
        findings, _binaries = scan(root, targets)
        if not findings:
            errors.append("target-surface negative fixture was not detected")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        errors = run_self_test()
        if errors:
            for error in errors:
                print(f"FAIL {error}")
            return 1
        print("PASS target-surface negative fixture is detected")
        print("PASS excluded audit fixture does not cause a false positive")
        return 0

    root = args.root.resolve()
    targets, excluded = inventory(root)
    findings, binaries = scan(root, targets)
    if args.report:
        report_inventory(targets, excluded, binaries)

    errors = [f"forbidden-current-surface:{item}" for item in findings]
    errors.extend(preservation_errors(root))
    if errors:
        for error in errors:
            print(f"FAIL {error}")
        return 1
    print("PASS current target surfaces contain no legacy channel-specific expression")
    print("PASS MIT, direct credit, forkedFrom, identities, and release version are preserved")
    print("PASS protected audit records and completed sprint contracts are unchanged")
    print("PASS Sprint 018 update surfaces and version-specific migration exist without future chat integration leakage")
    return 0


if __name__ == "__main__":
    sys.exit(main())
