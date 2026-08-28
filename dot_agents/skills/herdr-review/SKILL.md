---
name: herdr-review
description: 隣の Herdr pane に別エージェントを起動して、現在の差分・特定ファイル・直近コミットなどをレビューさせ、結果を回収して報告する。 「隣のcodexにレビューしてもらって」「隣のopusにレビューさせて」「別のエージェントにこの差分を見てもらって」のように、隣ペイン・別エージェント・レビューを明示した依頼で使う。既定は codex。claude、opus、sonnet 等が指定された場合はそのエージェントまたはモデルを使う。「レビューして」だけの依頼、または自分でレビューする依頼には使わず、自分でレビュースキルを実行する。
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(herdr *), Bash(grep *), Bash(sed *), Bash(test *), Read
---

# herdr-review

隣のペインに別エージェントを立ててレビューさせ、結果を回収して報告する。
汎用の herdr CLI 作法は herdr 本体が提供する `herdr` skill にある。
ここはその上の「レビューを委譲する」ワークフローだけを書く。

## 前提

```bash
test "${HERDR_ENV:-}" = 1
```

false なら Herdr の中で動いていないと伝えて終了する。外から他人の
セッションを操作しない。

## レビュー先とモデルを決める

指定は **エージェント種別** と **モデル** の2軸。混ぜて扱わない。

- エージェント種別: `claude` か `codex`。既定は `codex`
- モデル: 種別ごとに語彙が違う。claude は `opus` / `sonnet` / `haiku`、
  codex は `terra` / `sol` / `luna`

モデル名だけ言われた場合はその語彙から種別を決める
(「opus でレビューして」→ 種別 claude、モデル opus)。どちらも言われなければ
種別 codex、モデル未指定。知らない語が来たら推測せず種別を確認する
(モデルは増えるので、この一覧は既知のものにすぎない)。

起動は必ず素の `claude` / `codex` で行う。

`herdr agent start` は `-- [AGENT_ARG]...` で同じ引数を渡せるので切り替えられる
可能性があるが未検証。当面は `herdr pane run` を使う。

モデル指定はユーザーが言った語から組み立てる。skill にモデル名を固定しない。

- claude: `claude --model <語>` (短縮名もフル ID もそのまま通る)
- codex: 短縮名の実体は `gpt-<version>-<短縮名>` (「tera」と書かれても terra を指す)。
  version は焼き込まず設定から取る:

  ```bash
  grep -m1 '^model' ~/.codex/config.toml | sed -E 's/^model[[:space:]]*=[[:space:]]*"(.+)-[^-]+"$/\1/'
  ```

  出力が `gpt-5.6` なら `codex -m gpt-5.6-sol`。接頭辞が取れなければモデル指定を
  諦めてユーザーに確認する。

モデル未指定ならフラグを付けない。各 CLI の設定既定に委ねる。

## 既存エージェントを使うか判定する

**ペインを作る前に、隣に使えるエージェントがいないか見る。**

```bash
herdr pane layout --current
herdr agent list
```

隣接ペインに idle のエージェントがいて、ユーザーが新規起動を求めていないなら
それを使う。`herdr agent rename <pane_id> reviewer` で命名して依頼を送るだけでよい。
ユーザーが「隣の codex に」のように位置で指定した場合は
`herdr pane neighbor --direction <left|right|up|down> --current` で対象を特定する。

**「隣」は分割ルールの計算結果ではなくユーザーが見ている画面のこと。** 既存の
エージェントがいるのに新しいペインを別方向に作ると、ユーザーの期待と食い違う
(過去に縦長ペインの規則どおり下に作り、右の既存 codex を使ってほしかったと
指摘された)。新規作成は、使えるエージェントが隣にいないか、ユーザーが新しい
エージェントの起動を求めたときだけ。

既存ペインを使うときは、そのエージェントの `cwd` がレビュー対象のリポジトリと
違うことがある。違う場合は依頼文で対象を絶対パスで示し、`git -C <path>` を
使うよう明記する。相手のセッションを借りたことは最後にユーザーへ伝える。

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
herdr pane run <pane_id> "codex --sandbox workspace-write --ask-for-approval on-request"
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
herdr agent rename <pane_id> reviewer
```

30 秒待っても検出されなければ `herdr pane read <pane_id>` で状況を見る
(起動失敗・認証待ちなどが読める)。ポーリングを続けず、そこで報告する。

**検出された = 依頼できる、ではない。** codex は起動時に自動アップデート
(`npm install -g @openai/codex`) を始めることがあり、その間 herdr は codex として
検出するが TUI はまだ無いので `agent prompt` が `agent_prompt_stalled` で落ちる。
しかもアップデートは "Please restart Codex" と言って終了するため、`pane run` を
やり直す必要がある。検出後 1 度 `herdr pane read <pane_id>` を見て、入力欄
(codex なら `›` のプロンプト行) が出ていることを確かめてから依頼を送る。

## レビュースキルと投稿の有無を決める

どちらも呼び出し元から渡される引数として扱い、この skill には運用ポリシーを埋めない。

- レビュースキル: 依頼で指定されたスキルのパス。指定がなければ
  `~/.agents/skills/change-review/SKILL.md`。プロジェクトや職場ごとに別のスキルを使う
- 投稿の有無: 既定は投稿させず、結果を回収して依頼元に報告するだけ。
  「PR にコメントさせて」など投稿を指示されたときだけ reviewer に投稿させる。
  **どちらであっても依頼文に書く。** レビュースキルは PR 対象なら投稿する既定を
  持つことがあり (`change-review` がそう)、黙っていると投稿される

## 依頼を送る

送る前に相手が idle であることを確かめる。`--wait` は個々の依頼ターンでなく
最初に落ち着いた状態を待つので、working 中に送ると別のターンの完了で戻ってくる。

```bash
herdr agent get reviewer
herdr agent prompt reviewer "<依頼文>" --wait --timeout 300000
```

依頼文に必ず含める:

- レビュー対象 (現在の git diff / 特定ファイル / 直近コミット / PR番号など範囲を明示)
- レビュースキルのパスを渡し、それを読んで観点・出力形式に従ってレビューすること。
  PR ではない対象 (現在の diff・特定ファイルなど) のときは、そのスキルの Step 0 (`gh pr view`
  による取得) は省略し、指定した対象をそのままレビューしてよいと明記する
- **コードを書き換えないこと** (指摘に留める。修正は依頼元が行う)
- 決めた投稿の有無。投稿させるなら **投稿するのは reviewer 自身の仕事** だと明記する
  (依頼元は代理投稿しない。GitHub 上の投稿者名はどちらも同じアカウントなので、本文の
  識別行だけが誰の指摘かを示す手掛かりになる)。投稿させないなら、そのレビュースキルの
  投稿を止める指示を渡す (`change-review` なら `--no-comment`)

ルーブリックをここに書き下さず、レビュースキルのファイルをそのまま参照させる。codex はスキルを
`/<スキル名>` のようなコマンドとして起動する手段を持たないが、ファイルを読んで従うことはできるので、
claude・codex どちらが相手でも同じ依頼文・同じやり方で統一できる。スキルの内容が変わっても
herdr-review 側の追従は不要 (DRY)。

依頼が長くかかりそうなら `--wait` を付けずに投げ、本流の作業に戻ってから
拾ってもよい:

```bash
herdr agent wait reviewer --until blocked --until idle --timeout 300000
```

## 結果を確認する

```bash
herdr agent get reviewer
herdr agent read reviewer --source recent-unwrapped --lines 80
```

`agent get` の状態で分岐する。`--wait` も `agent wait` も blocked で戻るので、
戻ったこと自体は完了を意味しない。`blocked` なら結果を判定せず「blocked になったら」
へ進む。判定に進むのは `idle` / `done` のときだけ。

`--lines` は 80 から始め、`truncated` が立つか内容が足りないときだけ増やす。
読むほど自分のコンテキストを食う。

alternate screen を使うエージェント (claude など) の履歴回収は相手が idle の
ときだけ効く。working / blocked / unknown 中は深い履歴を取れないので、まず
idle を待つ。

**`idle` / `done` で戻ったことが保証するのは相手のターンが終わったことだけ。** 依頼した対象・観点を
レビューが実際に網羅しているかは、本文を読んで自分で判断する。

## blocked になったら

承認待ちか質問待ちを意味する。`herdr agent read` で何を聞かれているか読み、
安全と判断できるものは代わりに承認してよい。判断がつかない・不可逆・依頼の
範囲外のものはユーザーに提示して判断を仰ぐ。

自分で承認してよい (安全側):

- 読み取り専用コマンド (`ls` / `cat` / `grep` / `git status` / `git diff` / `git log` など)
- 依頼文で指定したレビュー対象の範囲内での読み取り・調査
- 失敗したコマンドの原因調査・別アプローチでのリトライ (ただし失敗した元のコマンドが
  読み取り専用・可逆・範囲内・外部副作用なしのときに限る。破壊的操作や範囲外の
  コマンドが失敗した場合は、調査もリトライもユーザーに確認する)

ユーザーに確認する (自分で判断しない):

- `git commit` / `push` / force 系、`rm -rf` / `reset --hard` など不可逆・破壊的な操作
- 依頼文で指定した対象を書き換えようとする操作 (reviewer にコードを書き換えさせない)
- 内容が不明なネットワークアクセス (`gh` / `curl` など外部・共有システムに影響しうるもの)

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
- reviewer にコードを書き換えさせない (指摘に留める。修正は依頼元が行う)
- 依頼文を `herdr pane run` で送らない。codex は貼り付け直後の Enter を
  捨てることがあり、依頼が入力欄に残る。`pane run` は起動だけ、送信は
  `agent prompt` に統一する
- reviewer に herdr コマンドを実行させない。herdr の socket API は呼び出し元を
  認可しないので、herdr を触れること = 任意のペインで任意コマンドを起動できること
  になる
