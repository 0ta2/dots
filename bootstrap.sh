#!/bin/bash
# 初回のみ実行する。前提: 事前に `chezmoi init --source=... <repo>` 済みで、
# このリポジトリが手元にクローンされている状態から呼ぶ。
# Homebrew と mise を用意した後、`mise run install` (ドットファイル反映・
# 不足ツール・skill・plugin の導入、最後に sync) へ引き渡す。
set -eu

if ! command -v brew >/dev/null 2>&1; then
    echo "🍺 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

BREW_BIN=$(command -v brew || echo /opt/homebrew/bin/brew)

if ! command -v mise >/dev/null 2>&1; then
    echo "⚙️  Installing mise..."
    "$BREW_BIN" install mise
fi

MISE_BIN=$(command -v mise || echo "$("$BREW_BIN" --prefix mise)/bin/mise")

cd "$(dirname "$0")"
"$MISE_BIN" run install
