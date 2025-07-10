local lsp_server = {
    lua_ls = {}
}

return {
    {
        "mason-org/mason-lspconfig.nvim",
        opts = {
            ensure_installed = vim.tbl_keys(lsp_server)
        },
        dependencies = {
            { "mason-org/mason.nvim", opts = {} },
            {
                "neovim/nvim-lspconfig",
                opts = {
                    servers = lsp_server
                },
                config = function(_, opts)
                    local lspconfig = require('lspconfig')
                    for server, config in pairs(opts.servers) do
                        config.capabilities = require('blink.cmp').get_lsp_capabilities(config.capabilities)
                        lspconfig[server].setup(config)
                    end
                end
            },
        },
    },
}
