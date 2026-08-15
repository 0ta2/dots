#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["tomlkit"]
# ///
"""dots が宣言する managed.toml を ~/.codex/config.toml へ差分マージする。

managed.toml に列挙されたトップレベルキーだけを上書きする。projects/notice/tui/
marketplaces/notify のような Codex Desktop・CLI が書き込む state はここでは
一切扱わない (managed.toml に書かないことで保護される)。tomlkit で読み書きする
ことで、コメントや managed.toml が知らないキーをそのまま残す。
"""

import pathlib
import sys
import tomllib

import tomlkit

# Codex Desktop/CLI がランタイムで書き込む state。managed.toml に紛れ込んでも
# 上書きしないための最終防衛線 (通常は managed.toml 側で書かない運用)。
DESKTOP_STATE_KEYS = {"projects", "notice", "tui", "marketplaces", "notify"}

CONFIG_PATH = pathlib.Path.home() / ".codex" / "config.toml"
MANAGED_PATH = pathlib.Path(__file__).parent / "managed.toml"


def merge(config_text: str, managed: dict) -> str:
    doc = tomlkit.parse(config_text)
    for key, value in managed.items():
        if key in DESKTOP_STATE_KEYS:
            raise ValueError(f"managed.toml に Desktop state のキー '{key}' は書けない")
        doc[key] = value
    return tomlkit.dumps(doc)


def main() -> None:
    managed = tomllib.loads(MANAGED_PATH.read_text())
    config_text = CONFIG_PATH.read_text() if CONFIG_PATH.exists() else ""
    merged = merge(config_text, managed)
    if merged != config_text:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(merged)
        print(f"codex-config-sync: updated {CONFIG_PATH}")
    else:
        print("codex-config-sync: no change")


def demo() -> None:
    before = 'model = "old"\n\n[projects."/x"]\ntrust_level = "trusted"\n'
    managed = {"model": "new", "sandbox_mode": "workspace-write"}

    once = merge(before, managed)
    twice = merge(once, managed)
    assert once == twice, "sync は冪等でなければならない"
    assert 'model = "new"' in once
    assert 'sandbox_mode = "workspace-write"' in once
    assert '[projects."/x"]' in once and 'trust_level = "trusted"' in once, (
        "managed.toml にないキー(projects)は保持されなければならない"
    )

    for key in DESKTOP_STATE_KEYS:
        try:
            merge(before, {key: "x"})
        except ValueError:
            pass
        else:
            raise AssertionError(f"Desktop state キー '{key}' の上書きは拒否されなければならない")

    print("demo ok")


if __name__ == "__main__":
    if "--demo" in sys.argv:
        demo()
    else:
        main()
