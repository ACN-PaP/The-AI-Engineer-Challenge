"""Orchestrates OpenAI tool-calling over live market data.

Flow per request (stateless, safe for serverless):
  1. Stream a Responses API call with the market-data tools available.
     - If the model answers directly (no tool needed), tokens stream straight through
       with no extra round-trip — this keeps general educational questions fast.
     - If the model requests a tool, no text is emitted yet; we execute the tool(s)
       server-side (never trusting anything the browser sent) and continue the SAME
       response via `previous_response_id`, then stream the grounded final answer.
  2. Citations are built only from tool calls that actually succeeded — the model
     never supplies its own source URLs.
"""
import json
import logging
import os
from typing import Generator, Optional

from openai import OpenAI

try:
    from api.services.market_data import (
        MarketDataError,
        get_coin_market_data,
        get_market_snapshot,
        get_price_history,
    )
except ImportError:  # pragma: no cover - exercised only under Vercel's import layout
    from services.market_data import (
        MarketDataError,
        get_coin_market_data,
        get_market_snapshot,
        get_price_history,
    )

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 3
CURRENCIES = ["usd", "thb"]

BASE_SYSTEM_PROMPT = (
    "You are a knowledgeable and cautious cryptocurrency advisor. "
    "Help users understand crypto markets, blockchain technology, coins, tokens, and investment concepts. "
    "Always include a disclaimer that this is not financial advice and users should do their own research "
    "(DYOR) before making investment decisions. "
    "Be clear, balanced, and avoid hype — present risks alongside opportunities. "
    "Use markdown formatting: bullet points for lists, **bold** for key terms, and headers when the answer is long. "
    "This app does not support trade execution, wallet/exchange connections, price alerts, or portfolio tracking — "
    "never offer to set one up; if asked, explain it's outside what this assistant can do.\n\n"
    "You have tools to retrieve LIVE market data (price, 24h change, market cap, volume) from CoinGecko. "
    "Call a tool whenever the user asks about a current/live price, market cap, volume, or how a coin is "
    "performing today — including vague follow-ups like 'is this coin up today?' or 'which one moved more?'. "
    "Do not call a tool for purely educational questions (e.g. how staking works) that don't need live numbers. "
    "NEVER state a specific current price, percentage change, market cap, or volume unless it came from a tool "
    "result in this conversation. If a tool call fails or returns an error, tell the user that current market "
    "data is unavailable right now and continue with general educational information only — do not guess or "
    "estimate a number. When you do have fresh tool data, mention when it was retrieved and that CoinGecko is "
    "the source. For answers grounded in live data, prefer this structure: Key takeaway; Current market "
    "snapshot; Opportunities/bullish factors; Risks/bearish factors; Data timestamp. Do not force this "
    "structure onto simple educational questions."
)


def _tool_definitions() -> list[dict]:
    return [
        {
            "type": "function",
            "name": "get_coin_market_data",
            "description": (
                "Get current market data for a single cryptocurrency: price, 24h change, "
                "market cap, and 24h volume. Use for questions about one specific coin."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "coin_id": {
                        "type": "string",
                        "description": "CoinGecko coin id, e.g. 'bitcoin', 'ethereum', 'solana'.",
                    },
                    "vs_currency": {"type": "string", "enum": CURRENCIES},
                },
                "required": ["coin_id", "vs_currency"],
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "get_market_snapshot",
            "description": (
                "Get current market data for multiple cryptocurrencies at once. "
                "Use when comparing two or more coins."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "coin_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "CoinGecko coin ids, e.g. ['bitcoin', 'ethereum'].",
                    },
                    "vs_currency": {"type": "string", "enum": CURRENCIES},
                },
                "required": ["coin_ids", "vs_currency"],
                "additionalProperties": False,
            },
        },
        {
            "type": "function",
            "name": "get_price_history",
            "description": (
                "Get recent daily price history for one coin. Use for trend questions beyond "
                "the 24h change, e.g. 'how has it done over the last week'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "coin_id": {"type": "string"},
                    "days": {"type": "integer", "description": "Number of days of history."},
                    "vs_currency": {"type": "string", "enum": CURRENCIES},
                },
                "required": ["coin_id", "days", "vs_currency"],
                "additionalProperties": False,
            },
        },
    ]


def get_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-5")


_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _execute_tool(name: str, arguments_json: str) -> dict:
    try:
        args = json.loads(arguments_json or "{}")
    except json.JSONDecodeError:
        return {"error": "invalid_arguments", "message": "Could not parse tool arguments."}

    try:
        if name == "get_coin_market_data":
            return get_coin_market_data(args.get("coin_id", ""), args.get("vs_currency", "usd"))
        if name == "get_market_snapshot":
            return {"items": get_market_snapshot(args.get("coin_ids", []), args.get("vs_currency", "usd"))}
        if name == "get_price_history":
            return get_price_history(
                args.get("coin_id", ""),
                int(args.get("days", 7) or 7),
                args.get("vs_currency", "usd"),
            )
        return {"error": "unknown_tool", "message": f"Unknown tool: {name}"}
    except MarketDataError as exc:
        logger.warning("Market data tool %s failed: %s", name, exc)
        return {"error": "market_data_unavailable", "message": str(exc)}
    except Exception:
        logger.exception("Unexpected error executing tool %s", name)
        return {"error": "tool_execution_failed", "message": "Unexpected error retrieving market data."}


def citation_from_entry(entry: dict) -> dict:
    coin_id = entry.get("id") or "coin"
    name = entry.get("name") or coin_id
    symbol = entry.get("symbol") or ""
    label = f"{name} ({symbol})" if symbol else name
    return {
        "id": f"coingecko-{coin_id}-{entry.get('retrieved_at', '')}",
        "title": f"{label} market data — CoinGecko",
        "source": entry.get("source", "CoinGecko"),
        "url": entry.get("source_url", "https://www.coingecko.com"),
        "retrievedAt": entry.get("retrieved_at"),
    }


def citations_from_tool_result(name: str, result: dict) -> list[dict]:
    """Build citations only from a tool result that actually succeeded."""
    if not isinstance(result, dict) or result.get("error"):
        return []
    if name == "get_market_snapshot":
        return [citation_from_entry(e) for e in result.get("items", [])]
    if name in ("get_coin_market_data", "get_price_history"):
        return [citation_from_entry(result)]
    return []


def _dedupe_citations(citations: list[dict]) -> list[dict]:
    seen: set[str] = set()
    deduped = []
    for c in citations:
        if c["id"] in seen:
            continue
        seen.add(c["id"])
        deduped.append(c)
    return deduped


def _build_instructions(selected_coin_id: Optional[str], currency: str) -> str:
    context_lines = [f"Default currency for market data: {currency}."]
    if selected_coin_id:
        context_lines.append(
            f"The user currently has the coin '{selected_coin_id}' selected in the app UI. "
            f"If they refer to 'this coin', 'it', or don't name a coin, assume they mean '{selected_coin_id}'."
        )
    return BASE_SYSTEM_PROMPT + "\n\n" + " ".join(context_lines)


def run_agent_stream(
    messages: list[dict],
    selected_coin_id: Optional[str] = None,
    currency: str = "usd",
) -> Generator[tuple[str, object], None, None]:
    """Yield ("token", str) | ("citations", list[dict]) | ("error", dict) | ("done", None)."""
    client = get_client()
    model = get_model()
    currency = currency if currency in CURRENCIES else "usd"
    tools = _tool_definitions()
    instructions = _build_instructions(selected_coin_id, currency)

    current_input: list = list(messages)
    previous_response_id: Optional[str] = None
    citations: list[dict] = []

    for _round in range(MAX_TOOL_ROUNDS):
        kwargs: dict = dict(
            model=model,
            input=current_input,
            tools=tools,
            tool_choice="auto",
            stream=True,
        )
        if previous_response_id:
            kwargs["previous_response_id"] = previous_response_id
        else:
            kwargs["instructions"] = instructions

        try:
            stream = client.responses.create(**kwargs)
        except Exception:
            logger.exception("Failed to start OpenAI response stream")
            yield (
                "error",
                {"code": "llm_unavailable", "message": "The assistant is temporarily unavailable. Please try again."},
            )
            return

        text_emitted = False
        final_response = None
        try:
            for event in stream:
                if event.type == "response.output_text.delta":
                    text_emitted = True
                    yield ("token", event.delta)
                elif event.type == "response.completed":
                    final_response = event.response
                elif event.type in ("response.failed", "response.incomplete"):
                    final_response = getattr(event, "response", None)
        except Exception:
            logger.exception("OpenAI stream interrupted")
            yield (
                "error",
                {"code": "stream_interrupted", "message": "The response was interrupted. Please try again."},
            )
            return

        if final_response is None:
            yield ("error", {"code": "empty_response", "message": "No response was generated. Please try again."})
            return

        function_calls = [item for item in final_response.output if item.type == "function_call"]

        if not function_calls:
            if not text_emitted:
                yield (
                    "error",
                    {"code": "empty_response", "message": "No response was generated. Please try again."},
                )
                return
            if citations:
                yield ("citations", _dedupe_citations(citations))
            yield ("done", None)
            return

        previous_response_id = final_response.id
        current_input = []
        for call in function_calls:
            result = _execute_tool(call.name, call.arguments)
            citations.extend(citations_from_tool_result(call.name, result))
            current_input.append(
                {
                    "type": "function_call_output",
                    "call_id": call.call_id,
                    "output": json.dumps(result),
                }
            )

    yield (
        "error",
        {"code": "tool_loop_limit", "message": "Could not complete the request after multiple attempts. Please try again."},
    )


def run_agent_once(
    messages: list[dict],
    selected_coin_id: Optional[str] = None,
    currency: str = "usd",
) -> dict:
    """Non-streaming variant used by /api/chat, sharing the same tool-calling logic."""
    text_parts: list[str] = []
    citations: list[dict] = []
    for event_type, payload in run_agent_stream(messages, selected_coin_id, currency):
        if event_type == "token":
            text_parts.append(payload)
        elif event_type == "citations":
            citations = payload
        elif event_type == "error":
            return {"error": payload}
        elif event_type == "done":
            break
    return {"reply": "".join(text_parts), "citations": citations}
