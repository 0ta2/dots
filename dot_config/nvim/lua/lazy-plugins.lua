require("lazy").setup({
  spec = {
      { import = "plugins.tmux" }
      { "nvim-lua/plenary.nvim" },

      { import = "plugins.utils" },
      { import = "plugins.git" },
  }
})
