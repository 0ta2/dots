return {
    {
        "nvim-neotest/neotest",
        dependencies = {
            "nvim-neotest/nvim-nio",
            "antoinemadec/FixCursorHold.nvim",
            { "fredrikaverpil/neotest-golang", version = "*" },
        },
        opts = {
            status = { virtual_text = true },
            output = { open_on_run = true },
            adapters = {
                "neotest-golang",
            },
        },
        config = function(_, opts)
            local adapters = {}
            if opts.adapters then
                for _, config in pairs(opts.adapters or {}) do
                    if type(config) == "string" then
                        config = require(config)
                    end
                    adapters[#adapters + 1] = config
                end
                opts.adapters = adapters
            end

            require("neotest").setup(opts)
        end,
    },

    {
        "YuminosukeSato/gogentest",
        config = function()
        end
    },
}
