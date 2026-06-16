#!/usr/bin/env python3
import json, sys, time

data = json.load(sys.stdin)

BLOCKS = ' ▏▎▍▌▋▊▉█'
R = '\033[0m'
DIM = '\033[2m'

def gradient(pct):
    if pct < 50:
        r = int(pct * 5.1)
        return f'\033[38;2;{r};200;80m'
    else:
        g = int(200 - (pct - 50) * 4)
        return f'\033[38;2;255;{max(g,0)};60m'

def bar(pct, width=6):
    pct = min(max(pct, 0), 100)
    filled = pct * width / 100
    full = int(filled)
    frac = int((filled - full) * 8)
    b = '█' * full
    if full < width:
        b += BLOCKS[frac]
        b += '░' * (width - full - 1)
    return b

def remaining(resets_at):
    secs = max(0, int(resets_at - time.time()))
    d, rem = divmod(secs, 86400)
    h, rem = divmod(rem, 3600)
    m = rem // 60
    if d > 0:
        return f'{d}d{h}h'
    return f'{h}h{m:02d}m'

def calc_pace(pct, resets_at, window_secs, per_secs):
    """経過時間から消費ペース（%/per_secs）を計算する。窓の開始直後は None。"""
    if resets_at is None:
        return None
    elapsed = window_secs - max(0, resets_at - time.time())
    if elapsed < 60:
        return None
    return pct / elapsed * per_secs

def fmt(label, pct, resets_at=None, pace=None, pace_unit=''):
    p = round(pct)
    rem = f' {DIM}{remaining(resets_at)}{R}' if resets_at is not None else ''
    pace_str = f' {DIM}({pace:.1f}%/{pace_unit}){R}' if pace is not None else ''
    return f'{label} {gradient(pct)}{bar(pct)} {p}%{R}{rem}{pace_str}'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [model]

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(fmt('ctx', ctx))

five_data = data.get('rate_limits', {}).get('five_hour', {})
five = five_data.get('used_percentage')
if five is not None:
    five_pace = calc_pace(five, five_data.get('resets_at'), 5 * 3600, 3600)
    parts.append(fmt('5h', five, five_data.get('resets_at'), pace=five_pace, pace_unit='h'))

week_data = data.get('rate_limits', {}).get('seven_day', {})
week = week_data.get('used_percentage')
if week is not None:
    week_pace = calc_pace(week, week_data.get('resets_at'), 7 * 86400, 86400)
    parts.append(fmt('7d', week, week_data.get('resets_at'), pace=week_pace, pace_unit='d'))

print(f'{DIM}│{R}'.join(f' {p} ' for p in parts), end='')
