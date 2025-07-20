local lsp_server = {
    lua_ls = {},
    jsonls = {},
    yamlls = {},
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
            },
        },
    },

    {
        'nvimdev/lspsaga.nvim',
        config = function()
            require('lspsaga').setup({})
        end,
        opts = {},
    },

    {
        "b0o/schemastore.nvim",
    },
}
