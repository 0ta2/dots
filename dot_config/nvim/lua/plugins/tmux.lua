return {
    {
        'christoomey/vim-tmux-navigator',
        cnfig = function()
            vim.g.tmux_navigator_no_mappings = 1
            vim.g.tmux_navigator_save_on_switch = 2
            vim.g.tmux_navigator_no_mappings = 1

            local desc = "tmuxとnvimをシームレスに移動"
            vim.keymap.set('n', '<C-S-h>', [[:<C-u>TmuxNavigateLeft <CR>]], { desc = desc })
            vim.keymap.set('n', '<C-S-j>', [[:<C-u>TmuxNavigateDown <CR>]], { desc = desc })
            vim.keymap.set('n', '<C-S-k>', [[:<C-u>TmuxNavigateUp <CR>]], { desc = desc })
            vim.keymap.set('n', '<C-S-l>', [[:<C-u>TmuxNavigateRight <CR>]], { desc = desc })
            vim.keymap.set('n', '<C-S-\\>', [[:<C-u>TmuxNavigatePrevious <CR>]], { desc = desc })
        end
    },
}
