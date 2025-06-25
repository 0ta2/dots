#!/usr/bin/env bash

set -euo pipefail

# Ensure starship is installed and in PATH
if ! command -v starship >/dev/null 2>&1; then
    exit 1
fi

# Get module name
MODULE_NAME="$1"
if [[ -z "$MODULE_NAME" ]]; then
    exit 1
fi

CURRENT_PANE_PATH=$(tmux display-message -p "#{pane_current_path}")

# Module specified, get only that module
starship module "$MODULE_NAME" --path "$CURRENT_PANE_PATH" | sed -E 's/\x1b\[[0-9;()]*[a-zA-Z@]?//g' | sed 's/^[[:space:]]*[^[:space:]]* //'
