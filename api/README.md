# Crypto Advisor API Backend

A FastAPI backend that powers the Crypto Advisor chat app. It streams answers from
OpenAI, grounds any live-market claim in real CoinGecko data via tool calling, and
returns server-built citations so the frontend never has to trust anything the model
says about current prices.

## Prerequisites

- [`uv`](https://github.com/astral-sh/uv) package manager (`pip install uv`)
- `uv` will provision Python 3.12 automatically for this project, so no separate interpreter installation is required
- An OpenAI API key available as the `OPENAI_API_KEY` environment variable when you run the server

## Setup

All commands below assume you are running them from the repository root.

```bash
uv sync
```

`uv` creates `.venv/` automatically on first sync (and downloads Python 3.12 if needed).

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Yes | — | Used by the OpenAI SDK. Never sent to the frontend. |
| `OPENAI_MODEL` | No | `gpt-5` | Model used for both `/api/chat` and `/api/chat/stream`. Change this without touching code. |

```bash
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-5   # optional override
```

## Running the server

```bash
uv run uvicorn api.index:app --reload
```

Runs on `http://localhost:8000` with auto-reload. If port 8000 is already in use:

```bash
lsof -ti:8000 | xargs kill -9
```

## Architecture

- `api/index.py` — FastAPI app and routes only; delegates to the services below.
- `api/models.py` — request/response validation (Pydantic).
- `api/services/market_data.py` — CoinGecko client. All requests happen server-side,
  with a timeout, a short-lived cache, and a `MarketDataError` on any failure (timeout,
  HTTP error, bad payload). The frontend's displayed prices (ticker/chart) are never
  trusted or reused here — every tool call fetches fresh, independently verified data.
- `api/services/conversation.py` — trims incoming history to the last 20 messages /
  16,000 characters before it's sent to OpenAI. History is entirely client-managed
  (sent fresh on every request); nothing is kept in process memory, so this is safe to
  run on stateless/serverless infrastructure (e.g. Vercel).
- `api/services/crypto_agent.py` — orchestrates OpenAI's Responses API with tool
  calling. A single streamed call either answers directly (general questions — no
  wasted round-trip) or requests a tool; on a tool call, the backend executes it,
  continues the *same* response via `previous_response_id`, and streams the grounded
  final answer. Citations are built only from tool calls that actually succeeded — the
  model can never supply its own source URL.

## API endpoints

### `POST /api/chat/stream` — streaming chat (SSE)

**Request body:**

```json
{
  "messages": [
    { "role": "user", "content": "Tell me about Ethereum staking." },
    { "role": "assistant", "content": "Ethereum staking means..." },
    { "role": "user", "content": "What are its main risks?" }
  ],
  "selected_coin_id": "ethereum",
  "currency": "usd"
}
```

- `messages` — required, 1–50 items. `role` must be `user` or `assistant`. User
  message content is capped at 4,000 characters; assistant content (replayed history)
  is capped at 8,000 characters, since it's our own generated text rather than
  free-form user input.
- `selected_coin_id` — optional. The coin currently selected in the app's watchlist/
  chart. Lets the model resolve "this coin" / "it" without the user naming it again.
- `currency` — `"usd"` (default) or `"thb"`. Only `usd` is exercised by the UI today;
  `thb` is already wired through the tools and CoinGecko support, ready for a future
  currency switcher.

**Response:** `text/event-stream`. Each line is `data: <json>\n\n` with one of:

```text
{"type": "token", "token": "Bitcoin is currently..."}
{"type": "citations", "citations": [{"id": "...", "title": "...", "source": "CoinGecko", "url": "...", "retrievedAt": "2026-08-21T04:11:43.69Z"}]}
{"type": "error", "error": {"code": "market_data_unavailable", "message": "..."}}
{"type": "done"}
```

- `token` events stream the answer incrementally.
- `citations` (0 or 1 per response) is only sent when at least one tool call
  succeeded — never sent, and never fabricated, if market data was unavailable.
- `error` carries a safe, user-facing message; raw OpenAI/CoinGecko exceptions are
  logged server-side and never forwarded to the client. Error codes: `llm_unavailable`,
  `stream_interrupted`, `empty_response`, `tool_loop_limit`, `internal_error`.
- `done` marks a normal, complete end of stream. The frontend treats a stream that
  ends *without* a `done` event as an interrupted, retryable error rather than a
  finished answer.

### `POST /api/chat` — non-streaming variant

Same request body as above. Shares the exact same agent logic as the streaming
endpoint (`run_agent_once` wraps `run_agent_stream`). Returns:

```json
{ "reply": "string", "citations": [ { "...": "..." } ] }
```

### `GET /api/news`

Unchanged — returns the latest Cointelegraph RSS headlines. See
[`frontend/components/news-panel.tsx`](../frontend/components/news-panel.tsx).

### `GET /`

Health check: `{"status": "ok"}`.

## Manual test steps

1. Start the backend (`uv run uvicorn api.index:app --reload`) and the frontend
   (`cd frontend && npm run dev`), pointing `frontend/.env.development.local` at
   `http://localhost:8000`.
2. **Live market data:** ask "What is the current Bitcoin price and how much has it
   moved today?" — expect a real price/24h change, a retrieval timestamp, and a
   clickable CoinGecko source card under the answer.
3. **Selected-coin context:** select Ethereum in the watchlist, ask "Is this coin up
   today?" — expect the answer to resolve "this coin" to Ethereum without you naming it.
4. **Conversation memory:** ask "Compare Bitcoin and Ethereum," then ask "Which one had
   the larger 24-hour move?" — expect the second answer to understand "which one" from
   history and re-cite fresh data.
5. **General question:** ask "How does proof of stake work?" — expect a normal answer
   with no CoinGecko tool call and no Sources section.
6. **Data-provider failure:** temporarily break connectivity to
   `api.coingecko.com` (or monkeypatch `market_data.httpx.get` to raise, as the
   automated tests do) and ask a price question — expect the assistant to say current
   data is unavailable, with no fabricated number and no citation.
7. **New chat:** click "New chat" — expect messages, follow-ups, and citations to reset.
8. **Retry:** if a request fails or is interrupted, expect a "Retry" action on that
   message that resends the same conversation without duplicating the user's turn.

## Automated tests

```bash
uv run pytest api/tests/ -v
```

Covers: request validation (roles, length caps, coin-id/currency validation),
history trimming, CoinGecko client caching/timeout/error handling, citation
construction (including "no citation on failure"), and the full tool-calling loop
against a fake OpenAI client (no real API calls).

## CORS

The API accepts requests from any origin (`*`) — adjust in `api/index.py` if you need
to restrict it.
