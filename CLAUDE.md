# my-plania

## Instagram skills (ig-*)

The voice profile lives in the repo at `.claude/instagram/voice.md`. The ig-* skills look for
`~/.claude/instagram/voice.md`, but in cloud sessions that file does not persist. At the start
of any ig-* task, copy `.claude/instagram/voice.md` to `~/.claude/instagram/voice.md` (or read
the repo copy directly). Write any voice updates back to the repo copy, and do the same for
`swipe.md` and other files the skills keep under `~/.claude/instagram/`.

All Instagram output is in Hebrew.

## Video editing (plania reels)

Before editing any plania video, read `.claude/instagram/video-style.md` (brand, text, color, cut, sound and
ending rules, plus the shot list from the 15.11 shoot). The editing scripts and brand fonts/logo live in
`marketing/video-kit/`. When the user gives a note, continue from the latest version and change only what she asked.
