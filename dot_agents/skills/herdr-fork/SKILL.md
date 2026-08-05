---
name: herdr-fork
description: 今の Claude Code セッションを別ペインでフォークして resume し、文脈を引き継いだまま分岐して並行作業する。「このセッションをフォークして隣で続けて」「隣のペインでこの続きを opus でやって」のように、今のセッション自体を分岐させる依頼で使う。HERDR_ENV=1 が必要。
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(herdr *), Bash(test *), Read
---

# herdr-fork

今のセッションを別ペインで resume し、同じ文脈を引き継いだまま分岐して並行作業する。
汎用の herdr CLI 作法は herdr 本体が提供する `herdr` skill にある。
ここはその上の「セッションをフォークする」ワークフローだけを書く。

## 前提

```bash
test "${HERDR_ENV:-}" = 1
```

false なら Herdr の中で動いていないと伝えて終了する。外から他人の
セッションを操作しない。

セッション ID は環境変数 `$CLAUDE_CODE_SESSION_ID` から取る。

## モデルを決める

フォーク先は常に claude 自身なので、指定はモデル名だけ (`opus` / `sonnet` /
`haiku` などユーザーが言った語をそのまま `--model` に渡す)。指定が無ければ
フラグを付けず、Claude Code の既定に委ねる。

## ペインを作る

```bash
herdr pane layout --pane "$HERDR_PANE_ID"
```

自分の rect の `width` / `height` を見て方向を決める。`width >= height * 2` なら
`right`、そうでなければ `down`。ユーザーが方向を指定したらそれに従う。

```bash
herdr pane split --current --direction <dir> --cwd "$PWD" --no-focus
```

`.result.pane.pane_id` を控える。`--no-focus` は必須 (ユーザーの焦点を奪わない)。
`--cwd "$PWD"` も必須 (省くと別のディレクトリで起動しうる)。

## フォークして resume する

```bash
herdr pane run <pane_id> "headroom wrap claude --resume $CLAUDE_CODE_SESSION_ID --fork-session"
```

モデル指定があれば末尾に `--model <語>` を付ける。

起動は必ず `headroom wrap claude` で行う。**理由は headroom のプロキシを通すため。**
素の `claude` を起動するとトークン圧縮も retrieve も効かない。この帰結として
`herdr agent start` は使えない (`--kind` のバイナリを直接起動するので headroom で
包めない)。headroom 自体が無い環境では素の `claude` に落とすが、その旨を伝える。

`--fork-session` は新しいセッション ID を払い出す。元セッション
($CLAUDE_CODE_SESSION_ID のセッション) には影響しない。

herdr はペイン内のエージェントを自動検出する。`herdr agent list` の
`.result.agents[]` に自分の `pane_id` を持つ要素が現れるまでポーリングして
起動を確認する。30 秒待っても検出されなければ `herdr pane read <pane_id>` で
状況を見る (起動失敗・認証待ちなどが読める)。

## resume 後の注意

`claude --resume` は会話の文脈を引き継ぐが、初回起動時の permission / sandbox
引数までは引き継がない (Herdr Discussion #2104)。フォークしたペインで依頼を
送る前に、権限・サンドボックスの状態を確認するようユーザーに伝える。

フォーク後の作業はユーザー自身がそのペインで続ける。このスキルはペインを
作って resume させるところまでで、依頼文の自動送信は行わない。

## やらないこと

- 自分が作っていないペイン・タブ・ワークスペースを閉じない
- ユーザーの焦点を奪わない (`--no-focus` を外さない)
- フォーク先に herdr コマンドを実行させない。herdr の socket API は呼び出し元を
  認可しないので、herdr を触れること = 任意のペインで任意コマンドを起動できることになる
