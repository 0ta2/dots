function _set_tmux_pane_title() {
  [[ -z "$TMUX" ]] && return
  tmux select-pane -T "$(~/.local/bin/tmux-window-name "$PWD")" 2>/dev/null
}
precmd_functions+=(_set_tmux_pane_title)
