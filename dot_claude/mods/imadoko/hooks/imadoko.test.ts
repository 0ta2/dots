import { describe, expect, test } from 'claude-code/testing'

import { EMPTY, activityOf, completeTurn, fallbackSummary, localeFor, parseSections, startTurn, statusFilePath, storedImadokoOf, summaryRequest, underHistory } from './imadoko'

describe('fallbackSummary は最終回答の最初の本文行を現状の代わりにする', () => {
  const cases: [string, string, string | undefined][] = [
    ['見出しを飛ばし強調を外す', '## 結論\n\n**方針を決めた。** 理由は 2 つ。', '方針を決めた。 理由は 2 つ。'],
    ['コードフェンスの行を飛ばす', '```ts\nconst x = 1\n```', 'const x = 1'],
    ['箇条書きの記号を外す', '- 一つ目の項目\n- 二つ目', '一つ目の項目'],
    ['番号つきの記号を外す', '1. 最初の手順', '最初の手順'],
    ['本文が無ければ無い', '# 見出しだけ\n\n', undefined],
  ]
  for (const [name, answer, expected] of cases) {
    test(name, () => {
      expect(fallbackSummary(answer)).toBe(expected)
    })
  }
})

describe('parseSections は Haiku の返答から概要を取り出す', () => {
  const task = { title: 't', state: 'doing', detail: 'd', owner: '', waitsOn: '' }
  const imadoko = { purpose: 'p', status: 's', tasks: [task], decisions: [], pending: [] }
  const cases: [string, string, unknown][] = [
    ['JSON だけの返答', JSON.stringify(imadoko), imadoko],
    ['前後に文があっても JSON の部分を読む', `Here it is:\n${JSON.stringify(imadoko)}\nDone.`, imadoko],
    ['目的が無ければ使えない', JSON.stringify({ ...imadoko, purpose: '' }), undefined],
    ['現状が無ければ使えない', JSON.stringify({ ...imadoko, status: 3 }), undefined],
    ['リストでない値は空にし、文字列でない項目を落とす', JSON.stringify({ ...imadoko, tasks: 'x', pending: ['a', 1] }), { ...imadoko, tasks: [], pending: ['a'] }],
    ['タスクは waits_on を読み、題名か状態の無いものを落とす', JSON.stringify({ ...imadoko, tasks: [{ title: 'w', state: 'waiting', detail: '', owner: 'R1', waits_on: 'merge' }, { title: '', state: 'next' }, { title: 'x', state: 'later' }] }), { ...imadoko, tasks: [{ title: 'w', state: 'waiting', detail: '', owner: 'R1', waitsOn: 'merge' }] }],
    ['担当は 2 文字までの記号だけを読み、長いものは空にする', JSON.stringify({ ...imadoko, tasks: [{ ...task, owner: 'I1' }, { ...task, title: 'u', owner: 'Codex' }] }), { ...imadoko, tasks: [{ ...task, owner: 'I1' }, { ...task, title: 'u', owner: '' }] }],
    ['済んだタスクは新しい方から 5 件まで、ほかは全部残す', JSON.stringify({ ...imadoko, tasks: [...Array.from({ length: 7 }, (_, index) => ({ ...task, title: `done ${index + 1}`, state: 'done' })), ...Array.from({ length: 7 }, (_, index) => ({ ...task, title: `wait ${index + 1}`, state: 'waiting' }))] }), { ...imadoko, tasks: [...Array.from({ length: 5 }, (_, index) => ({ ...task, title: `done ${index + 3}`, state: 'done' })), ...Array.from({ length: 7 }, (_, index) => ({ ...task, title: `wait ${index + 1}`, state: 'waiting' }))] }],
    ['壊れた JSON は使えない', '{"purpose": "p", ', undefined],
  ]
  for (const [name, reply, expected] of cases) {
    test(name, () => {
      expect(parseSections(reply)).toEqual(expected)
    })
  }
})

describe('activityOf は作業の進み具合を表すツール呼び出しだけを 1 行にする', () => {
  const cases: [string, string, Record<string, unknown>, string | undefined][] = [
    ['Bash は説明文を使う', 'Bash', { command: 'git push', description: 'Push the commits' }, 'Bash: Push the commits'],
    ['Bash に説明文が無ければコマンドの 1 行目', 'Bash', { command: 'make\nmake test' }, 'Bash: make'],
    ['Write はパス', 'Write', { file_path: '/a.ts', content: 'x' }, 'Write: /a.ts'],
    ['Agent は説明文', 'Agent', { description: 'Review the diff', prompt: '...' }, 'Agent: Review the diff'],
    ['MCP ツールは名前', 'mcp__github__create_issue', { title: 't' }, 'mcp__github__create_issue'],
    ['読むだけのツールは数えない', 'Read', { file_path: '/a.ts' }, undefined],
  ]
  for (const [name, tool, input, expected] of cases) {
    test(name, () => {
      expect(activityOf(tool, input)).toBe(expected)
    })
  }
})

describe('localeFor は Claude Code の language 設定から見出しの言語と Haiku の言語を決める', () => {
  const cases: [string, unknown, string, string][] = [
    ['未設定は英語', undefined, 'Purpose', 'English'],
    ['Japanese は日本語の見出し', 'Japanese', '目的', 'Japanese'],
    ['日本語 も日本語の見出し', '日本語', '目的', '日本語'],
    ['ja も日本語の見出し', 'ja', '目的', 'ja'],
    ['ほかの言語は英語の見出しで、Haiku はその言語で書く', 'French', 'Purpose', 'French'],
  ]
  for (const [name, setting, purpose, language] of cases) {
    test(name, () => {
      const locale = localeFor(setting)
      expect([locale.words.purpose, locale.language]).toEqual([purpose, language])
    })
  }
})

describe('storedImadokoOf は保存した概要の使用量の累計を読み、記録を始める前のものは 0 から数える', () => {
  const sections = { purpose: 'p', status: 's', tasks: [], decisions: [], pending: [] }
  const ZERO = { calls: 0, inputTokens: 0, outputTokens: 0 }
  const kept = { calls: 3, inputTokens: 4_200, outputTokens: 1_300 }
  const cases: [string, unknown, unknown][] = [
    ['累計があればそのまま読む', kept, kept],
    ['累計の無い古い保存は 0 にする', undefined, ZERO],
    ['回数が数でない累計は 0 にする', { ...kept, calls: '3' }, ZERO],
    ['入力トークンが数でない累計は 0 にする', { ...kept, inputTokens: null }, ZERO],
    ['出力トークンの無い累計は 0 にする', { calls: 3, inputTokens: 4_200 }, ZERO],
    ['負の値を持つ累計は 0 にする', { ...kept, outputTokens: -1 }, ZERO],
  ]
  for (const [name, usage, expected] of cases) {
    test(name, () => {
      const stored = { sections, turnKey: 'v1:x', savedAt: 1, ...(usage === undefined ? {} : { usage }) }
      expect(storedImadokoOf(stored)).toEqual({ sections, turnKey: 'v1:x', savedAt: 1, usage: expected })
    })
  }
})

describe('startTurn はエンジンが書き込んだタグだけを依頼でないとみなす', () => {
  const cases: [string, string, string | null][] = [
    ['タグで始まる依頼は依頼として読む', '<task>implement this</task>', '<task>implement this</task>'],
    ['system-reminder は依頼でない', '<system-reminder>注入</system-reminder>', null],
    ['task-notification は依頼でない', '<task-notification>done</task-notification>', null],
    ['local-command-stdout は依頼でない', '<local-command-stdout>ok</local-command-stdout>', null],
  ]
  for (const [name, text, ask] of cases) {
    test(name, () => {
      expect(startTurn(EMPTY, text).turns[0]?.ask).toBe(ask)
    })
  }
})

describe('underHistory は再開したセッションの履歴の後ろに、読み込み前に始まったターンをつなぐ', () => {
  const live = startTurn(EMPTY, '同じ依頼')

  test('同じ依頼を繰り返しても、回答のある前のターンは履歴として残す', () => {
    const history = completeTurn(startTurn(EMPTY, '同じ依頼'), '前の回答')
    const joined = underHistory(live, history, undefined)
    expect(joined.turns.map(turn => [turn.turn, turn.ask, turn.answer])).toEqual([
      [1, '同じ依頼', '前の回答'],
      [2, '同じ依頼', null],
    ])
  })

  test('transcript に写った読み込み中のターンは重ねない', () => {
    const history = startTurn(completeTurn(startTurn(EMPTY, '前の依頼'), '前の回答'), '同じ依頼')
    expect(underHistory(live, history, undefined).turns.map(turn => turn.ask)).toEqual(['前の依頼', '同じ依頼'])
  })

  test('compact の要約だけの履歴でも、その要約を引き継ぐ', () => {
    expect(underHistory(live, { ...EMPTY, background: '要約' }, undefined).background).toBe('要約')
  })
})

describe('summaryRequest はメンバーの一覧があるときだけ記号と説明を渡す', () => {
  const turn = completeTurn(startTurn(EMPTY, '依頼'), '回答')
  const cases: [string, { mark: string; about: string }[], string | undefined][] = [
    ['一覧があれば 1 人 1 行', [{ mark: 'I1', about: 'impl-dots-claude' }, { mark: 'R1', about: 'review-dots-codex' }], '<members>\n- I1: impl-dots-claude\n- R1: review-dots-codex\n</members>'],
    ['一覧が無ければ何も足さない', [], undefined],
  ]
  for (const [name, members, expected] of cases) {
    test(name, () => {
      expect(summaryRequest(turn, localeFor(undefined), members).prompt.match(/<members>[\s\S]*<\/members>/)?.[0]).toBe(expected)
    })
  }
})

describe('statusFilePath は herdr のワークスペースとペインが分かるときだけ書き出し先を決める', () => {
  const cases: [string, string | undefined, string | undefined, string | undefined, string | undefined][] = [
    ['全部あればワークスペースの下にペインの名前で', '/home/u', 'ws1', 'p2', '/home/u/.local/state/imadoko/ws1/p2.json'],
    ['ワークスペースが無ければ無い', '/home/u', undefined, 'p2', undefined],
    ['ペインが空なら無い', '/home/u', 'ws1', '', undefined],
    ['HOME が無ければ無い', undefined, 'ws1', 'p2', undefined],
  ]
  for (const [name, home, workspace, pane, expected] of cases) {
    test(name, () => {
      expect(statusFilePath(home, workspace, pane)).toBe(expected)
    })
  }
})
