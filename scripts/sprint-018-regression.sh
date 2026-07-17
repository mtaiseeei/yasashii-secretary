#!/usr/bin/env bash
# Sprint 018: 明示確認後だけ行う保護commit、plugin更新、migration、検証、rollbackを検証する。
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

python3 - "$REPO" <<'PY'
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

repo = Path(sys.argv[1])
plugin = repo / "plugins/yasashii-secretary"
apply_cli = plugin / "scripts/update-apply.mjs"
manifest = repo / ".claude-plugin/marketplace.json"
changelog = plugin / "CHANGELOG.md"
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

def run(command, cwd=None, env=None):
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return subprocess.run(command, cwd=cwd, env=merged, text=True, capture_output=True)

def parse(result):
    try:
        return json.loads(result.stdout)
    except Exception:
        return {}

def snapshot(root, include_git=False):
    values = {}
    for path in sorted(root.rglob("*")):
        rel = str(path.relative_to(root))
        if not include_git and (rel == ".git" or rel.startswith(".git/")):
            continue
        if path.is_symlink():
            values[rel] = f"symlink:{os.readlink(path)}"
        elif path.is_file():
            values[rel] = hashlib.sha256(path.read_bytes()).hexdigest()
    return values

def head(workspace):
    return run(["git", "rev-parse", "HEAD"], cwd=workspace).stdout.strip()

def seed_ledger(workspace, version="0.3.0"):
    records = []
    for rel in ("secretary/AGENTS.md", "secretary/CLAUDE.md"):
        digest = hashlib.sha256((workspace / rel).read_bytes()).hexdigest()
        records.append({"path": rel, "installedVersion": version, "baselineHash": f"sha256:{digest}", "templateVariables": {}})
    ledger = workspace / ".yasashii-secretary/update-ledger.json"
    ledger.parent.mkdir(parents=True, exist_ok=True)
    ledger.write_text(json.dumps(records, indent=2) + "\n")
    run(["git", "add", str(ledger.relative_to(workspace))], cwd=workspace)
    result = run(["git", "commit", "-qm", "更新台帳を追加"], cwd=workspace)
    assert result.returncode == 0

def make_current(root, version):
    current = root / f"plugin-{version}"
    shutil.copytree(plugin, current)
    plugin_json = current / ".claude-plugin/plugin.json"
    data = json.loads(plugin_json.read_text())
    data["version"] = version
    plugin_json.write_text(json.dumps(data) + "\n")
    return current

def make_workspace(root, name, content, extra=None):
    workspace = root / name
    (workspace / "secretary/memory").mkdir(parents=True)
    (workspace / "secretary/AGENTS.md").write_text(content)
    (workspace / "secretary/CLAUDE.md").write_text(old_claude)
    (workspace / "secretary/memory/MEMORY.md").write_text("# memory\n")
    (workspace / "secretary/memory/preferences.md").write_text("# preferences\n")
    (workspace / "secretary/projects/sample").mkdir(parents=True)
    (workspace / "secretary/projects/sample/PROJECT.md").write_text("status: active\n")
    (workspace / "chatwork").mkdir()
    (workspace / "chatwork/config.json").write_text('{"enabled":false}\n')
    (workspace / ".claude").mkdir()
    (workspace / ".claude/settings.json").write_text('{"enabledPlugins":{}}\n')
    if extra:
        for rel, value in extra.items():
            target = workspace / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(value)
    run(["git", "init", "-q"], cwd=workspace)
    run(["git", "config", "user.email", "fixture@example.com"], cwd=workspace)
    run(["git", "config", "user.name", "更新fixture"], cwd=workspace)
    run(["git", "add", "."], cwd=workspace)
    committed = run(["git", "commit", "-qm", "fixture初期状態"], cwd=workspace)
    assert committed.returncode == 0
    return workspace

def cli(command, workspace, current=None, env=None, extra=None):
    args = ["node", str(apply_cli), command, "--workspace", str(workspace), "--json"]
    if command == "start":
        args += [
            "--current-plugin-root", str(current),
            "--latest-manifest", str(manifest),
            "--changelog", str(changelog),
            "--claude-binary", str(mock),
        ]
    elif command == "retry-plugin":
        args += ["--claude-binary", str(mock)]
    elif command == "resume":
        args += ["--plugin-root", str(plugin)]
    if extra:
        args += extra
    fixture_env = {"YASASHII_UPDATE_TEST_MODE": "fixture", "CLAUDE_FIXTURE_LOG": str(log)}
    if env:
        fixture_env.update(env)
    return run(args, cwd=workspace, env=fixture_env)

with tempfile.TemporaryDirectory(prefix="sprint018-") as temp:
    root = Path(temp)
    log = root / "claude.log"
    mock = root / "claude-fixture"
    mock.write_text("""#!/usr/bin/env python3
import os, sys
with open(os.environ['CLAUDE_FIXTURE_LOG'], 'a', encoding='utf-8') as handle:
    handle.write(' '.join(sys.argv[1:]) + '\\n')
needle = os.environ.get('CLAUDE_FIXTURE_FAIL', '')
if needle and needle in ' '.join(sys.argv[1:]):
    raise SystemExit(9)
raise SystemExit(0)
""")
    mock.chmod(mock.stat().st_mode | stat.S_IXUSR)

    old_agents = run(["git", "show", "d569fef:plugins/yasashii-secretary/templates/AGENTS.md"], cwd=repo).stdout
    old_claude = run(["git", "show", "d569fef:plugins/yasashii-secretary/templates/CLAUDE.md"], cwd=repo).stdout
    current020 = make_current(root, "0.2.0")
    current030 = make_current(root, "0.3.0")

    print("== consent gate and protection commit ==")
    no_consent = make_workspace(root, "no-consent", old_agents)
    before = snapshot(no_consent, include_git=True)
    result = cli("start", no_consent, current020)
    data = parse(result)
    check("明示了承なしは正常停止", result.returncode == 0 and data.get("sideEffects") == 0)
    check("明示了承なしはplugin/workspace/Git 0変更", before == snapshot(no_consent, include_git=True) and not log.exists())

    plain = make_workspace(root, "plain-explanation", old_agents)
    plain_before = snapshot(plain, include_git=True)
    plain_args = [
        "node", str(apply_cli), "start", "--workspace", str(plain),
        "--current-plugin-root", str(current020), "--latest-manifest", str(manifest),
        "--changelog", str(changelog), "--claude-binary", str(mock),
    ]
    plain_result = run(plain_args, cwd=plain, env={"YASASHII_UPDATE_TEST_MODE": "fixture", "CLAUDE_FIXTURE_LOG": str(log)})
    check("開始前説明は通常表示でも変更・影響・対象・戻し方まで見える", plain_result.returncode == 0 and all(label in plain_result.stdout for label in ("現在版:", "最新版:", "主な変更:", "設定・ファイルへの影響:", "更新対象:", "戻し方:")) and plain_before == snapshot(plain, include_git=True))

    ambiguous = make_workspace(root, "ambiguous", old_agents)
    before = snapshot(ambiguous, include_git=True)
    result = cli("start", ambiguous, current020, extra=["--consent", "maybe"])
    check("曖昧な了承を拒否", result.returncode == 0 and parse(result).get("sideEffects") == 0 and before == snapshot(ambiguous, include_git=True))

    latest_unknown = make_workspace(root, "latest-unknown", old_agents)
    before = snapshot(latest_unknown, include_git=True)
    args = ["node", str(apply_cli), "start", "--workspace", str(latest_unknown), "--current-plugin-root", str(current020), "--no-network", "--consent", "update-approved", "--json"]
    result = run(args, cwd=latest_unknown)
    check("最新版未確認では全変更0", result.returncode == 0 and parse(result).get("sideEffects") == 0 and before == snapshot(latest_unknown, include_git=True))

    approved = make_workspace(root, "approved", old_agents)
    initial_head = head(approved)
    initial_files = snapshot(approved)
    result = cli("start", approved, current020, extra=["--consent", "update-approved"])
    start_data = parse(result)
    protected_head = head(approved)
    check("明示了承後に保護commitを1件作成", result.returncode == 0 and protected_head != initial_head and start_data.get("protectionCommit") == protected_head)
    check("保護commitはpushせずworkspace本文を変えない", initial_files == snapshot(approved) and run(["git", "status", "--porcelain"], cwd=approved).stdout == "")
    lines = log.read_text().splitlines()
    check("公式plugin更新経路だけを固定引数で実行", lines[-2:] == ["plugin marketplace update yasashii-secretary", "plugin update yasashii-secretary@yasashii-secretary --scope user"])
    check("reload前はmigration 0件", "yasashii-secretary:update-safety:v1:start" not in (approved / "secretary/AGENTS.md").read_text())

    dry = cli("resume", approved)
    dry_data = parse(dry)
    plan_hash = dry_data.get("plan", {}).get("planHash")
    check("reload後にversionを再確認してdry-run", dry.returncode == 0 and plan_hash and dry_data.get("pluginVersion") == "0.4.0")
    check("dry-run前後でworkspace変更0", initial_files == snapshot(approved))
    wrong = cli("resume", approved, extra=["--apply", "--plan-hash", "sha256:" + "0" * 64])
    check("plan hash不一致はmigration 0件", wrong.returncode != 0 and initial_files == snapshot(approved))
    applied = cli("resume", approved, extra=["--apply", "--plan-hash", plan_hash])
    applied_data = parse(applied)
    check("確認済みplanだけを適用", applied.returncode == 0 and applied_data.get("verification", {}).get("ok") is True)
    check("0.2.0既知baselineだけをbootstrap台帳化", (approved / ".yasashii-secretary/update-ledger.json").is_file())
    ledger = json.loads((approved / ".yasashii-secretary/update-ledger.json").read_text())
    check("bootstrap台帳は確認済み2件・許可4fieldだけ", len(ledger) == 2 and all(set(item) == {"path", "installedVersion", "baselineHash", "templateVariables"} and item["installedVersion"] == "0.4.0" for item in ledger))
    check("migrationは更新安全性sectionと入口pointerだけを追加", "yasashii-secretary:update-safety:v1:start" in (approved / "secretary/AGENTS.md").read_text() and "yasashii-secretary:update-entry:v1:start" in (approved / "secretary/CLAUDE.md").read_text())
    first_hash = hashlib.sha256((approved / "secretary/AGENTS.md").read_bytes()).hexdigest()
    again = cli("resume", approved)
    check("同じmigration再実行は追加変更0", again.returncode == 0 and parse(again).get("migrationCount") == 0 and hashlib.sha256((approved / "secretary/AGENTS.md").read_bytes()).hexdigest() == first_hash)
    rollback = cli("rollback", approved)
    rollback_data = parse(rollback)
    check("workspaceは管理対象だけ保護commitへ復元", rollback.returncode == 0 and rollback_data.get("workspaceRestored") is True and snapshot(approved) == initial_files)
    check("plugin未復元を隠さず手動手順を示す", rollback_data.get("pluginRestored") is False and rollback_data.get("unresolved"))

    print("== customized, secret, dirty, commit/plugin failure ==")
    clean_ledger = make_workspace(root, "clean-ledger", old_agents)
    seed_ledger(clean_ledger)
    result = cli("start", clean_ledger, current030, extra=["--consent", "update-approved"])
    dry = cli("resume", clean_ledger)
    dry_data = parse(dry)
    plan_hash = dry_data.get("plan", {}).get("planHash")
    applied = cli("resume", clean_ledger, extra=["--apply", "--plan-hash", plan_hash])
    check("0.3.0台帳一致fileをcleanとして更新", result.returncode == 0 and dry_data.get("plan", {}).get("change") == ["secretary/AGENTS.md", "secretary/CLAUDE.md"] and applied.returncode == 0)

    customized_ledger = make_workspace(root, "customized-ledger", old_agents)
    seed_ledger(customized_ledger)
    (customized_ledger / "secretary/AGENTS.md").write_text(old_agents + "\n# 社内運用\n")
    run(["git", "add", "secretary/AGENTS.md"], cwd=customized_ledger)
    run(["git", "commit", "-qm", "利用者のカスタマイズ"], cwd=customized_ledger)
    custom_agents_before = (customized_ledger / "secretary/AGENTS.md").read_text()
    result = cli("start", customized_ledger, current030, extra=["--consent", "update-approved"])
    dry = cli("resume", customized_ledger)
    dry_data = parse(dry)
    plan_hash = dry_data.get("plan", {}).get("planHash")
    applied = cli("resume", customized_ledger, extra=["--apply", "--plan-hash", plan_hash])
    check("customizedは既定保持・cleanだけ部分更新", result.returncode == 0 and applied.returncode == 0 and (customized_ledger / "secretary/AGENTS.md").read_text() == custom_agents_before and "yasashii-secretary:update-entry:v1:start" in (customized_ledger / "secretary/CLAUDE.md").read_text())

    custom_text = old_agents + "\n# 独自の運用\n社内だけの手順\n"
    customized = make_workspace(root, "customized", custom_text)
    custom_before = (customized / "secretary/AGENTS.md").read_text()
    result = cli("start", customized, current030, extra=["--consent", "update-approved"])
    dry = cli("resume", customized)
    plan_hash = parse(dry).get("plan", {}).get("planHash")
    applied = cli("resume", customized, extra=["--apply", "--plan-hash", plan_hash])
    check("unknown-baselineの無応答は現状維持", result.returncode == 0 and applied.returncode == 0 and (customized / "secretary/AGENTS.md").read_text() == custom_before)
    check("確認できない保持fileを台帳へ決めつけない", not (customized / ".yasashii-secretary/update-ledger.json").exists())

    diff_ws = make_workspace(root, "diff", custom_text)
    before = snapshot(diff_ws, include_git=True)
    diff_result = cli("start", diff_ws, current030, extra=["--selection", "secretary/AGENTS.md=diff", "--consent", "update-approved"])
    check("差分表示は本文を出さず全変更0", diff_result.returncode == 0 and "社内だけの手順" not in diff_result.stdout + diff_result.stderr and before == snapshot(diff_ws, include_git=True))

    replace_ws = make_workspace(root, "replace", custom_text)
    result = cli("start", replace_ws, current030, extra=["--selection", "secretary/AGENTS.md=replace", "--consent", "update-approved"])
    dry = cli("resume", replace_ws)
    plan_hash = parse(dry).get("plan", {}).get("planHash")
    applied = cli("resume", replace_ws, extra=["--apply", "--plan-hash", plan_hash])
    body = (replace_ws / "secretary/AGENTS.md").read_text()
    check("明示選択したcustomizedだけ更新", result.returncode == 0 and applied.returncode == 0 and "社内だけの手順" in body and "yasashii-secretary:update-safety:v1:start" in body)

    secret_value = "SYNTHETIC-SECRET-987654321"
    secret_ws = make_workspace(root, "secret", old_agents + f"\npassword={secret_value}\n")
    before_head = head(secret_ws)
    result = cli("start", secret_ws, current020, extra=["--consent", "update-approved"])
    check("secret疑いはcommit前に停止", result.returncode != 0 and head(secret_ws) == before_head)
    check("secretをstdout/stderr/台帳/logへ出さない", secret_value not in result.stdout + result.stderr and secret_value not in (log.read_text() if log.exists() else "") and not (secret_ws / ".yasashii-secretary/update-ledger.json").exists())

    secret_ledger = make_workspace(root, "secret-ledger", old_agents)
    seed_ledger(secret_ledger)
    ledger_secret = "SYNTHETIC-LEDGER-SECRET-987654321"
    secret_records = json.loads((secret_ledger / ".yasashii-secretary/update-ledger.json").read_text())
    secret_records[0]["secret"] = ledger_secret
    (secret_ledger / ".yasashii-secretary/update-ledger.json").write_text(json.dumps(secret_records, indent=2) + "\n")
    run(["git", "add", ".yasashii-secretary/update-ledger.json"], cwd=secret_ledger)
    run(["git", "commit", "-qm", "不正台帳fixture"], cwd=secret_ledger)
    before_head = head(secret_ledger)
    result = cli("start", secret_ledger, current030, extra=["--consent", "update-approved"])
    check("不正台帳のsecret疑いは保護commit前に停止して値を表示しない", result.returncode != 0 and head(secret_ledger) == before_head and ledger_secret not in result.stdout + result.stderr)

    env_secret = make_workspace(root, "env-secret", old_agents, extra={".env": f"ACCESS_TOKEN={secret_value}\n"})
    before_head = head(env_secret)
    result = cli("start", env_secret, current020, extra=["--consent", "update-approved"])
    check("管理対象外の資格情報fileも保護commit前に停止", result.returncode != 0 and head(env_secret) == before_head and secret_value not in result.stdout + result.stderr)

    dirty = make_workspace(root, "dirty", old_agents)
    (dirty / "secretary/memory/MEMORY.md").write_text("changed\n")
    before_head = head(dirty)
    result = cli("start", dirty, current020, extra=["--consent", "update-approved"])
    check("dirty/意図不明変更は勝手にcommitしない", result.returncode != 0 and head(dirty) == before_head)

    commit_fail = make_workspace(root, "commit-fail", old_agents)
    hook = commit_fail / ".git/hooks/pre-commit"
    hook.write_text("#!/bin/sh\nexit 1\n")
    hook.chmod(hook.stat().st_mode | stat.S_IXUSR)
    before_head = head(commit_fail)
    log_before = log.read_text() if log.exists() else ""
    result = cli("start", commit_fail, current020, extra=["--consent", "update-approved"])
    check("保護commit不能ではplugin/migration 0件", result.returncode != 0 and head(commit_fail) == before_head and (log.read_text() if log.exists() else "") == log_before)

    plugin_fail = make_workspace(root, "plugin-fail", old_agents)
    result = cli("start", plugin_fail, current020, env={"CLAUDE_FIXTURE_FAIL": "plugin update"}, extra=["--consent", "update-approved"])
    failure = parse(result)
    check("plugin更新失敗時migration 0件", result.returncode != 0 and failure.get("pluginUpdated") is False and failure.get("migrationCount") == 0 and "yasashii-secretary:update-safety:v1:start" not in (plugin_fail / "secretary/AGENTS.md").read_text())
    protected = head(plugin_fail)
    retried = cli("retry-plugin", plugin_fail)
    check("plugin失敗再試行は保護commitを増やさない", retried.returncode == 0 and head(plugin_fail) == protected and "yasashii-secretary:update-safety:v1:start" not in (plugin_fail / "secretary/AGENTS.md").read_text())

    print("== partial resume, verification failure, rollback and boundaries ==")
    partial = make_workspace(root, "partial", custom_text)
    cli("start", partial, current030, extra=["--selection", "secretary/AGENTS.md=replace", "--consent", "update-approved"])
    dry = cli("resume", partial)
    plan_hash = parse(dry).get("plan", {}).get("planHash")
    interrupted = cli("resume", partial, extra=["--apply", "--plan-hash", plan_hash, "--test-fail-after", "workspace-write"])
    resumed = cli("resume", partial, extra=["--apply", "--plan-hash", plan_hash])
    body = (partial / "secretary/AGENTS.md").read_text()
    check("途中失敗から同じplanで再開", interrupted.returncode != 0 and resumed.returncode == 0)
    check("途中再開でもsectionを重複しない", body.count("yasashii-secretary:update-safety:v1:start") == 1)

    verify_fail = make_workspace(root, "verify-fail", custom_text)
    before_files = snapshot(verify_fail)
    cli("start", verify_fail, current030, extra=["--selection", "secretary/AGENTS.md=replace", "--consent", "update-approved"])
    dry = cli("resume", verify_fail)
    plan_hash = parse(dry).get("plan", {}).get("planHash")
    failed_verify = cli("resume", verify_fail, extra=["--apply", "--plan-hash", plan_hash, "--test-post-verify-fail", "yes"])
    check("更新後検証1件失敗で成功報告しない", failed_verify.returncode != 0 and parse(failed_verify).get("title") == "更新後の検証に失敗しました")
    rolled = cli("rollback", verify_fail)
    check("検証失敗後もworkspace rollback", rolled.returncode == 0 and snapshot(verify_fail) == before_files)

    source = apply_cli.read_text()
    check("任意shell文字列と破壊的resetを使わない", "shell: false" in source and 'git(workspace, ["reset"' not in source and 'git(workspace, ["push"' not in source)
    check("push/remote変更の実行経路0", not any(line.startswith("push") or " remote " in f" {line} " for line in log.read_text().splitlines()))
    new_plugin_files = [apply_cli, plugin / "skills/update/SKILL.md"] + list((plugin / "migrations").rglob("*"))
    leaked = [path for path in new_plugin_files if path.is_file() and "Google" + " Chat" in path.read_text()]
    check("Google Chat実装漏出0", leaked == [])
    check("migrationは記憶・PJ・Chatwork本文を変更しない", all("memory/" not in item and "projects/" not in item and "chatwork/" not in item for item in source.split('ALLOWED_MANAGED_PATHS = new Set([')[1].split(']);', 1)[0].split(',')))

print(f"SPRINT018_PASS={passed} SPRINT018_FAIL={failed}")
sys.exit(1 if failed else 0)
PY
