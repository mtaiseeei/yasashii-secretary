#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/sprint-038-test.mjs"
node "$ROOT/scripts/sprint-038-historical-classifier-test.mjs"
node "$ROOT/scripts/sprint-038-historical-path-test.mjs"
node --check "$ROOT/plugins/secretary/scripts/lib/conversation-contract.mjs"
node --check "$ROOT/scripts/sprint-038-test.mjs"
node --check "$ROOT/scripts/run-historical-regression.mjs"
