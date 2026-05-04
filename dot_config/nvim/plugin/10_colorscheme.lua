vim.pack.add({
    "https://github.com/sho-87/kanagawa-paper.nvim",
})
require("kanagawa-paper").setup({
  overrides = function(colors)
    local theme = colors.theme
    return {
      -- ui.lua で使っている tiny-cmdline.nvim でハイライトがきれいに描画されなかったので対応した
      TinyCmdlineNormal = { bg = theme.ui.bg },
      TinyCmdlineBorder = { fg = theme.ui.fg_dim, bg = theme.ui.bg },
    }
  end,
})
vim.cmd.colorscheme("kanagawa-paper")
