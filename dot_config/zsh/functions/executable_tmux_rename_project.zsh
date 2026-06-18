function tmux-rename-project() {
  [[ -z "$TMUX" ]] && { echo "not in tmux" >&2; return 1 }
  local raw
  raw=$(~/.local/bin/tmux-window-name "$PWD")
  local name="${${(L)raw}//[^A-Za-z0-9_.-]/-}"
  tmux rename-session -- "$name"
}
