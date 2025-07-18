return {
    {
        "folke/which-key.nvim",
        opts = {},
        config = function() local wk = require("which-key")
            wk.add({
                { "<leader>f", group = "[F]ile" },
                { "<leader>g", group = "[G]it" },
            })
        end
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
}
