return {
	"iwe-org/iwe.nvim",
	config = function()
		require("iwe").setup({
			mappings = {
				enable_markdown_mappings = false, -- Core markdown editing keybindings
				enable_picker_keybindings = false, -- Set to true to enable gf, gs, ga, g/, gb, gR, go
				enable_lsp_keybindings = true, -- Set to true to enable IWE-specific LSP keybindings
				enable_preview_keybindings = false, -- Set to true to enable preview keybindings
			},
			picker = {
				backend = "snacks", -- "auto", "telescope", "fzf_lua", "snacks", "mini", "vim_ui"
				fallback_notify = false,
			},
			telescope = {
				enabled = false,
			},
		})
		vim.keymap.set("n", "gf", "<Plug>(iwe-picker-find-files)")
	end,
}
