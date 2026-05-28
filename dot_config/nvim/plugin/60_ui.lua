--
-- キーバインドヘルプ
--
vim.pack.add({
    { src = "https://github.com/nvim-mini/mini.clue" },
})
local miniclue = require("mini.clue")
miniclue.setup({
    triggers = {
        -- Leader triggers
        { mode = { "n", "x" }, keys = "<Leader>" },
        -- `[` and `]` keys
        { mode = "n", keys = "[" },
        { mode = "n", keys = "]" },
        -- Built-in completion
        { mode = "i", keys = "<C-x>" },
        -- Marks
        { mode = { "n", "x" }, keys = "'" },
        { mode = { "n", "x" }, keys = "`" },
        -- Registers
        { mode = { "n", "x" }, keys = '"' },
        { mode = { "i", "c" }, keys = "<C-r>" },
        -- Window commands
        { mode = "n", keys = "<C-w>" },
        -- `z` key
        { mode = { "n", "x" }, keys = "z" },
        -- `g` key
        { mode = { "n", "x" }, keys = "g" },
    },

    clues = {
        miniclue.gen_clues.square_brackets(),
        miniclue.gen_clues.builtin_completion(),
        miniclue.gen_clues.marks(),
        miniclue.gen_clues.registers(),
        miniclue.gen_clues.windows(),
        miniclue.gen_clues.g(),
        miniclue.gen_clues.z(),
        { mode = { "n", "x" }, keys = "<Leader>h", desc = "diffcode" },
        { mode = { "n", "x" }, keys = "<Leader>f", desc = "fzf-lua" },
    },
    window = {
        delay = 500,
    },
})
vim.api.nvim_create_autocmd("FileType", {
    pattern = "codediff",
    callback = function()
        vim.schedule(function()
            pcall(function()
                require("mini.clue").set_buffer_triggers()
            end)
        end)
    end,
})

--
-- カーソルアニメーション
--
vim.pack.add({
    { src = "https://github.com/sphamba/smear-cursor.nvim" },
})
require("smear_cursor").setup({
    msg = {
        targets = {
            default = "cmd",
            error = "msg",
            list_cmd = "pager",
            search_count = "cmd",
            return_prompt = "cmd",
        },
    },
})

--
-- UI 強化（コマンドライン/通知）
--
require("vim._core.ui2").enable({
    enable = true,
    msg = {
        ---@type 'cmd'|'msg' Default message target, either in the
        ---cmdline or in a separate ephemeral message window.
        ---@type string|table<string, 'cmd'|'msg'|'pager'> Default message target
        ---or table mapping |ui-messages| kinds and triggers to a target.
        targets = "cmd",
        cmd = {
            height = 1,
        },
        dialog = {
            height = 0.5,
        },
        msg = {
            height = 0.5,
            timeout = 4000,
        },
        pager = {
            height = 1,
        },
    },
})
vim.pack.add({
    { src = "https://github.com/rachartier/tiny-cmdline.nvim" },
})
require("tiny-cmdline").setup({
    width = {
        value = "60%",
        min = 40,
        max = 80,
    },
    position = {
        x = "50%",
        y = "50%",
    },
    menu_col_offset = 3,
    on_reposition = require("tiny-cmdline").adapters.blink,
    native_types = {},
})

--
-- Code Action
--
vim.pack.add({
    { src = "https://github.com/rachartier/tiny-code-action.nvim" },
    { src = "https://github.com/nvimdev/lspsaga.nvim" },
})
require("tiny-code-action").setup({
    picker = { "fzf-lua" },
})
require("lspsaga").setup({
    lightbulb = {
        virtual_text = false,
    },
    ui = {
        code_action = "󰌶",
    },
})

local p = (require("kanagawa-paper.colors").setup() or {}).palette or {}

--
-- モード表示
--
vim.pack.add({
    { src = "https://github.com/mvllow/modes.nvim" },
})
require("modes").setup({
    colors = {
        bg = "",
        copy = p.carpYellow,
        delete = p.peachRed,
        change = p.peachRed,
        format = p.surimiOrange,
        insert = p.waveAqua2,
        replace = p.waveBlue2,
        select = p.oniViolet,
        visual = p.oniViolet,
    },
    line_opacity = 0.4,
})

--
-- ウィンドウフォーカスの視覚化
--
vim.pack.add({
    { src = "https://github.com/tadaa/vimade" },
})
require("vimade").setup({
    recipe = { "default", { animate = true } },
    fadelevel = 0.6,
})

--
-- バッファライン
--
vim.pack.add({
    { src = "https://github.com/akinsho/bufferline.nvim" },
})

require("bufferline").setup({
    options = {
        show_buffer_icons = true,
        diagnostics = "nvim_lsp",
        diagnostics_indicator = function(_, _, diagnostics_dict, _)
            local s = " "
            for e, n in pairs(diagnostics_dict) do
                local sym = (e == "error" and "󰅚 ")
                    or (e == "warning" and "󰀪 ")
                    or (e == "info" and "󰋽 ")
                    or (e == "hint" and "󰌶")
                s = s .. n .. sym
            end
            return s
        end,
    },
})
vim.keymap.set("n", "<leader>q", function()
    local bufs = vim.fn.getbufinfo({ buflisted = 1 })
    if #bufs > 1 then
        vim.cmd("bprevious")
        vim.cmd("bdelete #")
    else
        vim.cmd("bdelete")
    end
end, { desc = "バッファを閉じる（レイアウト保持）" })

--
-- パンくず表示
--
vim.pack.add({
    { src = "https://github.com/Bekaboo/dropbar.nvim" },
})
require("dropbar").setup()
vim.api.nvim_set_hl(0, "DropBarIconUISeparator", { fg = p.crystalBlue, bold = true })
vim.api.nvim_set_hl(0, "DropBarIconKindDefault", { fg = p.carpYellow })
vim.api.nvim_set_hl(0, "WinBar", { fg = p.fujiWhite })

--
-- データビジュアライゼーション
--
vim.pack.add({
    { src = "https://github.com/Owen-Dechow/graph_view_yaml_parser" },
    { src = "https://github.com/Owen-Dechow/graph_view_toml_parser" },
    { src = "https://github.com/a-usr/xml2lua.nvim" },
    { src = "https://github.com/Owen-Dechow/videre.nvim" },
})

require("videre").setup({
    round_units = true,
    simple_statusline = true,
})

--
-- ダッシュボード
--
vim.pack.add({
    { src = "https://github.com/goolord/alpha-nvim" },
})

local alpha = require("alpha")
local dashboard = require("alpha.themes.dashboard")
dashboard.section.header.val = {
    [[                               __                ]],
    [[  ___     ___    ___   __  __ /\_\    ___ ___    ]],
    [[ / _ `\  / __`\ / __`\/\ \/\ \\/\ \  / __` __`\  ]],
    [[/\ \/\ \/\  __//\ \_\ \ \ \_/ |\ \ \/\ \/\ \/\ \ ]],
    [[\ \_\ \_\ \____\ \____/\ \___/  \ \_\ \_\ \_\ \_\]],
    [[ \/_/\/_/\/____/\/___/  \/__/    \/_/\/_/\/_/\/_/]],
}
dashboard.section.buttons.val = {
    dashboard.button("e", "󰝒  > New file", ":ene | startinsert<CR>"),
    dashboard.button("f", "󰈞  > Find file", ":FzfLua global<CR>"),
    dashboard.button("k", "󰊢  > Lazygit", ":IwanoToggle lazygit<CR>"),
    dashboard.button("v", "󰕷  > Vim.pack update", ":PackUpdate<CR>"),
    dashboard.button("m", "  > Mason", ":Mason<CR>"),
    dashboard.button("q", "󰗼  > Quit NVIM", ":qa<CR>"),
}
alpha.setup(dashboard.opts)
