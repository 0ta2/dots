---
name: herdr-review
description: 隣の Herdr pane に別エージェントを起動して、現在の差分・特定ファイル・直近コミットなどをレビューさせ、結果を回収して報告する。 「隣のcodexにレビューしてもらって」「隣のopusにレビューさせて」「別のエージェントにこの差分を見てもらって」のように、隣ペイン・別エージェント・レビューを明示した依頼で使う。既定は codex。claude、opus、sonnet 等が指定された場合はそのエージェントまたはモデルを使う。「レビューして」だけの依頼、または自分でレビューする依頼には使わず、既存の review スキルを使う。
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
herdr agent rename <pane_id> reviewer
```

30 秒待っても検出されなければ `herdr pane read <pane_id>` で状況を見る
(起動失敗・認証待ちなどが読める)。ポーリングを続けず、そこで報告する。

## 依頼を送る

送る前に相手が idle であることを確かめる。`--wait` は個々の依頼ターンでなく
最初に落ち着いた状態を待つので、working 中に送ると別のターンの完了で戻ってくる。

```bash
herdr agent get reviewer
herdr agent prompt reviewer "<依頼文>" --wait --timeout 300000
```

依頼文に必ず含める:

- レビュー対象 (現在の git diff / 特定ファイル / 直近コミット / PR番号など範囲を明示)
- `~/.agents/skills/review/SKILL.md` を読み、その観点・出力形式に従ってレビューすること。
  PR ではない対象 (現在の diff・特定ファイルなど) のときは、その skill の Step 0 (`gh pr view`
  による取得) は省略し、指定した対象をそのままレビューしてよいと明記する
- **コードを書き換えないこと** (指摘に留める。修正は依頼元が行う)
- 回答の最後に単独行で `REVIEW_DONE` と出力すること (他の文字と同じ行に混ぜない)

ルーブリックをここに書き下さず `review` skill のファイルをそのまま参照させる。codex はこの skill を
`/review` のようなコマンドとして起動する手段を持たないが、ファイルを読んで従うことはできるので、
claude・codex どちらが相手でも同じ依頼文・同じやり方で統一できる。skill の内容が変わっても
herdr-review 側の追従は不要 (DRY)。

最後の完了マーカーは省略しない。**理由:** herdr はまだ作業中のエージェントを
idle/done と誤判定することがあり、`--wait` の戻りだけを信じると途中経過を
最終レビューとして報告してしまう。マーカーの有無で完了を機械的に確認する。

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

`--lines` は 80 から始め、`truncated` が立つか内容が足りないときだけ増やす。
読むほど自分のコンテキストを食う。

alternate screen を使うエージェント (claude など) の履歴回収は相手が idle の
ときだけ効く。working / blocked / unknown 中は深い履歴を取れないので、まず
idle を待つ。

**`REVIEW_DONE` が回答本文の末尾に単独行で現れているか確認する。** 出力に
文字列が含まれているかで判定してはいけない — 依頼文自体にこの文字列が入っているので、
画面には送信した瞬間から自分の依頼のエコーとして現れており、含有チェックは
レビューが始まる前から通ってしまう。見るのは「依頼文のエコーより後ろに、回答の
最後の行として単独で出ているか」。

条件を満たさなければ `--wait` が戻っていても idle 表示が出ていても完了と
みなさない。数秒待って再度 `herdr agent read` するか
`herdr agent wait reviewer --until idle` をやり直す。何度待ってもマーカーが
現れない場合は途中経過として扱い、その旨と生の出力をユーザーに提示して判断を
仰ぐ (勝手に最終レビューとして報告しない)。

マーカーはあるが応答全文が出ないなら「回答を tmp に md で書いてパスだけ
返して」と頼み直し、ファイルを直接読む。最初の依頼文でファイル出力を求めるのは
避ける (画面から取れるなら不要)。

**idle や done は完了の証明ではない。** herdr は画面から状態を推定しているだけで、
バックグラウンド実行中を idle と誤判定する既知の不具合がある。`REVIEW_DONE`
マーカーの有無で機械的に確認し、状態表示や相手の報告文だけで完了扱いにしない。

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

## やらないこと

- 自分が作っていないペイン・タブ・ワークスペースを閉じない
- ユーザーの焦点を奪わない (`--no-focus` を外さない)
- reviewer にコードを書き換えさせない (指摘に留める。修正は依頼元が行う)
- 回答の末尾に単独行の `REVIEW_DONE` が無い出力を最終レビューとしてそのまま報告しない
  (依頼文のエコーに含まれる同じ文字列をマーカーと取り違えない)
- 依頼文を `herdr pane run` で送らない。codex は貼り付け直後の Enter を
  捨てることがあり、依頼が入力欄に残る。`pane run` は起動だけ、送信は
  `agent prompt` に統一する
- reviewer に herdr コマンドを実行させない。herdr の socket API は呼び出し元を
  認可しないので、herdr を触れること = 任意のペインで任意コマンドを起動できること
  になる
