--
-- Lua LSP 開発支援
--
vim.pack.add({
    { src = "https://github.com/folke/lazydev.nvim" },
})
require("lazydev").setup({
    library = {
        { path = "${3rd}/luv/library", words = { "vim%.uv" } },
    },
})

--
-- Mason（LSP/ツールインストーラ）
--
vim.pack.add({
    { src = "https://github.com/mason-org/mason.nvim" },
    { src = "https://github.com/neovim/nvim-lspconfig" },
    { src = "https://github.com/b0o/schemastore.nvim" },
})
require("mason").setup({})

--
-- LSP サーバー有効化
--
local Config = require("config")
local lsp_servers = {}
for _, v in pairs(Config.languages) do
    if v.lsp then
        table.insert(lsp_servers, v.lsp)
    end
end
vim.lsp.enable(lsp_servers)

-- mason registry を使った自動インストール
local _ok, registry = pcall(require, "mason-registry")
if _ok then
    local mason_packages = {}
    for _, v in pairs(Config.languages) do
        if v.mason then
            table.insert(mason_packages, v.mason)
        elseif v.lsp then
            table.insert(mason_packages, v.lsp)
        end
        if v.linter then
            table.insert(mason_packages, v.linter)
        end
        if v.formatter then
            table.insert(mason_packages, v.formatter)
        end
    end
    vim.schedule(function()
        for _, name in ipairs(mason_packages) do
            local ok_pkg, pkg = pcall(registry.get_package, name)
            if ok_pkg and pkg then
                if not pkg:is_installed() then
                    pkg:install()
                end
            else
                vim.notify(("mason: package not found: %s"):format(name), vim.log.levels.WARN)
            end
        end
    end)
end

--
-- LSP キーマップ
--
vim.api.nvim_create_autocmd("LspAttach", {
    group = vim.api.nvim_create_augroup("LspKeymaps", { clear = true }),
    callback = function(ev)
        local opts = { buffer = ev.buf }
        vim.keymap.set(
            "n",
            "ga",
            vim.lsp.buf.code_action,
            vim.tbl_extend("force", opts, { desc = "コードアクションの実行" })
        )
        vim.keymap.set("n", "gk", vim.lsp.buf.hover, vim.tbl_extend("force", opts, { desc = "ホバー" }))
        vim.keymap.set("n", "gR", vim.lsp.buf.rename, vim.tbl_extend("force", opts, { desc = "リネーム" }))
        vim.keymap.set(
            "n",
            "gd",
            "<Cmd>FzfLua lsp_definitions<CR>",
            vim.tbl_extend("force", opts, { desc = "定義へ移動" })
        )
        vim.keymap.set(
            "n",
            "gD",
            "<Cmd>FzfLua lsp_declarations<CR>",
            vim.tbl_extend("force", opts, { desc = "宣言へ移動" })
        )
        vim.keymap.set(
            "n",
            "gr",
            "<Cmd>FzfLua lsp_references<CR>",
            vim.tbl_extend("force", opts, { desc = "参照一覧" })
        )
        vim.keymap.set(
            "n",
            "gi",
            "<Cmd>FzfLua lsp_implementations<CR>",
            vim.tbl_extend("force", opts, { desc = "実装へ移動" })
        )
    end,
})
