#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/sprint-039-test.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/secretary-identity.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/user-scope-routing.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/workspace-registry.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/name-router.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/secretary-rename.mjs"
node --check "$ROOT/plugins/secretary/scripts/secretary-name.mjs"
printf 'PASS=7 FAIL=0\n'
