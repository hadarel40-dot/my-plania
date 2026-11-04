import { z } from "zod";

/** הפעולות שהעוזר יכול לבצע בעורך. כל פעולה מתורגמת בצד הדפדפן לפונקציה קיימת */
export const CHAT_ACTIONS = [
  "shorter", "more_energy", "calmer", "transitions",
  "music_change", "music_off", "music_on", "music_volume",
  "captions_hide", "captions_show", "captions_create", "captions_style", "captions_color", "captions_highlight",
  "captions_font", "captions_size", "captions_position", "captions_words", "replace_word",
  "set_hook", "add_text", "animations", "filter", "speed", "cut_range", "freeze", "aspect",
  "reedit", "open_tool",
] as const;
export type ChatActionType = (typeof CHAT_ACTIONS)[number];

const PRESETS = ["word-pop", "highlight-box", "one-word", "bold-pop", "karaoke", "minimal", "neon", "underline", "bubble", "typewriter", "slide", "outline", "shadow3d", "gradient"] as const;
const MOODS = ["energetic", "happy", "pop", "chill", "cinematic", "hiphop", "romantic", "acoustic", "inspiring"] as const;
const FILTERS = ["none", "cinematic", "vivid", "warm", "cold", "vintage", "matte", "bw", "noir"] as const;
const LEVELS = ["none", "clean", "dynamic", "extreme", "some", "lots"] as const;

export const ChatActionSchema = z.object({
  type: z.enum(CHAT_ACTIONS),
  text: z.string().optional().describe("Hebrew text for set_hook/add_text/reedit; tool name for open_tool (background|tricks|captions|music|text|media|smart)"),
  from: z.string().optional().describe("replace_word: the wrong word"),
  to: z.string().optional().describe("replace_word: the right word"),
  color: z.string().optional().describe("hex color like #facc15"),
  preset: z.enum(PRESETS).optional(),
  font: z.string().optional().describe("font id from the list"),
  mood: z.enum(MOODS).optional(),
  level: z.enum(LEVELS).optional().describe("transitions: none|clean|dynamic|extreme; animations: none|some|lots"),
  filter: z.enum(FILTERS).optional(),
  aspect: z.enum(["9:16", "16:9", "1:1"]).optional(),
  value: z.number().optional().describe("numbers: target seconds for shorter, volume 0..1, size multiplier 0.6..1.8, position y 0..1, words per caption 1..4, speed 0.25..3"),
  start: z.number().optional().describe("seconds on the timeline"),
  end: z.number().optional().describe("seconds on the timeline"),
});
export type ChatAction = z.infer<typeof ChatActionSchema>;

export const ChatReplySchema = z.object({
  reply: z.string().describe("short Hebrew reply (1-2 sentences) saying what was done, or asking one short question if the request is unclear"),
  actions: z.array(ChatActionSchema).max(10),
});
export type ChatReply = z.infer<typeof ChatReplySchema>;

export interface ChatRequest {
  message: string;
  /** תיאור הסרטון והמצב הנוכחי בעורך */
  context: string;
  /** ההודעות הקודמות בשיחה */
  history?: { role: "user" | "assistant"; text: string }[];
}

export const CHAT_SYSTEM = `You are the editing assistant inside a free Hebrew video editor for Instagram Reels (like CapCut). The creator writes what she wants in Hebrew, casually, like talking to a human editor. Translate the request into actions on the current video. Prefer doing over asking: only ask a short question when the request is truly unclear.

Actions (use only these; several are allowed, in order):
- shorter {value?: target seconds}: make the video shorter (talking: slightly faster; vibe: drop shots).
- more_energy: more dynamic transitions, zooms. calmer: softer, fewer transitions. transitions {level: none|clean|dynamic|extreme}.
- music_change {mood?}: a different song. music_off: remove music, original sound back. music_on: add music. music_volume {value 0..1}.
- captions_create: transcribe speech into captions (when there are none). captions_hide / captions_show.
- captions_style {preset}: caption style. captions_color {color}: text color. captions_highlight {color}: highlight color of the spoken word.
- captions_font {font}. captions_size {value: 0.6..1.8, 1 = normal}. captions_position {value: 0 top .. 1 bottom; middle 0.5, default 0.78}. captions_words {value 1..4}: words per caption.
- replace_word {from, to}: fix a word in all captions.
- set_hook {text}: the opening line on screen. add_text {text, start?, end?}: text on screen.
- animations {level: none|some|lots}: pop-up animations at key moments.
- filter {filter}: color look for the whole video. speed {value}: playback speed of all clips.
- cut_range {start, end}: delete that part of the video (timeline seconds). freeze {start}: freeze frame at that second.
- aspect {aspect}.
- reedit {text}: redo the whole automatic edit from scratch following these instructions (only when she asks for a completely different edit).
- open_tool {text: background|tricks|captions|music|text|media|smart}: when she asks for something done by hand (background removal, twins, split screen, picture in picture, uploading). Background removal takes time, so open the tool and explain in one sentence how.

Color names: yellow #facc15, pink #f472b6, red #ef4444, green #22c55e, blue #3b82f6, light blue #22d3ee, purple #a78bfa, orange #fb923c, white #ffffff, black #111111.
Reply in natural, warm Hebrew, 1-2 short sentences, addressing her in feminine forms. Say what you did, not how. Never invent facts about the video beyond the context.`;
