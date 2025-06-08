function fghq() {
  local selected_dir
  selected_dir=$(ghq list | fzf --query="${LBUFFER}")

  if [ -n "${selected_dir}" ]; then
    if [[ -n "${TMUX}" ]]; then
      tmux rename-window $(basename ${selected_dir})
    fi

    BUFFER="cd $(ghq root)/${selected_dir}"
    zle accept-line
  fi
}

zle -N fghq
bindkey "^]" fghq
