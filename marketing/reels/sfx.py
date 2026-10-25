"""Synthesizes the reel sound effects and mixes them at the cue times.

Usage: python3 sfx.py <cues.json> <duration_seconds> <out.wav>
cues.json is a list of {"t": seconds, "name": sound}. No samples are downloaded;
every sound is generated here so there are no licensing questions.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def env(n, attack=0.004, decay=8.0):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-decay * t)


def tone(freq, dur, decay=8.0, partials=((1, 1.0),)):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(amp * np.sin(2 * np.pi * freq * k * t) for k, amp in partials)
    return s * env(n, decay=decay)


def lowpass(x, cutoffs):
    """One-pole low-pass with a per-sample cutoff (Hz)."""
    a = 1 - np.exp(-2 * np.pi * np.asarray(cutoffs) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def ping():
    # Two quick rising notes, like an incoming text.
    bell = ((1, 1.0), (2, 0.25), (3, 0.08))
    a = tone(1175, 0.16, 18, bell)
    b = tone(1568, 0.32, 12, bell)
    out = np.zeros(int(0.42 * SR))
    out[: len(a)] += a
    off = int(0.085 * SR)
    out[off: off + len(b)] += b
    return 0.32 * out


def whoosh():
    n = int(0.34 * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    sweep = 400 + 5200 * np.sin(np.pi * t) ** 2
    shaped = lowpass(noise, sweep) - lowpass(noise, sweep * 0.25)
    shape = np.sin(np.pi * t) ** 1.6
    return 0.55 * shaped * shape / (np.abs(shaped).max() + 1e-9)


def pop():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    freq = 220 + 520 * np.exp(-t * 45)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return 0.42 * np.sin(phase) * env(n, 0.002, 38)


def tap():
    n = int(0.05 * SR)
    click = rng.standard_normal(n) * env(n, 0.0005, 260)
    body = tone(1900, 0.05, 90)
    return 0.30 * (0.5 * click + body)


def tick():
    n = int(0.03 * SR)
    return 0.3 * (rng.standard_normal(n) * env(n, 0.0003, 420) + tone(3200, 0.03, 300))


def thud():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    freq = 70 + 110 * np.exp(-t * 30)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return 0.6 * np.sin(phase) * env(n, 0.002, 16)


def ding():
    return 0.20 * tone(1320, 0.9, 5.5, ((1, 1.0), (2.01, 0.35), (3.02, 0.12)))


SOUNDS = {name: fn() for name, fn in {
    'ping': ping, 'whoosh': whoosh, 'pop': pop, 'tap': tap,
    'tick': tick, 'thud': thud, 'ding': ding,
}.items()}


def main(cues_path, duration, out_path):
    cues = json.load(open(cues_path))
    mix = np.zeros(int(float(duration) * SR) + SR)
    for c in cues:
        s = SOUNDS[c['name']] * c.get('gain', 1.0)
        i = int(c['t'] * SR)
        j = min(len(mix), i + len(s))
        mix[i:j] += s[: j - i]
    mix = mix[: int(float(duration) * SR)]
    peak = np.abs(mix).max()
    if peak > 0:
        mix *= 0.8 / peak  # normalize to about -2 dBFS so it carries on phone speakers
    pcm = (np.stack([mix, mix], axis=1) * 32767).astype('<i2')
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    main(*sys.argv[1:4])
