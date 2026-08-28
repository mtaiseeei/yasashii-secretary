#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/sprint-042-test.mjs
git diff --check
