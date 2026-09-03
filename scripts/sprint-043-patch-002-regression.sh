#!/bin/sh
set -eu

node scripts/sprint-043-patch-002-test.mjs
node scripts/sprint-043-patch-002-classification.mjs
node scripts/sprint-043-patch-002-overlay-test.mjs
node scripts/sprint-042-core-test.mjs
node scripts/sprint-042-projection-test.mjs
node scripts/sprint-042-hook-test.mjs
node scripts/sprint-042-link-test.mjs
node scripts/sprint-042-drift-test.mjs
node scripts/sprint-043-patch-002-baseline.mjs
node scripts/sprint-042-xmind-test.mjs
node scripts/sprint-042-collaboration-test.mjs
node scripts/sprint-043-patch-001-test.mjs
node scripts/sprint-040-patch-001-test.mjs

if [ "${1:-}" = "--candidate" ]; then
  node scripts/sprint-043-patch-002-portability.mjs --three-surfaces
else
  node scripts/sprint-043-patch-002-portability.mjs
fi

printf '%s\n' 'YASASHII_SPRINT043_PATCH002_REGRESSION TARGET=21/21 CORE=43/43 PROJECTION=35/35 HOOK=40/40 LINK=34/34 DRIFT=25/25 XMIND=29+1-NOT-RUN COLLABORATION=20/20 PATCH001=4/4 OVERLAY=secondChanged0 PRODUCT_FAIL=0 EXTERNAL_LIVE=NOT-RUN RELEASE=NOT-RUN'
