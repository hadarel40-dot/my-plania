---
name: reel-retention
description: >-
  Make a reel people watch to the end - diagnose why viewers drop off a finished
  video and plan or edit one with a hook in the first second, a change every
  1.5-2.5 seconds, an open loop and a payoff. Use when she says the video is
  boring, "אנשים עוזבים באמצע", "תעשה את זה מעניין יותר", "retention", "watch
  time", "why did this flop", or before any reel is rendered for Instagram.
---

# reel-retention

A reel loses people in three places: the first second, any stretch where nothing
changes, and the moment the point is clear but the video is not over. This skill
finds those places and fixes them. Talk to her in Hebrew.

## 1. Measure before you touch it

```bash
python3 .claude/skills/reel-retention/check.py video.mp4
```

It reports the size and ratio, whether there is a soundtrack, every cut or big
visual change, when the first change happens, and every stretch longer than 2.5 s
with no change. It sees cuts, zooms and big motion; it does not see text that
changes on a still shot. So also pull frames and look:

```bash
ffmpeg -i video.mp4 -vf fps=2,scale=270:-1,tile=6x4 contact.png
```

If she has Instagram insights for the reel (retention graph, average watch time,
skip rate), ask for a screenshot. The drop on the graph beats any guess.

## 2. The rules, in her format

Her reels are b-roll with text on screen, no talking (see `.claude/instagram/voice.md`).
That format lives or dies on pace, because there is no face or voice to hold people.

1. **Second 0 is the hook.** No logo, no fade in, no establishing shot. The first
   frame already has motion (a hand, steam, a door opening) and the hook text is on
   screen from frame 1. The hook names a tension, not a topic: "18:00 ואין לי מושג
   מה מבשלים" beats "תכנון ארוחות".
2. **Something changes every 1.5–2.5 seconds.** A cut, a punch-in zoom (100%→110%),
   a new line of text, a sound hit. A still shot for 4 seconds with one long sentence
   is where people leave.
3. **Text arrives in pieces, on the beat.** Split the sentence into 2–4 chunks that
   pop in with the cuts. Big (60–80 px on 1080 wide), centered in the safe area
   (not the bottom 20% or top 12%), max 6–7 words per chunk, high contrast.
4. **Open a loop early, close it at the end.** "השלב האחרון הכי כואב", "1/5" counters,
   "חכי לסוף", a before shot whose after only comes last. People stay to see it close.
5. **Payoff, then end immediately.** No "תעקבו" slate. The last frame should cut back
   cleanly into the first so the reel loops; loops count as rewatches.
6. **Sound does half the work.** A trending audio (original audio on a business
   account), cuts on the beat, plus small hits: whoosh on transitions, pop when text
   appears, a click on the counter. Silent reels get pushed less.
7. **Length follows content.** 7–12 s for one idea. Longer only if every 2 s earns it.
8. **Color and light.** Warm, bright, contrast up a little. Dark or flat footage reads
   as boring before anyone reads a word (`media-use` has grades and looks).

## 3. Fix it

Rank the problems by where they sit in time (the first second first), propose the
fix for each in one line, and then build it. Tools in this project:

- **Remotion** (`remotion-create`, `remotion-best-practices`, `remotion-captions`,
  `remotion-render`) for text animation, zooms, counters, captions and the final MP4.
  Her web editor in `video-editor/` is also Remotion based.
- **HyperFrames** (`hyperframes`, `hyperframes-cli`, `media-use`) for motion design,
  title cards, sound effects, music, color grades.
- **`reverse-any-video`** when she brings a reel she likes: rebuild its edit
  structure, then swap in her footage and text. **`style-sampling`** for a proven style.
- `ig-reel` for the hook and the beat sheet (`beats.py`), `ig-caption` for the caption.

Render 1080×1920, H.264 + AAC, 30 fps, then run `check.py` again on the result and
show her the before and after numbers. When it is good, `ig-schedule` puts it in the
content bank.

## Never

- Never invent retention numbers. Only what `check.py` measured or what her insights show.
- Never add text that claims something her product does not do (voice.md, "טענות").
