-- 行番号を表示
vim.o.number = true

-- マウスモードを有効化
vim.o.mouse = 'a'

-- モードを非表示
vim.o.showmode = false

-- NeovimとOSのクリップボードを同期
-- 起動時間が長くなるのを避けるため、設定は UiEnter イベントの後に実行する。
vim.schedule(function()
    vim.o.clipboard = 'unnamedplus'
end)

-- 折り返した行でもインデントを維持
vim.o.breakindent = true

-- Undo履歴の永続化
vim.o.undofile = true

-- スマート検索
-- 小文字だけで検索 → 大文字・小文字を区別せずに検索
-- 大文字を含む検索 → 区別して検索
vim.o.ignorecase = true
vim.o.smartcase = true

-- デフォルトで signcolumn を表示したままにする
vim.o.signcolumn = 'yes'


-- カーソル停止後に反応するまでの更新時間を短くする
vim.o.updatetime = 250
-- キーマップの組み合わせ待ち時間を短くする
vim.o.timeoutlen = 300

-- 新しいスプリットの開き方を設定する
vim.o.splitright = true
vim.o.splitbelow = true

-- Neovim がエディタ内で特定の空白文字をどのように表示するかを設定する。
-- `vim.opt` は､テーブルとのやり取りを便利に行うためのインターフェースを提供する｡
vim.o.list = true
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }

-- 入力中に置換の内容をライブでプレビューする
vim.o.inccommand = 'split'

-- カーソルがある行を表示する
vim.o.cursorline = true

-- カーソルの上下に保持する最小行数
vim.o.scrolloff = 10

-- バッファに未保存の変更があるために操作が失敗する場合(例えば `:q`)
-- 代わりに現在のファイルを保存するか尋ねるダイアログを表示する
vim.o.confirm = true

-- `<Tab>` 挿入時に適切な数のスペースを使う
vim.o.expandtab = true
-- タブ文字幅（表示用）
vim.o.tabstop = 4
-- 自動インデント幅
vim.o.shiftwidth = 4
-- 挿入・削除時の幅
vim.o.softtabstop = 4
