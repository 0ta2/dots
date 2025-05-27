-- リーダーキーを `<space>` に設定
-- 詳しくは、 `:help mapleader` を参照
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

-- ターミナルでNerd Fontがインストールされ、選択されている場合はtrueに設定
vim.g.have_nerd_font = false

-- options の設定
require("options")

-- keymaps の設定
require("keymaps")

-- lazy.nvim のインストール
require("lazy-bootstrap")

-- lazy.nvim のインストール
require("lazy-bootstrap")

-- lazy.nvim の Plugins 設定
require("lazy-plugins")
