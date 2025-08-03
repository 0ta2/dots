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
            },

            fuzzy = { implementation = "prefer_rust_with_warning" }
        },
        opts_extend = { "sources.default" }
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

    {
        "kylechui/nvim-surround",
        version = "^3.0.0",
        opts = {},
    },
}
