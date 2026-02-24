return {
    {
        "folke/sidekick.nvim",
        opts = {
            cli = {
                ---@class sidekick.cli.Mux
                ---@field backend? "tmux"|"zellij" Multiplexer backend to persist CLI sessions
                mux = {
                    backend = "tmux",
                    enabled = true,
                },
                ---@type table<string, sidekick.Prompt|string|fun(ctx:sidekick.context.ctx):(string?)>
                prompts = {
                    changes = "変更内容をレビューしてください。",
                    diagnostics = "{file} の診断エラーを修正する方法を教えてください。\n{diagnostics}",
                    diagnostics_all = "以下の診断エラーを修正する方法を教えてください。\n{diagnostics_all}",
                    document = "{function|line} にドキュメントを追加してください。",
                    explain = "{this} を説明してください。",
                    fix = "{this} を修正してください。",
                    optimize = "{this} を最適化するにはどうすればよいですか？",
                    review = "{file} に問題や改善点がないかレビューしてください。",
                    tests = "{this} のテストを書いてください。",
                    -- simple context prompts
                    buffers = "{buffers}",
                    file = "{file}",
                    line = "{line}",
                    position = "{position}",
                    quickfix = "{quickfix}",
                    selection = "{selection}",
                    ["function"] = "{function}",
                    class = "{class}",
                },
            },
        },
        keys = {
            {
                "<tab>",
                function()
                    if not require("sidekick").nes_jump_or_apply() then
                        return "<Tab>"
                    end
                end,
                expr = true,
                desc = "Goto/Apply Next Edit Suggestion",
            },
            {
                "<c-.>",
                function()
                    require("sidekick.cli").toggle({ filter = { installed = true } })
                end,
                desc = "Sidekick Toggle",
                mode = { "n", "t", "i", "x" },
            },
            {
                "<leader>ad",
                function()
                    require("sidekick.cli").close()
                end,
                desc = "CLIのセッションを閉じる",
            },
            {
                "<leader>at",
                function()
                    require("sidekick.cli").send({ msg = "{this}" })
                end,
                mode = { "x", "n" },
                desc = "現在のブロックを Sidekick に連携する",
            },
            {
                "<leader>af",
                function()
                    require("sidekick.cli").send({ msg = "{file}" })
                end,
                desc = "現在のファイルを Sidekeick に連携する",
            },
            {
                "<leader>av",
                function()
                    require("sidekick.cli").send({ msg = "{selection}" })
                end,
                mode = { "x" },
                desc = "選択している範囲を Sidekick に連携する",
            },
            {
                "<leader>ap",
                function()
                    require("sidekick.cli").prompt()
                end,
                mode = { "n", "x" },
                desc = "Sidekick の Prompt を選択",
            },
        },
    },

    {
        "olimorris/codecompanion.nvim",
        opts = {
            opts = {
                language = "Japanese",
                display = {
                    actiion_palette = {
                        provider = "snacks",
                    },
                },
            },
        },
    },

    {
        "carlos-algms/agentic.nvim",
        opts = {
            provider = "claude-acp",
        },
    },

    {
        "zbirenbaum/copilot.lua",
        opts = {
            -- Override should_attach to allow copilot in AgenticInput buffers
            -- AgenticInput uses buftype = "nofile" which copilot.lua rejects by default
            should_attach = function(bufnr, bufname)
                local filetype = vim.bo[bufnr].filetype

                if filetype == "AgenticInput" then
                    return true
                end

                -- Delegate to default behavior for all other buffers
                local default_should_attach = require("copilot.config.should_attach").default
                return default_should_attach(bufnr, bufname)
            end,
        },
    },
}
