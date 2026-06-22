--
-- HTTP クライアント
--
-- NOTE: https://github.com/mistweaverco/kulala.nvim/issues/788#issuecomment-3647575260
vim.api.nvim_create_autocmd("FileType", {
    callback = function(args)
        local _, treesitter = pcall(require, "nvim-treesitter")
        if _ == nil or not treesitter then
            return
        end
        if not vim.list_contains(treesitter.get_installed(), vim.treesitter.language.get_lang(args.match)) then
            return
        end
        vim.treesitter.start(args.buf)
    end,
})
vim.pack.add({
    "https://github.com/mistweaverco/kulala.nvim",
})

require("kulala").setup({
    global_keymaps = true,
})

--
-- CSV ビューワー
--
vim.pack.add({
    "https://github.com/hat0uma/csvview.nvim",
})

require("csvview").setup({
    ---@module "csvview"
    ---@type CsvView.Options
    parser = { comments = { "#", "//" } },
    keymaps = {
        textobject_field_inner = { "if", mode = { "o", "x" } },
        textobject_field_outer = { "af", mode = { "o", "x" } },
        jump_next_field_end = { "<Tab>", mode = { "n", "v" } },
        jump_prev_field_end = { "<S-Tab>", mode = { "n", "v" } },
        jump_next_row = { "<Enter>", mode = { "n", "v" } },
        jump_prev_row = { "<S-Enter>", mode = { "n", "v" } },
    },
    view = {
        display_mode = "border",
    },
})

--
-- Go 開発ツール
--
vim.pack.add({
    "https://github.com/olexsmir/gopher.nvim",
})
require("gopher").setup({
    commands = {
        gomodifytags = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "gomodifytags"),
        gotests = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "gotests"),
        impl = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "impl"),
        iferr = vim.fs.joinpath(vim.fn.stdpath("data"), "mason", "bin", "iferr"),
    },
})

--
-- テスト
--
vim.pack.add({
    "https://github.com/fredrikaverpil/neotest-golang",
    "https://github.com/nvim-neotest/neotest",
})

require("neotest").setup({
    status = { virtual_text = true },
    output = { open_on_run = true },
    adapters = {
        require("neotest-golang"),
    },
})

--
-- PKM（iwe.nvim）
--
vim.pack.add({
    "https://github.com/iwe-org/iwe.nvim",
})

require("iwe").setup({
    mappings = {
        enable_markdown_mappings = false,
        enable_picker_keybindings = false,
        enable_lsp_keybindings = true,
        enable_preview_keybindings = false,
    },
    picker = {
        backend = "fzf_lua",
        fallback_notify = false,
    },
    telescope = {
        enabled = false,
    },
})
vim.keymap.set("n", "gf", "<Plug>(iwe-picker-find-files)")

--
-- コードレビュー注釈（review.nvim）
--
vim.pack.add({
    "https://github.com/georgeguimaraes/review.nvim",
})

require("review").setup({
    keymaps = {
        close = false,
        readonly_delete = false,
        readonly_edit = false,
        readonly_add_file = false,
    },
})

vim.api.nvim_create_user_command("ReviewPR", function(opts)
    local pr_ref = opts.fargs[1] or ""
    local json = vim.fn.system("gh pr view " .. pr_ref .. " --json baseRefName,headRefName")
    local ok, pr = pcall(vim.json.decode, json)
    if not ok or not pr.baseRefName or not pr.headRefName then
        vim.notify("PR が見つかりません", vim.log.levels.ERROR)
        return
    end
    vim.fn.system("git fetch origin " .. pr.baseRefName .. " " .. pr.headRefName)
    local mb = vim.fn.systemlist("git merge-base origin/" .. pr.baseRefName .. " origin/" .. pr.headRefName)[1]
    if not mb or mb == "" then
        vim.notify("merge-base を取得できません", vim.log.levels.ERROR)
        return
    end
    vim.cmd("Review commits " .. mb .. " origin/" .. pr.headRefName)
end, { nargs = "?", desc = "PR の差分を review.nvim で表示" })
