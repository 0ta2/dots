import { expect, test } from 'claude-code/testing'

import { isDangerous, linkRefs, segmentsOf } from './segments'

test('headings and callouts split out of the markdown, fences left alone', () => {
  const text = ['## 結論', '本文', '> [!IMPORTANT]', '> 判断してください', '> [!NOTE] x', '> [!WARNING]', '> 気をつける', '後の文', '```', '## コード内', '```'].join('\n')
  expect(segmentsOf(text)).toEqual([
    { kind: 'heading', level: 2, text: '結論' },
    { kind: 'markdown', text: '本文' },
    { kind: 'callout', callout: 'important', text: '判断してください\n[!NOTE] x' },
    { kind: 'callout', callout: 'warning', text: '気をつける' },
    { kind: 'markdown', text: '後の文\n```\n## コード内\n```' },
  ])
})

test('owner/repo#123 links to GitHub except inside inline code', () => {
  expect(linkRefs('see 0ta2/dots#181 and `0ta2/dots#1`')).toBe('see [0ta2/dots#181](https://github.com/0ta2/dots/issues/181) and `0ta2/dots#1`')
})

test('commands that are hard to undo are dangerous', () => {
  for (const command of ['rm -rf x', 'cd a && git push', 'git reset --hard', 'sudo ls', 'gh pr merge 1 --merge', 'mise run chezmoi:apply']) expect(isDangerous(command)).toBe(true)
  for (const command of ['ls', 'git status', 'git log', 'grep rm file', 'gh pr view 1']) expect(isDangerous(command)).toBe(false)
})

test('code spans of several backticks and nested fences are left alone', () => {
  expect(linkRefs('see ``0ta2/dots#181`` and 0ta2/dots#2')).toBe('see ``0ta2/dots#181`` and [0ta2/dots#2](https://github.com/0ta2/dots/issues/2)')
  const text = ['````md', '```', '## 例の中', '```', '````', '## 外'].join('\n')
  expect(segmentsOf(text)).toEqual([
    { kind: 'markdown', text: '````md\n```\n## 例の中\n```\n````' },
    { kind: 'heading', level: 2, text: '外' },
  ])
})
