# my-plania

## שפה

כל ההודעות למשתמשת נכתבות בעברית: סיכומים, הסברים, שאלות ומה שהיא צריכה לעשות.

## Instagram skills (ig-*)

The voice profile lives in the repo at `.claude/instagram/voice.md`. The ig-* skills look for
`~/.claude/instagram/voice.md`, but in cloud sessions that file does not persist. At the start
of any ig-* task, copy `.claude/instagram/voice.md` to `~/.claude/instagram/voice.md` (or read
the repo copy directly). Write any voice updates back to the repo copy, and do the same for
`swipe.md` and other files the skills keep under `~/.claude/instagram/`.

All Instagram output is in Hebrew.

## OpenMontage (video production)

The OpenMontage repo is a git submodule at `vendor/OpenMontage`, and its 49 Claude skills are copied
into `.claude/skills/`. After a fresh clone, run `git submodule update --init --depth 1`.
For full video pipelines, read `vendor/OpenMontage/AGENT_GUIDE.md` first and run `make setup`
inside `vendor/OpenMontage` (needs Python 3.10+, FFmpeg, Node 22+). Skills that mention `tools/`,
`pipeline_defs/` or `AGENT_GUIDE.md` mean paths inside `vendor/OpenMontage`.

## Video editing for plania

Before editing any video for @plania.il, read `.claude/instagram/video-style.md` (brand, on-screen text,
color, pacing, sound rules, and the best shots from the Drive folder). Write updates back to that file.
