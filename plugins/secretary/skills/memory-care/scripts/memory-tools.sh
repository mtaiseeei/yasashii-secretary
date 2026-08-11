#!/usr/bin/env bash
# POSIX互換入口。正本実装はWindowsでもshell不要で動くmemory-tools.mjs。
set -u
_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$_HERE/memory-tools.mjs" "$@"
