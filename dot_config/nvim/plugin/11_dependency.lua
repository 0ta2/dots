vim.pack.add({
    -- luaの便利ライブラリ
    { src = "https://github.com/nvim-lua/plenary.nvim" },
    -- 非同期ライブラリ
    { src = "https://github.com/nvim-neotest/nvim-nio" },
    -- UIコンポーネントライブラリ
    { src = "https://github.com/MunifTanjim/nui.nvim" },
    -- icon
    { src = "https://github.com/nvim-mini/mini.icons" },
})
require("mini.icons").setup()
MiniIcons.mock_nvim_web_devicons()
