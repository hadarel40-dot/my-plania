# Plania US: coming-soon reels

Four 9:16 reels (1080x1920, 30fps) for building followers before launch. Ready to post in `out/`.
English only. No prices, no savings numbers, no "Now open".

| File | Length | Idea |
|---|---|---|
| `out/reel1-430.mp4` | 25.6s | 4:30 PM and the "what's for dinner?" texts, then plan once, one tap, 48 ingredients |
| `out/reel2-built.mp4` | 21.7s | "I got tired of what's for dinner, so I built an app": 4 real features |
| `out/reel3-saves.mp4` | 16.8s | Saved recipes on Instagram vs. actually cooked, then import from Instagram/TikTok |
| `out/reel4-poll.mp4` | 14s | "1 or 2" poll for comments |

Every reel ends on "Opening soon." + "Follow for launch day".

## Before posting
- Sound effects are built in (message pings, transition whooshes, taps, pops). No music. If you add a track from Instagram's audio library, keep it low so the effects still come through.
- Post order: 4 (poll, wakes up the account) -> 1 -> 3 -> 2, every 2-3 days.
- Cover frame: pick the first line of text (Instagram's "Choose cover").

## Post captions

**Reel 1 (4:30)**
It's 4:30 and the texts start coming in. I'm building something so dinner is decided before anyone asks.
Opening soon. Follow so you don't miss launch day.
#mealplanning #workingmom #momlife #dinnerideas #grocerylist #mentalload

**Reel 2 (I built it)**
I got tired of answering "what's for dinner?" every single day, so I built the app I wanted. Plan the week, one tap for groceries, ideas when you're stuck, and your saved reels in one place.
Opening soon. Follow for launch day.
#mealplanning #buildinpublic #momsinbusiness #weeklymealplan #dinnerideas

**Reel 3 (saved recipes)**
Be honest: how many saved recipes have you actually cooked? Soon you'll be able to drop them straight into your week.
Opening soon. Follow for launch day.
#recipesaves #mealplanning #dinnerideas #easyrecipes #weeknightdinner

**Reel 4 (poll)**
Comment 1 or 2.
1: deciding what to cook
2: remembering what to buy
I'm building the next video from your answers.
#mealplanning #momlife #dinnertime #mentalload

## Rebuilding
1. `./prep-assets.sh <screen-recording.mp4> <weekly.png> <meals.png> <suggestions.png> <guide.png>`
   cuts the real app footage, crops the status bar, and blurs the estimated-price column.
2. `node render.js reel1-430.html out/reel1-430.mp4` (needs Playwright, ffmpeg, and Python with numpy).
   Sound cues come from `api.sfx(...)` calls in each reel; `sfx.py` synthesizes and mixes them.
   `node render.js reel1-430.html /tmp/r1 --stills 3,10` saves single frames for checking.
