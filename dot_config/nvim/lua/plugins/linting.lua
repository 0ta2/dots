local linters = {
    lua = { "selene" },
}

return {
    "mfussenegger/nvim-lint",
    opts = {
        events = {
            "BufWritePost",
            "BufReadPost",
        },
        linters_by_ft = linters
    },
    config = function(_, opts)
        local lint = require('lint')
        lint.linters_by_ft = opts.linters_by_ft

        vim.api.nvim_create_autocmd(opts.events, {
            group = vim.api.nvim_create_augroup("nvim-lint", { clear = true }),
            callback = function()
                require("lint").try_lint()
            end,
        })
    end
}
