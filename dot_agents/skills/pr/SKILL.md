---
name: pr
description: GitHub の Pull Request を作成・更新する。PR作成、プルリクエスト作成、PR更新、gh pr create、gh pr edit の場合に使用する。
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(git status), Bash(git log*), Bash(git diff*), Bash(git branch*), Bash(git add*), Bash(git commit*), Bash(git push*), Bash(gh pr create*), Bash(gh pr view*), Bash(gh pr edit*), Bash(gh pr list*), Bash(ls*), Glob, Read
---

# PR スキル

## 事前確認：作成 or 更新の判断

まず次のコマンドを並列で実行して現在の状態を把握する:
- `git branch --show-current` で現在のブランチ名を確認
- `gh pr list --head <ブランチ名> --state open` でオープンなPRの有無を確認

- **PRが存在しない** → [PR作成フロー](#pr-作成フロー)へ
- **PRが存在する** → [PR更新フロー](#pr-更新フロー)へ

---

## PR 作成フロー

1. 次のコマンドを並列で実行して現在の状態を把握する
   - `git status` で未追跡ファイルを確認
   - `git log --oneline -10` で最近のコミット履歴を確認
   - `git diff main...HEAD` でベースブランチとの差分を確認（ベースブランチは状況に応じて `main` or `master`）

2. 未コミットファイルの確認
   - `git status` の結果に未コミットファイルがある場合、PR に含めるべきか判断する
   - `specs/` `plans/` `docs/superpowers/` 配下の設計ドキュメントは**コミットしない**（作業用ファイルであり成果物ではない）
   - それ以外のドキュメント（README 更新等）で PR に含めるべきものがあればコミットする

3. PR テンプレートの有無を確認する
   - 以下の優先順位で探す:
     1. `.github/PULL_REQUEST_TEMPLATE.md`
     2. `.github/pull_request_template.md`
     3. `.github/PULL_REQUEST_TEMPLATE/` ディレクトリ内のファイル
   - テンプレートが見つかった場合はその内容を確認し、PR本文のベースとして使用する
   - テンプレートが見つからない場合は後述のデフォルトフォーマットを使用する

4. 現在のブランチをリモートに push する（未 push の場合）
   ```bash
   git push -u origin <ブランチ名>
   ```

5. `gh pr create` コマンドで PR を作成する
   - タイトルは後述のルールに従って生成する
   - 本文は HEREDOC を使って渡す
   - `--draft` フラグを付けてドラフト PR として作成する

### テンプレートがある場合

テンプレートの内容に従って各セクションを埋める。**本文の先頭に `## Scope Lock` を足す**
(後述)。テンプレート側の節は消さず並べ替えもしない:

```bash
gh pr create --draft --title "タイトル" --body "$(cat <<'EOF'
## Scope Lock

- やること:
- やらないこと:
- 受け入れ条件:
- この PR の判定に含めないもの:

<!-- テンプレートの内容に従って記載 -->
EOF
)"
```

### テンプレートがない場合（デフォルトフォーマット）

```bash
gh pr create --draft --title "タイトル" --body "$(cat <<'EOF'
## Scope Lock

- やること:
- やらないこと:
- 受け入れ条件:
- この PR の判定に含めないもの:

## 変更内容

- 変更点1
- 変更点2

## 変更の理由

なぜこの変更が必要かを記載する

## テスト

- [ ] 動作確認済み

🤖 Generated with <Claude Code または Codex>
EOF
)"
```

Scope Lock はレビュアが判定範囲として読む節。

- **やらないこと** / **判定に含めないもの** に挙げたものは、レビュアは指摘にしない
  (別 PR の番号 / accepted risk / technical debt を、参照で具体的に指す)。ただし**この PR の
  差分が新たに持ち込んだ Blocker は Scope Lock に関係なく指摘される**
- 除外事項をレビュー依頼文で毎回組み立て直さずに済ませるための節。ラウンドをまたいで
  前提がブレないよう、レビュー中に増えた除外事項はここに追記する
- 除外するものが無ければ、その項目は `なし` と書く (節ごと落とさない)
- accepted risk / technical debt は **参照で書く** (Issue 番号・チケット ID)。未修正の弱点の
  内容そのものは PR 本文に書かない (public リポジトリなら誰でも読め、履歴として消えない)

6. PR 作成後に `gh pr view` で URL を確認してユーザーに知らせる

---

## PR 更新フロー

コード変更が無くても、レビュー中に除外事項が決まったときは本文の更新だけでこのフローを使う
(Scope Lock の「この PR の判定に含めないもの」に追記する)。

1. 次のコマンドを並列で実行して現在の状態を把握する
   - `git log --oneline -10` で最近のコミット履歴を確認
   - `git diff main...HEAD` でベースブランチとの差分を確認
   - `gh pr view` で現在のPRタイトル・本文を確認

2. 現在のブランチをリモートに push する（未 push のコミットがある場合）
   ```bash
   git push
   ```

3. 変更内容をもとにPRのタイトル・本文を更新する
   - 既存の本文に新しい変更内容を追記・修正する
   - タイトルも変更内容を反映して必要であれば更新する

   ```bash
   gh pr edit --title "新しいタイトル" --body "$(cat <<'EOF'
   ## Scope Lock

   - やること: （既存の内容をそのまま残す）
   - やらないこと: （既存の内容をそのまま残す）
   - 受け入れ条件: （既存の内容をそのまま残す）
   - この PR の判定に含めないもの: （既存 + レビューで新たに除外が決まったもの）

   ## 変更内容

   - 変更点1（既存）
   - 変更点2（新規追加）

   ## 変更の理由

   なぜこの変更が必要かを記載する

   ## テスト

   - [ ] 動作確認済み

   🤖 Generated with <Claude Code または Codex>
   EOF
   )"
   ```

   `gh pr edit --body` は本文を全置換するので、**手順 1 で読んだ既存の Scope Lock を必ず
   本文に含める。** 省くと空の節で上書きされ、レビュアが読む判定範囲が無言で消える。

4. 更新後に `gh pr view` で URL を確認してユーザーに知らせる

---

## PR タイトルの生成ルール

コミット履歴と diff を分析し、PR 全体の変更をひと言で表すタイトルを生成する。

### フォーマット

```
<タイプ>(<スコープ>): <件名（日本語）>
```

スコープが自明な場合や複数にまたがる場合は省略可能:

```
<タイプ>: <件名（日本語）>
```

### タイプ

| タイプ     | 用途                                         |
| ---------- | -------------------------------------------- |
| `feat`     | 新機能を追加した                             |
| `fix`      | バグを修正した                               |
| `refactor` | リファクタリングした（機能変更なし）         |
| `revert`   | 以前のコミットを取り消した                   |
| `style`    | コードの見た目を変更した（ロジック変更なし） |
| `docs`     | ドキュメントを追加・更新した                 |
| `test`     | テストを追加・修正した                       |
| `chore`    | ビルドや設定ファイルを変更した               |
| `perf`     | パフォーマンスを改善した                     |
| `ci`       | CI/CD の設定を変更した                       |

### 件名のルール

- 言語: 日本語で記載
- 50文字以内を推奨
- 文末にピリオド（。）は不要
- 「何をしたか」を端的に表す（体言止め・過去形・現在形どれでも可）
- 複数の変更がある場合は最も重要な変更を代表させる

### 良い例 / 悪い例

```
✅ feat(nvim): telescope のキーバインドを追加
✅ fix(ghostty): ghostty のフォントサイズ設定を修正
✅ chore(brew): Brewfile に ripgrep を追加
❌ 設定を更新した（何を更新したか不明）
❌ fix: 修正（内容が不明）
❌ Various changes and improvements（英語・曖昧）
```

---

## 注意事項

- PR のベースブランチはリポジトリのデフォルトブランチ（通常 `main` または `master`）を使用する
- コミット履歴から変更の全体像を把握した上で PR タイトル・本文を作成・更新する
- PR はドラフトとして作成する（`--draft` フラグを使用）
- push は明示的に依頼がない限り確認してから実施する
- `--force` push は使わない
