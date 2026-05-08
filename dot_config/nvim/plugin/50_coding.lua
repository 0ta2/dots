--
-- 補完
--
vim.pack.add({
    { src = "https://github.com/rafamadriz/friendly-snippets" },
    { src = "https://github.com/saghen/blink.lib" },
    { src = "https://github.com/saghen/blink.cmp" },
})

---@module 'blink.cmp'
---@type blink.cmp.Config
local cmp = require("blink.cmp")
cmp.build():wait(60000)
cmp.setup({
    cmdline = { enabled = true },
    completion = {
        keyword = { range = "full" },
        accept = { auto_brackets = { enabled = false } },
        list = { selection = { preselect = false, auto_insert = true } },
        menu = {
            draw = {
                columns = {
                    { "label", "label_description", gap = 1 },
                    { "kind_icon", "kind" },
                },
            },
        },
        documentation = { auto_show = true, auto_show_delay_ms = 500 },
        ghost_text = { enabled = true },
    },
    keymap = { preset = "super-tab" },
    sources = { default = { "lsp", "path", "snippets", "buffer" } },
    snippets = { preset = "default" },
    signature = { enabled = true },
})

--
-- フォーマット
--
vim.pack.add({
    { src = "https://github.com/stevearc/conform.nvim" },
})

require("conform").setup({
    formatters_by_ft = {
        lua = { "stylua" },
        go = { "golangci-lint", "goimports", "gofmt" },
        markdown = { "prettierd" },
    },
    default_format_opts = {
        lsp_format = "fallback",
    },
})
vim.o.formatexpr = "v:lua.require'conform'.formatexpr()"
vim.keymap.set("n", "gq", function()
    require("conform").format({
        lsp_format = "fallback",
        timeout_ms = 500,
    })
end, { desc = "Format buffer (conform.nvim)" })

--
-- リンター
--
vim.pack.add({
    { src = "https://github.com/mfussenegger/nvim-lint" },
})

local lint = require("lint")
lint.linters_by_ft = {
    lua = { "selene" },
    go = { "golangci-lint" },
    rust = { "clippy" },
}

vim.api.nvim_create_autocmd({ "BufWritePost", "BufReadPost" }, {
    group = vim.api.nvim_create_augroup("nvim-lint", { clear = true }),
    callback = function()
        lint.try_lint()
    end,
})
