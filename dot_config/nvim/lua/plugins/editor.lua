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
            lazygit = {
                config = {
                    os = { editPreset = "nvim-remote" },
                },
            },
        },
        keys = {
            -- explorer
            { "<leader>e", function() Snacks.explorer.open() end, desc = "エクスプローラーを開く" },
            -- lazygit
            { "<leader>gl", function() Snacks.lazygit() end, desc = "Lazygitを開く" },
        },
    },

    -- Git のバッファ統合
    {
        "lewis6991/gitsigns.nvim",
        opts = {},
    },

    {
        "sindrets/diffview.nvim",
        opts = {},
    },

    -- カーソルの移動強化
    {
        "folke/flash.nvim",
        ---@type Flash.Config
        opts = {
            modes = {
                search = {
                    enabled = true
                },
                char = {
                    jump_labels = true,
                },
            }
        },
        keys = {
            { "<CR>",   mode = { "n", "x", "o" }, function() require("flash").jump() end,              desc = "Flash" },
            { "<C-CR>", mode = { "n", "x", "o" }, function() require("flash").treesitter() end,        desc = "Flash Treesitter" },
            { "r",      mode = "o",               function() require("flash").remote() end,            desc = "Remote Flash" },
            { "R",      mode = { "o", "x" },      function() require("flash").treesitter_search() end, desc = "Treesitter Search" },
            { "<c-s>",  mode = { "c" },           function() require("flash").toggle() end,            desc = "Toggle Flash Search" },
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

    -- バッファの表示
    {
        'akinsho/bufferline.nvim',
        version = "*",
        dependencies = 'nvim-tree/nvim-web-devicons',
        opts = {
            options = {
                diagnostics = "nvim_lsp",
                diagnostics_indicator = function(count, level, diagnostics_dict, context)
                    local s = " "
                    for e, n in pairs(diagnostics_dict) do
                        local sym = (e == "error" and " ")
                            or (e == "warning" and " ")
                            or (e == "info" and " ")
                            or (e == "hint" and "󰌶")
                        s = s .. n .. sym
                    end
                    return s
                end,
            },
            -- NOTE: catppuccin の bufferline のカラーを微調整｡これで､タブのない空白部分が黒くではなく catppuccin のカラーで統一される｡
            highlights = require("catppuccin.groups.integrations.bufferline").get_theme({
                styles = { "italic", "bold" },
                custom = {
                    all = {
                        fill = { bg = "#1e1e2e" },
                    },
                },
            }),
        },
    },

    -- ステータスラインの強化
    {
        'nvim-lualine/lualine.nvim',
        opts = {
            options = {
                theme = 'catppuccin',
                section_separators = { left = '', right = '' },
                component_separators = {},
                extensions = {
                    "lazy",
                    "mason",
                    "trouble",
                },
            },
            sections = {
                lualine_a = { "mode" },
                lualine_b = { "branch" },
                lualine_c = {
                    "%=",
                    {
                        "diff",
                        separator = "  |  ",
                    },
                    {
                        "diagnostics"
                    }
                },
                lualine_x = { "encoding", "fileformat", "filetype" },
                lualine_y = { "progress" },
                lualine_z = { "location" }
            },
        },
    },

    -- 検索･置換
    {
        "MagicDuck/grug-far.nvim",
        opts = { headerMaxWidth = 80 },
    },
}
