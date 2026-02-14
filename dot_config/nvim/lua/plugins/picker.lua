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
            -- {
            --     "<c-p>",
            --     function()
            --         Snacks.picker.smart()
            --     end,
            --     desc = "ファイルのスマート検索(buffers, recent, files)",
            -- },
            -- {
            --     "<c-g>",
            --     function()
            --         Snacks.picker.grep()
            --     end,
            --     desc = "文字列検索",
            -- },
            {
                "<c-j>",
                function()
                Snacks.picker.jumps()
                end,
                desc = "jump履歴の移動",
            },
            {
                "<leader>c",
                function()
                    Snacks.picker.pickers()
                end,
                desc = "ピッカーのピッカー",
            },
            {
                "<leader>gi",
                function()
                    Snacks.picker.gh_issue()
                end,
                desc = "GitHub Issues 一覧(Openのみ)",
            },
            {
                "<leader>gI",
                function()
                    Snacks.picker.gh_issue({ state = "all" })
                end,
                desc = "GitHub Issues 一覧(all)",
            },
            {
                "<leader>gp",
                function()
                    Snacks.picker.gh_pr()
                end,
                desc = "GitHub Pull Requests 一覧(Openのみ)",
            },
            {
                "<leader>gP",
                function()
                    Snacks.picker.gh_pr({ state = "all" })
                end,
                desc = "GitHub Pull Requests 一覧(all)",
            },
        },
    },

    {
        "2kabhishek/seeker.nvim",
        dependencies = { "folke/snacks.nvim" },
        cmd = { "Seeker" },
        keys = {
            { "<c-p>", ":Seeker files<CR>", desc = "seeker の Files 検索" },
            { "<c-g>", ":Seeker grep<CR>",  desc = "seeker の Grep 検索" },
        },
        opts = {},
    },
}
