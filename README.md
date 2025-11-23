# dots

`chezmoi` のインストールと `dots` の反映するには下記を実行

```bash
sh -c "$(curl -fsLS get.chezmoi.io)" -- -b $HOME/.local/bin init --source=~/ghq/github.com/0ta2/dots --apply git@github.com:0ta2/dots.git
```

ファイルに変更があった際に、反映するには下記を実行

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

