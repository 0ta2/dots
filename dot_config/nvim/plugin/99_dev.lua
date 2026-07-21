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
local amanoukihashi = require("amanoukihashi")
amanoukihashi.setup({
    claude_cmd = { "headroom", "wrap", "claude" },
    history_dirs = { vim.fn.expand("~/ghq/github.com/0ta2/harness") },
})
vim.keymap.set({ "n", "t", "i", "x" }, "<c-.>", function()
    amanoukihashi.sidebar_toggle()
end, { desc = "amanoukihashi: サイドバーをトグル" })
vim.keymap.set("n", "<leader>al", amanoukihashi.sidebar_toggle, { desc = "amanoukihashi: セッション一覧" })
vim.keymap.set("n", "<leader>an", amanoukihashi.new_session, { desc = "amanoukihashi: セッションを作成" })
vim.keymap.set("n", "<leader>ah", amanoukihashi.history, { desc = "amanoukihashi: 履歴から再開" })
vim.keymap.set("n", "<leader>ad", amanoukihashi.diff, { desc = "amanoukihashi: 累積差分" })
vim.keymap.set("n", "<leader>ar", function()
    local old = require("amanoukihashi.sidebar").selected()
    if not old then
        vim.notify("amanoukihashi: no selected session", vim.log.levels.WARN)
        return
    end
    vim.ui.input({ prompt = "rename session: ", default = old }, function(new)
        if new and new ~= "" and new ~= old then
            amanoukihashi.rename(old, new)
        end
    end)
end, { desc = "amanoukihashi: 選択セッションを移動" })
vim.keymap.set("n", "<leader>ak", function()
    local path_name = require("amanoukihashi.sidebar").selected()
    if not path_name then
        vim.notify("amanoukihashi: no selected session", vim.log.levels.WARN)
        return
    end
    amanoukihashi.kill(path_name)
end, { desc = "amanoukihashi: 選択セッションを破棄" })
