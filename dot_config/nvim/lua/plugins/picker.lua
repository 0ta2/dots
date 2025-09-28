return {
    {
        "folke/snacks.nvim",
        priority = 1000,
        lazy = false,
        opts = {
            picker = {
                enabled = true,
                formatters = {
                    file = {
                        filename_first = true,
                    },
                },
                hidden = true,
            },
        },
        keys = {
            -- Picker
            { "<c-p>", function() Snacks.picker.smart() end, desc = "ファイルのスマート検索(buffers, recent, files)" },
            { "<c-g>", function() Snacks.picker.grep() end, desc = "文字列検索" },
            { "<leader>c", function() Snacks.picker.pickers() end, desc = "ピッカーのピッカー" },
        },
    },

    -- {
    --     "ibhagwan/fzf-lua",
    --     opts = {},
    --     keys = {
    --         {
    --             "<c-p>",
    --             function()
    --                 require("fzf-lua").combine({ pickers = { "buffers", "oldfiles", "files" } })
    --             end,
    --             desc = "ファイルのスマート検索(oldfiles,files,buffers)",
    --         },
    --         {
    --             "<c-g>",
    --             function ()
    --                 FzfLua.live_grep()
    --             end,
    --             desc = "文字列検索"
    --         },
    --         { "<leader>c", "<cmd>FzfLua builtin<cr>", desc = "ピッカーのピッカー" },
    --     }
    -- },
}
