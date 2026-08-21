"""CoinGecko market-data client with short-lived caching and safe error handling.

All requests happen server-side only — the browser never supplies a price that gets
trusted or repeated back by the assistant.
"""
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"
REQUEST_TIMEOUT_SECONDS = 6.0
CACHE_TTL_SECONDS = 45
SUPPORTED_CURRENCIES = {"usd", "thb"}
SOURCE_NAME = "CoinGecko"


class MarketDataError(Exception):
    """Raised whenever current CoinGecko data cannot be retrieved or parsed."""


_cache: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        _cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)


def _normalize_currency(vs_currency: str) -> str:
    currency = (vs_currency or "usd").strip().lower()
    if currency not in SUPPORTED_CURRENCIES:
        raise MarketDataError(f"Unsupported currency: {vs_currency!r}")
    return currency


def _coin_source_url(coin_id: str) -> str:
    return f"https://www.coingecko.com/en/coins/{coin_id}"


def _get_json(url: str, params: dict) -> Any:
    try:
        response = httpx.get(url, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except httpx.TimeoutException as exc:
        raise MarketDataError("CoinGecko request timed out.") from exc
    except httpx.HTTPStatusError as exc:
        raise MarketDataError(f"CoinGecko returned HTTP {exc.response.status_code}.") from exc
    except httpx.RequestError as exc:
        raise MarketDataError("CoinGecko request failed.") from exc
    except ValueError as exc:
        raise MarketDataError("CoinGecko returned an invalid response.") from exc


def _normalize_entry(raw: dict, vs_currency: str, retrieved_at: str) -> dict:
    coin_id = raw.get("id") or ""
    return {
        "id": coin_id,
        "symbol": (raw.get("symbol") or "").upper(),
        "name": raw.get("name") or coin_id,
        "price": raw.get("current_price"),
        "change_24h_pct": raw.get("price_change_percentage_24h"),
        "market_cap": raw.get("market_cap"),
        "volume_24h": raw.get("total_volume"),
        "vs_currency": vs_currency,
        "retrieved_at": retrieved_at,
        "source": SOURCE_NAME,
        "source_url": _coin_source_url(coin_id),
    }


def get_market_snapshot(coin_ids: list[str], vs_currency: str = "usd") -> list[dict]:
    """Fetch current price, 24h change, market cap, and volume for one or more coins."""
    currency = _normalize_currency(vs_currency)
    ids = sorted({c.strip().lower() for c in (coin_ids or []) if c and c.strip()})
    if not ids:
        raise MarketDataError("At least one coin_id is required.")

    cache_key = f"snapshot:{currency}:{','.join(ids)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    payload = _get_json(
        f"{COINGECKO_BASE_URL}/coins/markets",
        {"vs_currency": currency, "ids": ",".join(ids)},
    )
    if not isinstance(payload, list) or not payload:
        raise MarketDataError(f"No market data found for: {', '.join(ids)}")

    retrieved_at = datetime.now(timezone.utc).isoformat()
    result = [_normalize_entry(entry, currency, retrieved_at) for entry in payload]
    _cache_set(cache_key, result)
    return result


def get_coin_market_data(coin_id: str, vs_currency: str = "usd") -> dict:
    """Fetch current market data for a single coin."""
    if not coin_id or not coin_id.strip():
        raise MarketDataError("coin_id is required.")
    normalized_id = coin_id.strip().lower()
    results = get_market_snapshot([normalized_id], vs_currency)
    match = next((r for r in results if r["id"] == normalized_id), None)
    if match is None:
        raise MarketDataError(f"No market data found for: {coin_id}")
    return match


def get_price_history(coin_id: str, days: int = 7, vs_currency: str = "usd") -> dict:
    """Fetch recent daily price history for a single coin."""
    if not coin_id or not coin_id.strip():
        raise MarketDataError("coin_id is required.")
    currency = _normalize_currency(vs_currency)
    coin = coin_id.strip().lower()
    bounded_days = max(1, min(int(days or 7), 90))

    cache_key = f"history:{currency}:{coin}:{bounded_days}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    payload = _get_json(
        f"{COINGECKO_BASE_URL}/coins/{coin}/market_chart",
        {"vs_currency": currency, "days": bounded_days},
    )
    prices = payload.get("prices") if isinstance(payload, dict) else None
    if not prices:
        raise MarketDataError(f"No price history found for: {coin}")

    retrieved_at = datetime.now(timezone.utc).isoformat()
    result = {
        "id": coin,
        "vs_currency": currency,
        "days": bounded_days,
        "prices": prices,
        "retrieved_at": retrieved_at,
        "source": SOURCE_NAME,
        "source_url": _coin_source_url(coin),
    }
    _cache_set(cache_key, result)
    return result
