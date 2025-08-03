return {
    -- NOTE: 下記の箇所でも使用中｡変更する場合は統一感を保つため､すべて変更したほうがよい｡
    --          -- catppuccin/tmux
    --          -- bufferline.nvim
    {
        "catppuccin/nvim",
        name = "catppuccin",
        priority = 1000,
        config = function()
            vim.cmd([[colorscheme catppuccin-mocha]])
        end,
        opts = {
            integrations = {
                blink_cmp = {
                    style = 'bordered',
                },
                native_lsp = {
                    enabled = true,
                    virtual_text = {
                        errors = { "italic" },
                        hints = { "italic" },
                        warnings = { "italic" },
                        information = { "italic" },
                        ok = { "italic" },
                    },
                    underlines = {
                        errors = { "underline" },
                        hints = { "underline" },
                        warnings = { "underline" },
                        information = { "underline" },
                        ok = { "underline" },
                    },
                    inlay_hints = {
                        background = true,
                    },
                },
                treesitter = true,
                snacks = {
                    enabled = true,
                },
                flash = true,
                which_key = true,
                lsp_saga = true,
                mason = true,
                grug_far = true,
                gitsigns = {
                    enabled = true,
                    transparent = false,
                }
            },
        },
    },
}
