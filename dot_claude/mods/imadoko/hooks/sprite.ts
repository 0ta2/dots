import type { MemberState as Status, Role } from '../types'

export const SIZE = 12
const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584

type Palette = Record<string, number>

const COMMON: Palette = { s: 0xffd6a5, e: 0x222222, k: 0x6c584c, m: 0xe5383b, l: 0x4a4e69, r: 0xff0054, w: 0xffffff, t: 0xffe066 }

const ROLES: Record<Role, { palette: Palette; hat: string[]; eyes?: string }> = {
  impl: { palette: { y: 0xfcbf49, h: 0xf77f00, b: 0x3a86ff }, hat: ['hhhh', 'hhhyyhhh', 'hhhhhhhhhh'] },
  review: { palette: { y: 0x00b4d8, h: 0x2b2d42, b: 0x06d6a0 }, hat: ['', 'hhhhhh', 'hhhhhhhh'], eyes: 'yeyyey' },
  member: { palette: { y: 0xced4da, h: 0x8d99ae, b: 0xadb5bd }, hat: ['', 'hhhhhh', 'hhhhhhhh'] },
}

const KINDS: Record<string, Palette> = {
  claude: { o: 0xd97757, e: 0x1a1a1a },
  codex: { u: 0x7b8cff, U: 0x4a55d6, d: 0x1b1f4a, w: 0xffffff },
}

const MASCOT_HATS: Record<Role, string[]> = {
  impl: ['', 'hhhh', 'hhhyyhhh'],
  review: ['', '', ''],
  member: ['', '', ''],
}

const center = (row: string) => {
  const left = Math.floor((SIZE - row.length) / 2)
  return '.'.repeat(left) + row + '.'.repeat(SIZE - row.length - left)
}

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
  const { hat, eyes } = ROLES[role]
  const isSleepy = status === 'idle' || status === 'done'
  const isCheer = status === 'done'
  const isTyping = status === 'working' && odd
  const face = [
    'ssssss',
    isSleepy ? (eyes ? 'ykyyky' : 'ssssss') : (eyes ?? 'sesses'),
    isSleepy && !eyes ? 'skssks' : 'ssssss',
    status === 'blocked' ? 'sssmss' : 'ssmmss',
  ]
  return [
    ...hat.map(center),
    center(face[0]!),
    center(face[1]!),
    isCheer ? center('s.' + face[2]! + '.s') : center(face[2]!),
    isCheer ? center('s.' + face[3]! + '.s') : center(face[3]!),
    center(isTyping ? 'sbbbbbbbbs' : 'bbbbbbbb'),
    center(isTyping || isCheer ? 'bbbbbbbb' : 'sbbbbbbbbs'),
    center('bbbbbbbb'),
    center('ll..ll'),
    center('kk..kk'),
  ]
}

function clawd(role: Role, status: Status, odd: boolean): string[] {
  const isSleepy = status === 'idle' || status === 'done'
  const isCheer = status === 'done'
  const isTyping = status === 'working' && odd
  const rows = [
    ...MASCOT_HATS[role].map(center),
    center('oooooooo'),
    center(isSleepy ? 'oooooooo' : 'oeooooeo'),
    isCheer ? 'oooeooooeooo' : center('oeooooeo'),
    isCheer || isTyping ? center('oooooooo') : 'oooooooooooo',
    isTyping ? 'oooooooooooo' : center('oooooooo'),
    center('oooooooo'),
    center('o.o..o.o'),
    center('o.o..o.o'),
    center(''),
  ]
  if (isCheer) stamp(rows, [4, 0], ['o..........o'])
  if (role === 'review') stamp(rows, [4, 2], [isSleepy ? 'yyyooyyy' : 'yeyooyey'])
  return rows
}

function codexPet(role: Role, status: Status, odd: boolean): string[] {
  const isCheer = status === 'done'
  const isTyping = status === 'working' && odd
  const prompt = status === 'idle' || status === 'done' ? 'l' : 'w'
  const cursor = (status === 'working' && odd) || status === 'idle' ? 'dd' : 'ww'
  const rows = [
    role === 'impl' ? center('hhhyyhhh') : center('uuu..uuu'),
    center('uuuuuuuuuu'),
    center('uddddddddu'),
    center(`ud${prompt}dddddu`),
    center(`udd${prompt}ddddu`),
    center(`ud${prompt}d${cursor}ddu`),
    center('uuuuuuuuuu'),
    center('uuuuuu'),
    center(isTyping || isCheer ? 'uuuuuu' : 'u.uuuuuu.u'),
    center(isTyping ? 'u.uuuuuu.u' : 'uuuuuu'),
    center('uu..uu'),
    center('UU..UU'),
  ]
  if (isCheer) stamp(rows, [6, 0], ['.u........u.', '..u......u..'])
  if (role === 'review') stamp(rows, [2, 0], ['y..........y', 'y..........y', 'y..........y'])
  return rows
}

export function pixels(role: Role, status: Status, frame: number, kind?: string): string[] {
  const odd = frame % 2 === 1
  const rows = kind === 'claude' ? clawd(role, status, odd) : kind === 'codex' ? codexPet(role, status, odd) : human(role, status, odd)
  if (status === 'blocked' && !odd) stamp(rows, [0, 11], ['r', 'r', 'r', '.', 'r'])
  if (status === 'idle') stamp(rows, odd ? [1, 8] : [0, 8], ['wwww', '..w.', '.w..', 'wwww'])
  if (status === 'done') stamp(rows, [0, 0], odd ? ['t.t', '.t.', 't.t'] : ['.t.', 'ttt', '.t.'])
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
  const palette = { ...COMMON, ...ROLES[role].palette, ...(kind ? KINDS[kind] : undefined) }
  const isFaded = status === 'unknown' || status === 'absent'
  const color = (c: string) => {
    const v = palette[c]
    return v === undefined ? undefined : isFaded ? gray(v) : v
  }
  const rows = pixels(role, status, frame, kind)
  const words = new Uint32Array(SIZE * (SIZE / 2) * 3)
  for (let y = 0; y < SIZE / 2; y++) {
    for (let x = 0; x < SIZE; x++) {
      const top = color(rows[y * 2]![x]!)
      const bottom = color(rows[y * 2 + 1]![x]!)
      const i = (y * SIZE + x) * 3
      if (top !== undefined) words.set([UPPER, top, bottom ?? DEFAULT], i)
      else if (bottom !== undefined) words.set([LOWER, bottom, DEFAULT], i)
      else words.set([0x20, DEFAULT, DEFAULT], i)
    }
  }
  return base64(new Uint8Array(words.buffer))
}
