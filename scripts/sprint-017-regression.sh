#!/usr/bin/env bash
# Sprint 017: 読み取り専用の更新診断、release整合、最小台帳を検証する。
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

python3 - "$REPO" <<'PY'
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

repo = Path(sys.argv[1])
plugin = repo / "plugins/secretary"
diagnose = plugin / "scripts/update-diagnose.mjs"
ledger = plugin / "scripts/update-ledger.mjs"
edition_guard = plugin / "scripts/edition-guard.mjs"
integrity = repo / "scripts/check-release-integrity.py"
passed = 0
failed = 0

def check(label, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS {label}")
    else:
        failed += 1
        print(f"  FAIL {label}")

def run(command, **kwargs):
    return subprocess.run(command, text=True, capture_output=True, **kwargs)

def snapshot(root):
    result = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and not path.is_symlink():
            result[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
        elif path.is_symlink():
            result[str(path.relative_to(root))] = f"symlink:{os.readlink(path)}"
    return result

print("== release integrity ==")
result = run([sys.executable, str(integrity), "--root", str(repo)])
check("現行manifestとCHANGELOGが一致", result.returncode == 0)

with tempfile.TemporaryDirectory(prefix="sprint017-release-") as temp:
    root = Path(temp).resolve()
    (root / ".claude-plugin").mkdir(parents=True)
    (root / "plugins/secretary/.claude-plugin").mkdir(parents=True)
    (root / "plugins/yasashii-secretary").mkdir(parents=True)
    shutil.copy(repo / ".claude-plugin/marketplace.json", root / ".claude-plugin/marketplace.json")
    shutil.copy(plugin / ".claude-plugin/plugin.json", root / "plugins/secretary/.claude-plugin/plugin.json")
    shutil.copy(plugin / "CHANGELOG.md", root / "plugins/secretary/CHANGELOG.md")
    shutil.copy(plugin / "CHANGELOG.md", root / "plugins/yasashii-secretary/CHANGELOG.md")

    data = json.loads((root / "plugins/secretary/.claude-plugin/plugin.json").read_text())
    data["version"] = "0.2.9"
    (root / "plugins/secretary/.claude-plugin/plugin.json").write_text(json.dumps(data))
    check("manifest version不一致を拒否", run([sys.executable, str(integrity), "--root", str(root)]).returncode != 0)
    shutil.copy(plugin / ".claude-plugin/plugin.json", root / "plugins/secretary/.claude-plugin/plugin.json")

    original = (plugin / "CHANGELOG.md").read_text()
    changed = original.replace("### 必要な操作", "### 操作", 1)
    (root / "plugins/secretary/CHANGELOG.md").write_text(changed)
    (root / "plugins/yasashii-secretary/CHANGELOG.md").write_text(changed)
    check("CHANGELOG必須項目欠落を拒否", run([sys.executable, str(integrity), "--root", str(root)]).returncode != 0)
    changed = original + "\n## [0.3.0] - 2026-07-17\n"
    (root / "plugins/secretary/CHANGELOG.md").write_text(changed)
    (root / "plugins/yasashii-secretary/CHANGELOG.md").write_text(changed)
    check("CHANGELOG重複versionを拒否", run([sys.executable, str(integrity), "--root", str(root)]).returncode != 0)
    parts = original.split("## [")
    reversed_log = parts[0] + "## [" + parts[2] + "## [" + parts[1]
    (root / "plugins/secretary/CHANGELOG.md").write_text(reversed_log)
    (root / "plugins/yasashii-secretary/CHANGELOG.md").write_text(reversed_log)
    check("CHANGELOGの降順崩れを拒否", run([sys.executable, str(integrity), "--root", str(root)]).returncode != 0)

print("== minimal ledger and diagnosis ==")
with tempfile.TemporaryDirectory(prefix="sprint017-workspace-") as temp:
    base = Path(temp).resolve()
    workspace = base / "workspace"
    fake_plugin = base / "plugin"
    latest_manifest = base / "latest.json"
    workspace.mkdir()
    (fake_plugin / ".claude-plugin").mkdir(parents=True)
    (fake_plugin / "rules/copy").mkdir(parents=True)
    shutil.copy(plugin / ".claude-plugin/plugin.json", fake_plugin / ".claude-plugin/plugin.json")
    shutil.copy(plugin / "edition.json", fake_plugin / "edition.json")
    shutil.copy(plugin / "rules/copy/yasashii.json", fake_plugin / "rules/copy/yasashii.json")
    shutil.copy(repo / ".claude-plugin/marketplace.json", latest_manifest)
    (workspace / "secretary/memory/decisions").mkdir(parents=True)
    (workspace / ".claude").mkdir()
    (workspace / "secretary/AGENTS.md").write_text("safe template\n")
    (workspace / "secretary/CLAUDE.md").write_text("pointer\n")
    (workspace / "secretary/memory/MEMORY.md").write_text("index\n")
    (workspace / "secretary/memory/preferences.md").write_text("detail: short\n")
    (workspace / ".claude/settings.json").write_text('{"enabledPlugins":{}}\n')
    run(["git", "init", "-q"], cwd=workspace)
    run(["node", str(edition_guard), "--workspace", str(workspace), "--plugin-root", str(fake_plugin),
         "--entry", "onboarding", "--prepare-new", "--json"])

    init = run([
        "node", str(ledger), "init", "--workspace", str(workspace), "--plugin-root", str(fake_plugin),
        "--managed-path", "secretary/AGENTS.md", "--managed-path", "secretary/CLAUDE.md",
        "--managed-path", "secretary/memory/MEMORY.md", "--managed-path", "secretary/memory/preferences.md",
        "--template-variable", "CREATED_DATE=2026-07-17", "--template-variable", "REPORT_DETAIL=みじかく",
        "--new-install", "--confirm",
    ])
    ledger_path = workspace / ".secretary/update-ledger.json"
    check("新規導入で最小台帳を作成", init.returncode == 0 and ledger_path.is_file())
    ledger_value = json.loads(ledger_path.read_text())
    records = ledger_value["records"]
    check("新規台帳はschemaVersionとeditionを持つ", ledger_value["schemaVersion"] == 2 and ledger_value["edition"] == "yasashii-secretary")
    check("台帳は許可4項目だけ", all(set(item) == {"path", "installedVersion", "baselineHash", "templateVariables"} for item in records))
    check("台帳に本文を保存しない", "safe template" not in ledger_path.read_text() and "detail: short" not in ledger_path.read_text())
    check("台帳の生成変数は許可listだけ", all(set(item["templateVariables"]) <= {"CREATED_DATE", "CREATED_AT", "REPORT_DETAIL"} for item in records))
    check("既存台帳を上書きしない", run([
        "node", str(ledger), "init", "--workspace", str(workspace), "--plugin-root", str(fake_plugin),
        "--managed-path", "secretary/AGENTS.md", "--new-install", "--confirm"
    ]).returncode != 0)

    private_workspace = base / "private-workspace"
    (private_workspace / "secretary").mkdir(parents=True)
    (private_workspace / "secretary/AGENTS.md").write_text("x")
    run(["node", str(edition_guard), "--workspace", str(private_workspace), "--plugin-root", str(fake_plugin),
         "--entry", "onboarding", "--prepare-new", "--json"])
    refused = run([
        "node", str(ledger), "init", "--workspace", str(private_workspace), "--plugin-root", str(fake_plugin),
        "--managed-path", "secretary/AGENTS.md", "--template-variable", "OWNER_NAME=個人名",
        "--new-install", "--confirm",
    ])
    check("私的生成変数を拒否して台帳を作らない", refused.returncode != 0 and not (private_workspace / ".secretary/update-ledger.json").exists())
    invalid_private = run([
        "node", str(ledger), "init", "--workspace", str(private_workspace), "--plugin-root", str(fake_plugin),
        "--managed-path", "secretary/AGENTS.md", "--template-variable", "CREATED_DATE=個人名",
        "--new-install", "--confirm",
    ])
    check("許可名でも私的値になり得る形式を拒否", invalid_private.returncode != 0 and not (private_workspace / ".secretary/update-ledger.json").exists())

    symlink_workspace = base / "symlink-workspace"
    outside = base / "outside"
    (symlink_workspace / "secretary").mkdir(parents=True)
    outside.mkdir()
    (symlink_workspace / "secretary/AGENTS.md").write_text("x")
    (symlink_workspace / ".secretary").symlink_to(outside, target_is_directory=True)
    refused = run([
        "node", str(ledger), "init", "--workspace", str(symlink_workspace), "--plugin-root", str(fake_plugin),
        "--managed-path", "secretary/AGENTS.md", "--new-install", "--confirm",
    ])
    check("台帳directoryのsymlink越え書込を拒否", refused.returncode != 0 and not (outside / "update-ledger.json").exists())

    before = snapshot(base)
    outputs = {}
    for choice in ("check-only", "decline", "cancel", "proceed-update"):
        result = run([
            "node", str(diagnose), "--workspace", str(workspace), "--plugin-root", str(fake_plugin),
            "--latest-manifest", str(latest_manifest), "--changelog", str(plugin / "CHANGELOG.md"),
            "--choice", choice, "--json",
        ])
        outputs[choice] = json.loads(result.stdout) if result.returncode == 0 else {}
    after = snapshot(base)
    check("確認・見送り・中止・実更新希望の全choiceが書き込まない", before == after)
    check("同一versionをsameと判定", outputs["check-only"].get("status") == "same")
    check("clean workspaceを判定", outputs["check-only"].get("workspace", {}).get("status") == "clean")
    check("side effect countersが全て0", all(all(value == 0 for value in item.get("sideEffects", {}).values()) for item in outputs.values()))
    check("同一versionは実更新を利用不可にして診断中に停止", outputs["proceed-update"].get("choices", [{}, {}])[1].get("available") is False and "すでに最新版" in outputs["proceed-update"].get("selectedOutcome", ""))

    (workspace / "secretary/AGENTS.md").write_text("customized\n")
    customized_before = snapshot(workspace)
    customized = run([
        "node", str(diagnose), "--workspace", str(workspace), "--plugin-root", str(fake_plugin),
        "--latest-manifest", str(latest_manifest), "--changelog", str(plugin / "CHANGELOG.md"), "--json",
    ])
    customized_data = json.loads(customized.stdout)
    check("変更済みworkspaceをcustomizedと判定", customized_data["workspace"]["status"] == "customized")
    check("customized診断でも書き込まない", customized_before == snapshot(workspace))

    ledgerless = base / "ledgerless"
    ledgerless.mkdir()
    ledgerless_before = snapshot(ledgerless)
    output = run(["node", str(diagnose), "--workspace", str(ledgerless), "--plugin-root", str(fake_plugin), "--no-network", "--json"])
    ledgerless_data = json.loads(output.stdout)
    check("台帳なしはledgerless、最新版なしはlatest-unverified", ledgerless_data["workspace"]["status"] == "ledgerless" and ledgerless_data["status"] == "latest-unverified")
    check("診断時に台帳を後付けしない", ledgerless_before == snapshot(ledgerless))

    old_plugin = base / "old-plugin"
    (old_plugin / ".claude-plugin").mkdir(parents=True)
    (old_plugin / "rules/copy").mkdir(parents=True)
    (old_plugin / ".claude-plugin/plugin.json").write_text('{"name":"yasashii-secretary","version":"0.2.0"}\n')
    shutil.copy(plugin / "edition.json", old_plugin / "edition.json")
    shutil.copy(plugin / "rules/copy/yasashii.json", old_plugin / "rules/copy/yasashii.json")
    output = run([
        "node", str(diagnose), "--workspace", str(ledgerless), "--plugin-root", str(old_plugin),
        "--latest-manifest", str(latest_manifest), "--changelog", str(plugin / "CHANGELOG.md"), "--json",
    ])
    check("古い現在版はupdate-available", json.loads(output.stdout)["status"] == "update-available")

    unknown_plugin = base / "unknown-plugin"
    (unknown_plugin / ".claude-plugin").mkdir(parents=True)
    (unknown_plugin / "rules/copy").mkdir(parents=True)
    (unknown_plugin / ".claude-plugin/plugin.json").write_text('{"name":"yasashii-secretary"}\n')
    shutil.copy(plugin / "edition.json", unknown_plugin / "edition.json")
    shutil.copy(plugin / "rules/copy/yasashii.json", unknown_plugin / "rules/copy/yasashii.json")
    output = run([
        "node", str(diagnose), "--workspace", str(ledgerless), "--plugin-root", str(unknown_plugin),
        "--latest-manifest", str(latest_manifest), "--changelog", str(plugin / "CHANGELOG.md"), "--json",
    ])
    check("現在版不明はcurrent-unknown", json.loads(output.stdout)["status"] == "current-unknown")

    broken_changelog = base / "broken-changelog.md"
    broken_changelog.write_text((plugin / "CHANGELOG.md").read_text().replace("### 必要な操作", "### 操作", 1))
    output = run([
        "node", str(diagnose), "--workspace", str(ledgerless), "--plugin-root", str(fake_plugin),
        "--latest-manifest", str(latest_manifest), "--changelog", str(broken_changelog), "--json",
    ])
    check("説明不完全な公開版をlatest-unverifiedにする", json.loads(output.stdout)["status"] == "latest-unverified")

    secret = "TOP-SECRET-987654"
    hostile = {"schemaVersion": 2, "edition": "yasashii-secretary", "records": [
        {"path":"secretary/AGENTS.md","installedVersion":"0.3.0","baselineHash":"sha256:" + "0"*64,
         "templateVariables":{"CREATED_DATE":"secret=" + secret}}
    ]}
    ledger_path.write_text(json.dumps(hostile))
    output = run([
        "node", str(diagnose), "--workspace", str(workspace), "--plugin-root", str(fake_plugin),
        "--latest-manifest", str(latest_manifest), "--changelog", str(plugin / "CHANGELOG.md"), "--json",
    ])
    check("不正台帳をunknown-baselineとして扱う", json.loads(output.stdout)["workspace"]["status"] == "unknown-baseline")
    check("不正台帳の秘密値を出力しない", secret not in output.stdout and secret not in output.stderr)

print("== static safety and public guidance ==")
source = diagnose.read_text()
check("診断scriptは書込APIとchild_processを使わない", not any(term in source for term in ("writeFile", "appendFile", "renameSync", "rmSync", "child_process")))
check("診断scriptからworkspace migrationを実行しない", "update-apply" not in source and "migrations" not in source)
guide = (repo / "docs/guide/updates.md").read_text()
skill = (plugin / "skills/update/SKILL.md").read_text()
check("第三者marketplaceの自動更新既定offを明記", "第三者marketplaceの自動更新は既定で無効" in guide and "第三者marketplaceの自動更新は既定で無効" in skill)
check("自動更新でもworkspaceは自動置換しないと明記", "workspaceへコピー" in guide and "自動では置き換わりません" in guide)
check("更新診断へGoogle Chat変更を混在させない", "skills/google-chat" not in skill and "google-chat/" not in source and "wizard-server" not in source)

print(f"PASS={passed} FAIL={failed}")
sys.exit(1 if failed else 0)
PY
