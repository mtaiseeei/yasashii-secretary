#!/usr/bin/env bash
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/start-sprint-013-wizard-fixture.sh" "${1:-8765}"
