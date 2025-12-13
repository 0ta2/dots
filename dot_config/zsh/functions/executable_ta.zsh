ta() {
    local raw="${1-}"
    local name target

    # 引数なし: 「前のセッションへ / 既存に attach / なければ new」
    if [[ -z "$raw" ]]; then
        if [[ -n "${TMUX-}" ]]; then
            tmux switch-client -l 2>/dev/null || tmux display-message "no previous session"
        else
            tmux attach-session 2>/dev/null || tmux new-session
        fi

        return
    fi

    # 命名の表記揺れ吸収
    name="${(U)raw}"
    # セッション名の簡易正規化(英数._- 以外は - に変換)
    name="${name//[^A-Za-z0-9_.-]/-}"

    # = を付けて厳密一致（前方一致回避）
    target="=${name}"

    if tmux has-session -t "$target" 2>/dev/null; then
        if [[ -n "${TMUX-}" ]]; then
            tmux switch-client -t "$target"
        else
            tmux attach-session -t "$target"
        fi

        return
    fi

    # セッションが無い場合は作ってから移動（tmux外でも tmux内でも成立させる）
    if [[ -n "${TMUX-}" ]]; then
        tmux new-session -d -s "$name"
        tmux switch-client -t "$target"
    else
        tmux new-session -s "$name"
    fi
}
