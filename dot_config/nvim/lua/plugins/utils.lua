return {
    {
        "folke/which-key.nvim",
        opts = {},
        config = function()
            local wk = require("which-key")
            wk.add({
                { "<leader>f", group = "file" },
            })
        end
    },

    {
        "folke/snacks.nvim",
        priority = 1000,
        lazy = false,
        ---@type snacks.Config
        opts = {
            picker = { enabled = true },
        },
        keys = {
            { "<leader>ff", function() Snacks.picker.files() end, desc = "ファイル検索" },

        },
    },
}
