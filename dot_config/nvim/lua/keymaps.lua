vim.keymap.set('n', '<Esc>', '<Cmd>nohlsearch<CR>', { desc = '検索後の強調表示の解除' })

vim.keymap.set('n', ';', ':', { desc = ';と:を入れ替える' }) 

vim.keymap.set('n', 'H', '^', { desc = 'ノーマルモードのHで先頭に移動' })
vim.keymap.set('v', 'H', '^', { desc = 'ビジュアルモードのHで先頭に移動' })
vim.keymap.set('n', 'L', '$', { desc = 'ノーマルモードのLで末尾に移動' })
vim.keymap.set('v', 'L', '$', { desc = 'ビジュアルモードのLで末尾に移動' })

vim.keymap.set('n', 'j', 'gj', { desc = '行が折り返して表示されている場合に､表示の行単位で移動' })
vim.keymap.set('n', 'k', 'gk', { desc = '行が折り返して表示されている場合に､表示の行単位で移動' })
vim.keymap.set('v', 'j', 'gj', { desc = '行が折り返して表示されている場合に､表示の行単位で移動' })
vim.keymap.set('v', 'k', 'gk', { desc = '行が折り返して表示されている場合に､表示の行単位で移動' })

vim.keymap.set('n', '<leader>s', ':split<CR>', { desc = '画面を横に分割' })
vim.keymap.set('n', '<leader>v', ':vsplit<CR>', { desc = '画面を縦に分割' })

vim.keymap.set('n', '<leader>o', '<C-w>_<C-w>|', { desc = '縦横に最大化' })
vim.keymap.set('n', '<leader>=', '<C-w>=', { desc = '縦横の幅を揃える' })

vim.keymap.set('n', '<leader>t', '<Cmd>enew<CR>', { desc = '新しいバッファを作成' })

vim.keymap.set('n', '<leader>n', '<Cmd>bnext<CR>', { desc = '次のバッファへ移動' })
vim.keymap.set('n', '<leader>p', '<Cmd>bprevious<CR>', { desc = '前のバッファへ移動' })

vim.keymap.set('n', 'x', '"_x', { desc = 'xで削除した際にレジスタに入らないようにする' })
vim.keymap.set('n', 's', '"_s', { desc = 'sで削除した際にレジスタに入らないようにする' })

vim.keymap.set('c', '<C-p>', '<Up>', { desc = 'コマンドラインで前の履歴' })
vim.keymap.set('c', '<C-n>', '<Down>', { desc = 'コマンドラインで次の履歴' })

