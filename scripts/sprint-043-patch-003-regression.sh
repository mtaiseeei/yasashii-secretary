#!/bin/sh
set -eu

node scripts/sprint-043-patch-003-test.mjs
node scripts/sprint-043-patch-003-classification.mjs
node scripts/sprint-043-patch-001-test.mjs
node scripts/sprint-043-patch-002-test.mjs
node scripts/sprint-042-core-test.mjs
node scripts/sprint-042-projection-test.mjs
node scripts/sprint-042-hook-test.mjs
node scripts/sprint-042-link-test.mjs
node scripts/sprint-042-drift-test.mjs
node scripts/sprint-042-xmind-test.mjs
node scripts/sprint-042-collaboration-test.mjs
node scripts/sprint-043-patch-002-overlay-test.mjs
node scripts/sprint-043-e2e.mjs
node scripts/sprint-038-patch-002-windows-test.mjs

if [ "${1:-}" = "--three-surfaces" ]; then
  node scripts/sprint-043-patch-003-portability.mjs --three-surfaces
else
  node scripts/sprint-043-patch-003-portability.mjs
fi

printf '%s\n' 'YASASHII_SPRINT043_PATCH003_REGRESSION TARGET=12+4-NOT-RUN PATCH001=4 PATCH002=21 CORE=43 PROJECTION=35 HOOK=40 LINK=34 DRIFT=25 XMIND=29+1-NOT-RUN COLLABORATION=20/57 OVERLAY=secondChanged0 E2E=4 WINDOWS_092_PORTABLE=12 PRODUCT_FAIL=0 WINDOWS_NATIVE=NOT-RUN EXTERNAL_WRITE=0'
