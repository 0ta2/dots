return {
	{
		"folke/which-key.nvim",
		opts = {},
		config = function()
			local wk = require("which-key")
			wk.add({
				{ "<leader>g", group = "[G]it" },
				{ "<leader>a", group = "[A]i" },
			})
		end,
	},

	{
		"sphamba/smear-cursor.nvim",
		opts = {},
	},

	{
		"echasnovski/mini.icons",
		version = "*",
	},

	{
		"folke/snacks.nvim",
		priority = 1000,
		opts = {
			dashboard = {
				enabled = true,
				autokeys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
				preset = {
					keys = {
						{ icon = " ", key = "n", desc = "New File", action = ":ene | startinsert" },
						{ icon = " ", key = "p", desc = "Find File", action = ":lua Snacks.picker.smart()" },
						{ icon = " ", key = "g", desc = "Find Text", action = ":lua Snacks.picker.grep()" },
						{
							icon = "󰒲 ",
							key = "l",
							desc = "Lazy",
							action = ":Lazy",
							enabled = package.loaded.lazy ~= nil,
						},
						{
							icon = " ",
							key = "m",
							desc = "Mason",
							action = ":Mason",
							enabled = package.loaded.lazy ~= nil,
						},
						{ icon = "󰊢", key = "i", desc = "LazyGit", action = ":lua Snacks.lazygit()" },
						{ icon = " ", key = "q", desc = "Quit", action = ":qa" },
					},
				},
				sections = {
					{ section = "header" },
					{
						pane = 2,
						icon = "",
						section = "terminal",
						title = "Setup Info",
						cmd = "mise current",
						indent = 2,
						height = 5,
						padding = 1,
					},
					{ section = "keys", gap = 1, padding = 1 },
					{
						pane = 2,
						icon = " ",
						title = "Recent Files",
						section = "recent_files",
						indent = 2,
						padding = 1,
					},
					{ pane = 2, icon = " ", title = "Projects", section = "projects", indent = 2, padding = 1 },
					{
						pane = 2,
						icon = " ",
						title = "Git Status",
						section = "terminal",
						enabled = function()
							return Snacks.git.get_root() ~= nil
						end,
						cmd = "git status --short --branch --renames",
						height = 5,
						padding = 1,
						ttl = 5 * 60,
						indent = 3,
					},
					{ section = "startup" },
				},
			},
			indent = {
				enabled = true,
			},
		},
	},

	{
		"folke/noice.nvim",
		opts = {
			lsp = {
				-- override markdown rendering so that **cmp** and other plugins use **Treesitter**
				override = {
					["vim.lsp.util.convert_input_to_markdown_lines"] = true,
					["vim.lsp.util.stylize_markdown"] = true,
					["cmp.entry.get_documentation"] = true, -- requires hrsh7th/nvim-cmp
				},
			},
			-- you can enable a preset for easier configuration
			presets = {
				bottom_search = false, -- use a classic bottom cmdline for search
				command_palette = true, -- position the cmdline and popupmenu together
				long_message_to_split = true, -- long messages will be sent to a split
				inc_rename = false, -- enables an input dialog for inc-rename.nvim
				lsp_doc_border = false, -- add a border to hover docs and signature help
			},
		},
	},

	{
		-- 折り畳みを高機能化
		"kevinhwang91/nvim-ufo",
		dependencies = { "kevinhwang91/promise-async" },
		config = function()
			vim.o.foldcolumn = "1"
			-- 起動時に開いた状態にするために 99 を設定
			vim.o.foldlevel = 99
			vim.o.foldlevelstart = 99
			vim.o.foldenable = true

			vim.keymap.set("n", "zR", require("ufo").openAllFolds)
			vim.keymap.set("n", "zM", require("ufo").closeAllFolds)
			require("ufo").setup()
		end,
	},

	{
		"MeanderingProgrammer/render-markdown.nvim",
		---@module 'render-markdown'
		---@type render.md.UserConfig
		opts = {
			code = {
				sign = false,
				border = "thick",
			},
		},
	},

	{
		"esmuellert/vscode-diff.nvim",
		opts = {},
	},
}
