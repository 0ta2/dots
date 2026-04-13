return {
	{
		"stevearc/conform.nvim",
		opts = {
			formatters_by_ft = {
				lua = { "stylua" },
				go = { "golangci-lint", "goimports", "gofmt" },
				markdown = { "prettierd" },
			},
			default_format_opts = {
				lsp_format = "fallback",
			},
		},

		init = function()
			vim.o.formatexpr = "v:lua.require'conform'.formatexpr()"
		end,

		config = function(_, opts)
			require("conform").setup(opts)

			vim.api.nvim_create_autocmd({ "BufWritePre", "BufLeave", "FocusLost" }, {
				pattern = "*",
				callback = function(args)
					require("conform").format({ bufnr = args.buf })
				end,
			})

			vim.keymap.set("n", "<leader>f", function()
				require("conform").format({
					lsp_format = "fallback",
					timeout_ms = 500,
				})
			end, { desc = "Format buffer (conform.nvim)" })
		end,
	},
}
