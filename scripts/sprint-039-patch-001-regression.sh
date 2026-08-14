#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/sprint-039-patch-001-migration-test.mjs"
node "$ROOT/scripts/sprint-039-patch-001-test.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/secretary-identity-migration.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/safe-git.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/secretary-rename.mjs"
node --check "$ROOT/plugins/secretary/scripts/secretary-name.mjs"
bash "$ROOT/scripts/sprint-039-regression.sh"
node "$ROOT/scripts/sprint-021-git-safety-test.mjs"
node "$ROOT/scripts/sprint-035-test.mjs"
python3 "$ROOT/scripts/check-report-schema.py" --plugin-root "$ROOT/plugins/secretary"
node "$ROOT/scripts/sprint-039-release-integrity-test.mjs"
printf 'PASS=10 FAIL=0\n'
