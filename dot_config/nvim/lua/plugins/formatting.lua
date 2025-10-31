return {
	{
		"stevearc/conform.nvim",
		opts = {
			formatters_by_ft = {
				lua = { "stylua" },
				go = { "golangci-lint", "goimports", "gofmt" },
			},
			default_format_opts = {
				lsp_format = "fallback",
			},
			format_on_save = {
				lsp_format = "fallback",
				timeout_ms = 500,
			},
		},

		init = function()
			vim.o.formatexpr = "v:lua.require'conform'.formatexpr()"
		end,
	},
}
