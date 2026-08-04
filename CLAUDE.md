# CLAUDE.md

このファイルはリポジトリで作業する際に Claude Code (claude.ai/code) へのガイダンスを提供します。

## 概要

[chezmoi](https://www.chezmoi.io/) で管理するドットファイルリポジトリです。chezmoi の命名規則に従ってファイルが `$HOME` へデプロイされます。

## よく使うコマンド

タスクはすべて `mise.toml` に定義されており、`mise run <タスク名>` で実行します:

```bash
# chezmoi
mise run chezmoi:apply     # ドットファイルを適用
mise run chezmoi:diff      # 差分確認
mise run chezmoi:status    # status確認
mise run chezmoi:add       # ファイルをchezmoi管理下に追加
mise run chezmoi:template  # ファイルをテンプレートとして管理

# homebrew
mise run brew:sync         # Brewfileを元にパッケージを同期

# install / update
mise run install            # 初回セットアップ一式 (chezmoi適用 → mise tools → brew/skill/plugin/uv)
mise run update              # 全ツールの更新 (chezmoi/brew/mise/skill/uv tool/herdr plugin)
```

直接 chezmoi コマンドを実行する場合は `--source` を指定する:
```bash
chezmoi --source=~/ghq/github.com/0ta2/dots apply
```

**罠**: `--source` を付けずに `chezmoi apply/diff/managed` を叩くと、デフォルトソース
(`~/.local/share/chezmoi`、ほぼ空スタブ) を見てしまい「managed でない」と誤判定する。

`~/.config/` 配下のファイルを編集する前に、必ず一度 chezmoi 管理下か確認する:
```bash
chezmoi --source=~/ghq/github.com/0ta2/dots managed | grep <name>
```
`find dots -iname '*<name>*'` で済ませない(該当ファイルを見落として直接編集し、次の
`chezmoi apply` で上書きされる事故が過去に複数回発生している)。実体を直接編集して
しまった場合は `mise run chezmoi:add <path>` でソース側に取り込む。

Lua ファイル（Neovim設定）のLint:
```bash
selene dot_config/nvim/
```

## chezmoi のファイル命名規則
- `dot_` prefix → デプロイ時に `.` prefix になる（例: `dot_config/` → `~/.config/`）
- `private_` prefix → パーミッション600でデプロイ
- `executable_` prefix → 実行可能ファイルとしてデプロイ
- `.tmpl` suffix → Go テンプレートとして処理される
- `run_once_` prefix → chezmoi apply 時に一度だけ実行されるスクリプト
- `run_onchange_` prefix → ファイル変更時に実行されるスクリプト

## アーキテクチャ

### ディレクトリ構成

```
dots/
├── .chezmoiscripts/          # chezmoi apply 時に実行されるスクリプト
│   ├── run_once_01_install_brew.sh.tmpl    # Homebrew インストール（初回のみ）
│   └── run_onchange_01_brew-bundle.sh.tmpl # Brewfile 変更時に brew bundle 実行
├── .chezmoiexternal.toml     # 外部 git リポジトリ（tmux プラグイン）
├── .chezmoiignore            # chezmoi でデプロイしないファイル（Brewfile, mise.toml等）
├── dot_agents/skills/        # → ~/.agents/skills/ (Claude Code / Codex 共通 skill の正本)
├── dot_claude/               # → ~/.claude/ (Claude Code 設定と共通 skill へのリンク)
├── dot_config/               # → ~/.config/
│   ├── nvim/                 # Neovim設定（lazy.nvim, selene でLint）
│   ├── zsh/                  # zsh設定（zimfw使用）
│   ├── zed/                  # Zed エディタ設定
│   ├── tmux/                 # tmux設定
│   ├── git/                  # Git設定
│   ├── mise/                 # mise設定
│   ├── ghostty/              # Ghostty ターミナル設定
│   ├── lazygit/              # lazygit設定
│   ├── karabiner/            # Karabiner-Elements設定
│   ├── zsh-abbr/             # zsh 略語設定
│   └── starship.toml         # Starship プロンプト設定
├── dot_local/bin/            # → ~/.local/bin/ （カスタムスクリプト）
│   └── executable_ta             # カスタムスクリプト
├── Brewfile                  # Homebrew パッケージ定義（chezmoi管理外）
├── mise.toml                 # mise タスク定義（chezmoi管理外）
└── selene.toml               # Lua linter 設定（neovim標準, global_usage/unused_variable=deny）
```

### テンプレート変数

`.tmpl` ファイルでは chezmoi テンプレート変数が使える:
- `.chezmoi.username` → ユーザー名。`"0ta2"` の場合はプライベート設定（Brewfile をリポジトリ内から参照）、それ以外は `~/Brewfile`
- `.claudeAllowDomains` → Claude Code の curl 許可ドメイン一覧（`dot_claude/settings.json.tmpl`）

### Claude Code 設定（`dot_claude/settings.json.tmpl`）

- 言語: 日本語
- Vim モード: 有効
- ステータスライン: モデル名とコンテキスト使用率を表示（`statusline-command.sh`）
- 通知: Stop/Notification フックで `terminal-notifier` を使って macOS 通知
- パーミッション: `rm -rf` と `sudo` は deny、`git push/merge/rebase` は確認必須

### 共通 skills

全リポジトリで使う skill の正本は `dot_agents/skills/` に置く。
chezmoi は `~/.agents/skills/` へ配布し、`dot_claude/skills/symlink_*` により
`~/.claude/skills/` からも同じ実体を参照する。内容を2箇所へコピーしない。

`~/.agents/skills/` は Claude Code と Codex の両方が読む。frontmatter は
両者が解釈できるフィールドだけを使う。`name` / `description` / `allowed-tools` /
`disable-model-invocation` / `user-invocable` は両対応。**`when_to_use` は使わない**
(Codex 側に実装が無く、書いてもトリガー情報が Codex から見えなくなる)。
発動条件・トリガー語句・除外条件はすべて `description` に書く。Claude Code は
`description` と `when_to_use` を連結して一覧に載せるため、まとめても損失はない。

### Neovim 設定（`dot_config/nvim/`）

lazy.nvim でプラグイン管理。プラグインは `lua/plugins/` に機能ごとに分割:
- `ai.lua` - AI 補完系
- `coding.lua` - コーディング支援
- `lsp.lua` - LSP設定
- `picker.lua` - ファイル選択
- `ui.lua` - UI系
- 等

`lua/lazy-plugins.lua.tmpl` はテンプレートファイルで、プラグインリストを管理。
