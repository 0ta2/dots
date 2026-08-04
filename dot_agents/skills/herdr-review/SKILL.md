---
name: herdr-review
description: 隣の Herdr pane に別エージェントを起動して、現在の差分・特定ファイル・直近コミットなどをレビューさせ、結果を回収して報告する。 「隣のcodexにレビューしてもらって」「隣のopusにレビューさせて」「別のエージェントにこの差分を見てもらって」のように、隣ペイン・別エージェント・レビューを明示した依頼で使う。既定は codex。claude、opus、sonnet 等が指定された場合はそのエージェントまたはモデルを使う。「レビューして」だけの依頼、または自分でレビューする依頼には使わず、既存の review スキルを使う。 
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(herdr *), Bash(grep *), Bash(sed *), Bash(test *), Read
---

# Herdr Review

別モデルの目で、対象を限定した actionable なレビューを行う。

## 手順

1. `HERDR_ENV=1` であることを確認する。設定されていなければ、Herdr 内で実行するようユーザーに伝えて止める。
2. `herdr pane layout --current` を確認し、`width >= height * 2` なら `right`、それ以外なら `down` を選ぶ。
3. `herdr pane split --current --direction <dir> --cwd "$PWD" --no-focus` を実行し、返された `pane_id` を控える。
4. `herdr pane run <pane_id> "headroom wrap codex --sandbox workspace-write --ask-for-approval on-failure"` または `herdr pane run <pane_id> "headroom wrap claude"` で別エージェントを起動する。
   - 指定がなければ codex を使う。
   - `claude` または `codex` が指定されたら対応するコマンドを使う。
   - `opus`、`sonnet` などモデルが指定されたら、対応するランタイムに `--model <指定された語>` をそのまま渡す。モデル指定がなければ `--model` は付けない。
   - `hc` / `hx` エイリアスは使わない。
   - codex には `--sandbox workspace-write --ask-for-approval on-failure` を付ける。ファイル書き込みは自動承認され、コマンドが失敗したときだけ確認が入るため、承認プロンプトの往復が減る。`gh` などネットワークアクセスを伴うコマンドはサンドボックスでブロックされることがあり、その場合は個別に承認する。
5. `herdr agent list` をポーリングし、対象 `pane_id` のエージェント検出を待つ。30 秒待っても検出されなければ `herdr pane read <pane_id>` で状況を確認してユーザーに報告し、ポーリングを続けない。
6. 検出後、`herdr agent rename <pane_id> reviewer` を実行する。
7. `herdr agent get reviewer` で reviewer が idle であることを確認する。不自然な状態なら `herdr agent explain reviewer` で判定根拠を読む。
8. 対象を明示し、「actionable な指摘のみ返す」ことを含めた依頼文を作る。例: `現在の git diff をレビューし、actionable な指摘のみ返してください。`
9. `herdr agent prompt reviewer "<レビュー依頼文>" --wait --timeout 300000` で依頼する。依頼文を `herdr pane run` で送らない。
10. `herdr agent read reviewer --source recent-unwrapped --lines 80` で回答を回収する。出力が truncated または内容不足のときだけ行数を増やす。alternate screen から深い履歴を取るのは reviewer が idle のときだけにする。それでも取得できなければ、「回答を tmp に Markdown で書き、パスだけ返してください」とフォールバックする。
11. 回収した actionable な指摘をユーザーに要約して報告する。指摘がなければその旨を報告する。

## 運用制約

- idle / done は完了の証明ではない。Herdr は画面から状態を推定しているだけである。
- `herdr agent prompt` の前に必ず `herdr agent get` で相手が idle か確認する。
- reviewer に Herdr コマンドを実行させない。socket API は呼び出し元を認可しない。
