#!/usr/bin/env bash
set -eu
HOOK=$(cd "$(dirname "$0")/.." && pwd)/dot_local/bin/executable_git-worktree-copyfile

ver=$(git --version | awk '{print $3}')
if [[ $(printf '2.54\n%s\n' "$ver" | sort -V | head -1) != 2.54 ]]; then
    echo "SKIP: configured hook (hook.<name>.event) needs git >= 2.54, found $ver"
    exit 0
fi

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
export GIT_CONFIG_GLOBAL=$T/gitconfig GIT_CONFIG_SYSTEM=/dev/null
git config --global user.email t@t; git config --global user.name t
git config --global commit.gpgsign false
git config --global hook.wc.event post-checkout
git config --global hook.wc.command "$HOOK"

git init -q "$T/repo"; cd "$T/repo"
echo tracked > a.txt; git add a.txt; git commit -qm init
printf 'SECRET=1\n' > .env
mkdir -p config && echo '{}' > config/local.json
mkdir -p .venv && echo bin > .venv/marker
echo ignore > ignored.txt
git config --add worktree.copyfile .env
git config --add worktree.copyfile config/local.json
git config --add worktree.copyfile .venv
git config --add worktree.copyfile missing.txt
git config --add worktree.copyfile /etc/passwd
git config --add worktree.copyfile ../../escape.txt

git worktree add -q "$T/wt" -b feat
cd "$T/wt"
[[ $(cat .env) == 'SECRET=1' ]] || { echo FAIL: .env; exit 1; }
[[ -f config/local.json ]] || { echo FAIL: nested; exit 1; }
[[ -f .venv/marker ]] || { echo FAIL: dir; exit 1; }
[[ ! -e missing.txt ]] || { echo FAIL: missing; exit 1; }
[[ ! -e ignored.txt ]] || { echo FAIL: unconfigured file copied; exit 1; }
[[ ! -e passwd && ! -e etc ]] || { echo FAIL: absolute path; exit 1; }
[[ ! -e "$T/escape.txt" ]] || { echo FAIL: traversal; exit 1; }
[[ -f a.txt ]] || { echo FAIL: checkout; exit 1; }

# 通常の checkout ではコピーしない
cd "$T/repo"; rm -f .env
git checkout -q -b other
[[ ! -e .env ]] || { echo FAIL: plain checkout copied; exit 1; }

# clone でもコピーしない (common-dir == git-dir)
printf 'SECRET=1\n' > .env
cd "$T"; git clone -q "$T/repo" "$T/clone"
[[ ! -e "$T/clone/.env" ]] || { echo FAIL: clone copied; exit 1; }

# SHA-256 リポジトリ (null OID が 64 桁) でもコピーする
git init -q --object-format=sha256 "$T/sha256"; cd "$T/sha256"
echo tracked > a.txt; git add a.txt; git commit -qm init
printf 'SECRET=1\n' > .env
git config --add worktree.copyfile .env
git worktree add -q "$T/sha256-wt" -b feat
[[ -f "$T/sha256-wt/.env" ]] || { echo FAIL: sha256 repo; exit 1; }

# コピー先の親が worktree 外を指す symlink なら書き込まない
mkdir -p "$T/outside"
git init -q "$T/evil"; cd "$T/evil"
base=$(git symbolic-ref --short HEAD)
echo tracked > a.txt; git add a.txt; git commit -qm init
git checkout -q -b esc
ln -s "$T/outside" config; git add config; git commit -qm symlink
git checkout -q "$base"
mkdir -p config && echo '{}' > config/local.json
git config --add worktree.copyfile config/local.json
git worktree add -q "$T/evil-wt" esc
[[ ! -e "$T/outside/local.json" ]] || { echo FAIL: symlink escape; exit 1; }

# --separate-git-dir では common dir の親がメイン worktree ではない。
# 無関係なファイルを拾わず、何もせず抜ける
printf 'DECOY=1\n' > "$T/.env"
git init -q --separate-git-dir "$T/sgd-meta" "$T/sgd-repo"; cd "$T/sgd-repo"
echo tracked > a.txt; git add a.txt; git commit -qm init
git config --add worktree.copyfile .env
git worktree add -q "$T/sgd-wt" -b feat
[[ ! -e "$T/sgd-wt/.env" ]] || { echo FAIL: separate-git-dir copied a foreign file; exit 1; }

echo PASS
