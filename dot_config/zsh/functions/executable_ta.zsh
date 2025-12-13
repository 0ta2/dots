ta() {
    local name="${1-}"

    if [[ -n ${name} ]]; then
        # NOTE: 命名の表記揺れを吸収するため｡ある程度置換する｡
        # zsh 機能で大文字化
        name=${(U)name}
        # セッション名の簡易正規化(英数._- 以外は - に変換)
        name=${name//[^A-Za-z0-9_.-]/-}

        # NOTE: = をつけないとtmuxは､前方一致で確認をするため､厳密な一致でチェックする｡
        if tmux has-session -t "=${name}" 2>/dev/null; then
            if [[ -n "${TMUX-}" ]]; then
                tmux switch-client -t "=${name}"
            else
                tmux attach-session -t "=${name}"
            fi
        else
            tmux new-session -s "${name}"
        fi
    else
        if [[ -n "${TMUX-}" ]]; then
            # 直前のセッションへ（なければ何もしない）
            tmux switch-client -l 2>/dev/null || tmux display-message "no previous session"
        else
            tmux atache-session 2>/dev/null || tmux new-session
        fi
    fi
}
