tsm () {
    sessions=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | sort)

    result=$(echo "$sessions" | \
        fzf --preview='tmux list-windows -t {} -F "#{window_index}: #{window_name}"' \
        --expect=ctrl-q,ctrl-t,ctrl-r \
        --no-select-1 \
        --header='Enter: switch | Ctrl+q: kill | Ctrl+t: new | Ctrl+r: rename')

    if [ -z "$result" ]; then
        exit 0
    fi

    key=$(echo "$result" | sed -n '1p')
    session=$(echo "$result" | sed -n '2p')

    case "$key" in
        ctrl-q)
            if [ -n "$session" ]; then
                echo -n "Kill session '$session'? (y/N): "
                read -r answer
                if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
                    current_session=$(tmux display-message -p '#S')
                    if [ "$session" = "$current_session" ]; then
                        tmux switch-client -n
                    fi
                    tmux kill-session -t "$session"
                    echo "Session '$session' killed."
                else
                    echo "Cancelled."
                fi
            fi
            ;;

        ctrl-t)
            echo -n "New session name: "
            read -r new_session_name
            if [ -n "${new_session_name}" ]; then
                ta ${new_session_name}
            else
                echo "Cancelled."
            fi
            ;;

        ctrl-r)
            if [ -n "$session" ]; then
                echo -n "New name for '$session': "
                read -r new_session_name
                if [ -n "$new_session_name" ]; then
                    # 命名の表記揺れ吸収
                    name="${(U)new_session_name}"
                    # セッション名の簡易正規化(英数._- 以外は - に変換)
                    name="${name//[^A-Za-z0-9_.-]/-}"

                    session_name="$name"
                    tmux rename-session -t "$session" "$name"
                    echo "Session renamed to '$name'."
                else
                    echo "Cancelled."
                fi
            fi
            ;;

        *)
            if [ -n "$session" ]; then
                tmux switch-client -t "$session"
            fi
            ;;
    esac
}
