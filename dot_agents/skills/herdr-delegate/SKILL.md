---
name: herdr-delegate
description: 隣のペインに別のコーディングエージェント (codex/claude) を立てて実装を委譲する。「隣の codex に実装頼んで」「別のエージェントにこれ実装させて」など、委譲先が別ペインであることを明示されたときに使う。単に実装を頼まれただけでは使わない。HERDR_ENV=1 が必要。
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(herdr *), Bash(grep *), Bash(sed *), Bash(test *), Read
---

# herdr-delegate

隣のペインにエージェントを立てて実装を任せ、自分は本流の作業を続ける。
汎用の herdr CLI 作法は herdr 本体が提供する `herdr` skill にある。
ここはその上の「実装を委譲する」ワークフローだけを書く。

## 前提

```bash
test "${HERDR_ENV:-}" = 1
```

false なら Herdr の中で動いていないと伝えて終了する。外から他人の
セッションを操作しない。

## 委譲先とモデルを決める

指定は **エージェント種別** と **モデル** の2軸。混ぜて扱わない。

- エージェント種別: `claude` か `codex`。既定は `codex`
- モデル: 種別ごとに語彙が違う。claude は `opus` / `sonnet` / `haiku`、
  codex は `terra` / `sol` / `luna`

モデル名だけ言われた場合はその語彙から種別を決める
(「opus で実装して」→ 種別 claude、モデル opus)。どちらも言われなければ
種別 codex、モデル未指定。知らない語が来たら推測せず種別を確認する
(モデルは増えるので、この一覧は既知のものにすぎない)。

起動は必ず `headroom wrap claude` / `headroom wrap codex` で行う。

**理由は headroom のプロキシを通すため。** 素の `claude` / `codex` を起動すると
トークン圧縮も retrieve も効かない。ここは省略しない。

この帰結として `herdr agent start` は使えない。あれは `--kind` のバイナリを
直接起動するので headroom で包めない。代わりに `herdr pane run` を使う。
headroom 自体が無い環境では素の `claude` / `codex` に落とすが、その旨を伝える。

モデル指定はユーザーが言った語から組み立てる。skill にモデル名を固定しない。

- claude: `headroom wrap claude --model <語>` (短縮名もフル ID もそのまま通る)
- codex: 短縮名の実体は `gpt-<version>-<短縮名>` (「tera」と書かれても terra を指す)。
  version は焼き込まず設定から取る:

  ```bash
  grep -m1 '^model' ~/.codex/config.toml | sed -E 's/^model[[:space:]]*=[[:space:]]*"(.+)-[^-]+"$/\1/'
  ```

  出力が `gpt-5.6` なら `headroom wrap codex -m gpt-5.6-sol`。接頭辞が取れなければモデル指定を
  諦めてユーザーに確認する。

モデル未指定ならフラグを付けない。各 CLI の設定既定に委ねる。

## 既存エージェントを使うか判定する

ユーザーが「左の Claude」のように既存ペインを位置で指定した場合は、ペインを
作らない。`herdr pane neighbor --direction <left|right|up|down> --current` で対象を
特定し、`herdr agent get <pane_id>` でエージェントを確認してから、その pane ID に
`herdr agent prompt` を送る。新規ペインの作成は、ユーザーが新しいエージェントの
起動を求めた場合だけ行う。

## ペインを作る

```bash
herdr pane layout --current
```

自分の rect の `width` / `height` を見て方向を決める。`width >= height * 2` なら
`right`、そうでなければ `down`。同じ方向に分割を重ねて使えない幅にしない。
ユーザーが方向を指定したらそれに従う。

```bash
herdr pane split --current --direction <dir> --cwd "$PWD" --no-focus
```

`.result.pane.pane_id` を控える。`--no-focus` は必須 (ユーザーの焦点を奪わない)。
`--cwd "$PWD"` も必須 (省くと別のディレクトリで起動しうる)。

## エージェントを起動して命名する

```bash
herdr pane run <pane_id> "headroom wrap codex --sandbox workspace-write --ask-for-approval on-failure"
```

`--sandbox workspace-write --ask-for-approval on-failure` を付ける。ファイル書き込みは
自動承認され、コマンドが失敗したときだけ確認が入るため、承認プロンプトの往復が減る。
`gh` などネットワークアクセスを伴うコマンドはサンドボックスでブロックされることがあり、
その場合は個別に承認する。claude を起動する場合はこのオプションは付けない。

herdr はペイン内のエージェントを自動検出する。`herdr agent list` の
`.result.agents[]` に自分の `pane_id` を持つ要素が現れるまでポーリングし、
現れたら命名する:

```bash
herdr agent rename <pane_id> implementer
```

30 秒待っても検出されなければ `herdr pane read <pane_id>` で状況を見る
(起動失敗・認証待ちなどが読める)。ポーリングを続けず、そこで報告する。

## 依頼を送る

送る前に相手が idle であることを確かめる。`--wait` は個々の依頼ターンでなく
最初に落ち着いた状態を待つので、working 中に送ると別のターンの完了で戻ってくる。

```bash
herdr agent get implementer
herdr agent prompt implementer "<依頼文>" --wait --timeout 600000
```

依頼文に必ず含める:

- 実装対象と受け入れ条件
- **なぜそれをするか** (背景・目的)。モデルは背景を渡すと受け入れ条件だけでは
  拾えない判断 (命名・エッジケースの扱いなど) をある程度汲んで実装する
- 触ってよいファイル・ディレクトリの範囲
- **git 操作をしないこと** (commit / push / PR は依頼元が行う)
- 最後に何を報告してほしいか (下記)

報告してほしい内容は依頼文で指定する。指定しないと散文の経過説明が返り、
読み直しが要る。求めるのは次の4点だけ:

- 変更したファイルのパス一覧
- 各ファイルで何をしたか1行ずつ
- 実行したテスト・確認コマンドとその結果
- やり残し・判断を保留した点 (無ければ「なし」)

経過の説明・所感・前置き・謝辞は不要と明記する。

長くかかる作業は `--wait` を付けずに投げ、本流の作業に戻ってから拾ってもよい:

```bash
herdr agent wait implementer --until blocked --until idle --timeout 600000
```

## 結果を確認する

```bash
herdr agent get implementer
herdr agent read implementer --source recent-unwrapped --lines 80
```

`--lines` は 80 から始め、`truncated` が立つか内容が足りないときだけ増やす。
読むほど自分のコンテキストを食う。

alternate screen を使うエージェント (claude など) の履歴回収は相手が idle の
ときだけ効く。working / blocked / unknown 中は深い履歴を取れないので、まず
idle を待つ。それでも応答全文が出ないなら「回答を tmp に md で書いてパスだけ
返して」と頼み直し、ファイルを直接読む。最初の依頼文でファイル出力を求めるのは
避ける (画面から取れるなら不要)。

**idle や done は完了の証明ではない。** herdr は画面から状態を推定しているだけで、
バックグラウンド実行中を idle と誤判定する既知の不具合がある。完了の判定は
`git diff` と依頼文で指定したテストを自分で確認して行う。相手の報告文と
状態表示だけで完了扱いにしない。

## blocked になったら

承認待ちか質問待ちを意味する。`herdr agent read` で何を聞かれているか読み、
安全と判断できるものは代わりに承認してよい。判断がつかない・不可逆・依頼の
範囲外のものはユーザーに提示して判断を仰ぐ。

自分で承認してよい (安全側):

- 読み取り専用コマンド (`ls` / `cat` / `grep` / `git status` / `git diff` / `git log` など)
- 依頼文で明示した範囲内でのファイル作成・編集
- 依頼文で指定したテスト・確認コマンドの実行
- 失敗したコマンドの原因調査・別アプローチでのリトライ

ユーザーに確認する (自分で判断しない):

- `git commit` / `push` / force 系、`rm -rf` / `reset --hard` など不可逆・破壊的な操作
- 依頼文で触ってよいと言っていない範囲への変更
- 内容が不明なネットワークアクセス (`gh` / `curl` など外部・共有システムに影響しうるもの)
- 実装方針そのものの選択を委譲先が聞いてきたとき (受け入れ条件に書かれていない判断)

承認するにせよユーザーに確認するにせよ、応答は
`herdr agent prompt` か `herdr agent send-keys` で行う。

## 状態がおかしいとき

working のはずが idle に見える、いつまでも検出されない、といったときは

```bash
herdr agent explain <名前 or pane_id>
```

で herdr がその状態と判定した根拠を読む。相手側の設定 (codex の
`[tui] terminal_title` など) が検出を壊していることがある。推測で送信を
繰り返さず、根拠を見てから次の手を決める。

## やらないこと

- 自分が作っていないペイン・タブ・ワークスペースを閉じない
- ユーザーの焦点を奪わない (`--no-focus` を外さない)
- 委譲先に git 操作を代行させない
- 実装を任せた後、同じ変更を自分でも書かない (どちらの成果か分からなくなる)
- 依頼文を `herdr pane run` で送らない。codex は貼り付け直後の Enter を
  捨てることがあり、依頼が入力欄に残る。`pane run` は起動だけ、送信は
  `agent prompt` に統一する
- 委譲先に herdr コマンドを実行させない。herdr の socket API は呼び出し元を
  認可しないので、herdr を触れること = 任意のペインで任意コマンドを起動できること
  になる
