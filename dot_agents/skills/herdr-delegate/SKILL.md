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

**ペインを作る前に、隣に使えるエージェントがいないか見る。**

```bash
herdr pane layout --current
herdr agent list
```

隣接ペインに idle のエージェントがいて、ユーザーが新規起動を求めていないなら
それを使う。`herdr agent rename <pane_id> implementer` で命名して依頼を送るだけでよい。
ユーザーが「左の Claude」のように位置で指定した場合は
`herdr pane neighbor --direction <left|right|up|down> --current` で対象を特定する。

**「隣」は分割ルールの計算結果ではなくユーザーが見ている画面のこと。** 既存の
エージェントがいるのに新しいペインを別方向に作ると、ユーザーの期待と食い違う。
新規作成は、使えるエージェントが隣にいないか、ユーザーが新しいエージェントの
起動を求めたときだけ。

既存ペインを使うときは、そのエージェントの `cwd` が作業対象のリポジトリと違うことが
ある。違う場合は依頼文で対象を絶対パスで示し、`git -C <path>` を使うよう明記する。
相手のセッションを借りたことは最後にユーザーへ伝える。

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
herdr pane run <pane_id> "headroom wrap codex --sandbox workspace-write --ask-for-approval on-request"
```

`--sandbox workspace-write` でファイル書き込みを自動承認し、`--ask-for-approval` で
承認の要求条件を決める。`gh` などネットワークアクセスを伴うコマンドはサンドボックスで
ブロックされることがあり、その場合は個別に承認する。claude を起動する場合はこの
オプションは付けない。

**`--ask-for-approval` の有効値は codex のバージョンで変わる。** `invalid value` で
即終了したら値を推測で変えず `codex --help` で現行の候補を確認する (過去に
`on-failure` が廃止され、起動が丸ごと失敗した)。

herdr はペイン内のエージェントを自動検出する。`herdr agent list` の
`.result.agents[]` に自分の `pane_id` を持つ要素が現れるまでポーリングし、
現れたら命名する:

```bash
herdr agent rename <pane_id> implementer
```

30 秒待っても検出されなければ `herdr pane read <pane_id>` で状況を見る
(起動失敗・認証待ちなどが読める)。ポーリングを続けず、そこで報告する。

**検出された = 依頼できる、ではない。** codex は起動時に自動アップデート
(`npm install -g @openai/codex`) を始めることがあり、その間 herdr は codex として
検出するが TUI はまだ無いので `agent prompt` が `agent_prompt_stalled` で落ちる。
しかもアップデートは "Please restart Codex" と言って終了するため、`pane run` を
やり直す必要がある。検出後 1 度 `herdr pane read <pane_id>` を見て、入力欄
(codex なら `›` のプロンプト行) が出ていることを確かめてから依頼を送る。

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
- 完了マーカーの出力指示。**マーカー文字列そのものは依頼文に書かず、組み立てさせる。**
  「報告の最後に、`IMPLEMENT` と `DONE` をアンダースコア1つで繋いだ語を単独行で
  出力すること (他の文字と同じ行に混ぜない)」と書く

報告してほしい内容は依頼文で指定する。指定しないと散文の経過説明が返り、
読み直しが要る。求めるのは次の4点だけ:

- 変更したファイルのパス一覧
- 各ファイルで何をしたか1行ずつ
- 実行したテスト・確認コマンドとその結果
- やり残し・判断を保留した点 (無ければ「なし」)

経過の説明・所感・前置き・謝辞は不要と明記する。

最後の完了マーカーは省略しない。**理由:** herdr はまだ作業中のエージェントを
idle/done と誤判定することがあり、`--wait` の戻りだけを信じると途中経過の画面を
最終報告として読んでしまう。マーカーの有無で「相手のターンが終わったか」を
機械的に確認する。

**マーカー文字列を依頼文に literal で書かない。理由:** `herdr agent read` が返すのは
メッセージ境界を持たない端末スナップショットで、自分が送った依頼文のエコーも含む。
依頼文にマーカーを書くと送信した瞬間から画面にその文字列が存在し、作業が始まる前に
含有チェックが通ってしまう (「エコーより後ろ」は機械的に切り分けられず、エコーが
`--lines` の窓に残る保証もない)。組み立てさせれば、その語を画面に出せるのは応答だけになる。

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
idle を待つ。

**組み立てさせたマーカーが出力に現れているか確認する。** 依頼文にその語を書いて
いないので、画面にあれば応答由来と確定できる。現れないうちは `--wait` が戻っていても
idle 表示が出ていても相手のターンが終わったとみなさない。数秒待って
`herdr agent read` か `herdr agent wait implementer --until idle` をやり直す。何度
待っても現れなければ途中経過として扱い、その旨と生の出力をユーザーに提示する
(勝手に完了として報告しない)。

残る誤検知は「最後に IMPLEMENT_DONE を出力します」のような相手の実況だけなので、
マーカーが報告の**最後の行**として単独で出ていることも見る。実況と区別がつかない、
または応答全文が画面に出ないなら「報告を tmp に md で書き、最後の行にマーカーを
入れて、パスだけ返して」と頼み直す。ファイルの末尾行なら端末を介さず判定できる
(最初の依頼文でファイル出力を求めるのは避ける。画面から取れるなら不要)。

**マーカーが保証するのは相手のターンが終わったことだけ。** 実装が受け入れ条件を
満たしたかどうかは `git diff` と依頼文で指定したテストを自分で確認して判定する。

## blocked になったら

承認待ちか質問待ちを意味する。`herdr agent read` で何を聞かれているか読み、
安全と判断できるものは代わりに承認してよい。判断がつかない・不可逆・依頼の
範囲外のものはユーザーに提示して判断を仰ぐ。

自分で承認してよい (安全側):

- 読み取り専用コマンド (`ls` / `cat` / `grep` / `git status` / `git diff` / `git log` など)
- 依頼文で明示した範囲内でのファイル作成・編集
- 依頼文で指定したテスト・確認コマンドの実行
- 失敗したコマンドの原因調査・別アプローチでのリトライ (ただし失敗した元のコマンドが
  読み取り専用・可逆・範囲内・外部副作用なしのときに限る。破壊的操作や範囲外の
  コマンドが失敗した場合は、調査もリトライもユーザーに確認する)

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

`agent prompt` が `agent_prompt_stalled` で落ちたら、`herdr pane read <pane_id>` で
依頼文が相手の入力欄に残っているかを見て原因を分ける。

- 入力欄に依頼文がある: 本文は入ったが Enter が確定していない (claude の
  `-- INSERT --` 中や codex の貼り付け直後に起きる)。`herdr agent send-keys <名前> enter`
  で送信する。同じ依頼を `agent prompt` で送り直すと二重に入力される
- 入力欄自体が無い: エージェントがまだ起動しきっていない。画面を見て待つか、
  終了していれば `pane run` からやり直す

## やらないこと

- 自分が作っていないペイン・タブ・ワークスペースを閉じない
- ユーザーの焦点を奪わない (`--no-focus` を外さない)
- 委譲先に git 操作を代行させない
- 実装を任せた後、同じ変更を自分でも書かない (どちらの成果か分からなくなる)
- 完了マーカーの無い出力を最終報告として扱わない
- 依頼文にマーカー文字列を literal で書かない (エコーで含有チェックが成立してしまう)
- 依頼文を `herdr pane run` で送らない。codex は貼り付け直後の Enter を
  捨てることがあり、依頼が入力欄に残る。`pane run` は起動だけ、送信は
  `agent prompt` に統一する
- 委譲先に herdr コマンドを実行させない。herdr の socket API は呼び出し元を
  認可しないので、herdr を触れること = 任意のペインで任意コマンドを起動できること
  になる
