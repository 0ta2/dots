# dots

## セットアップ (初回のみ、2段階)

### 1. chezmoi を導入し dots を取得する (反映はしない)

```bash
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b $HOME/.local/bin init --source=~/ghq/github.com/0ta2/dots git@github.com:0ta2/dots.git
```

### 2. Homebrew と mise を用意して初回セットアップする

```bash
~/ghq/github.com/0ta2/dots/bootstrap.sh
```

Homebrew・mise を導入した後 `mise run install` (ドットファイル反映・不足ツール・skill・plugin の
導入・Codex 設定同期) を実行する。

## 日常のコマンド

```bash
mise run sync    # ドットファイル反映 + Codex設定マージ (副作用なし、何度実行しても収束する)
mise run update  # brew/mise/skill/uv tool の更新、最後に sync
```

直接 chezmoi コマンドを実行する場合は下記の通り:

```bash
~/.local/bin/chezmoi --source=~/ghq/github.com/0ta2/dots apply
```

## mac セットアップ

- 一般
  - 情報 
    - `コンピュータ名` を変更
  - 自動入力とパスワード
    - `パスワードやパスキーを自動入力` をOFF
- アクセシビリティ
  - ポインタコントロール
    - トラックパッドオプション
      - `ドラッグにトラックパッドを使用` をON
- デスクトップとDock
  - `Dock` のサイズ小さく好みのサイズへ変更
  - `Dock` の拡大を好みの大きさへ変更
  - `Dock` を自動的に表示/非表示をOFF
  - 起動中のアプリケーションをアニメーションで表示をOFF
  - 起動済みのアプリケーションにインジケータを表示をOFF
  - アプリの提案と最近使用したアプリをDockに表示をOFF
- アプリの提案と最近使用したアプリをDockに表示をOFF
- 外観
  - `外観モード`をダークに変更
- キーボード
  - キーボードショートカット
    - `Spotlight検索を表示` のショートカットのチェックを外す
    - 入力ソース
      - 前の入力ソースを選択 を `Cmd + スペース` に変更
      - 入力メニューの次のソースを選択 を `Cmd + shift + スペース` に変更
    - 装飾キー
      - `CapsLock` を Ctrl に変更する
    - 入力ソース
      - USキー と ひらがな(Google)
- トラックパッド
  - ポイントとクリック
    - 軌跡の速さを一番早く
    - タップでクリック にチェック

## Neovim ローカル開発プラグインのリンク作成

`iwano.nvim` / `amanoukihashi.nvim` をローカルのリポジトリから読み込むため、下記のシンボリックリンクを作成する:

```bash
mkdir -p ~/.local/share/nvim/site/pack/mine/opt
ln -s ~/ghq/github.com/0ta2/iwano.nvim ~/.local/share/nvim/site/pack/mine/opt/iwano.nvim-local
ln -s ~/ghq/github.com/0ta2/amanoukihashi.nvim ~/.local/share/nvim/site/pack/mine/opt/amanoukihashi.nvim-local
```

