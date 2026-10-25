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
Copy as is. No hashtags: the search keywords are written into the text itself
(meal planning, weekly meal plan, grocery list, dinner ideas, and so on), which is what Instagram search reads.
The first line is the hook (it's what shows before "more").

**Reel 1 (4:30)**
```
4:30 PM. Three texts. One question: what's for dinner? 🙃
If you're a working mom carrying the mental load of meal planning on top of your actual job, I see you.
I'm building a digital planning tool for exactly this: make your weekly meal plan once, and your grocery list builds itself.
Opening soon. Follow so you're here on launch day.
What time does "what's for dinner?" hit at your house?
```

**Reel 2 (I built it)**
```
I got tired of "what's for dinner?" so I built a digital planning tool.
1. It plans my weekly meal plan
2. One tap turns the meal plan into a grocery list, sorted by aisle
3. Out of dinner ideas? It suggests easy family meals
4. It saves recipes straight from Instagram and TikTok
Meal planning for busy moms, all in one place.
Opening soon. Follow for launch day.
Which one would you use first?
```

**Reel 3 (saved recipes)**
```
Be honest: how many saved recipes have you actually cooked? 👀
Your Instagram and TikTok recipes deserve better than a saved folder.
Soon you'll be able to import any recipe reel and add it straight to your weekly meal plan, so those easy dinner ideas finally make it to the table.
Opening soon. Follow for launch day.
Comment your saved-to-cooked ratio.
```

**Reel 4 (poll)**
```
Comment 1 or 2 👇
1: deciding what to cook for dinner
2: remembering what to buy at the grocery store
Meal planning has two jobs, and most moms are stuck on one of them. I'm making the next video from your answers.
```

**Reel 5 (money leaks)**
```
Your grocery budget isn't the problem. The leaks are.
Buying doubles of what's already in the fridge, "while I'm here" extras, food waste from things that go bad, the second grocery trip, and 4:30 takeout when there's no dinner plan.
The fix is simple meal planning: plan the week first, then shop only from your grocery list.
Opening soon. Follow for launch day.
Which leak is yours? Comment the number.
```

## Rebuilding
1. `./prep-assets.sh <screen-recording.mp4> <weekly.png> <meals.png> <suggestions.png> <guide.png>`
   cuts the real app footage, crops the status bar, and blurs the estimated-price column.
2. `node render.js reel1-430.html out/reel1-430.mp4` (needs Playwright, ffmpeg, and Python with numpy).
   Sound cues come from `api.sfx(...)` calls in each reel; `sfx.py` synthesizes and mixes them.
   `node render.js reel1-430.html /tmp/r1 --stills 3,10` saves single frames for checking.
