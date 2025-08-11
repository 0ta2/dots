return {
    {
        "yetone/avante.nvim",
        build = "make",
        version = false,
        ---@module 'avante'
        ---@type avante.Config
        opts = {
            ---@alias Provider "claude" | "openai" | "azure" | "gemini" | "cohere" | "copilot" | string
            ---@type Provider
            provider = "copilot",
            ---@alias Mode "agentic" | "legacy"
            ---@type Mode
            mode = "agentic",
            auto_suggestions_provider = "copilot",
        },
        dependencies = {
            "nvim-lua/plenary.nvim",
            "MunifTanjim/nui.nvim",
            "folke/snacks.nvim",
            "nvim-tree/nvim-web-devicons",
            {
                "HakonHarnes/img-clip.nvim",
                opts = {
                    default = {
                        embed_image_as_base64 = false,
                        prompt_for_file_name = false,
                        drag_and_drop = {
                            insert_mode = true,
                        },
                    },
                },
            },
            opts = {
                file_selector = {
                    provider = "snacks",
                },
            },
        },
    },

    {
        "zbirenbaum/copilot.lua",
        opts = {},
    }
}
