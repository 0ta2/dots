#!/usr/bin/env python3
import json, sys, time
from datetime import date, timedelta

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

def count_weekdays_split(start_ts, pivot_ts, end_ts):
    """start→pivot を elapsed、start→end を total として平日数を同時計算する。"""
    d = date.fromtimestamp(start_ts)
    pivot_d, end_d = date.fromtimestamp(pivot_ts), date.fromtimestamp(end_ts)
    elapsed = total = 0
    while d < end_d:
        if d.weekday() < 5:
            total += 1
            if d < pivot_d:
                elapsed += 1
        d += timedelta(days=1)
    return elapsed, total

def calc_projected(pct, resets_at, window_secs, weekdays_only=False):
    """このペースが続いた場合のリセット時点の予測着地 (%)。窓の開始直後は None。"""
    if resets_at is None:
        return None
    now = time.time()
    if weekdays_only:
        start_ts = resets_at - window_secs
        elapsed, total = count_weekdays_split(start_ts, now, resets_at)
        if elapsed < 1 or total == 0:  # elapsed は日数単位
            return None
        return pct * total / elapsed
    else:
        elapsed = window_secs - max(0, resets_at - now)
        if elapsed < 60:
            return None
        return pct * window_secs / elapsed

def fmt(label, pct, resets_at=None, projected=None):
    p = round(pct)
    rem = f' {DIM}{remaining(resets_at)}{R}' if resets_at is not None else ''
    if projected is not None:
        proj_str = f' {DIM}→ ~{min(round(projected), 999)}%{R}'
    else:
        proj_str = ''
    return f'{label} {gradient(pct)}{bar(pct)} {p}%{R}{rem}{proj_str}'

model = data.get('model', {}).get('display_name', 'Claude')
parts = [model]

ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    parts.append(fmt('ctx', ctx))

five_data = data.get('rate_limits', {}).get('five_hour', {})
five = five_data.get('used_percentage')
if five is not None:
    five_proj = calc_projected(five, five_data.get('resets_at'), 5 * 3600)
    parts.append(fmt('5h', five, five_data.get('resets_at'), projected=five_proj))

week_data = data.get('rate_limits', {}).get('seven_day', {})
week = week_data.get('used_percentage')
if week is not None:
    week_proj = calc_projected(week, week_data.get('resets_at'), 7 * 86400, weekdays_only=True)
    parts.append(fmt('7d', week, week_data.get('resets_at'), projected=week_proj))

print(f'{DIM}│{R}'.join(f' {p} ' for p in parts), end='')
