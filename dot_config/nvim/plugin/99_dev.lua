if vim.loop.os_get_passwd().username == "0ta2" then
    vim.cmd.packadd("iwano.nvim-local")
else
    vim.pack.add({
        "https://github.com/0ta2/iwano.nvim",
    })
end

require("iwano").setup({
    tools = {
        lazygit = { cmd = { "lazygit" } },
    },
})
vim.keymap.set("n", "<Leader>k", function()
    require("iwano").toggle("lazygit")
end)
