--
-- ファイルエクスプローラー
--
local canola_columns = {
    detail = { "icon", "git_status", "permissions", "size", "mtime" },
    simple = { "icon" },
}
local canola_detail = true
vim.g.canola = {
    cursor = true,
    hidden = {
        enabled = false,
    },
    columns = canola_columns.detail,
    keymaps = {
        h = { callback = "actions.parent", mode = "n" },
        l = { callback = "actions.select", mode = "n" },
        ["gd"] = {
            desc = "Toggle file detail view",
            callback = function()
                canola_detail = not canola_detail
                local cols = canola_detail and canola_columns.detail or canola_columns.simple
                require("canola").set_columns(cols)
            end,
        },
        ["<C-p>"] = {
            desc = "カレントディレクトリでファイル検索",
            callback = function()
                local dir = require("canola").get_current_dir()
                require("fzf-lua").files({ cwd = dir })
            end,
        },
        ["<C-g>"] = {
            desc = "カレントディレクトリで文字列検索",
            callback = function()
                local dir = require("canola").get_current_dir()
                require("fzf-lua").live_grep_native({ cwd = dir })
            end,
        },
    },
    watch = false,
}
vim.g.canola_git = {
    show = { untracked = true, ignored = false },
    format = "compact",
}
vim.g.canola_trash = {}
vim.pack.add({
    { src = "https://github.com/barrettruth/canola.nvim", version = "canola" },
    { src = "https://github.com/barrettruth/canola-collection" },
})
vim.keymap.set("n", "<Leader>e", "<Cmd>Canola<CR>", { desc = "ファイルツリーを開く" })

--
-- ファジーファインダー
--
vim.pack.add({
    { src = "https://github.com/ibhagwan/fzf-lua" },
})

local fzf = require("fzf-lua")
fzf.setup({
    lsp = {
        jump1 = true,
        ignore_current_line = true,
        includeDeclaration = false,
    },
})
fzf.register_ui_select()
vim.keymap.set("n", "<Leader>fc", "<Cmd>FzfLua<CR>", { desc = "ピッカー検索" })
vim.keymap.set("n", "<Leader>fl", "<Cmd>FzfLua lgrep_curbuf<CR>", { desc = "ライン検索" })
vim.keymap.set("n", "<Leader>fj", "<Cmd>FzfLua jumps<CR>", { desc = "jumpの検索" })
vim.keymap.set("n", "<Leader>ft", "<Cmd>FzfLua filetypes<CR>", { desc = "ファイルタイプの検索" })
vim.keymap.set("n", "<C-g>", "<Cmd>FzfLua live_grep_native<CR>", { desc = "文字列検索" })
vim.keymap.set("n", "<C-p>", "<Cmd>FzfLua global<CR>", { desc = "ファイル検索" })

--
-- テキスト編集拡張
--
vim.pack.add({
    { src = "https://github.com/kylechui/nvim-surround" },
    { src = "https://github.com/andymass/vim-matchup" },
    { src = "https://github.com/saghen/blink.download" },
    { src = "https://github.com/saghen/blink.indent" },
    { src = "https://github.com/saghen/blink.pairs", version = vim.version.range(">=0") },
})

require("nvim-surround").setup({})
vim.g.matchup_treesitter_stopline = 500
vim.g.matchup_treesitter_enabled = 1
vim.g.matchup_matchparen_offscreen = { method = "popup" }
vim.keymap.set({ "n", "x" }, "m", "<Plug>(matchup-%)", { desc = "対応括弧へ移動", noremap = false })

-- kanagawa-paper に合わせた括弧レインボーカラー
local p = require("kanagawa-paper.colors").setup().palette
local blink_pairs_colors = {
    Yellow = p.carpYellow,
    Blue = p.crystalBlue,
    Green = p.springGreen,
    Peach = p.surimiOrange,
    Lavender = p.oniViolet,
    Red = p.waveRed,
}
for name, color in pairs(blink_pairs_colors) do
    vim.api.nvim_set_hl(0, "BlinkPairs" .. name, { fg = color })
end

--- @module 'blink.pairs'
--- @type blink.pairs.Config
require("blink.pairs").setup({
    mappings = {
        enabled = true,
        disabled_filetypes = {},
        pairs = {
            ["["] = { {
                "[",
                "]",
                when = function()
                    return false
                end,
            } },
        },
    },
    highlights = {
        enabled = true,
        groups = {
            "BlinkPairsYellow",
            "BlinkPairsBlue",
            "BlinkPairsGreen",
            "BlinkPairsPeach",
            "BlinkPairsLavender",
            "BlinkPairsRed",
        },
        matchparen = { enabled = true, group = "MatchParen" },
    },
    debug = false,
})

require("blink.indent").setup({})

--
-- Git
--
vim.pack.add({
    { src = "https://github.com/lewis6991/gitsigns.nvim" },
    { src = "https://github.com/esmuellert/codediff.nvim" },
    { src = "https://github.com/linrongbin16/gitlinker.nvim" },
})

require("gitsigns").setup()
require("codediff").setup({
    keymaps = {
        toggle_stage = "-",
        stage_hunk = "<leader>hs",
        unstage_hunk = "<leader>hu",
        discard_hunk = "<leader>hr",
    },
})
require("gitlinker").setup()

--
-- カーソル移動強化
--
vim.pack.add({
    { src = "https://github.com/nvim-mini/mini.jump2d" },
})
require("mini.jump2d").setup({
    mappings = {
        start_jumping = "s",
    },
})

--
-- ウィンドウ管理
--
vim.pack.add({
    { src = "https://github.com/mrjones2014/smart-splits.nvim" },
})

require("smart-splits").setup()

-- リサイズ（Ghostty: macos-option-as-alt = true が必要）
vim.keymap.set("n", "<A-h>", require("smart-splits").resize_left)
vim.keymap.set("n", "<A-j>", require("smart-splits").resize_down)
vim.keymap.set("n", "<A-k>", require("smart-splits").resize_up)
vim.keymap.set("n", "<A-l>", require("smart-splits").resize_right)
-- ウィンドウ間移動
vim.keymap.set("n", "<C-h>", require("smart-splits").move_cursor_left)
vim.keymap.set("n", "<C-j>", require("smart-splits").move_cursor_down)
vim.keymap.set("n", "<C-k>", require("smart-splits").move_cursor_up)
vim.keymap.set("n", "<C-l>", require("smart-splits").move_cursor_right)
vim.keymap.set("n", "<C-\\>", require("smart-splits").move_cursor_previous)
-- バッファスワップ
vim.keymap.set("n", "<leader>lh", require("smart-splits").swap_buf_left)
vim.keymap.set("n", "<leader>lj", require("smart-splits").swap_buf_down)
vim.keymap.set("n", "<leader>lk", require("smart-splits").swap_buf_up)
vim.keymap.set("n", "<leader>ll", require("smart-splits").swap_buf_right)

--
-- 検索・置換
--
vim.pack.add({
    { src = "https://github.com/MagicDuck/grug-far.nvim" },
})
require("grug-far").setup({
    windowCreationCommand = "topleft vsplit",
    headerMaxWidth = 80,
})

--
-- バッファ管理
--
vim.pack.add({
    { src = "https://github.com/chrisgrieser/nvim-early-retirement" },
})
require("early-retirement").setup({
    retirementAgeMins = 5,
    minimumBufferNum = 5,
})
