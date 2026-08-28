#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/sprint-041-test.mjs
node scripts/sprint-041-prewrite.mjs --check
node scripts/sprint-040-patch-001-test.mjs

if [ -f scripts/fixtures/sprint-041/yasashii-prewrite-receipt.json ]; then
  node scripts/sprint-041-prewrite.mjs --verify-receipt
fi

printf 'SPRINT041_REGRESSION_PASS=1 FAIL=0\n'
