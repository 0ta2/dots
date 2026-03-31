return {
	"iwe-org/iwe.nvim",
	config = function()
		require("iwe").setup({
			mappings = {
				enable_markdown_mappings = true, -- Core markdown editing keybindings
				enable_picker_keybindings = false, -- Set to true to enable gf, gs, ga, g/, gb, gR, go
				enable_lsp_keybindings = false, -- Set to true to enable IWE-specific LSP keybindings
				enable_preview_keybindings = false, -- Set to true to enable preview keybindings
			},
		})
	end,
}
