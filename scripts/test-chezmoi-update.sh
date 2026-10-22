#!/usr/bin/env bash
set -euo pipefail

UPDATE=$(cd "$(dirname "$0")" && pwd)/chezmoi-update.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export GIT_CONFIG_GLOBAL="$work/gitconfig"
export GIT_CONFIG_NOSYSTEM=1
: >"$GIT_CONFIG_GLOBAL"

fail() { echo "FAIL: $*" >&2; exit 1; }
commit() {
    git -C "$1" -c user.name=test -c user.email=test@example.com commit -qm "$2"
}

git init -q --bare "$work/origin.git"
git clone -q "$work/origin.git" "$work/publisher"
printf 'base\n' >"$work/publisher/dotfile"
git -C "$work/publisher" add dotfile
commit "$work/publisher" base
git -C "$work/publisher" push -qu origin HEAD

git clone -q "$work/origin.git" "$work/fast-forward"
printf 'first update\n' >>"$work/publisher/dotfile"
git -C "$work/publisher" add dotfile
commit "$work/publisher" first-update
git -C "$work/publisher" push -q
"$UPDATE" "$work/fast-forward"
[[ "$(git -C "$work/fast-forward" rev-parse HEAD)" == "$(git -C "$work/publisher" rev-parse HEAD)" ]] \
    || fail "fast-forward did not reach upstream"

git clone -q "$work/origin.git" "$work/dirty"
printf 'second update\n' >>"$work/publisher/dotfile"
git -C "$work/publisher" add dotfile
commit "$work/publisher" second-update
git -C "$work/publisher" push -q
dirty_head=$(git -C "$work/dirty" rev-parse HEAD)
printf 'local work\n' >"$work/dirty/untracked"
if "$UPDATE" "$work/dirty"; then fail "dirty worktree was updated"; fi
[[ "$(git -C "$work/dirty" rev-parse HEAD)" == "$dirty_head" ]] || fail "dirty worktree HEAD changed"
[[ -f "$work/dirty/untracked" ]] || fail "dirty file was removed"

git clone -q "$work/origin.git" "$work/conflicted"
printf 'local conflict\n' >"$work/conflicted/dotfile"
git -C "$work/conflicted" add dotfile
commit "$work/conflicted" local-conflict
printf 'remote conflict\n' >"$work/publisher/dotfile"
git -C "$work/publisher" add dotfile
commit "$work/publisher" remote-conflict
git -C "$work/publisher" push -q
if git -C "$work/conflicted" pull --no-rebase; then fail "test setup did not create a conflict"; fi
if "$UPDATE" "$work/conflicted"; then fail "conflicted worktree was updated"; fi
git -C "$work/conflicted" rev-parse -q --verify MERGE_HEAD >/dev/null || fail "conflict state was changed"
git -C "$work/conflicted" diff --name-only --diff-filter=U | grep -qx dotfile || fail "conflict was changed"

git clone -q "$work/origin.git" "$work/diverged"
git -C "$work/diverged" config pull.rebase true
printf 'local commit\n' >"$work/diverged/local"
git -C "$work/diverged" add local
commit "$work/diverged" local
printf 'third update\n' >>"$work/publisher/dotfile"
git -C "$work/publisher" add dotfile
commit "$work/publisher" third-update
git -C "$work/publisher" push -q
diverged_head=$(git -C "$work/diverged" rev-parse HEAD)
if "$UPDATE" "$work/diverged"; then fail "diverged branch was updated"; fi
[[ "$(git -C "$work/diverged" rev-parse HEAD)" == "$diverged_head" ]] || fail "diverged branch HEAD changed"
[[ -z "$(git -C "$work/diverged" status --porcelain)" ]] || fail "diverged worktree changed"

echo PASS
