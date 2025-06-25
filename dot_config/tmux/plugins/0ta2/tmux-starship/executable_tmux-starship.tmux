#!/usr/bin/env bash

set -euo pipefail

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set helper script path for users to reference
tmux set-option -g @starship_cmd "'${CURRENT_DIR}/scripts/helper.sh'"
