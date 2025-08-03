return {
    {
        'saghen/blink.cmp',
        version = '1.*',

        ---@module 'blink.cmp'
        ---@type blink.cmp.Config
        opts = {
            keymap = { preset = 'super-tab' },

            appearance = {
                nerd_font_variant = 'mono'
            },

            completion = { documentation = { auto_show = false } },

            sources = {
                default = { 'lsp', 'path', 'snippets', 'buffer' },
                providers = {
                    lazydev = {
                        name = "LazyDev",
                        module = "lazydev.integrations.blink",
                        score_offset = 100,
                    },
                },
            },

            fuzzy = { implementation = "prefer_rust_with_warning" }
        },
        opts_extend = { "sources.default" }
    },

    -- lualsの高速なセットアップのためのプラグイン
    {
        "folke/lazydev.nvim",
        opts = {
            library = {
                { path = "${3rd}/luv/library", words = { "vim%.uv" } },
                { path = "snacks.nvim",        words = { "Snacks" } },
                { path = "lazy.nvim",          words = { "LazyVim" } },
            },
        }
    },

    {
        'saghen/blink.pairs',
        version = '*',
        dependencies = 'saghen/blink.download',
        opts = {
            mappings = {
                enabled = true,
                disabled_filetypes = {},
                pairs = {},
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
                matchparen = {
                    enabled = true,
                    group = 'MatchParen',
                },
            },
            debug = false,
        },
        config = function(_, opts)
            local palette = require("catppuccin.palettes").get_palette("mocha")
            local colors = {
                Yellow = palette.yellow,
                Blue = palette.blue,
                Green = palette.green,
                Peach = palette.peach,
                Lavender = palette.lavender,
                Red = palette.red,
            }
            for name, color in pairs(colors) do
                vim.api.nvim_set_hl(0, "BlinkPairs" .. name, { fg = color })
            end
            require("blink.pairs").setup(opts)
        end,
    },

    -- 区切り文字の追加､削除､変更
    {
        "kylechui/nvim-surround",
        version = "^3.0.0",
        opts = {},
    },

    -- カッコ閉じの移動を強化
    {
        "andymass/vim-matchup",
        init = function()
            vim.g.matchup_treesitter_stopline = 500
            vim.g.matchup_treesitter_enabled = 1
            vim.g.matchup_matchparen_offscreen = { method = "popup" }
            require('match-up').setup({
                treesitter = {
                    stopline = 500
                }
            })
        end,
        ---@type matchup.Config
        opts = {
            treesitter = {
                stopline = 500,
            }
        },
        config = function()
            -- %キーのデフォルト動作を<leader>%に移動
            vim.keymap.set({ 'n', 'x' }, 'm', '<Plug>(matchup-%)', { desc = "カッコ閉じの移動", noremap = false })
        end
    },
}
