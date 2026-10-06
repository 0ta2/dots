import type { MemberState as Status, Role } from '../types'

export const WIDTH = 10
export const HEIGHT = 6
const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584

type Palette = Record<string, number>

const COMMON: Palette = { s: 0xffd6a5, e: 0x222222, k: 0x6c584c, m: 0xe5383b, l: 0x4a4e69, r: 0xff0054, w: 0xffffff, t: 0xffe066 }

const ROLES: Record<Role, Palette> = {
  impl: { y: 0xfcbf49, h: 0xf77f00, b: 0x3a86ff },
  review: { y: 0x00b4d8, h: 0x2b2d42, b: 0x06d6a0 },
  member: { y: 0xced4da, h: 0x8d99ae, b: 0xadb5bd },
}

const KINDS: Record<string, Palette> = {
  claude: { o: 0xd97757, e: 0x1a1a1a },
  codex: { u: 0x7b8cff, U: 0x4a55d6, d: 0x1b1f4a, w: 0xffffff },
}

const HELMET = '..hhyyhh..'

function stamp(rows: string[], at: [number, number], mark: string[]) {
  mark.forEach((line, dy) => {
    const y = at[0] + dy
    const row = rows[y]!.split('')
    ;[...line].forEach((c, dx) => {
      if (c !== '.') row[at[1] + dx] = c
    })
    rows[y] = row.join('')
  })
}

function human(role: Role, status: Status, odd: boolean): string[] {
  const isSleepy = status === 'idle' || status === 'done'
  const isTyping = status === 'working' && odd
  return [
    role === 'impl' ? HELMET : '...hhhh...',
    '...ssss...',
    isSleepy ? '...ssss...' : role === 'review' ? '..yeyyey..' : '...esse...',
    isTyping ? '.sbbbbbbs.' : '..bbbbbb..',
    isTyping ? '..bbbbbb..' : '.sbbbbbbs.',
    '...l..l...',
  ]
}

function clawd(role: Role, status: Status, odd: boolean): string[] {
  const isSleepy = status === 'idle' || status === 'done'
  const isCheer = status === 'done'
  const isTyping = status === 'working' && odd
  const rows = [
    role === 'impl' ? HELMET : '..........',
    '.oooooooo.',
    isSleepy ? '.oooooooo.' : '.oeooooeo.',
    isCheer || isTyping ? '.oooooooo.' : 'oooooooooo',
    isTyping ? 'oooooooooo' : '.oooooooo.',
    '.o.o..o.o.',
  ]
  if (isCheer) stamp(rows, [1, 0], ['o........o'])
  if (role === 'review') stamp(rows, [2, 1], [isSleepy ? 'yyyooyyy' : 'yeyooyey'])
  return rows
}

function codexPet(role: Role, status: Status, odd: boolean): string[] {
  const isTyping = status === 'working' && odd
  const prompt = status === 'idle' || status === 'done' ? 'l' : 'w'
  const cursor = isTyping || status === 'idle' ? 'dd' : 'ww'
  const rows = [
    role === 'impl' ? HELMET : '..uu..uu..',
    '.uuuuuuuu.',
    `.ud${prompt}ddddu.`,
    `.udd${prompt}d${cursor}u.`,
    isTyping ? 'uuuuuuuuuu' : '.uuuuuuuu.',
    '..UU..UU..',
  ]
  if (status === 'done') stamp(rows, [3, 0], ['u........u'])
  if (role === 'review') stamp(rows, [2, 0], ['y........y', 'y........y'])
  return rows
}

export function pixels(role: Role, status: Status, frame: number, kind?: string): string[] {
  const odd = frame % 2 === 1
  const rows = kind === 'claude' ? clawd(role, status, odd) : kind === 'codex' ? codexPet(role, status, odd) : human(role, status, odd)
  if (status === 'blocked' && !odd) stamp(rows, [0, 9], ['r', 'r', '.', 'r'])
  if (status === 'idle') stamp(rows, [0, odd ? 8 : 9], ['w'])
  if (status === 'done') stamp(rows, [0, 0], [odd ? 't.' : '.t', odd ? '.t' : 't.'])
  return rows
}

const gray = (c: number) => {
  const v = Math.round(((c >> 16) & 0xff) * 0.3 + ((c >> 8) & 0xff) * 0.59 + (c & 0xff) * 0.11)
  return (v << 16) | (v << 8) | v
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

export function cells(role: Role, status: Status, frame: number, kind?: string): string {
  const palette = { ...COMMON, ...ROLES[role], ...(kind ? KINDS[kind] : undefined) }
  const isFaded = status === 'unknown' || status === 'absent'
  const color = (c: string) => {
    const v = palette[c]
    return v === undefined ? undefined : isFaded ? gray(v) : v
  }
  const rows = pixels(role, status, frame, kind)
  const words = new Uint32Array(WIDTH * (HEIGHT / 2) * 3)
  for (let y = 0; y < HEIGHT / 2; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const top = color(rows[y * 2]![x]!)
      const bottom = color(rows[y * 2 + 1]![x]!)
      const i = (y * WIDTH + x) * 3
      if (top !== undefined) words.set([UPPER, top, bottom ?? DEFAULT], i)
      else if (bottom !== undefined) words.set([LOWER, bottom, DEFAULT], i)
      else words.set([0x20, DEFAULT, DEFAULT], i)
    }
  }
  return base64(new Uint8Array(words.buffer))
}
