#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/sprint-038-patch-001-test.mjs"
node "$ROOT/scripts/sprint-035-test.mjs"
python3 "$ROOT/scripts/check-release-integrity.py" --root "$ROOT"
node --check "$ROOT/scripts/check-harness-compat-online.mjs"
node --check "$ROOT/scripts/master-release-gate.mjs"
