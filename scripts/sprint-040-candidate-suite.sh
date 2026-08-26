#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EDITION="${1:?edition is required}"
cd "$ROOT"

node scripts/sprint-040-test.mjs
node scripts/sprint-040-edition-test.mjs --edition "$EDITION"
bash scripts/sprint-038-regression.sh
bash scripts/sprint-010-regression.sh
node scripts/sprint-021-git-safety-test.mjs
if [ "$EDITION" != "agentic" ]; then
  node scripts/sprint-038-private-test.mjs
fi

printf 'SPRINT040_CANDIDATE_SUITE_EDITION=%s PASS=1 FAIL=0\n' "$EDITION"
