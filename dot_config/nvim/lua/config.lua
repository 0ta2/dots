return {
    languages = {
        go = { treesitter = "go", lsp = "gopls", mason = "gopls", linter = "golangci-lint" },
        lua = { treesitter = "lua", lsp = "lua_ls", mason = "lua-language-server", formatter = "stylua" },
        rust = { treesitter = "rust", lsp = "rust_analyzer", mason = "rust-analyzer" },
        python = { treesitter = "python", lsp = "pyright", mason = "pyright" },
        bash = { treesitter = "bash", lsp = "bashls", mason = "bash-language-server" },
        zsh = { treesitter = "zsh" },
        terraform = { treesitter = "terraform", mason = "terraform-ls" },
        sql = { treesitter = "sql" },
        json = { lsp = "jsonls", mason = "json-lsp" },
        yaml = { lsp = "yamlls", mason = "yaml-language-server" },
        typescript = { lsp = "ts_ls", mason = "typescript-language-server" },
    },
}
