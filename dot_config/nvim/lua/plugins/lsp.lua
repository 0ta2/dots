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
            },
        },
    },
}
