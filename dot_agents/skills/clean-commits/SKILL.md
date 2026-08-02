---
name: clean-commits
description: ブランチのコミット履歴を整理する。fix を squash したい、コミットをまとめたい、コミット履歴をきれいにしたい場合に使用する。
user-invocable: true
allowed-tools: Bash(git log*), Bash(git rebase*), Bash(git commit*), Bash(git reset*), Bash(git status*), Bash(git add*), Bash(cat*), Bash(chmod*)
---

# コミット整理スキル

## fix コミットのポリシー

| 責任領域                             | 方針                                        |
| ------------------------------------ | ------------------------------------------- |
| 自分のコード                         | main マージ前に関連 feat へ squash して消す |
| 外部プラグイン・ライブラリの設定変更 | fix コミットとして残す                      |

## 手順

### 1. コミット一覧の確認

```bash
git log --oneline <ブランチ> --not main --stat
```

変更ファイルで論理グループを判断する。別ファイルの変更は順序変更してもコンフリクトしない。

### 2. 整理方針をユーザーに提示して確認する

- fix コミットのポリシーを適用してグループを提案する
- squash 後のコミットメッセージも合わせて提案する
- 承認を得てから実行する

### 3. 非インタラクティブな rebase（squash・順序変更）

```bash
cat > /tmp/rebase-seq.sh << 'SCRIPT'
#!/bin/bash
cat > "$1" << 'EOF'
pick <hash> <message>
fixup <hash> <message>
pick <hash> <message>
fixup <hash> <message>
EOF
SCRIPT
chmod +x /tmp/rebase-seq.sh

BASE=$(git merge-base <branch> main)
GIT_SEQUENCE_EDITOR=/tmp/rebase-seq.sh git rebase -i $BASE
```

fixup は pick の直前コミットのメッセージを使う。メッセージを変えたい場合は後で `git commit --amend` する。

### 4. コミットの split（1 コミットを複数に分割）

```bash
cat > /tmp/edit-seq.sh << 'SCRIPT'
#!/bin/bash
sed -i '' 's/^pick <hash>/edit <hash>/' "$1"
SCRIPT
chmod +x /tmp/edit-seq.sh

GIT_SEQUENCE_EDITOR=/tmp/edit-seq.sh git rebase -i HEAD~<N>

# rebase が止まったら分割
git reset HEAD~
git add <file1>
git commit -m "feat: ..."
git add <file2>
git commit -m "fix: ..."
git rebase --continue
```

### 5. コミットメッセージの修正

HEAD のメッセージを変える場合:

```bash
git commit --amend -m "新しいメッセージ"
```

## 注意事項

- macOS の sed は `-i ''` を使う（Linux は `-i` のみ）
- rebase sequence のコミットハッシュは短縮形（7 文字）でよい
- リモートへ push 済みのブランチは rebase 後に force push が必要になる。事前に確認する
