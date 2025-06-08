fbr() {
    local branches branch
    branches=$(git branch -vv) &&
    branch=$(echo "$branches" | fzf) &&
    git checkout $(echo "$branch" | sed 's/^..//;s/ .*//')
}
