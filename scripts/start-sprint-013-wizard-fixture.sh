#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/yasashii-wizard-eval.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT INT TERM
cp -R "$ROOT/scripts/fixtures/chatwork-wizard/." "$WORK/"

NODE_ENV=test \
YASASHII_CHATWORK_TEST_PRIVATE=1 \
YASASHII_CHATWORK_SKIP_DISPATCH=1 \
YASASHII_CHATWORK_SKIP_GIT=1 \
YASASHII_CHATWORK_TEST_SECRET=1 \
node "$ROOT/plugins/yasashii-secretary/skills/chatwork/scripts/wizard-server.mjs" \
  --root "$WORK" \
  --port "${1:-8765}"
