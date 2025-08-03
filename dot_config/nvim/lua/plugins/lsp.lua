local lsp_server = {
    lua_ls = {},
    jsonls = {},
    yamlls = {},
}
local formatters = {
    stylua = {},
}

return {
    {
        "mason-org/mason-lspconfig.nvim",
        opts = {
            ensure_installed = vim.tbl_keys(lsp_server)
        },
        dependencies = {
            {
                "mason-org/mason.nvim",
                opts = {
                    ensure_installed = formatters
                },
                config = function(_, opts)
                    require("mason").setup(opts)
                    local mr = require("mason-registry")
                    mr:on("package:install:success", function()
                        vim.defer_fn(function()
                            -- trigger FileType event to possibly load this newly installed LSP server
                            require("lazy.core.handler.event").trigger({
                                event = "FileType",
                                buf = vim.api.nvim_get_current_buf(),
                            })
                        end, 100)
                    end)

                    mr.refresh(function()
                        for _, tool in ipairs(opts.ensure_installed) do
                            local p = mr.get_package(tool)
                            if not p:is_installed() then
                                p:install()
                            end
                        end
                    end)
                end,
            },
            { "neovim/nvim-lspconfig" },
        },
    },

    {
        'nvimdev/lspsaga.nvim',
        config = function()
            require('lspsaga').setup({})
        end,
        opts = {
            ui = {
                kind = require("catppuccin.groups.integrations.lsp_saga").custom_kind(),
            },
        },
    },

    {
        "b0o/schemastore.nvim",
    },
}
