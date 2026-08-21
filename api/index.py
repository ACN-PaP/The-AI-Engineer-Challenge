from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from urllib.request import urlopen, Request
from xml.etree import ElementTree
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = (
    "You are a knowledgeable and cautious cryptocurrency advisor. "
    "Help users understand crypto markets, blockchain technology, coins, tokens, and investment concepts. "
    "Always include a disclaimer that this is not financial advice and users should do their own research (DYOR) before making investment decisions. "
    "Be clear, balanced, and avoid hype — present risks alongside opportunities. "
    "Use markdown formatting: bullet points for lists, **bold** for key terms, and headers when the answer is long."
)

class ChatRequest(BaseModel):
    message: str

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
        raise HTTPException(status_code=502, detail=f"Error fetching news: {str(e)}")

@app.post("/api/chat")
def chat(request: ChatRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    try:
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request.message}
            ]
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling OpenAI API: {str(e)}")

def _stream_tokens(message: str):
    try:
        response = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message}
            ],
            stream=True,
        )
        for chunk in response:
            token = chunk.choices[0].delta.content
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return StreamingResponse(
        _stream_tokens(request.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
