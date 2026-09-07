---
name: change-review
description: コードレビュー。security / performance / DRY / consistency の4観点でチェックし、[MUST]/[SHOULD]/[IMO]/[nits]/[Q] プレフィックス付きの指摘を出力する。対象は PR・現在のローカル差分・特定ファイル・直近コミット。PR が対象のときは結果を PR のインラインコメントとして投稿する (`--no-comment` で抑止)。Claude Code / Codex 組み込みの review コマンドと名前が衝突しないよう change-review という名前にしている。明示呼び出しは Claude Code で `/change-review`、Codex で `$change-review`。「PR をレビューして」「コードレビュー」「今の差分をレビューして」「このファイルをレビューして」「直近のコミットをレビューして」など、レビュー依頼があれば積極的に使用する。
user-invocable: true
allowed-tools: Bash(gh pr view*), Bash(gh pr diff*), Bash(gh api *), Bash(git *), Grep, Glob, Read, Write
argument-hint: "[PR番号/URL | ファイルパス | --diff | --last-commit] [--round N] [--since <SHA>] [--skip <観点>] [--only <観点>] [--no-comment]"
---

# Change Review: コードレビュー

## コンテキスト

<arguments>
$ARGUMENTS
</arguments>

## 観点（重要度順）

| #   | 観点           | 概要                                                |
| --- | -------------- | --------------------------------------------------- |
| 1   | セキュリティ   | XSS, CSRF, インジェクション, 認証漏れ, 機密情報漏洩 |
| 2   | パフォーマンス | N+1, 再レンダリング, バンドルサイズ, メモリリーク   |
| 3   | DRY            | コード重複, 既存ユーティリティとの重複              |
| 4   | 一貫性         | 命名・パターン・スタイルの一貫性                    |

`--skip <観点名>` / `--only <観点名>` で絞り込み可能。
対象が PR のときは Step 4 で結果を PR に投稿する。`--no-comment` を付けると投稿しない。

## Step 0: レビュー対象の取得

引数からレビュー対象を判定する。引数がなければユーザーに確認する。

### PR (番号 or URL)

```bash
gh pr view <PR番号> --json title,body,files,headRefName,headRefOid
gh pr diff <PR番号>
```

`headRefOid` を控える。**レビューはこのコミットに対して行う。** Step 4 の `commit_id` と、
投稿前の変化検知に使う。

`body` に `## Scope Lock` の節があれば、それがこの PR の判定範囲になる。「やらないこと」
「判定に含めないもの」(別 PR の番号 / accepted risk / technical debt) に挙がっているものは、
問題を見つけても指摘にしない (Step 3 の Non-actionable)。

**ただし、この PR の差分が新たに持ち込んだ Blocker (`[MUST]`) は Scope Lock に書かれていても
出す。** Scope Lock が外せるのは「この PR が触っていない範囲」と「既知の負債を今回は直さない」
ことまで。PR 本文は実装側が書くので、ここを無条件にすると実装者がレビューを黙らせられる。

### 現在のローカル差分

```bash
git diff HEAD
git status --short
```

`git diff HEAD` は新規作成 (untracked) ファイルの中身を出力しない。`git status --short` の
`??` 行に出た untracked ファイルも読み、レビュー対象に含める。

### 特定ファイル

指定されたパスをそのまま読む (差分ではなく現在の内容全体)。

### 直近コミット

```bash
git show HEAD --stat
git show HEAD
```

## Step 0.5: ラウンドと既存の指摘の把握

同じ PR を複数回レビューするときは、ラウンドごとに読む範囲を狭める。狭めないと同じコードを
毎回採点し直すことになり、レビュアーの質が高いほど新しい指摘が出続けて終わらない。

### ラウンド番号を数える

**ラウンド番号 = この PR に投稿済みの「自分の」レビュー件数 + 1。**

自分のレビューかどうかは `.user.login` では判別できない。GitHub の投稿者名は実行者の
1 アカウントに集約されるので、人間も codex も claude も同じ `login` になる。**Step 4 で入れる
識別行 (本文の先頭行) だけが手掛かり**になるので、そこで絞る:

```bash
gh api --paginate repos/<owner>/<repo>/pulls/<PR番号>/reviews \
  -q '.[] | "\(.submitted_at)\t\(.commit_id)\t\(.body | split("\n")[0])"' \
  | grep -F '<自分のエージェント名>'
```

数えるのはエージェント名の単位で、モデル ID は見ない (モデルを変えて同じ PR を見せる運用が
あるため)。**ヒット 0 の原因は「本当に 1 周目」と「識別行の名前が前回と揺れた」の 2 つある。**
`grep` を外した生のレビュー件数で分ける。0 件なら 1 周目で確定。1 件以上あるのに識別行の一致が
0 件なら名前揺れの疑いなので (Step 4 参照)、1 周目に落とさずユーザーに確認する。

`--round N` / `--since <SHA>` が引数で渡されていればそちらを優先する。`--since` 省略時は
上で絞った自分の直近レビューの `commit_id` を使う。

ラウンドが 2 以上なら Step 1 と Step 2 の読む範囲を狭める (各 Step に記載)。3 以上で Blocker が
残っていたら Step 3 で打ち切りを宣言する。

### 既存の指摘を読む

**投稿より前にここで読む。** Step 3 の Non-actionable 判定 (決着済みの蒸し返し) にも、Step 4 の
重複投稿の回避にも、Step 5 の返信にも、この内容が要る。

まず未解決スレッドに絞る。resolved / unresolved は REST では返らないので GraphQL で引く:

```bash
gh api graphql --paginate -f query='
query($owner:String!,$name:String!,$pr:Int!,$endCursor:String){
  repository(owner:$owner,name:$name){ pullRequest(number:$pr){
    reviewThreads(first:100, after:$endCursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ id isResolved comments(first:1){nodes{fullDatabaseId}} } } } } }' \
  -F owner=<owner> -F name=<repo> -F pr=<PR番号> \
  -q '.data.repository.pullRequest.reviewThreads.nodes[]
      | select(.isResolved | not)
      | "\(.id)\t\(.comments.nodes[0].fullDatabaseId)"'
```

`--paginate` は `-q` か `--slurp` が無いとページごとに別の JSON を吐くので、上のように `-q` で
必要な形に落とす。`fullDatabaseId` は `BigInt` で **JSON では文字列**、REST の `.id` は数値。
突き合わせるときは型を揃える (`==` が黙って空になる)。ID は非推奨の `databaseId` ではなく
`fullDatabaseId` を使う (前者は 64-bit ID を扱えない)。

次に本文を読む。**3 つのエンドポイントを全部見る。** インラインだけでは足りない (Step 4 は
サマリ表・総合・「参考 (PR 差分外)」を review body に書くので、インラインしか読まないと
自分の投稿すら回収できない):

```bash
# インラインコメント
gh api --paginate repos/<owner>/<repo>/pulls/<PR番号>/comments \
  -q '.[] | "--- \(.id) \(.user.login) line=\(.line) subject=\(.subject_type)\n\(.body)"'
# レビュー本文 (サマリ・総合はここに入る)
gh api --paginate repos/<owner>/<repo>/pulls/<PR番号>/reviews \
  -q '.[] | select(.body != "") | "--- review \(.id) \(.user.login) \(.state)\n\(.body)"'
# PR の会話 (経緯コメント)
gh api --paginate repos/<owner>/<repo>/issues/<PR番号>/comments \
  -q '.[] | "--- issue \(.id) \(.user.login)\n\(.body)"'
```

`--paginate` を省くと 1 ページ目しか見ない。**本文を切り詰めない** (再現条件や要求されている
対処が後半に書かれていることがあり、切ると対応済みかどうかを判断できない)。`line` が `null`
のものは outdated (指摘対象の行がその後の push で消えた) か、ファイル単位のコメント
(`subject_type: "file"`) のどちらか。後者は行に紐づかないだけの現役の指摘なので、outdated と
同じ扱いにしない。

## Step 1: 変更ファイルの全体を読む (1 周目)

差分だけでレビューしない。**変更ファイルの全体**を読む。

- PR: `git fetch origin <headRefName>` してから `git show origin/<headRefName>:<file_path>`
- 現在のローカル差分: 対象ファイル (untracked 含む) を作業ツリーからそのまま読む
- 直近コミット: 作業ツリーではなく `git show HEAD:<file_path>` から読む (worktree が HEAD より
  後で編集されていることがあるため)。削除されたファイルは `git show HEAD^:<file_path>`
- 特定ファイル: Step 0 で読み込み済み

変更された関数の呼び出し元・呼び出し先も確認する。削除されたコードの参照元が残っていないかも見る。

### 2 周目以降

**前回レビューからの差分だけを読む。** 変更ファイルの全体も、一貫性判定のための周辺ファイルも
読み直さない (1 周目で読んで判定済み)。

```bash
git fetch origin <headRefName>
git merge-base --is-ancestor <since> <headRefOid> && git diff <since>..<headRefOid>
```

fetch は 2 周目でも必要 (1 周目の指示は 1 周目のブロックにしかない)。`<since>` が解決できない、
または `<headRefOid>` の祖先でないとき (force-push / rebase された) は、`git diff A..B` が
「前回以降の変更」にならないので **1 周目として全体を読み直す。**

差分が空のとき (前回レビュー以降に push が無い) は、レビューをやり直さない。「前回から変更
なし」と端末に出し、**Step 4 のレビュー投稿は行わない** (Step 4 の「指摘 0 件でも `COMMENT` で
投稿する」より、こちらが優先)。Step 0.5 で読んだ未対応の指摘に対する Step 5 の返信と resolve は
通常どおり行う。

この差分の外は、問題を見つけても新しい指摘にしない。1 周目で挙げなかったものは、1 周目の
判断で決着したものとして扱う。

## Step 2: 各観点のチェック

### セキュリティ

- XSS: テンプレートへのユーザー入力埋め込み、`innerHTML`、URL インジェクション
- 認証/認可: 新エンドポイントの認証ヘッダー、権限チェック、IDOR
- 機密情報: ハードコードされた秘密情報、ログでの漏洩
- インジェクション: SQL、コマンド、入力検証

### パフォーマンス

- FE: 不要な再レンダリング、バンドルサイズ
- BE: N+1、メモリリーク、不要なアロケーション
- 多重呼び出し、タイムアウト未設定

### DRY

- PR 内の重複コード
- 既存ユーティリティとの重複（grep で参照ゼロを確認してから指摘する）
- 3 回以上繰り返しは共通化候補

### 一貫性

- **周辺ファイルを最低 3 つ読んでから判定する** (1 周目のみ)
- 命名規則、コードパターン、アーキテクチャの一貫性

## Step 3: 結果の出力

各指摘の冒頭に必ずプレフィックスを付ける (Step 4 の識別行はその前に置く前置きで、
指摘本文自体はプレフィックスから始める)。**マージを止められるのは Blocker だけ。**

| プレフィックス | 分類      | 使う基準                                             | マージ |
| -------------- | --------- | ---------------------------------------------------- | ------ |
| `[MUST]`       | Blocker   | バグ・脆弱性・ビルドエラー。再現手順が書けるもの     | 止める |
| `[SHOULD]`     | Follow-up | パフォーマンス問題・明確なコード重複                 | 止めない (Issue へ) |
| `[IMO]`        | Follow-up | より良いパターンの提案（採否は著者に委ねる）         | 止めない |
| `[nits]`       | Follow-up | typo・変数名の微細な改善（対応任意）                 | 止めない |
| `[Q]`          | —         | 意図が不明な箇所（指摘ではなく質問）                 | 止めない |

### Non-actionable — 出さないもの

次の 3 つは指摘として成立していない。端末出力にも PR への投稿にも載せない。

- **Scope Lock の外** — この PR が守ると宣言していない範囲 (Step 0 で読んだ「やらないこと」
  「判定に含めないもの」)。ただし差分が新たに持ち込んだ Blocker は除く (Step 0 参照)
- **決着済みの蒸し返し** — 実装者が反論し、判断が下った論点。同じ指摘を別の言い方で出し直さない。
  実装者から理由付きで「これは Non-actionable だ」と宣言されたものは、**その理由に反論できる
  ときだけ**再提出する
- **前提の誤解** — 指摘の前提が実際には成り立っていない

確信度が低いことは Non-actionable ではない。**確信度や重大度ではフィルタしない。** 上の 3 つに
当たらなければ、確信が持てないものも末尾に `(確信度: 低)` を添えて出す。省くのはスタイルや
命名の好みのような些細な点だけ。

サマリ形式:

```
## レビュー結果: #<番号> <タイトル>

| 観点           | 判定                            | 指摘数 |
|----------------|---------------------------------|--------|
| セキュリティ   | SAFE / MEDIUM / HIGH / CRITICAL | 0      |
| パフォーマンス | FAST / MEDIUM / HIGH / CRITICAL | 0      |
| DRY            | CLEAN / MEDIUM / HIGH           | 0      |
| 一貫性         | CONSISTENT / MEDIUM / HIGH      | 0      |

総合: LGTM / 要対応 / ブロッカーあり
```

CRITICAL が 1 つでもあれば「ブロッカーあり」、HIGH があれば「要対応」。

### 打ち切り

3 周目以降で Blocker が残っているときは、総合の下に打ち切りを書く:

```
このラウンドでレビューを打ち切る。残る Blocker は別 PR / Issue へ。
```

これ以上同じ PR を周回しない。

## Step 4: PR への投稿

対象が PR のときは、Step 3 の結果を PR のインラインコメントとして**既定で投稿する**。
ローカル差分・特定ファイル・直近コミットは投稿先が無いので常に端末出力のみ。

`--no-comment` が指定されたときは **GitHub への書き込みを一切しない**。この Step の投稿だけで
なく、Step 5 の返信と resolve も行わない。読み取りと端末出力だけにする。

**Step 0.5 で読んだ既存の指摘と重複していないか確認してから投稿する。** 他のレビュアが既に
挙げていて未対応のままの指摘を、そうと知らずに重複投稿しないため。既出だったものは新しい
コメントを立てず、既存スレッドへの返信で済ませる。

**本文と各インラインコメントの、それぞれ先頭行に**、実行したエージェントとモデルを引用行で
入れる。見出しやプレフィックスより前に置く:

```text
> 🤖 **<エージェント名>** `<実際に動いているモデル ID>`
```

`<...>` は自分の実行環境の値に置き換える。**この skill に書かれた例をそのままコピーしない**
(モデルは実行のたびに変わりうるので、固定値を写すと別のモデルの名前で投稿することになる)。

**エージェント名は Step 0.5 のラウンド判定のキーになる。** 同じ PR を再レビューするときは前回と
同じ文字列を使う (`Claude Code` と `Claude` が混ざると自分の過去レビューを数えられなくなる)。

順序は次で固定する。

- レビュー本文: 識別行 → 見出し → サマリ表 → 総合
- インライン・返信・追加コメント: 識別行 → `[MUST]` 等から始まる指摘本文

Codex から実行したなら `**Codex**` と実際のモデル名にする。どのモデルで実行したか分からない
まま投稿しない。

**本文に 1 回だけ書くのでは足りない。** GitHub の投稿者名は実行者の 1 アカウントに集約される
ので、画面上ではレビューの指摘も著者の返信もすべて同じ名前で並ぶ。コメント単位で識別行が
無いと、どのコメントがどのエージェントのものか読み手が追えない。返信・追加コメントを
投稿するときも同じ行を先頭に付ける。

`event` は必ず `COMMENT` にする。**`APPROVE` は使わない** (GitHub は自分の PR に approve を
出せない)。指摘が 1 件も無いときも `COMMENT` で投稿し、本文の総合を `LGTM` と書く (例外は
2 周目以降で差分が空のとき。Step 1 に従い投稿しない)。

指摘は行に紐づけて `comments` に入れる。同じ行に複数の指摘を付けてよい。差分外の補足は
行に紐づかないので、本文側に「参考 (PR 差分外)」として書く。

`commit_id` には Step 0 で控えた `headRefOid` を使う。投稿の直前に再取得して一致を確認し、
**変わっていたら投稿しない** (レビューは旧コミットの差分に対する行番号を持っているので、
新しいコミットに投稿すると別の行に付くか 422 になる)。その場合は新しい head でレビューし直す。

```bash
gh pr view <PR番号> --json headRefOid -q .headRefOid   # Step 0 で控えた値と一致するか確認
gh api repos/<owner>/<repo>/pulls/<PR番号>/reviews --method POST --input <JSONファイル> \
  -q '.html_url, .state'
```

指摘本文にはバッククォートやクォートが入るのでシェルに埋め込まず、JSON を一時ファイルに
書き出して `--input` で渡す:

```json
{
  "commit_id": "<headRefOid>",
  "event": "COMMENT",
  "body": "> 🤖 **<エージェント名>** `<モデル ID>`\n\n## レビュー結果: #<番号> <タイトル>\n\n<サマリ表>\n\n総合: ...",
  "comments": [
    {"path": "<ファイルパス>", "line": <行番号>, "side": "RIGHT", "body": "> 🤖 **<エージェント名>** `<モデル ID>`\n\n**[SHOULD] <見出し>**\n\n<本文>"}
  ]
}
```

`line` は変更後 (右側) の行番号で `side` は `RIGHT`。削除行に付けるときは変更前の行番号と
`"side": "LEFT"` にする。投稿したら返ってきた `html_url` をユーザーに報告する。

## Step 5: 既存の指摘に答える

自分が投稿するだけで終わりにしない。Step 0.5 で読んだ他のレビュー (人間・
`chatgpt-codex-connector` などの bot・別エージェント) のうち、未対応のものに答える。

`--no-comment` のときは返信も resolve もしない。Step 0.5 で読んだ未対応の指摘を端末に出す。

### 1. 対応内容を返信する

本文にはシングルクォートやバッククォートが入るのでシェルに埋め込まず、ファイルに書いて渡す:

```bash
gh api repos/<owner>/<repo>/pulls/<PR番号>/comments/<comment_id>/replies \
  --method POST -F body=@<返信本文を書いたファイル>
```

返信にも識別行を付ける。

### 2. スレッドを resolve する

```bash
gh api graphql \
  -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' \
  -F id=<thread_id>
```

**対応していない指摘を resolve しない** (見た目上だけ片付いて、次に見たときに残っていることが
分からなくなる)。

**レビュア側で実行しているとき** (他人の変更を見に行くだけで、コードは直さない) は、未対応
スレッドを resolve できない。黙って通り過ぎず、「独立に検証したがまだ有効」と返信し、Step 4 の
投稿本文にも残課題として書く。

## 偽陽性防止

**指摘を出す前:**

1. 差分の外の実コードを読んでから判断する
2. PR 由来の問題だけを指摘する（PR 以前から存在するリスクは指摘しない）
3. 技術仕様は公式ドキュメントまで遡る（コードベース内の使用例だけで判断しない）
4. dead code 指摘は grep で参照ゼロを確認してから

**指摘を取り消す前:**

5. 取り消しの根拠がコード内の使用例レベルなら不十分
6. 迷ったら消さずに残す（間違った指摘は著者が返信すれば済む。正しい指摘を消すとバグが入る）
