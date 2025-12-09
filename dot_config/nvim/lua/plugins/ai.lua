return {
	{
		"folke/sidekick.nvim",
		opts = {
			cli = {
				---@class sidekick.cli.Mux
				---@field backend? "tmux"|"zellij" Multiplexer backend to persist CLI sessions
				mux = {
					backend = "tmux",
					enabled = true,
				},
				---@type table<string, sidekick.Prompt|string|fun(ctx:sidekick.context.ctx):(string?)>
				prompts = {
					changes = "Can you review my changes?",
					diagnostics = "Can you help me fix the diagnostics in {file}?\n{diagnostics}",
					diagnostics_all = "Can you help me fix these diagnostics?\n{diagnostics_all}",
					document = "Add documentation to {function|line}",
					explain = "Explain {this}",
					fix = "Can you fix {this}?",
					optimize = "How can {this} be optimized?",
					review = "Can you review {file} for any issues or improvements?",
					tests = "Can you write tests for {this}?",
					-- simple context prompts
					buffers = "{buffers}",
					file = "{file}",
					line = "{line}",
					position = "{position}",
					quickfix = "{quickfix}",
					selection = "{selection}",
					["function"] = "{function}",
					class = "{class}",
				},
			},
		},
		keys = {
			{
				"<tab>",
				function()
					if not require("sidekick").nes_jump_or_apply() then
						return "<Tab>"
					end
				end,
				expr = true,
				desc = "Goto/Apply Next Edit Suggestion",
			},
			{
				"<c-a>",
				function()
					require("sidekick.cli").toggle({ filter = { installed = true } })
				end,
				desc = "Sidekick Toggle",
				mode = { "n", "t", "i", "x" },
			},
			{
				"<leader>ad",
				function()
					require("sidekick.cli").close()
				end,
				desc = "CLIのセッションを閉じる",
			},
			{
				"<leader>at",
				function()
					require("sidekick.cli").send({ msg = "{this}" })
				end,
				mode = { "x", "n" },
				desc = "現在のブロックを Sidekick に連携する",
			},
			{
				"<leader>af",
				function()
					require("sidekick.cli").send({ msg = "{file}" })
				end,
				desc = "現在のファイルを Sidekeick に連携する",
			},
			{
				"<leader>av",
				function()
					require("sidekick.cli").send({ msg = "{selection}" })
				end,
				mode = { "x" },
				desc = "選択している範囲を Sidekick に連携する",
			},
			{
				"<leader>ap",
				function()
					require("sidekick.cli").prompt()
				end,
				mode = { "n", "x" },
				desc = "Sidekick の Prompt を選択",
			},
		},
	},

	{
		"zbirenbaum/copilot.lua",
		opts = {},
	},
}
