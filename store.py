"""SQLite storage: conversation history, notes, reminders, processed message ids."""

import os
import sqlite3
import threading
from datetime import datetime, timezone

_lock = threading.Lock()
_conn = sqlite3.connect(os.environ.get("DB_PATH", "agent.db"), check_same_thread=False)
_conn.row_factory = sqlite3.Row
_conn.executescript(
    """
    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        due_at TEXT NOT NULL,
        sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS seen_messages (
        id TEXT PRIMARY KEY
    );
    """
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _exec(sql: str, args: tuple = ()) -> sqlite3.Cursor:
    with _lock:
        cur = _conn.execute(sql, args)
        _conn.commit()
        return cur


def mark_seen(message_id: str) -> bool:
    """Return True if this is the first time we see the message (Meta retries webhooks)."""
    try:
        _exec("INSERT INTO seen_messages (id) VALUES (?)", (message_id,))
        return True
    except sqlite3.IntegrityError:
        return False


# --- history ---------------------------------------------------------------

def add_history(role: str, text: str) -> None:
    _exec("INSERT INTO history (role, text, created_at) VALUES (?, ?, ?)", (role, text, _now()))


def recent_history(limit: int) -> list[dict]:
    rows = _exec("SELECT role, text FROM history ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{"role": r["role"], "content": r["text"]} for r in reversed(rows)]


def clear_history() -> None:
    _exec("DELETE FROM history")


# --- notes -----------------------------------------------------------------

def add_note(text: str) -> int:
    return _exec("INSERT INTO notes (text, created_at) VALUES (?, ?)", (text, _now())).lastrowid


def list_notes() -> list[dict]:
    return [dict(r) for r in _exec("SELECT id, text, created_at FROM notes ORDER BY id").fetchall()]


def delete_note(note_id: int) -> bool:
    return _exec("DELETE FROM notes WHERE id = ?", (note_id,)).rowcount > 0


# --- reminders -------------------------------------------------------------

def add_reminder(text: str, due_at_utc: str) -> int:
    return _exec("INSERT INTO reminders (text, due_at) VALUES (?, ?)", (text, due_at_utc)).lastrowid


def pending_reminders() -> list[dict]:
    return [dict(r) for r in _exec(
        "SELECT id, text, due_at FROM reminders WHERE sent = 0 ORDER BY due_at"
    ).fetchall()]


def due_reminders() -> list[dict]:
    return [dict(r) for r in _exec(
        "SELECT id, text, due_at FROM reminders WHERE sent = 0 AND due_at <= ?", (_now(),)
    ).fetchall()]


def mark_reminder_sent(reminder_id: int) -> None:
    _exec("UPDATE reminders SET sent = 1 WHERE id = ?", (reminder_id,))


def cancel_reminder(reminder_id: int) -> bool:
    return _exec("DELETE FROM reminders WHERE id = ? AND sent = 0", (reminder_id,)).rowcount > 0
