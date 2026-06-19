-- vim.pack.add({
--     { src = "https://github.com/folke/sidekick.nvim" },
-- })
--
-- require("sidekick").setup({
--     cli = {
--         mux = {
--             backend = "tmux",
--             enabled = true,
--         },
--         win = {
--             layout = "right",
--             config = function(terminal)
--                 local screen_width = vim.o.columns
--                 if screen_width > 200 then
--                     terminal.opts.split = { width = 150, height = 0 }
--                 else
--                     terminal.opts.split = { width = 80, height = 0 }
--                 end
--             end,
--         },
--         prompts = {
--             changes = "変更内容をレビューしてください。",
--             diagnostics = "{file} の診断エラーを修正する方法を教えてください。\n{diagnostics}",
--             diagnostics_all = "以下の診断エラーを修正する方法を教えてください。\n{diagnostics_all}",
--             document = "{function|line} にドキュメントを追加してください。",
--             explain = "{this} を説明してください。",
--             fix = "{this} を修正してください。",
--             optimize = "{this} を最適化するにはどうすればよいですか？",
--             review = "{file} に問題や改善点がないかレビューしてください。",
--             tests = "{this} のテストを書いてください。",
--             buffers = "{buffers}",
--             file = "{file}",
--             line = "{line}",
--             position = "{position}",
--             quickfix = "{quickfix}",
--             selection = "{selection}",
--             ["function"] = "{function}",
--             class = "{class}",
--         },
--     },
-- })
--
-- vim.keymap.set({ "n" }, "<tab>", function()
--     if not require("sidekick").nes_jump_or_apply() then
--         return "<Tab>"
--     end
-- end, { expr = true, desc = "Goto/Apply Next Edit Suggestion" })
--
-- vim.keymap.set({ "n", "t", "i", "x" }, "<c-.>", function()
--     require("sidekick.cli").toggle({ filter = { installed = true } })
-- end, { desc = "Sidekick Toggle" })
--
-- vim.keymap.set("n", "<leader>ad", function()
--     require("sidekick.cli").close()
-- end, { desc = "CLIのセッションを閉じる" })
--
-- vim.keymap.set({ "x", "n" }, "<leader>at", function()
--     require("sidekick.cli").send({ msg = "{this}" })
-- end, { desc = "現在のブロックを Sidekick に連携する" })
--
-- vim.keymap.set("n", "<leader>af", function()
--     require("sidekick.cli").send({ msg = "{file}" })
-- end, { desc = "現在のファイルを Sidekick に連携する" })
--
-- vim.keymap.set("x", "<leader>av", function()
--     require("sidekick.cli").send({ msg = "{selection}" })
-- end, { desc = "選択している範囲を Sidekick に連携する" })
--
-- vim.keymap.set({ "n", "x" }, "<leader>ap", function()
--     require("sidekick.cli").prompt()
-- end, { desc = "Sidekick の Prompt を選択" })

--
-- code-bridge.nvim — tmux で動く外部 Claude Code セッションへのコンテキスト送信
--
vim.pack.add({
    { src = "https://github.com/samir-roy/code-bridge.nvim" },
})

require("code-bridge").setup({
    tmux = {
        target_mode = "window_name",
        window_name = "claude",
        switch_to_target = true,
        find_node_process = true, -- Claude Code は node.js プロセスで動作する
    },
})

vim.keymap.set({ "n", "v" }, "<leader>cb", ":CodeBridgeTmux<CR>", { desc = "code-bridge: ファイルを Claude に送信" })
vim.keymap.set({ "n", "v" }, "<leader>ci", ":CodeBridgeTmuxInteractive<CR>", { desc = "code-bridge: インタラクティブ送信" })
vim.keymap.set("n", "<leader>cd", ":CodeBridgeTmuxDiff<CR>", { desc = "code-bridge: git diff を送信" })
vim.keymap.set({ "n", "v" }, "<leader>cq", ":CodeBridgeQuery<CR>", { desc = "code-bridge: クイックチャット" })
vim.keymap.set("n", "<leader>cc", ":CodeBridgeChat<CR>", { desc = "code-bridge: チャットを開く" })
