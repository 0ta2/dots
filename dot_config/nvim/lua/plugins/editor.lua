return {
    {
        "folke/snacks.nvim",
        priority = 1000,
        lazy = false,
        ---@type snacks.Config
        opts = {
            explorer = {
                enabled = true,
            },
        },
        keys = {
            -- explorer
            { "<leader>e", function() Snacks.explorer.open() end, desc = "エクスプローラーを開く" },
            -- lazygit
            { "<leader>gl", function() Snacks.lazygit() end, desc = "Lazygitを開く" },
        },
    },

    -- カーソルの移動強化
    {
        "folke/flash.nvim",
        ---@type Flash.Config
        opts = {},
        keys = {
            { "s", mode = { "n", "x", "o" }, function() require("flash").jump() end,       desc = "Flash" },
            { "S", mode = { "n", "x", "o" }, function() require("flash").treesitter() end, desc = "Flash Treesitter" },
        },
    },

    -- csv を見やすく表示するためのプラグイン
    {
        "hat0uma/csvview.nvim",
        ---@module "csvview"
        ---@type CsvView.Options
        opts = {
            parser = { comments = { "#", "//" } },
            keymaps = {
                -- Text objects for selecting fields
                textobject_field_inner = { "if", mode = { "o", "x" } },
                textobject_field_outer = { "af", mode = { "o", "x" } },
                -- Excel-like navigation:
                -- Use <Tab> and <S-Tab> to move horizontally between fields.
                -- Use <Enter> and <S-Enter> to move vertically between rows and place the cursor at the end of the field.
                -- Note: In terminals, you may need to enable CSI-u mode to use <S-Tab> and <S-Enter>.
                jump_next_field_end = { "<Tab>", mode = { "n", "v" } },
                jump_prev_field_end = { "<S-Tab>", mode = { "n", "v" } },
                jump_next_row = { "<Enter>", mode = { "n", "v" } },
                jump_prev_row = { "<S-Enter>", mode = { "n", "v" } },
            },
            view = {
                ---@type CsvView.Options.View.DisplayMode
                display_mode = "border",
            },
        },
        cmd = { "CsvViewEnable", "CsvViewDisable", "CsvViewToggle" },
    },

    -- vimの画面分割とtmuxとのシームレスな移動
    -- NOTE: tmuxのプラグインとしても使用している｡
    {
        'mrjones2014/smart-splits.nvim',
        opts = {},
        config = function()
            -- resizing splits
            -- Ghostty に macos-option-as-alt = true の設定が必要
            vim.keymap.set('n', '<A-h>', require('smart-splits').resize_left)
            vim.keymap.set('n', '<A-j>', require('smart-splits').resize_down)
            vim.keymap.set('n', '<A-k>', require('smart-splits').resize_up)
            vim.keymap.set('n', '<A-l>', require('smart-splits').resize_right)
            -- moving between splits
            vim.keymap.set('n', '<C-h>', require('smart-splits').move_cursor_left)
            vim.keymap.set('n', '<C-j>', require('smart-splits').move_cursor_down)
            vim.keymap.set('n', '<C-k>', require('smart-splits').move_cursor_up)
            vim.keymap.set('n', '<C-l>', require('smart-splits').move_cursor_right)
            vim.keymap.set('n', '<C-\\>', require('smart-splits').move_cursor_previous)
            -- swapping buffers between weditindows
            vim.keymap.set('n', '<leader>lh', require('smart-splits').swap_buf_left)
            vim.keymap.set('n', '<leader>lj', require('smart-splits').swap_buf_down)
            vim.keymap.set('n', '<leader>lk', require('smart-splits').swap_buf_up)
            vim.keymap.set('n', '<leader>ll', require('smart-splits').swap_buf_right)
        end
    },
}
