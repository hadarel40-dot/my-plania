"""WhatsApp Cloud API webhook server.

Run: uvicorn app:app --host 0.0.0.0 --port 8000
"""

import asyncio
import hashlib
import hmac
import logging
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse

import agent
import store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("whatsapp-agent")

WHATSAPP_TOKEN = os.environ["WHATSAPP_TOKEN"]
PHONE_NUMBER_ID = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
VERIFY_TOKEN = os.environ["WHATSAPP_VERIFY_TOKEN"]
APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
OWNER_PHONE = os.environ["OWNER_PHONE"]
GRAPH_URL = f"https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages"
WHATSAPP_MAX_LEN = 4096


def send_whatsapp(to: str, text: str) -> None:
    for i in range(0, len(text), WHATSAPP_MAX_LEN):
        r = httpx.post(
            GRAPH_URL,
            headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": text[i : i + WHATSAPP_MAX_LEN]},
            },
            timeout=30,
        )
        if r.status_code >= 400:
            log.error("WhatsApp send failed: %s %s", r.status_code, r.text)


def handle_message(sender: str, text: str) -> None:
    if text.strip() in ("/reset", "/new"):
        store.clear_history()
        send_whatsapp(sender, "התחלנו שיחה חדשה 🧹 (הפתקים והתזכורות נשמרו)")
        return
    try:
        reply = agent.reply_to(text)
    except Exception:
        log.exception("agent failed")
        reply = "אופס, משהו השתבש. נסה שוב בעוד רגע."
    send_whatsapp(sender, reply)


async def reminder_loop() -> None:
    while True:
        for r in await asyncio.to_thread(store.due_reminders):
            await asyncio.to_thread(send_whatsapp, OWNER_PHONE, f"⏰ תזכורת: {r['text']}")
            await asyncio.to_thread(store.mark_reminder_sent, r["id"])
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(reminder_loop())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)


@app.get("/webhook")
def verify(request: Request):
    """Meta calls this once when you register the webhook URL."""
    p = request.query_params
    if p.get("hub.mode") == "subscribe" and p.get("hub.verify_token") == VERIFY_TOKEN:
        return PlainTextResponse(p.get("hub.challenge", ""))
    raise HTTPException(status_code=403)


@app.post("/webhook")
async def receive(request: Request, background: BackgroundTasks):
    body = await request.body()
    if APP_SECRET:
        expected = "sha256=" + hmac.new(APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, request.headers.get("X-Hub-Signature-256", "")):
            raise HTTPException(status_code=401)

    data = await request.json()
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            for msg in change.get("value", {}).get("messages", []):
                sender = msg.get("from")
                if sender != OWNER_PHONE:
                    log.info("ignoring message from %s", sender)
                    continue
                if not store.mark_seen(msg["id"]):
                    continue
                if msg.get("type") == "text":
                    background.add_task(handle_message, sender, msg["text"]["body"])
                else:
                    background.add_task(send_whatsapp, sender, "כרגע אני מבין רק הודעות טקסט 🙂")
    # Always answer 200 quickly, otherwise Meta keeps retrying.
    return {"ok": True}


@app.get("/")
def health():
    return {"status": "ok"}
