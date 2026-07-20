--
-- ファイルエクスプローラー
--
vim.pack.add({
    { src = "https://github.com/nvim-neo-tree/neo-tree.nvim" },
})

local function neotree_node_dir(state)
    local node = state.tree:get_node()
    return node.type == "directory" and node.path or vim.fn.fnamemodify(node.path, ":h")
end

require("neo-tree").setup({
    filesystem = {
        filtered_items = {
            visible = true,
            hide_dotfiles = false,
            hide_gitignored = false,
        },
        window = {
            mappings = {
                ["-"] = "close_node",
                ["<C-p>"] = {
                    function(state)
                        require("fzf-lua").files({ cwd = neotree_node_dir(state) })
                    end,
                    desc = "カレントディレクトリでファイル検索",
                },
                ["<C-g>"] = {
                    function(state)
                        require("fzf-lua").live_grep_native({ cwd = neotree_node_dir(state) })
                    end,
                    desc = "カレントディレクトリで文字列検索",
                },
            },
        },
    },
})
vim.keymap.set("n", "<Leader>e", "<Cmd>Neotree reveal toggle<CR>", { desc = "ファイルツリーを開く（現在ファイルを選択）" })

--
-- ファジーファインダー
--
vim.pack.add({
    { src = "https://github.com/ibhagwan/fzf-lua" },
})

local fzf = require("fzf-lua")
fzf.setup({
    files = {
        hidden = true,
        no_ignore = true,
    },
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
    { src = "https://github.com/saghen/blink.lib" },
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
require("blink.pairs").download():pwait(60000)
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
    explorer = {
        view_mode = "tree",
    },
    keymaps = {
        toggle_stage = "-",
        stage_hunk = "<leader>hs",
        unstage_hunk = "<leader>hu",
        discard_hunk = "<leader>hr",
    },
})
vim.keymap.set("n", "gp", function()
    local accessors = require("codediff.ui.lifecycle.accessors")
    local _, path = accessors.get_paths(vim.api.nvim_get_current_tabpage())
    if not path then
        vim.notify("codediff セッションが見つかりません", vim.log.levels.WARN)
        return
    end
    local buf = vim.fn.bufadd(path)
    vim.fn.bufload(buf)
    local popup = require("nui.popup")({
        bufnr = buf,
        enter = true,
        relative = "editor",
        position = "50%",
        size = { width = "80%", height = "85%" },
        border = { style = "rounded", text = { top = " " .. vim.fn.fnamemodify(path, ":~:.") .. " " } },
    })
    popup:mount()
    popup:map("n", "q", function() popup:unmount() end, { nowait = true })
end, { desc = "Peek current diff file in float" })
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
-- ターミナルでは単発 Esc をジョブへ送り、300ms以内の二連打でNormal modeへ抜ける
local terminal_escape_timers = {}

local function handle_terminal_escape()
    local buf = vim.api.nvim_get_current_buf()
    local timer = terminal_escape_timers[buf]
    if timer then
        timer:stop()
        timer:close()
        terminal_escape_timers[buf] = nil

        local keys = vim.api.nvim_replace_termcodes("<C-\\><C-n>", true, false, true)
        vim.api.nvim_feedkeys(keys, "n", false)
        return
    end

    terminal_escape_timers[buf] = vim.defer_fn(function()
        terminal_escape_timers[buf] = nil
        if not vim.api.nvim_buf_is_valid(buf) then
            return
        end

        local job_id = vim.b[buf].terminal_job_id
        if job_id then
            vim.fn.chansend(job_id, "\27")
        end
    end, 300)
end

vim.keymap.set("t", "<Esc>", handle_terminal_escape, { silent = true })
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
