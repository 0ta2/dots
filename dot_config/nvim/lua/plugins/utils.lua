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
        lazy = false,
        ---@type snacks.Config
        opts = {
                enabled = true,
            },
            explorer = {
                enabled = true,
            },
        },
        keys = {
            { "<leader>e", function() Snacks.explorer.open() end, desc = "エクスプローラーを開く" },
            -- Lazygit
            { "<leader>gl", function() Snacks.lazygit() end, desc = "Lazygitを開く" },
        },
    },
}
