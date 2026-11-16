---
name: ig-schedule
description: >-
  Put a finished reel, carousel, image or story into Hadarel's content bank on her
  site (hadarelifergan.com, admin tab "תוכן") and schedule it for Instagram. Use
  when she says "תכניס את זה לעמוד תוכן", "תתזמן", "תעלה לאתר", "schedule this",
  "put this in my content page", or finishes a video or carousel and wants it
  queued for @plania.il or @hadarelifergan.
---

# ig-schedule

Everything she makes in Claude Code ends up as one `ContentPost` record in the
Base44 app **Plania's** (`6ac284b25278ab1689bc08f5`). The admin tab "תוכן"
shows it, and the workflow "Publish Content" posts every `approved` post whose
`scheduled_at` has passed (checked every 10 minutes). @hadarelifergan posts with
the site's Instagram connection; @plania.il goes through the Plania IL app
(`6a12ecc1d43884481a3de494`, function `igPublish`). All talk with her is in Hebrew.

## The record

| field | values |
|---|---|
| `account` | `hadarelifergan` or `plania.il` (ask if unclear; see `.claude/instagram/voice.md`) |
| `format` | `reel`, `carousel`, `image`, `story` |
| `status` | `idea`, `draft`, `approved` (goes out by itself), `publishing`, `published`, `failed` |
| `title` | short internal name |
| `hook` | on-screen text / opening line |
| `script` | shot list or script |
| `caption` | the Instagram caption (≤2200 chars, ≤30 hashtags) |
| `media` | ordered `[{ "url", "type": "video" \| "image", "name" }]`, public https URLs |
| `scheduled_at` | ISO 8601 UTC. She talks in Israel time: convert (Asia/Jerusalem) |
| `notes` | anything else |
| `source` | `manual` when she made it with you, `agent` for the weekly agent |

Read and write with the Base44 MCP tools: `query_entities`, `create_entities`,
`update_entities` on entity `ContentPost`.

## Steps

1. **Check the file against Instagram's rules** before anything else.
   - Reel: MP4 or MOV, H.264 + AAC, 9:16 (1080×1920), 3 s to 15 min (aim for under 90 s), under 100 MB.
   - Carousel: 2 to 10 files, images **JPG only**, 4:5 (1080×1350) recommended, all the same ratio.
   - Image / story: JPG (or MP4 for a video story).
   - Fix what you can: `ffmpeg -i in.mov -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 128k -movflags +faststart -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" out.mp4`;
     PNG/WEBP slides → `ffmpeg -i slide.png -q:v 2 slide.jpg`.
2. **Write what is missing**: caption with `ig-caption`, then `ig-human`. Use her voice from `.claude/instagram/voice.md`.
3. **Get the files online** (see "Uploading" below) so each one has a public https URL.
4. **Propose the slot**: suggest a day and time. Look at what is already scheduled
   (`query_entities` with `{"status": {"$in": ["approved", "draft"]}}`) so two posts
   on the same account do not land on the same day. Her usual slots are 20:30–21:00.
5. **Show her a summary** (account, format, date and time in Israel time, first line
   of the caption, number of files) and ask: save as draft, or approve for publishing?
6. **Create the record** with `create_entities`. Use `status: "approved"` **only** when
   she said so in this conversation. Otherwise `draft`.
7. Tell her it is in the "תוכן" tab: `hadarelifergan.com/hp-manage-7k2x`.

## Uploading

The best path is the platform upload API, straight from the shell:

```bash
curl -sS -X POST "https://app.base44.com/api/files/apps/6ac284b25278ab1689bc08f5/upload" \
  -H "Authorization: Bearer $BASE44_TOKEN" -F "file=@out.mp4"
# → { "file_uri": "...", "url": "https://..." }   use `url` in media[]
```

(Not yet tried from here. If the form field name is refused, read the contract with the
Base44 MCP: `describe_api` on `POST /api/files/apps/{app_id}/upload`.)

It needs two things this cloud environment may not have yet: `app.base44.com` in the
environment's allowed hosts, and her Base44 personal access token as a network secret
for that host. If the request is blocked, say so in one line and ask her to approve the
environment change from claude.ai on a computer or a current Claude app.

Until then, **do not** send files through `upload_app_asset` as base64: a video or a
set of slides is far too large for that. Instead create the record with everything
except `media`, as a `draft`, and tell her to open the post in the "תוכן" tab and drag
the file in (it converts images to JPG by itself), then press "אישור לפרסום".

## Changing or moving a post

- Reschedule: `update_entities` with a new `scheduled_at`.
- Pull it back: set `status` to `draft`.
- A `failed` post has the reason in `error`. Fix the cause, then set it back to `approved`.
- Never touch posts in `publishing` or `published`.
