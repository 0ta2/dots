return {
    {
        "saghen/blink.cmp",
        version = "1.*",

        dependencies = {
            "L3MON4D3/LuaSnip",
            version = "v2.*",
            dependencies = { "rafamadriz/friendly-snippets" },
            build = "make install_jsregexp",
            config = function()
                require("luasnip.loaders.from_vscode").lazy_load()
            end,
        },

        ---@module 'blink.cmp'
        ---@type blink.cmp.Config
        opts = {
            keymap = {
                ["<C-space>"] = { "show", "show_documentation", "hide_documentation" },
                ["<C-e>"] = { "hide", "fallback" },

                ["<Tab>"] = {
                    function(cmp)
                        if cmp.snippet_active() then
                            return cmp.accept()
                        else
                            return cmp.select_and_accept()
                        end
                    end,
                    "snippet_forward",
                    "fallback",
                },
                ["<S-Tab>"] = { "snippet_backward", "fallback" },

                ["<Up>"] = { "select_prev", "fallback" },
                ["<Down>"] = { "select_next", "fallback" },
                ["<C-p>"] = { "select_prev", "fallback_to_mappings" },
                ["<C-n>"] = { "select_next", "fallback_to_mappings" },

                ["<C-b>"] = { "scroll_documentation_up", "fallback" },
                ["<C-f>"] = { "scroll_documentation_down", "fallback" },

                -- signature設定
                ["<C-u>"] = { "scroll_signature_up", "fallback" },
                ["<C-d>"] = { "scroll_signature_down", "fallback" },
                ["<C-k>"] = { "show_signature", "hide_signature", "fallback" },
            },

            appearance = {
                nerd_font_variant = "mono",
            },

            completion = {
                documentation = { auto_show = true, auto_show_delay_ms = 500 },
                menu = {
                    draw = {
                        columns = {
                            { "label",      "label_description", gap = 1 },
                            { "kind_icon",  "kind",              "source_id", gap = 1 },
                            { "source_name" },
                        },
                        -- NOTE: 補完候補が何から取得されたものかを表示する｡
                        -- https://github.com/Saghen/blink.cmp/discussions/1983
                        components = {
                            source_name = {
                                text = function(ctx)
                                    return ctx.item.client_name or ctx.item.source_name
                                end,
                            },
                        },
                    },
                },
                list = {
                    selection = {
                        preselect = true,
                        auto_insert = true,
                    },
                },
            },

            sources = {
                default = { "lsp", "path", "snippets", "buffer" },
                providers = {
                    lazydev = {
                        name = "LazyDev",
                        module = "lazydev.integrations.blink",
                        score_offset = 100,
                    },
                },
            },

            cmdline = {
                keymap = {
                    ["<Tab>"] = { "show_and_insert_or_accept_single", "select_next" },
                    ["<S-Tab>"] = { "show_and_insert_or_accept_single", "select_prev" },

                    ["<C-space>"] = { "show", "fallback" },

                    ["<C-n>"] = { "select_next", "fallback" },
                    ["<C-p>"] = { "select_prev", "fallback" },
                    ["<Right>"] = { "select_next", "fallback" },
                    ["<Left>"] = { "select_prev", "fallback" },

                    ["<C-y>"] = { "select_and_accept", "fallback" },
                    ["<C-e>"] = { "cancel", "fallback" },
                },
                completion = {
                    menu = {
                        auto_show = true,
                    },
                    ghost_text = { enabled = true },
                },
            },

            fuzzy = { implementation = "prefer_rust_with_warning" },

            snippets = {
                preset = "luasnip",
            },

            signature = { enabled = true },
        },
        opts_extend = { "sources.default" },
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
        },
    },

    {
        "saghen/blink.pairs",
        version = "*",
        dependencies = "saghen/blink.download",
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
                    group = "MatchParen",
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
            require("match-up").setup({
                treesitter = {
                    stopline = 500,
                },
            })
        end,
        ---@type matchup.Config
        opts = {
            treesitter = {
                stopline = 500,
            },
        },
        config = function()
            -- %キーのデフォルト動作を<leader>%に移動
            vim.keymap.set(
                { "n", "x" },
                "m",
                "<Plug>(matchup-%)",
                { desc = "カッコ閉じの移動", noremap = false }
            )
        end,
    },

    -- go
    {
        "olexsmir/gopher.nvim",
        opts = {
            commands = {
                gomodifytags = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "gomodifytags"),
                gotests = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "gotests"),
                impl = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "impl"),
                iferr = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "iferr"),
            },
        },
        config = function(_, opts)
            require("gopher").setup(opts)
        end,
    },
}
