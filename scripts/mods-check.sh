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
  # 型定義は engine が生成し mod 間で同じ (MCP の一覧だけ読み込んだ時点で違う) なので、未読み込みの mod は他の mod のものを借りる
  [ -d "$types" ] || types=$(ls -d "$HOME"/.claude/mods/*/.claude-plugin/types 2>/dev/null | head -1)
  if [ ! -d "$types" ]; then
    echo "  型定義がありません: ~/.claude/mods/*/.claude-plugin/types"
    echo "  mise run chezmoi:apply のあと、Claude Code のセッションで mod を一度読み込んでから実行してください"
    failed+=("$mod")
    continue
  fi
  work=$(mktemp -d)
  cp -R "$src" "$work/$mod"
  mv "$work/$mod/dot_claude-plugin" "$work/$mod/.claude-plugin"
  cp -R "$types" "$work/$mod/.claude-plugin/types"
  ok=1
  claude plugin test "$work/$mod" >"$work/test.log" 2>&1 || { ok=0; echo "  test: 失敗"; grep -E '\(fail\)' "$work/test.log" | sed 's/^/    /'; }
  claude plugin validate "$work/$mod" >"$work/validate.log" 2>&1 || { ok=0; echo "  validate: 失敗"; sed 's/^/    /' "$work/validate.log"; }
  # tsc はカレントからの相対パスでエラーを出すので、mod の中で回して hooks/... の形にする
  (cd "$work/$mod" && npx -y -p typescript@7.0.2 tsc -p . --noEmit) >"$work/tsc.log" 2>&1 || { ok=0; echo "  tsc: 失敗"; sed 's/^/    /' "$work/tsc.log"; }
  [ $ok -eq 1 ] && echo "  ok" || failed+=("$mod")
  rm -rf "$work"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "失敗: ${failed[*]}"
  exit 1
fi
