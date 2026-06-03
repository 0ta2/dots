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

vim.pack.add({
    { src = "https://github.com/0ta2/amanoukihashi.nvim", branch = "feat/phase0" },
})

require("amanoukihashi").setup({
    default_cmd = { "claude" },
})

vim.keymap.set({ "n", "t" }, "<leader>ca", function()
    require("amanoukihashi").toggle("main")
end, { desc = "Claude Code: main セッション" })

vim.keymap.set({ "n", "t" }, "<leader>cb", function()
    require("amanoukihashi").toggle("feat")
end, { desc = "Claude Code: feat セッション" })
