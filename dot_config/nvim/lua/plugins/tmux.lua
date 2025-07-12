return {
    {
        'christoomey/vim-tmux-navigator',
        init = function ()
            vim.g.tmux_navigator_no_mappings = 1
            vim.g.tmux_navigator_save_on_switch = 2
        end,
        config = function()
            local desc = "tmuxとnvimをシームレスに移動"
            vim.keymap.set('n', '<c-h>', ":TmuxNavigateLeft <CR>", { desc = desc })
            vim.keymap.set('n', '<c-j>', ":TmuxNavigateDown <CR>", { desc = desc })
            vim.keymap.set('n', '<c-k>', ":TmuxNavigateUp <CR>", { desc = desc })
            vim.keymap.set('n', '<c-l>', ":TmuxNavigateRight <CR>", { desc = desc })
        end
    },
}
