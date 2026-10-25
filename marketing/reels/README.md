# Plania US: coming-soon reels

Four 9:16 reels (1080x1920, 30fps) for building followers before launch. Ready to post in `out/`.
English only. No prices, no savings numbers, no "Now open".

| File | Length | Idea |
|---|---|---|
| `out/reel1-430.mp4` | 25.6s | 4:30 PM and the "what's for dinner?" texts, then plan once, one tap, 48 ingredients |
| `out/reel2-built.mp4` | 21.7s | "I got tired of what's for dinner, so I built a digital planning tool": 4 real features |
| `out/reel3-saves.mp4` | 16.8s | Saved recipes on Instagram vs. actually cooked, then import from Instagram/TikTok |
| `out/reel4-poll.mp4` | 14s | "1 or 2" poll for comments |
| `out/reel5-leaks.mp4` | 24.5s | Where grocery money leaks (5 leaks, no numbers), then plan first and shop from the list |

Every reel ends on "Opening soon." + "Follow for launch day".

## Before posting
- Sound effects are built in (message pings, transition whooshes, taps, pops). No music. If you add a track from Instagram's audio library, keep it low so the effects still come through.
- Post order: 4 (poll, wakes up the account) -> 1 -> 5 -> 3 -> 2, every 2-3 days.
- Cover frame: pick the first line of text (Instagram's "Choose cover").

## Post captions
Copy as is. The first line is the hook (it's what shows before "more").

**Reel 1 (4:30)**
```
4:30 PM. Three texts. One question. 🙃
I'm building a digital planning tool so dinner is decided before anyone asks: plan the week once, and the grocery list builds itself.
Opening soon. Follow so you're here on launch day.
What time does "what's for dinner?" hit at your house?
#mealplanning #workingmom #dinnerideas #mentalload #momlife
```

**Reel 2 (I built it)**
```
I got tired of "what's for dinner?" so I built a digital planning tool.
1. It plans my week
2. One tap turns it into a grocery list, sorted by aisle
3. Out of ideas? It suggests meals
4. It saves recipes straight from Instagram and TikTok
Opening soon. Follow for launch day.
Which one would you use first?
#mealplanning #buildinpublic #momsinbusiness #weeklymealplan #dinnerideas
```

**Reel 3 (saved recipes)**
```
Be honest: how many saved recipes have you actually cooked? 👀
Soon you'll be able to import them from Instagram or TikTok and drop them straight into your week.
Opening soon. Follow for launch day.
Comment your saved-to-cooked ratio.
#recipesaves #mealplanning #dinnerideas #easyrecipes #weeknightdinner
```

**Reel 4 (poll)**
```
Comment 1 or 2 👇
1: deciding what to cook
2: remembering what to buy
I'm making the next video from your answers.
#mealplanning #momlife #dinnertime #mentalload
```

**Reel 5 (money leaks)**
```
Your grocery budget isn't the problem. The leaks are.
Doubles of what's already in the fridge, "while I'm here" extras, food that goes bad, the second trip, 4:30 takeout.
Plan the week first, then shop only from the list.
Opening soon. Follow for launch day.
Which leak is yours? Comment the number.
#grocerybudget #mealplanning #budgetingtips #foodwaste #momlife
```

## Rebuilding
1. `./prep-assets.sh <screen-recording.mp4> <weekly.png> <meals.png> <suggestions.png> <guide.png>`
   cuts the real app footage, crops the status bar, and blurs the estimated-price column.
2. `node render.js reel1-430.html out/reel1-430.mp4` (needs Playwright, ffmpeg, and Python with numpy).
   Sound cues come from `api.sfx(...)` calls in each reel; `sfx.py` synthesizes and mixes them.
   `node render.js reel1-430.html /tmp/r1 --stills 3,10` saves single frames for checking.
