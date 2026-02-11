return {
    {
        "nvim-treesitter/nvim-treesitter",
        branch = "main",
        config = function(_, opts)
            local treesitter = require("nvim-treesitter")
            local installed = treesitter.get_installed()
            local to_install = vim.tbl_filter(function(lang)
                return not vim.tbl_contains(installed, lang)
            end, opts.langs)
            if #to_install > 0 then
                treesitter.install(to_install)
            end

            local group = vim.api.nvim_create_augroup("TreesitterSetup", { clear = true })
            vim.api.nvim_create_autocmd("FileType", {
                group = group,
                pattern = opts.langs,
                callback = function(args)
                    vim.treesitter.start(args.buf)
                    vim.bo[args.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
                end,
            })
        end,
        opts = {
            langs = {
                "zsh",
                "bash",
                "lua",
                "go",
                "rust",
                "python",
                "terraform",
                "sql"
            },
        },
    },

    {
        "nvim-treesitter/nvim-treesitter-context",
        opts = {},
    },
}
