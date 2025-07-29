return {
    {
        "folke/which-key.nvim",
        opts = {},
        config = function()
            local wk = require("which-key")
            wk.add({
                { "<leader>g", group = "[G]it" },
                { "<leader>l", group = "Sp[l]it" },
            })
        end
    },

    {
        "sphamba/smear-cursor.nvim",
        opts = {},
    },

    {
        'echasnovski/mini.icons', version = '*',
    },

    {
        "folke/snacks.nvim",
        priority = 1000,
        opts = {
            dashboard = {
                enabled = true,
                autokeys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
                sections = {
                    { section = "header" },
                    {
                        pane = 2,
                        icon = "",
                        section = "terminal",
                        title = "Setup Info",
                        cmd = "mise current",
                        indent = 2,
                        height = 5,
                        padding = 1,
                    },
                    { section = "keys", gap = 1, padding = 1 },
                    { pane = 2, icon = " ", title = "Recent Files", section = "recent_files", indent = 2, padding = 1 },
                    { pane = 2, icon = " ", title = "Projects", section = "projects", indent = 2, padding = 1 },
                    {
                        pane = 2,
                        icon = " ",
                        title = "Git Status",
                        section = "terminal",
                        enabled = function()
                            return Snacks.git.get_root() ~= nil
                        end,
                        cmd = "git status --short --branch --renames",
                        height = 5,
                        padding = 1,
                        ttl = 5 * 60,
                        indent = 3,
                    },
                    { section = "startup" },
                },
            },
            indent = {
                enabled = true,
            },
        },
    },

    {
        "folke/noice.nvim",
        opts = {
            lsp = {
                -- override markdown rendering so that **cmp** and other plugins use **Treesitter**
                override = {
                    ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
                    ["vim.lsp.util.stylize_markdown"] = true,
                    ["cmp.entry.get_documentation"] = true, -- requires hrsh7th/nvim-cmp
                },
            },
            -- you can enable a preset for easier configuration
            presets = {
                bottom_search = false,        -- use a classic bottom cmdline for search
                command_palette = true,       -- position the cmdline and popupmenu together
                long_message_to_split = true, -- long messages will be sent to a split
                inc_rename = false,           -- enables an input dialog for inc-rename.nvim
                lsp_doc_border = false,       -- add a border to hover docs and signature help
            },
        },
        dependencies = {
            "rcarriga/nvim-notify",
        },
    },

    {
        'MeanderingProgrammer/render-markdown.nvim',
        ---@module 'render-markdown'
        ---@type render.md.UserConfig
        opts = {
            code = {
                sign = false,
                border = 'thick',
            },
        },
    },
}
