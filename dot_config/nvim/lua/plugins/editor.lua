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

    {
        "folke/flash.nvim",
        ---@type Flash.Config
        opts = {},
        keys = {
            { "s",     mode = { "n", "x", "o" }, function() require("flash").jump() end,              desc = "Flash" },
            { "S",     mode = { "n", "x", "o" }, function() require("flash").treesitter() end,        desc = "Flash Treesitter" },
       },
    },
}
