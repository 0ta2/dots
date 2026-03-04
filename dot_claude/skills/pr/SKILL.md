---
name: pr
description: GitHub の Pull Request を作成・更新する。PR作成、プルリクエスト作成、PR更新、gh pr create、gh pr edit の場合に使用する。
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash(git status), Bash(git log*), Bash(git diff*), Bash(git branch*), Bash(git push*), Bash(gh pr create*), Bash(gh pr view*), Bash(gh pr edit*), Bash(gh pr list*), Bash(ls*), Glob, Read
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

2. PR テンプレートの有無を確認する
   - 以下の優先順位で探す:
     1. `.github/PULL_REQUEST_TEMPLATE.md`
     2. `.github/pull_request_template.md`
     3. `.github/PULL_REQUEST_TEMPLATE/` ディレクトリ内のファイル
     4. `docs/PULL_REQUEST_TEMPLATE.md`
   - テンプレートが見つかった場合はその内容を確認し、PR本文のベースとして使用する
   - テンプレートが見つからない場合は後述のデフォルトフォーマットを使用する

3. 現在のブランチをリモートに push する（未 push の場合）
   ```bash
   git push -u origin <ブランチ名>
   ```

4. `gh pr create` コマンドで PR を作成する
   - タイトルは50文字以内で日本語で記載する
   - 本文は HEREDOC を使って渡す

### テンプレートがある場合

テンプレートの内容に従って各セクションを埋める:

```bash
gh pr create --title "タイトル" --body "$(cat <<'EOF'
<!-- テンプレートの内容に従って記載 -->
EOF
)"
```

### テンプレートがない場合（デフォルトフォーマット）

```bash
gh pr create --title "タイトル" --body "$(cat <<'EOF'
## 変更内容

- 変更点1
- 変更点2

## 変更の理由

なぜこの変更が必要かを記載する

## テスト

- [ ] 動作確認済み

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

5. PR 作成後に `gh pr view` で URL を確認してユーザーに知らせる

---

## PR 更新フロー

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
   ## 変更内容

   - 変更点1（既存）
   - 変更点2（新規追加）

   ## 変更の理由

   なぜこの変更が必要かを記載する

   ## テスト

   - [ ] 動作確認済み

   🤖 Generated with [Claude Code](https://claude.ai/claude-code)
   EOF
   )"
   ```

4. 更新後に `gh pr view` で URL を確認してユーザーに知らせる

---

## 注意事項

- PR のベースブランチはリポジトリのデフォルトブランチ（通常 `main` または `master`）を使用する
- タイトルは変更内容を端的に表す日本語で記載する
- コミット履歴から変更の全体像を把握した上で PR 本文を作成・更新する
- push は明示的に依頼がない限り確認してから実施する
- `--force` push は使わない
