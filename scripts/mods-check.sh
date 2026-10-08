#!/usr/bin/env bash
# usage: scripts/mods-check.sh [mod...]  (省略時は dot_claude/mods/ の全 mod)
set -uo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
mods=("$@")
[ ${#mods[@]} -eq 0 ] && mods=($(ls "$root/dot_claude/mods"))

failed=()
for mod in "${mods[@]}"; do
  src="$root/dot_claude/mods/$mod"
  types="$HOME/.claude/mods/$mod/.claude-plugin/types"
  echo "== $mod"
  if [ ! -d "$types" ]; then
    echo "  型定義がありません: $types"
    echo "  mise run chezmoi:apply のあと、Claude Code のセッションで一度 $mod を読み込んでから実行してください"
    failed+=("$mod")
    continue
  fi
  work=$(mktemp -d)
  cp -R "$src" "$work/$mod"
  mv "$work/$mod/dot_claude-plugin" "$work/$mod/.claude-plugin"
  cp -R "$types" "$work/$mod/.claude-plugin/types"
  ok=1
  claude plugin test "$work/$mod" >"$work/test.log" 2>&1 || { ok=0; echo "  test: 失敗"; grep -E '\(fail\)' "$work/test.log" | sed 's/^/    /'; }
  claude plugin validate "$work/$mod" >"$work/validate.log" 2>&1 || { ok=0; echo "  validate: 失敗"; sed 's/^/    /' "$work/validate.log" | tail -5; }
  npx -y -p typescript tsc -p "$work/$mod" --noEmit >"$work/tsc.log" 2>&1 || { ok=0; echo "  tsc: 失敗"; sed "s#$work/$mod/##; s/^/    /" "$work/tsc.log"; }
  [ $ok -eq 1 ] && echo "  ok" || failed+=("$mod")
  rm -rf "$work"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "失敗: ${failed[*]}"
  exit 1
fi
