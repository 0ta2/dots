#!/usr/bin/env bash
# Safely fast-forward the chezmoi source before applying it.
set -euo pipefail

source_dir=${1:?usage: chezmoi-update.sh <source-dir>}

die() {
    echo "chezmoi:update: $*" >&2
    exit 1
}

git -C "$source_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "source is not a Git worktree: $source_dir"

if [[ -n "$(git -C "$source_dir" status --porcelain)" ]]; then
    die "source has uncommitted changes; commit, stash, or discard them yourself before updating"
fi

git_dir=$(git -C "$source_dir" rev-parse --path-format=absolute --git-dir)
for ref in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
    git -C "$source_dir" rev-parse -q --verify "$ref" >/dev/null 2>&1 \
        && die "source has an in-progress Git operation; resolve it yourself before updating"
done
[[ ! -d "$git_dir/rebase-apply" && ! -d "$git_dir/rebase-merge" ]] \
    || die "source has an in-progress rebase; resolve it yourself before updating"

git -C "$source_dir" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1 \
    || die "current branch has no upstream; configure one before updating"

echo "chezmoi:update: fast-forwarding $source_dir"
git -C "$source_dir" pull --ff-only
