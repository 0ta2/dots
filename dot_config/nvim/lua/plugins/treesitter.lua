return {
    {
        "nvim-treesitter/nvim-treesitter",
        opts = {
            ensure_installed = {
                "lua",
                "go",
            },
            sync_install = false,
            auto_install = true,
            highlight = {
                enable = true,
            },
            indent = {
                enable = true
            },
            -- 100 KBを超える場合は､自動的に無効
            disable = function(lang, buf)
                local max_filesize = 100 * 1024 -- 100 KB
                local ok, stats = pcall(vim.loop.fs_stat, vim.api.nvim_buf_get_name(buf))
                if ok and stats and stats.size > max_filesize then
                    return true
                end
            end,
            additional_vim_regex_highlighting = false,
        },
        init = function()
            vim.wo.foldmethod = 'expr'
            vim.wo.foldexpr = 'v:lua.vim.treesitter.foldexpr()'
            -- 起動時に開いた状態にするために 99 を設定
            vim.wo.foldlevel = 99
        end
    },

    {
        "nvim-treesitter/nvim-treesitter-context",
        opts = {},
    },
}
