#!/usr/bin/env python3
"""
מייצר את ספריית המוזיקה המובנית (public/music/*.mp3): קטעי רקע מקוריים, מסונתזים
מאפס בקוד, ולכן בלי זכויות יוצרים של אף אחד. רץ פעם אחת:
    python3 scripts/make-music.py   (דורש numpy ו-ffmpeg)
"""
import os, subprocess, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "music")
rng = np.random.default_rng(7)

NOTE = {n: i for i, n in enumerate("C C# D D# E F F# G G# A A# B".split())}
def hz(name, octave):
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)

def chord(root, kind, octave=4):
    steps = {"maj": [0, 4, 7, 11], "min": [0, 3, 7, 10], "maj3": [0, 4, 7], "min3": [0, 3, 7]}[kind]
    base = NOTE[root] + 12 * (octave + 1)
    return [440.0 * 2 ** ((base + s - 69) / 12) for s in steps]

def env(n, a, d, s, r, sustain_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = max(0, n - a - d - r) if sustain_len is None else sustain_len
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sl, s), np.linspace(s, 0, max(r, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]

def lowpass(x, cutoff):
    # מסנן one-pole פשוט
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def t_(n): return np.arange(n) / SR

def kick(dur=0.35, punch=1.0):
    n = int(dur * SR); t = t_(n)
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * punch

def snare(dur=0.22, tone=0.4):
    n = int(dur * SR); t = t_(n)
    noise = lowpass(rng.standard_normal(n), 6000) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * tone
    return (noise + body) * 0.6

def clap(dur=0.25):
    n = int(dur * SR); t = t_(n); x = np.zeros(n)
    for off in (0, 0.012, 0.024):
        k = int(off * SR); m = n - k
        x[k:] += rng.standard_normal(m) * np.exp(-t[:m] * 30)
    return lowpass(x, 5000) * 0.35

def hat(dur=0.05, level=0.22):
    n = int(dur * SR); t = t_(n)
    x = rng.standard_normal(n); x = x - lowpass(x, 7000)
    return x * np.exp(-t * 60) * level

def keys(freqs, dur, bright=0.3, trem=0.0):
    n = int(dur * SR); t = t_(n); x = np.zeros(n)
    for f in freqs:
        detune = 1 + rng.uniform(-0.002, 0.002)
        x += np.sin(2 * np.pi * f * detune * t) + bright * np.sin(4 * np.pi * f * t) * np.exp(-t * 3)
    x *= env(n, 0.01, 0.4, 0.6, 0.3)
    if trem: x *= 1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * 4.5 * t))
    return x / max(1, len(freqs))

def pluck(f, dur, bright=0.5):
    n = int(dur * SR); t = t_(n)
    x = sum(np.sin(2 * np.pi * f * k * t) * (bright ** (k - 1)) / k for k in range(1, 6))
    return x * np.exp(-t * 6)

def piano(f, dur):
    n = int(dur * SR); t = t_(n)
    x = sum(np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k * k)) * np.exp(-t * (1.5 + k)) / k for k in range(1, 7))
    return x * env(n, 0.003, 0.1, 0.9, 0.2) * 0.6

def saw(f, dur, cutoff=1800):
    n = int(dur * SR); t = t_(n)
    x = 2 * ((f * t) % 1) - 1
    return lowpass(x, cutoff)

def bass(f, dur, kind="sine"):
    n = int(dur * SR); t = t_(n)
    x = np.sin(2 * np.pi * f * t) + (0.3 * np.sin(4 * np.pi * f * t) if kind == "warm" else 0)
    return x * env(n, 0.005, 0.1, 0.8, 0.08) * 0.5

def pad(freqs, dur, cutoff=1200):
    n = int(dur * SR); x = np.zeros(n)
    for f in freqs:
        for det in (0.997, 1.003):
            x += saw(f * det, dur, cutoff)
    return x * env(n, dur * 0.3, 0.2, 0.8, dur * 0.3) / (2 * len(freqs))

class Track:
    def __init__(self, bpm, bars):
        self.bpm, self.beat = bpm, 60 / bpm
        self.buf = np.zeros(int((bars * 4 + 2) * self.beat * SR) + SR)
        self.bars = bars
    def put(self, x, at_beat, gain=1.0):
        i = int(at_beat * self.beat * SR); j = min(len(self.buf), i + len(x))
        self.buf[i:j] += x[: j - i] * gain
    def render(self, name):
        x = self.buf[: int(self.bars * 4 * self.beat * SR)]
        fade = int(1.5 * SR); x[-fade:] *= np.linspace(1, 0, fade); x[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
        x = np.tanh(x / max(1e-6, np.abs(x).max()) * 1.4) * 0.9
        # סטריאו עדין: השהיה קצרה בערוץ אחד
        d = int(0.011 * SR); right = np.concatenate([np.zeros(d), x[:-d]])
        st = np.stack([x, 0.85 * x + 0.15 * right], axis=1)
        wav = os.path.join(OUT, name + ".wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((st * 32767).astype(np.int16).tobytes())
        mp3 = os.path.join(OUT, name + ".mp3")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5", "-c:a", "libmp3lame", "-b:a", "128k", mp3], check=True)
        os.remove(wav)
        return len(x) / SR

def progression(names):
    return [chord(r, k) for r, k in names]

def make_chill():
    tr = Track(80, 14)
    prog = progression([("D", "min"), ("G", "maj"), ("C", "maj"), ("A", "min")])
    for bar in range(tr.bars):
        b = bar * 4; ch = prog[bar % 4]
        tr.put(keys(ch, tr.beat * 4, 0.2, trem=0.25), b, 0.55)
        tr.put(bass(ch[0] / 2, tr.beat * 1.8, "warm"), b, 0.8); tr.put(bass(ch[0] / 2, tr.beat * 1.5, "warm"), b + 2.5, 0.6)
        if bar >= 1:
            tr.put(kick(0.4, 0.8), b); tr.put(kick(0.4, 0.6), b + 2.5)
            tr.put(snare(0.25, 0.2), b + 1, 0.6); tr.put(snare(0.25, 0.2), b + 3, 0.6)
            for k in range(8): tr.put(hat(0.04, 0.12), b + k * 0.5 + (0.08 if k % 2 else 0))
    crackle = (rng.random(len(tr.buf)) > 0.9993) * rng.standard_normal(len(tr.buf)) * 0.15
    tr.buf += lowpass(crackle, 3000) + lowpass(rng.standard_normal(len(tr.buf)), 800) * 0.01
    return tr.render("chill-lofi")

def make_happy():
    tr = Track(118, 18)
    prog = progression([("C", "maj3"), ("G", "maj3"), ("A", "min3"), ("F", "maj3")])
    for bar in range(tr.bars):
        b = bar * 4; ch = prog[bar % 4]
        for k in range(8):
            f = ch[[0, 1, 2, 1, 0, 2, 1, 2][k]] * 2
            tr.put(pluck(f, tr.beat * 0.6, 0.45), b + k * 0.5, 0.35)
        tr.put(bass(ch[0] / 2, tr.beat * 0.9), b, 0.9); tr.put(bass(ch[0] / 2, tr.beat * 0.9), b + 1.5, 0.7); tr.put(bass(ch[0] / 2, tr.beat * 0.9), b + 2, 0.8)
        if bar >= 2:
            for k in range(4): tr.put(kick(0.3), b + k, 0.9 if k % 2 == 0 else 0.6)
            tr.put(clap(), b + 1); tr.put(clap(), b + 3)
            for k in range(8): tr.put(hat(0.05, 0.16), b + k * 0.5 + 0.25 * (k % 2 == 0) * 0)
    return tr.render("happy-upbeat")

def make_energetic():
    tr = Track(128, 20)
    prog = progression([("A", "min3"), ("F", "maj3"), ("C", "maj3"), ("G", "maj3")])
    for bar in range(tr.bars):
        b = bar * 4; ch = prog[bar % 4]
        for k in range(4): tr.put(kick(0.28, 1.0), b + k)
        for k in range(4): tr.put(hat(0.06, 0.25), b + k + 0.5)
        if bar % 2 == 1: tr.put(clap(), b + 1); tr.put(clap(), b + 3)
        for k in range(8): tr.put(saw(ch[0] / 2, tr.beat * 0.45, 900) * env(int(tr.beat * 0.45 * SR), 0.003, 0.05, 0.7, 0.05), b + k * 0.5, 0.35)
        if bar >= 4:
            for k in (0, 1.5, 3):
                tr.put(sum(saw(f * 2, tr.beat * 0.4, 3000) for f in ch) / 3 * env(int(tr.beat * 0.4 * SR), 0.002, 0.1, 0.4, 0.1), b + k, 0.3)
    return tr.render("energetic-dance")

def make_cinematic():
    tr = Track(90, 14)
    prog = progression([("D", "min3"), ("A#", "maj3"), ("F", "maj3"), ("C", "maj3")])
    for bar in range(tr.bars):
        b = bar * 4; ch = prog[bar % 4]
        tr.put(pad([f / 2 for f in ch], tr.beat * 4.2, 900 + bar * 60), b, 0.7)
        tr.put(bass(ch[0] / 4, tr.beat * 3.5), b, 1.0)
        if bar >= 2: tr.put(kick(0.9, 1.2), b, 1.0); tr.put(lowpass(rng.standard_normal(int(0.6 * SR)), 900) * np.exp(-t_(int(0.6 * SR)) * 6), b, 0.4)
        if bar >= 6:
            for k in range(8): tr.put(pluck(ch[k % 3] * 2, tr.beat * 0.5, 0.3), b + k * 0.5, 0.25)
            tr.put(snare(0.4, 0.5), b + 2, 0.5)
    return tr.render("cinematic-epic")

def make_romantic():
    tr = Track(72, 12)
    prog = [(chord("F", "maj", 3)), chord("C", "maj", 3), chord("D", "min", 3), chord("A#", "maj", 3)]
    for bar in range(tr.bars):
        b = bar * 4; ch = prog[bar % 4]
        tr.put(piano(ch[0] / 2, tr.beat * 4), b, 0.7)
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        for k, idx in enumerate(pattern):
            tr.put(piano(ch[idx] * 2, tr.beat * 1.5), b + k * 0.5, 0.45)
        if bar >= 4: tr.put(pad([f for f in ch[:3]], tr.beat * 4.2, 700), b, 0.25)
    return tr.render("romantic-piano")

def make_pop():
    tr = Track(105, 18)
    prog = progression([("G", "maj3"), ("D", "maj3"), ("E", "min3"), ("C", "maj3")])
    for bar in range(tr.bars):
        b = bar * 4; ch = prog[bar % 4]
        tr.put(keys([f * 2 for f in ch], tr.beat * 0.9, 0.5), b, 0.4); tr.put(keys([f * 2 for f in ch], tr.beat * 0.9, 0.5), b + 1.5, 0.35)
        tr.put(keys([f * 2 for f in ch], tr.beat * 0.9, 0.5), b + 2.5, 0.35)
        for k in (0, 0.75, 2, 2.75): tr.put(bass(ch[0] / 2, tr.beat * 0.6, "warm"), b + k, 0.8)
        if bar >= 2:
            tr.put(kick(), b); tr.put(kick(0.3, 0.7), b + 2.5); tr.put(kick(), b + 2)
            tr.put(snare(0.25, 0.4), b + 1); tr.put(snare(0.25, 0.4), b + 3)
            for k in range(8): tr.put(hat(0.04, 0.18), b + k * 0.5)
    return tr.render("pop-groove")

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    tracks = [
        ("chill-lofi", "לואו-פיי רגוע", "chill", make_chill),
        ("happy-upbeat", "קליל ושמח", "happy", make_happy),
        ("energetic-dance", "אנרגטי לריקוד", "energetic", make_energetic),
        ("cinematic-epic", "קולנועי ודרמטי", "cinematic", make_cinematic),
        ("romantic-piano", "פסנתר רומנטי", "romantic", make_romantic),
        ("pop-groove", "גרוב פופ", "pop", make_pop),
    ]
    # הרשימה, הקצב והאורך מתועדים ב-lib/music/builtin.ts
    for file, title, mood, fn in tracks:
        print(file, round(fn(), 1), "s")
