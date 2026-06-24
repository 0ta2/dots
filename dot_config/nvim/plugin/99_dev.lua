vim.cmd.packadd("iwano.nvim-local")

require("iwano").setup({
    tools = {
        lazygit = { cmd = { "lazygit" } },
    },
})
vim.keymap.set("n", "<Leader>k", function()
    require("iwano").toggle("lazygit")
end)

vim.cmd.packadd("amanoukihashi.nvim-local")
require("amanoukihashi").setup({
    default_cmd = { "claude" },
    layout = "split",
    split = {
        width = vim.o.columns > 200 and 150 or 80,
    },
})
vim.keymap.set({ "n", "t", "i", "x" }, "<c-.>", function()
    require("amanoukihashi").toggle()
end, { desc = "Claude Code: セッションをトグル" })
vim.keymap.set("n", "<leader>af", "<Cmd>AmanoukihashiSend @{file}<CR>", { desc = "amanoukihashi: 現在ファイルのパスを挿入" })
vim.keymap.set("v", "<leader>av", ":AmanoukihashiSend {selections}<CR>", { desc = "amanoukihashi: ビジュアル選択テキストを挿入" })
vim.keymap.set("n", "<leader>al", "<Cmd>AmanoukihashiList<CR>", { desc = "amanoukihashi: セッション一覧" })
