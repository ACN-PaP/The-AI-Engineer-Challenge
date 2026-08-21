import json
import logging
import os
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crypto_advisor")

try:
    from api.models import ChatRequest
    from api.services.conversation import trim_history
    from api.services.crypto_agent import run_agent_once, run_agent_stream
except ImportError:  # pragma: no cover - exercised only under Vercel's import layout
    from models import ChatRequest
    from services.conversation import trim_history
    from services.crypto_agent import run_agent_once, run_agent_stream

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/")
def root():
    return {"status": "ok"}


NEWS_FEED_URL = "https://cointelegraph.com/rss"


@app.get("/api/news")
def news():
    try:
        req = Request(NEWS_FEED_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=5) as res:
            feed = ElementTree.fromstring(res.read())

        items = []
        for item in feed.findall("./channel/item")[:12]:
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            if title and link:
                items.append({
                    "title": title,
                    "link": link,
                    "source": "Cointelegraph",
                    "pubDate": pub_date,
                })
        return {"items": items}
    except Exception as e:
        logger.warning("Failed to fetch news feed: %s", e)
        raise HTTPException(status_code=502, detail="Unable to fetch news right now.")


@app.post("/api/chat")
def chat(request: ChatRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    history = trim_history(request.messages)
    result = run_agent_once(history, request.selected_coin_id, request.currency)

    if "error" in result:
        logger.warning("Chat request failed: %s", result["error"])
        raise HTTPException(status_code=502, detail=result["error"]["message"])

    return {"reply": result["reply"], "citations": result["citations"]}


def _stream_events(request: ChatRequest):
    history = trim_history(request.messages)
    try:
        for event_type, payload in run_agent_stream(history, request.selected_coin_id, request.currency):
            if event_type == "token":
                yield f"data: {json.dumps({'type': 'token', 'token': payload})}\n\n"
            elif event_type == "citations":
                yield f"data: {json.dumps({'type': 'citations', 'citations': payload})}\n\n"
            elif event_type == "error":
                logger.warning("Agent stream error: %s", payload)
                yield f"data: {json.dumps({'type': 'error', 'error': payload})}\n\n"
                return
            elif event_type == "done":
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return
    except Exception:
        logger.exception("Unhandled error while streaming chat response")
        yield (
            "data: "
            + json.dumps({
                "type": "error",
                "error": {"code": "internal_error", "message": "Something went wrong. Please try again."},
            })
            + "\n\n"
        )


@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return StreamingResponse(
        _stream_events(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
