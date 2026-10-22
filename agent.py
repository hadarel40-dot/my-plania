"""The Claude side: system prompt, tools, and the agent loop for one incoming message."""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import anthropic

import store

log = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
HISTORY_TURNS = 30  # past messages (user + assistant) sent with each request
MAX_TOOL_ROUNDS = 10
TZ = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Jerusalem"))
BASE_DIR = Path(__file__).parent

client = anthropic.Anthropic()


def _load_system_prompt() -> str:
    parts = [(BASE_DIR / "prompt.md").read_text(encoding="utf-8")]
    knowledge_dir = BASE_DIR / "knowledge"
    for path in sorted(knowledge_dir.glob("*")):
        if path.suffix not in (".md", ".txt") or path.name == "README.md":
            continue
        parts.append(f'<document name="{path.name}">\n{path.read_text(encoding="utf-8")}\n</document>')
    return "\n\n".join(parts)


SYSTEM_PROMPT = _load_system_prompt()

TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 5},
    {
        "name": "save_note",
        "description": "Save a note to the user's long-term memory (things they asked you to remember, preferences, facts about them).",
        "input_schema": {
            "type": "object",
            "properties": {"text": {"type": "string", "description": "The note to save"}},
            "required": ["text"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "list_notes",
        "description": "List all saved notes with their ids.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "delete_note",
        "description": "Delete a saved note by id.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "integer"}},
            "required": ["id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "set_reminder",
        "description": (
            "Schedule a WhatsApp reminder to the user. `due_at` is a local date-time in the user's "
            "timezone, format YYYY-MM-DDTHH:MM. Resolve relative times ('tomorrow at 9') using the current time "
            "given in the conversation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "What to remind the user about"},
                "due_at": {"type": "string", "description": "Local time, YYYY-MM-DDTHH:MM"},
            },
            "required": ["text", "due_at"],
            "additionalProperties": False,
        },
        "strict": True,
    },
    {
        "name": "list_reminders",
        "description": "List upcoming (not yet sent) reminders with their ids.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "cancel_reminder",
        "description": "Cancel an upcoming reminder by id.",
        "input_schema": {
            "type": "object",
            "properties": {"id": {"type": "integer"}},
            "required": ["id"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]


def _to_local(utc_iso: str) -> str:
    return datetime.fromisoformat(utc_iso).astimezone(TZ).strftime("%Y-%m-%d %H:%M")


def run_tool(name: str, args: dict) -> str:
    if name == "save_note":
        return f"saved note #{store.add_note(args['text'])}"
    if name == "list_notes":
        notes = store.list_notes()
        return json.dumps(notes, ensure_ascii=False) if notes else "no notes"
    if name == "delete_note":
        return "deleted" if store.delete_note(args["id"]) else "note not found"
    if name == "set_reminder":
        local = datetime.strptime(args["due_at"], "%Y-%m-%dT%H:%M").replace(tzinfo=TZ)
        if local <= datetime.now(TZ):
            return "error: due_at is in the past"
        rid = store.add_reminder(args["text"], local.astimezone(timezone.utc).isoformat())
        return f"reminder #{rid} set for {local.strftime('%Y-%m-%d %H:%M')}"
    if name == "list_reminders":
        items = [{**r, "due_at": _to_local(r["due_at"])} for r in store.pending_reminders()]
        return json.dumps(items, ensure_ascii=False) if items else "no upcoming reminders"
    if name == "cancel_reminder":
        return "cancelled" if store.cancel_reminder(args["id"]) else "reminder not found"
    raise ValueError(f"unknown tool {name}")


def reply_to(user_text: str) -> str:
    """Run the agent on one incoming WhatsApp message and return the reply text."""
    now = datetime.now(TZ).strftime("%A %Y-%m-%d %H:%M")
    # History holds only final text turns, so it never carries thinking blocks across turns.
    messages = store.recent_history(HISTORY_TURNS)
    messages.append({"role": "user", "content": f"[{now}]\n{user_text}"})

    response = None
    for _ in range(MAX_TOOL_ROUNDS):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=messages,
            output_config={"effort": "medium"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            return "מצטער, אני לא יכול לעזור בזה."
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "pause_turn":
            continue  # long server-tool turn (web search); send it back to resume
        if response.stop_reason != "tool_use":
            break

        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                content, is_error = run_tool(block.name, block.input), False
            except Exception as e:  # report tool failures back to Claude instead of crashing
                log.exception("tool %s failed", block.name)
                content, is_error = f"error: {e}", True
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": content, "is_error": is_error})
        messages.append({"role": "user", "content": results})

    text = "\n".join(b.text for b in response.content if b.type == "text").strip()
    if not text:
        text = "בוצע ✅"
    store.add_history("user", f"[{now}]\n{user_text}")
    store.add_history("assistant", text)
    return text
