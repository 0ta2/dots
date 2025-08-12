fghq() {
    local selected_dir 
    selected_dir=$(
        ghq list -p | fzf \
            --query="${LBUFFER}" \
            --select-1 --exit-0
    ) || true

    [[ -z "${selected_dir}" ]] && { zle reset-prompt; return 0 }

    builtin cd -- ${selected_dir} || { zle -M "cd failed: ${selected_dir}"; return 1 }

    if [[ -n "${TMUX-}" ]];then
        # TODO: 正規表現のルールは別で管理 or ta コマンドを呼び出すなどしたい。
        local wname=${${selected_dir:t}//[^A-Za-z0-9_.-]/-}
        tmux rename-window -- ${wname} 2>/dev/null
    fi

    zle reset-prompt
}

zle -N fghq
bindkey "^]" fghq
