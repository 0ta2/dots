local lsp_servers = {
    gopls = {},
    lua_ls = {},
    jsonls = {},
    yamlls = {},
    copilot = {},
}
local formatters = {
    "stylua",
}
local go_tools = {
    -- NOTE: gopher.nvim で使用
    "gomodifytags",
    "gotests",
    "impl",
    "iferr",
}

local tools = vim.list_extend({}, formatters)
vim.list_extend(tools, go_tools)

return {
    {
        "mason-org/mason-lspconfig.nvim",
        opts = {
            ensure_installed = vim.tbl_keys(lsp_servers)
        },
        dependencies = {
            {
                "mason-org/mason.nvim",
                opts = {
                    ensure_installed = tools
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

    -- LSPのUI拡張
    {
        'nvimdev/lspsaga.nvim',
        config = function()
            require('lspsaga').setup({})
            vim.keymap.set('n', 'gd', '<cmd>Lspsaga goto_definition<CR>', { desc = "定義箇所に移動" })
            vim.keymap.set('n', 'gp', '<cmd>Lspsaga peek_definition<CR>', { desc = "定義箇所に表示" })
            vim.keymap.set('n', 'gD', '<cmd>Lspsaga finder def<CR>', { desc = "宣言へ移動" })
            vim.keymap.set('n', 'gr', '<cmd>Lspsaga finder ref<CR>', { desc = "参照箇所に移動" })
            vim.keymap.set('n', 'gi', '<cmd>Lspsaga finder imp<CR>', { desc = "実装箇所へ移動" })
            vim.keymap.set('n', 'ga', '<cmd>Lspsaga code_action<CR>', { desc = "コードアクションの実行" })
            vim.keymap.set('n', 'gk', '<cmd>Lspsaga hover_doc<CR>', { desc = "ホバー" })
            vim.keymap.set('n', 'grn', '<cmd>Lspsaga rename<CR>', { desc = "リネーム" })
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
