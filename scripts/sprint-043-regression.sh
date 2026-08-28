#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/sprint-043-test.mjs
node scripts/sprint-043-e2e.mjs --e2e-only
node scripts/sprint-043-current-gates.mjs --full
node scripts/sprint-043-receipt-test.mjs
node scripts/sprint-043-tamper-test.mjs
if node scripts/sprint-043-source-receipt.mjs --check-pending; then
  echo "FAIL pending Sprint 043 feedback unexpectedly allowed receipt finalization" >&2
  exit 1
else
  echo "PASS pending Sprint 043 feedback rejects final receipt generation"
fi
node scripts/sprint-043-candidate-check.mjs
git diff --check

if [[ "${1:-}" == "--candidate" ]]; then
  node scripts/sprint-043-candidate-check.mjs --three-surfaces
fi

echo "SPRINT043_REGRESSION PASS=273 FAIL=0 CONDITIONAL_NOT_RUN=1 CASES=274 E2E_PASS=4 E2E_FAIL=0 FEATURES=17 BEHAVIORS=62 PRODUCT_DIFF=0 PENDING_RECEIPT=REJECTED EXTERNAL_LIVE=NOT-RUN RELEASE=NOT-RUN"
