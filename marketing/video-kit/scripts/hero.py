#!/usr/bin/env python3
"""Hero reel for @plania.il: notes on the fridge -> "נמאס לי!!!" -> plania -> calm.

Run from marketing/video-kit after scripts/norm.sh has filled norm/:
    python3 scripts/hero.py            # writes out/00_PLANIA_HERO.mp4
Edit `segs` (shot list) and `texts` (on-screen text, by output time) below.
"""
import json, os, subprocess, sys
from pathlib import Path

K = Path(__file__).resolve().parent.parent
NORM, OUT, TMP = K / "norm", K / "out", K / "out/tmp_hero"
OUT.mkdir(exist_ok=True); TMP.mkdir(parents=True, exist_ok=True)
FPS = 30

# (clip, start, end, speed, look)   look: notes | before | boom | after
segs = [
    (4662, 1.00, 1.90, 1.0, "notes"),
    (4667, 0.75, 1.50, 1.0, "notes"),
    (4669, 0.60, 1.40, 1.0, "notes"),
    (4676, 0.50, 1.30, 1.0, "notes"),
    (4677, 0.60, 1.50, 1.0, "notes"),
    (4685, 0.50, 2.30, 1.6, "boom"),   # hand slaps the note at ~1.0s in the source
    (4705, 3.80, 5.60, 1.0, "before"),
    (4717, 0.90, 1.90, 1.0, "after"),
    (4720, 1.60, 3.20, 1.0, "after"),
    (4638, 0.00, 1.10, 1.0, "after"),
    (4641, 2.00, 3.30, 1.0, "after"),
    (4637, 0.50, 1.50, 1.0, "after"),
    (4643, 2.00, 3.20, 1.0, "after"),
    (4642, 10.30, 13.50, 1.0, "after"),  # last shot: calm sip of coffee
]
BOOM_SRC = 1.0  # moment of impact inside 4685 (source seconds)

def out_len(s): return round((s[2] - s[1]) / s[3] * FPS) / FPS
starts = []; t = 0.0
for s in segs: starts.append(t); t += out_len(s)
TOTAL = t
iboom = [i for i, s in enumerate(segs) if s[4] == "boom"][0]
BOOM_T = starts[iboom] + (BOOM_SRC - segs[iboom][1]) / segs[iboom][3]
iafter = [i for i, s in enumerate(segs) if s[4] == "after"][0]
AFTER_T = starts[iafter]

# on-screen text: (start, end, spec)
texts = [
    (0.15, starts[5], dict(id="t1", title="פתק להפשיר, פתק לקנות, פתק למה אוכלים", pos="top", pink=True)),
    (starts[6] + 0.1, starts[7], dict(id="t2", title="ועדיין:", sub="מה מבשלים היום?", pos="low")),
    (starts[8] + 0.1, starts[10], dict(id="t3", title="ועם <bdi>plania</bdi>?", pos="top")),
    (starts[10], starts[12], dict(id="t4", title="מתכננת את השבוע פעם אחת", sub="ורשימת הקניות נבנית לבד", pos="top")),
    (starts[12], TOTAL - 2.1, dict(id="t5", title="כל השבוע סגור", sub="בלי לרוץ למכולת באמצע השבוע", pos="low")),
    (TOTAL - 2.0, TOTAL, dict(id="logo", kind="endlogo")),
]

BASE = "curves=all='0/0.02 0.25/0.235 0.75/0.765 1/0.965'"
LOOK = {
    "notes":  "eq=contrast=1.08:saturation=1.0,colorbalance=rh=0.025:gh=0.005:bh=-0.02:rm=0.015:bm=-0.01",
    "before": "eq=saturation=0.94,colorbalance=rs=-0.01:bs=0.025:bm=0.015",
    "boom":   "eq=contrast=1.06,colorbalance=rh=0.02:bh=-0.015",
    "after":  "eq=saturation=1.06,colorbalance=rs=0.02:bs=-0.02:rm=0.025:gm=0.005:bm=-0.025:rh=0.03:bh=-0.03",
}
VIG = "vignette=angle=PI/9"

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: sys.exit(" ".join(map(str, cmd)) + "\n" + r.stderr[-2000:])

# 1. video segments
parts = []
for i, (n, a, b, sp, look) in enumerate(segs):
    nframes = round(out_len(segs[i]) * FPS)
    vf = [f"setpts=(PTS-STARTPTS)/{sp}", f"fps={FPS}", BASE, LOOK[look], VIG]
    if look == "boom":
        bf = round((BOOM_SRC - a) / sp * FPS)  # output frame of impact
        z = f"if(lt(in,{bf}),1,1+0.10*min(1,(in-{bf})/4))"
        sh = f"if(between(in,{bf},{bf+9}),22*sin(in*2.3)*(1-(in-{bf})/9),0)"
        vf += ["scale=2160:3840:flags=lanczos",
               f"zoompan=z='{z}':x='iw/2-iw/zoom/2+{sh}':y='ih/2-ih/zoom/2+{sh}*0.6':d=1:s=1080x1920:fps={FPS}",
               f"drawbox=t=fill:color=white@0.85:enable='between(n,{bf},{bf+1})'",
               f"drawbox=t=fill:color=white@0.4:enable='eq(n,{bf+2})'"]
    p = TMP / f"v{i:02d}.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-i", NORM / f"IMG_{n}.mp4", "-an",
         "-vf", ",".join(vf), "-frames:v", str(nframes),
         "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", p])
    parts.append(p)
(TMP / "list.txt").write_text("".join(f"file '{p}'\n" for p in parts))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", TMP / "list.txt", "-c", "copy", TMP / "video.mp4"])

# 2. audio
# 2a. each shot's own sound, same timing as the picture
aparts = []
for i, (n, a, b, sp, look) in enumerate(segs):
    p = TMP / f"a{i:02d}.wav"
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-t", str(b - a), "-i", NORM / f"IMG_{n}.mp4", "-vn",
         "-af", f"aresample=48000,atempo={sp},apad", "-t", str(out_len(segs[i])), "-ac", "2", p])
    aparts.append(p)
(TMP / "alist.txt").write_text("".join(f"file '{p}'\n" for p in aparts))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", TMP / "alist.txt", TMP / "orig.wav"])
# 2b. crowd murmur from the real "before" audio: 3 offset layers, lowpass 2.5k, light echo,
#     rising until the impact, then cut dead.
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", TMP / "alist.txt", "-t", str(starts[iboom + 2]),
     TMP / "before_raw.wav"])
crowd = (
    f"[0]aloop=loop=-1:size=2e6,atrim=0:{BOOM_T}[l0];"
    f"[1]aloop=loop=-1:size=2e6,atrim=0.9:{BOOM_T+0.9},asetpts=PTS-STARTPTS,adelay=0|0[l1];"
    f"[2]aloop=loop=-1:size=2e6,atrim=2.3:{BOOM_T+2.3},asetpts=PTS-STARTPTS,asetrate=48000*0.94,aresample=48000[l2];"
    f"[l0][l1][l2]amix=inputs=3:normalize=0,highpass=f=120,lowpass=f=2500,lowpass=f=2500,"
    f"aecho=0.8:0.6:60|110:0.25|0.15,"
    f"volume='0.25+0.9*t/{BOOM_T}':eval=frame,atrim=0:{BOOM_T},"
    f"afade=t=in:d=0.4,afade=t=out:st={BOOM_T-0.02}:d=0.02,alimiter=limit=0.6[crowd]"
)
run(["ffmpeg", "-v", "error", "-y", "-i", TMP / "before_raw.wav", "-i", TMP / "before_raw.wav", "-i", TMP / "before_raw.wav",
     "-filter_complex", crowd, "-map", "[crowd]", "-ar", "48000", "-ac", "2", TMP / "crowd.wav"])
# 2c. soft low boom (< 160 Hz)
run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=52:d=1.1", "-f", "lavfi", "-i", "sine=f=78:d=1.1",
     "-filter_complex", "[0][1]amix=inputs=2,afade=t=in:d=0.015,afade=t=out:st=0.05:d=1.0:curve=exp,"
     "lowpass=f=150,lowpass=f=150,volume=2.2", "-ar", "48000", "-ac", "2", TMP / "boom.wav"])
# 2d. mix: crowd until impact, boom at impact, quiet filtered real ambience afterwards
mix = (
    f"[1]lowpass=f=3000,highpass=f=90,volume='if(lt(t,{BOOM_T+0.25}),0,if(lt(t,{AFTER_T}),0.35,0.55))':eval=frame[amb];"
    f"[2]adelay={int(BOOM_T*1000)}|{int(BOOM_T*1000)}[bm];"
    f"[0][amb][bm]amix=inputs=3:normalize=0:duration=longest,atrim=0:{TOTAL},"
    f"afade=t=out:st={TOTAL-0.6}:d=0.6,alimiter=limit=0.85[a]"
)
run(["ffmpeg", "-v", "error", "-y", "-i", TMP / "crowd.wav", "-i", TMP / "orig.wav", "-i", TMP / "boom.wav",
     "-filter_complex", mix, "-map", "[a]", "-ar", "48000", "-ac", "2", TMP / "mix.wav"])

# 3. text layers
spec = [s for _, _, s in texts]
(TMP / "spec.json").write_text(json.dumps(spec, ensure_ascii=False))
env = dict(os.environ)
env.setdefault("NODE_PATH", subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip())
r = subprocess.run(["node", K / "scripts/overlay.js", TMP / "spec.json", TMP / "ovl"], env=env, capture_output=True, text=True)
if r.returncode: sys.exit(r.stderr)

# 4. composite
inputs = ["-i", TMP / "video.mp4", "-i", TMP / "mix.wav"]
fc, last = [], "[0:v]"
for k, (a, b, s) in enumerate(texts):
    inputs += ["-loop", "1", "-t", f"{TOTAL:.3f}", "-i", TMP / "ovl" / f"{s['id']}.png"]
    fade = 0.5 if s.get("kind") == "endlogo" else 0.18
    fc.append(f"[{k+2}:v]format=rgba,fade=t=in:st={a:.3f}:d={fade}:alpha=1[o{k}]")
    fc.append(f"{last}[o{k}]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[v{k}]")
    last = f"[v{k}]"
dst = OUT / "00_PLANIA_HERO.mp4"
run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", last, "-map", "1:a",
     "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS),
     "-c:a", "aac", "-b:a", "192k", "-t", f"{TOTAL:.3f}", "-movflags", "+faststart", dst])
print(f"ok {dst}  {TOTAL:.2f}s  boom at {BOOM_T:.2f}s")
