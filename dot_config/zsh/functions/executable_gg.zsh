gg() {
    local git_root
    if git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
        cd "${git_root}"
    fi
}

