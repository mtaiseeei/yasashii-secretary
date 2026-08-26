#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

YASASHII_SOURCE="${SPRINT040_YASASHII_SOURCE:-$ROOT/../yasashii-secretary}"
PRIVATE_SOURCE="${SPRINT040_PRIVATE_SOURCE:-$ROOT/../agentic-secretary-my-vault}"
CANDIDATE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/sprint-040-candidates.XXXXXX")"
CANDIDATES="$CANDIDATE_PARENT/candidates"
REPRODUCED="$CANDIDATE_PARENT/reproduced"
trap 'rm -rf "$CANDIDATE_PARENT"' EXIT

node scripts/sprint-040-source-snapshot.mjs --source "$YASASHII_SOURCE" --edition yasashii > "$CANDIDATE_PARENT/yasashii-before.json"
node scripts/sprint-040-source-snapshot.mjs --source "$PRIVATE_SOURCE" --edition private-my-vault > "$CANDIDATE_PARENT/private-before.json"

node scripts/sprint-040-handoff-test.mjs \
  --yasashii-source "$YASASHII_SOURCE" \
  --private-source "$PRIVATE_SOURCE"

node scripts/sprint-040-candidate-build.mjs \
  --public-root "$ROOT" \
  --yasashii-source "$YASASHII_SOURCE" \
  --private-source "$PRIVATE_SOURCE" \
  --output "$CANDIDATES"
node scripts/sprint-040-inventory-test.mjs --candidate-report "$CANDIDATES/candidate-report.json"

node scripts/sprint-040-candidate-build.mjs \
  --public-root "$ROOT" \
  --yasashii-source "$YASASHII_SOURCE" \
  --private-source "$PRIVATE_SOURCE" \
  --output "$REPRODUCED" \
  --skip-execute

node -e 'const a=require(process.argv[1]); const b=require(process.argv[2]); const ids=(r)=>Object.fromEntries(r.candidates.map((x)=>[x.id,x.candidate.sha256])); if(JSON.stringify(ids(a))!==JSON.stringify(ids(b))) process.exit(1); console.log(`SPRINT040_CANDIDATE_REPRODUCTION_PASS=${a.candidates.length} FAIL=0`)' "$CANDIDATES/candidate-report.json" "$REPRODUCED/candidate-report.json"

node scripts/sprint-040-source-snapshot.mjs --source "$YASASHII_SOURCE" --edition yasashii > "$CANDIDATE_PARENT/yasashii-after.json"
node scripts/sprint-040-source-snapshot.mjs --source "$PRIVATE_SOURCE" --edition private-my-vault > "$CANDIDATE_PARENT/private-after.json"
cmp -s "$CANDIDATE_PARENT/yasashii-before.json" "$CANDIDATE_PARENT/yasashii-after.json"
cmp -s "$CANDIDATE_PARENT/private-before.json" "$CANDIDATE_PARENT/private-after.json"
printf 'SPRINT040_DOWNSTREAM_READ_ONLY_PASS=2 FAIL=0\n'

node -e 'const r=require(process.argv[1]); for (const x of r.candidates) console.log(`SPRINT040_FINAL_${x.id.toUpperCase().replaceAll("-","_")}_CANDIDATE=${x.candidate.sha256}`)' "$CANDIDATES/candidate-report.json"

printf 'SPRINT040_REGRESSION_PASS=3_EDITIONS SPRINT040_REGRESSION_FAIL=0\n'
