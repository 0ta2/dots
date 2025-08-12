
fhistory() {
    # 新しい→古い、行番号なしの履歴を取得(zsh builtin)
  local -a hist uniq
  local -A seen
  hist=("${(@f)$(fc -rl -n 1)}")

  # 先に出たものを優先して重複除去
  local line
  for line in "${hist[@]}"; do
    [[ -n ${seen[$line]} ]] && continue
    seen[$line]=1
    uniq+=("$line")
  done

  local selected
  selected=$(printf '%s\n' "${uniq[@]}" | fzf --query="$LBUFFER" --select-1 --exit-0) || {
    zle reset-prompt
    return 0
  }


  BUFFER=$selected
  CURSOR=$#BUFFER
  zle reset-prompt
}

zle -N fhistory
bindkey '^R' fhistory
