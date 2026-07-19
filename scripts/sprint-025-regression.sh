#!/usr/bin/env bash
# Sprint 025: 0.7.0配布metadata、0.6.0 migration、plugin／workspace rollbackを検証する。
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
diagnose_cli = plugin / "scripts/update-diagnose.mjs"
manifest = repo / ".claude-plugin/marketplace.json"
changelog = plugin / "CHANGELOG.md"
validator = repo / "scripts/check-release-integrity.py"
passed = failed = 0

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

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def snapshot(root):
    values = {}
    for path in sorted(root.rglob("*")):
        rel = str(path.relative_to(root))
        if rel == ".git" or rel.startswith(".git/"):
            continue
        if path.is_symlink():
            values[rel] = f"symlink:{os.readlink(path)}"
        elif path.is_file():
            values[rel] = digest(path)
    return values

def make_plugin(root, version):
    target = root / f"plugin-{version}-{len(list(root.iterdir()))}"
    shutil.copytree(plugin, target)
    path = target / ".claude-plugin/plugin.json"
    data = json.loads(path.read_text())
    data["version"] = version
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    return target

def make_workspace(root, name, customize=False):
    workspace = root / name
    (workspace / "secretary/memory").mkdir(parents=True)
    (workspace / "secretary/projects/sample").mkdir(parents=True)
    (workspace / "chatwork/history").mkdir(parents=True)
    (workspace / "google-chat/history").mkdir(parents=True)
    (workspace / "secretary/AGENTS.md").write_text("# workspace rules\n")
    (workspace / "secretary/CLAUDE.md").write_text("@AGENTS.md\n")
    (workspace / "secretary/memory/MEMORY.md").write_text("# memory sentinel\n")
    (workspace / "secretary/projects/sample/PROJECT.md").write_text("status: active\ncustomer customization\n")
    (workspace / "chatwork/history/2026-07-19.md").write_text("chatwork sentinel\n")
    (workspace / "google-chat/history/2026-07-19.md").write_text("google chat sentinel\n")
    (workspace / ".yasashii-secretary").mkdir()
    records = []
    for rel in ("secretary/AGENTS.md", "secretary/CLAUDE.md"):
        records.append({"path": rel, "installedVersion": "0.6.0", "baselineHash": f"sha256:{digest(workspace / rel)}", "templateVariables": {}})
    (workspace / ".yasashii-secretary/update-ledger.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    if customize:
        (workspace / "secretary/AGENTS.md").write_text("# workspace rules\n# user customization\n")
    run(["git", "init", "-q"], cwd=workspace)
    run(["git", "config", "user.email", "fixture@example.com"], cwd=workspace)
    run(["git", "config", "user.name", "Sprint 025 fixture"], cwd=workspace)
    run(["git", "add", "."], cwd=workspace)
    assert run(["git", "commit", "-qm", "0.6.0 fixture"], cwd=workspace).returncode == 0
    return workspace

def cli(command, workspace, current=None, target=None, extra=None):
    args = ["node", str(apply_cli), command, "--workspace", str(workspace), "--json"]
    if command == "start":
        args += ["--current-plugin-root", str(current), "--latest-manifest", str(manifest), "--changelog", str(changelog), "--claude-binary", str(mock)]
    elif command == "retry-plugin":
        args += ["--claude-binary", str(mock)]
    elif command == "resume":
        args += ["--plugin-root", str(plugin)]
    elif command == "rollback" and target:
        args += ["--plugin-root", str(target)]
    if extra:
        args += extra
    return run(args, cwd=workspace, env={"YASASHII_UPDATE_TEST_MODE": "fixture", "CLAUDE_FIXTURE_LOG": str(log)})

def release_fixture(root):
    (root / ".claude-plugin").mkdir(parents=True)
    (root / "plugins/yasashii-secretary/.claude-plugin").mkdir(parents=True)
    shutil.copy2(manifest, root / ".claude-plugin/marketplace.json")
    shutil.copy2(plugin / ".claude-plugin/plugin.json", root / "plugins/yasashii-secretary/.claude-plugin/plugin.json")
    shutil.copy2(changelog, root / "plugins/yasashii-secretary/CHANGELOG.md")
    shutil.copy2(repo / "LICENSE", root / "LICENSE")

with tempfile.TemporaryDirectory(prefix="sprint025-") as temp:
    root = Path(temp).resolve()
    log = root / "claude.log"
    mock = root / "claude-fixture"
    mock.write_text("""#!/usr/bin/env python3
import os, sys
with open(os.environ['CLAUDE_FIXTURE_LOG'], 'a', encoding='utf-8') as handle:
    handle.write(' '.join(sys.argv[1:]) + '\\n')
raise SystemExit(0)
""")
    mock.chmod(mock.stat().st_mode | stat.S_IXUSR)

    print("== release metadata and archive-compatible validator ==")
    market_data = json.loads(manifest.read_text())
    plugin_data = json.loads((plugin / ".claude-plugin/plugin.json").read_text())
    entry = market_data["plugins"][0]
    check("marketplace/plugin/CHANGELOGは0.7.0", entry["version"] == plugin_data["version"] == "0.7.0" and changelog.read_text().startswith("# 変更履歴\n\n## [0.7.0]"))
    check("Claude配布metadataと単段クレジットが整合", entry["author"] == plugin_data["author"] == {"name": "mtaiseeei"} and entry["license"] == plugin_data["license"] == "MIT" and entry["forkedFrom"] == "https://github.com/Shin-sibainu/cc-company")
    archive = root / "archive"
    release_fixture(archive)
    valid = run(["python3", str(validator), "--root", str(archive)])
    check(".gitなし配布物でvalidator PASS", valid.returncode == 0)

    mutations = [
        ("marketplace author欠落", lambda m, p: m["plugins"][0].pop("author")),
        ("plugin author不正", lambda m, p: p.__setitem__("author", {"name": "wrong"})),
        ("MIT欠落", lambda m, p: p.pop("license")),
        ("forkedFrom不正", lambda m, p: m["plugins"][0].__setitem__("forkedFrom", "https://example.invalid/fork")),
        ("source不正", lambda m, p: m["plugins"][0].__setitem__("source", "./other")),
        ("name不正", lambda m, p: p.__setitem__("name", "other")),
        ("version不一致", lambda m, p: p.__setitem__("version", "0.6.0")),
    ]
    for index, (label, mutate) in enumerate(mutations):
        fixture = root / f"invalid-{index}"
        release_fixture(fixture)
        mpath = fixture / ".claude-plugin/marketplace.json"
        ppath = fixture / "plugins/yasashii-secretary/.claude-plugin/plugin.json"
        mdata, pdata = json.loads(mpath.read_text()), json.loads(ppath.read_text())
        mutate(mdata, pdata)
        mpath.write_text(json.dumps(mdata, ensure_ascii=False, indent=2) + "\n")
        ppath.write_text(json.dumps(pdata, ensure_ascii=False, indent=2) + "\n")
        check(f"validatorが{label}を拒否", run(["python3", str(validator), "--root", str(fixture)]).returncode != 0)

    print("== 0.6.0 diagnosis, migration, idempotency ==")
    current060 = make_plugin(root, "0.6.0")
    diagnosis_ws = make_workspace(root, "diagnosis")
    before = snapshot(diagnosis_ws)
    diagnosis = run(["node", str(diagnose_cli), "--workspace", str(diagnosis_ws), "--plugin-root", str(current060), "--latest-manifest", str(manifest), "--changelog", str(changelog), "--json"])
    diagnosis_data = parse(diagnosis)
    check("0.6.0→0.7.0を読み取り専用で診断", diagnosis.returncode == 0 and diagnosis_data.get("currentVersion") == "0.6.0" and diagnosis_data.get("latestVersion") == "0.7.0" and diagnosis_data.get("status") == "update-available")
    check("診断の全副作用0件", before == snapshot(diagnosis_ws) and all(value == 0 for value in diagnosis_data.get("sideEffects", {}).values()))

    workspace = make_workspace(root, "update")
    unrelated_before = {rel: digest(workspace / rel) for rel in ("secretary/memory/MEMORY.md", "secretary/projects/sample/PROJECT.md", "chatwork/history/2026-07-19.md", "google-chat/history/2026-07-19.md")}
    start = cli("start", workspace, current060, extra=["--consent", "update-approved", "--scope", "project"])
    start_data = parse(start)
    check("明示確認後だけ保護commitとplugin更新", start.returncode == 0 and start_data.get("protectionCommit") and log.read_text().splitlines()[-2:] == ["plugin marketplace update yasashii-secretary", "plugin update yasashii-secretary@yasashii-secretary --scope project"])
    backup = workspace / ".git/yasashii-secretary-update/plugin-backup"
    check("plugin 0.6.0をGit管理外へ退避", json.loads((backup / ".claude-plugin/plugin.json").read_text())["version"] == "0.6.0" and (backup / "skills/secretary/SKILL.md").is_file())
    dry = cli("resume", workspace)
    dry_data = parse(dry)
    plan_hash = dry_data.get("plan", {}).get("planHash")
    check("0.6.0 migration dry-runは追加・変更0で記憶等を対象外化", dry.returncode == 0 and plan_hash and dry_data["plan"]["add"] == [] and dry_data["plan"]["change"] == [])
    applied = cli("resume", workspace, extra=["--apply", "--plan-hash", plan_hash])
    records = json.loads((workspace / ".yasashii-secretary/update-ledger.json").read_text())
    check("適用後に台帳と主要導線を0.7.0として検証", applied.returncode == 0 and parse(applied).get("verification", {}).get("ok") is True and all(record["installedVersion"] == "0.7.0" for record in records))
    check("記憶・PJ・両チャット履歴を不変で保護", unrelated_before == {rel: digest(workspace / rel) for rel in unrelated_before})
    after_first = snapshot(workspace)
    again = cli("resume", workspace)
    check("同じmigrationの再実行は追加変更0・台帳重複0", again.returncode == 0 and parse(again).get("migrationCount") == 0 and snapshot(workspace) == after_first and len(records) == len({record["path"] for record in records}))

    legacy_ws = make_workspace(root, "legacy-session")
    legacy_current = make_plugin(root, "0.6.0")
    cli("start", legacy_ws, legacy_current, extra=["--consent", "update-approved"])
    legacy_state_path = legacy_ws / ".git/yasashii-secretary-update/session.json"
    legacy_state = json.loads(legacy_state_path.read_text())
    legacy_state.pop("pluginBackup", None)
    legacy_state_path.write_text(json.dumps(legacy_state, ensure_ascii=False, indent=2) + "\n")
    shutil.rmtree(legacy_ws / ".git/yasashii-secretary-update/plugin-backup")
    cache = root / "legacy-cache"
    old_cache = cache / "0.6.0"
    new_cache = cache / "0.7.0"
    shutil.copytree(legacy_current, old_cache)
    shutil.copytree(plugin, new_cache)
    legacy_resume = run(["node", str(apply_cli), "resume", "--workspace", str(legacy_ws), "--plugin-root", str(new_cache), "--json"], cwd=legacy_ws, env={"YASASHII_UPDATE_TEST_MODE": "fixture"})
    recovered = json.loads(legacy_state_path.read_text()).get("pluginBackup", {})
    check("0.6.0旧sessionでもreload後の旧cacheから復元物を回収", legacy_resume.returncode == 0 and recovered.get("version") == "0.6.0" and recovered.get("recoveredAfterReload") is True and (legacy_ws / ".git/yasashii-secretary-update/plugin-backup/skills/update/SKILL.md").is_file())

    print("== plugin and workspace rollback ==")
    rollback_ws = make_workspace(root, "rollback")
    rollback_initial = snapshot(rollback_ws)
    current_for_rollback = make_plugin(root, "0.6.0")
    target070 = make_plugin(root, "0.7.0")
    cli("start", rollback_ws, current_for_rollback, extra=["--consent", "update-approved", "--scope", "local"])
    dry = cli("resume", rollback_ws)
    failed_apply = cli("resume", rollback_ws, extra=["--apply", "--plan-hash", parse(dry)["plan"]["planHash"], "--test-post-verify-fail", "yes"])
    rolled = cli("rollback", rollback_ws, target=target070)
    rolled_data = parse(rolled)
    check("検証失敗を成功にせずrollbackへ停止", failed_apply.returncode != 0 and parse(failed_apply).get("title") == "更新後の検証に失敗しました")
    check("workspaceとpluginを両方復元", rolled.returncode == 0 and rolled_data.get("status") == "rolled-back" and rolled_data.get("workspaceRestored") is True and rolled_data.get("pluginRestored") is True and snapshot(rollback_ws) == rollback_initial)
    restored_manifest = json.loads((target070 / ".claude-plugin/plugin.json").read_text())
    check("pluginは同じscopeの0.6.0と主要skillを実確認", restored_manifest["version"] == "0.6.0" and rolled_data.get("pluginScope") == "local" and rolled_data.get("pluginVerified") is True and all((target070 / "skills" / name / "SKILL.md").is_file() for name in ("secretary", "update")))

    partial_ws = make_workspace(root, "partial")
    partial_current = make_plugin(root, "0.6.0")
    partial_target = make_plugin(root, "0.7.0")
    cli("start", partial_ws, partial_current, extra=["--consent", "update-approved"])
    dry = cli("resume", partial_ws)
    cli("resume", partial_ws, extra=["--apply", "--plan-hash", parse(dry)["plan"]["planHash"]])
    (partial_ws / "post-update-note.md").write_text("user work after update\n")
    run(["git", "add", "post-update-note.md"], cwd=partial_ws)
    run(["git", "commit", "-qm", "user commit after update"], cwd=partial_ws)
    partial = cli("rollback", partial_ws, target=partial_target)
    partial_data = parse(partial)
    check("保護commit後の利用者commitを上書きしない", partial.returncode != 0 and partial_data.get("workspaceRestored") is False and (partial_ws / "post-update-note.md").read_text() == "user work after update\n")
    check("pluginだけ戻った状態をpartial-restorationと表示", partial_data.get("status") == "partial-restoration" and partial_data.get("pluginRestored") is True and partial_data.get("unresolved"))

    manual_ws = make_workspace(root, "manual-fallback")
    manual_current = make_plugin(root, "0.6.0")
    cli("start", manual_ws, manual_current, extra=["--consent", "update-approved", "--scope", "user"])
    manual = cli("rollback", manual_ws)
    manual_data = parse(manual)
    check("自動復元不可時は旧版・scope・実行可能な手順を示す", manual.returncode != 0 and manual_data.get("status") == "partial-restoration" and manual_data.get("pluginVersion") == "0.6.0" and manual_data.get("pluginScope") == "user" and manual_data.get("fallback", {}).get("command", "").startswith("claude --plugin-dir"))

print(f"SPRINT025_PASS={passed} SPRINT025_FAIL={failed}")
sys.exit(1 if failed else 0)
PY
