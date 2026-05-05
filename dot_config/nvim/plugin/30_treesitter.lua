vim.pack.add({
    { src = "https://github.com/nvim-treesitter/nvim-treesitter",        version = "main" },
    { src = "https://github.com/nvim-treesitter/nvim-treesitter-context" },
})

local Config = require("config")

local langs = {}
for _, v in pairs(Config.languages) do
    if v.treesitter then
        table.insert(langs, v.treesitter)
    end
end

local treesitter = require("nvim-treesitter")
local installed = treesitter.get_installed()
local to_install = vim.tbl_filter(function(lang)
    return not vim.tbl_contains(installed, lang)
end, langs)
if #to_install > 0 then
    treesitter.install(to_install)
end

local group = vim.api.nvim_create_augroup("TreesitterSetup", { clear = true })
vim.api.nvim_create_autocmd("FileType", {
    group = group,
    pattern = langs,
    callback = function(args)
        vim.treesitter.start(args.buf)
        vim.bo[args.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
    end,
})

require("treesitter-context").setup({})
