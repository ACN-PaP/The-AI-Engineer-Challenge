import httpx
import pytest

from api.services import market_data


@pytest.fixture(autouse=True)
def clear_cache():
    market_data._cache.clear()
    yield
    market_data._cache.clear()


class FakeHttpResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://api.coingecko.com/x")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    def json(self):
        return self._json


def _coingecko_row(coin_id="bitcoin", symbol="btc", name="Bitcoin"):
    return {
        "id": coin_id,
        "symbol": symbol,
        "name": name,
        "current_price": 71000.5,
        "price_change_percentage_24h": 3.2,
        "market_cap": 1_000_000_000_000,
        "total_volume": 30_000_000_000,
    }


def test_get_market_snapshot_normalizes_fields(monkeypatch):
    monkeypatch.setattr(
        market_data.httpx, "get", lambda *a, **k: FakeHttpResponse([_coingecko_row()])
    )

    result = market_data.get_market_snapshot(["bitcoin"], "usd")

    assert result[0]["id"] == "bitcoin"
    assert result[0]["symbol"] == "BTC"
    assert result[0]["price"] == 71000.5
    assert result[0]["change_24h_pct"] == 3.2
    assert result[0]["source"] == "CoinGecko"
    assert result[0]["source_url"] == "https://www.coingecko.com/en/coins/bitcoin"
    assert "retrieved_at" in result[0]


def test_get_market_snapshot_uses_cache_within_ttl(monkeypatch):
    calls = {"n": 0}

    def fake_get(*args, **kwargs):
        calls["n"] += 1
        return FakeHttpResponse([_coingecko_row()])

    monkeypatch.setattr(market_data.httpx, "get", fake_get)

    market_data.get_market_snapshot(["bitcoin"], "usd")
    market_data.get_market_snapshot(["bitcoin"], "usd")

    assert calls["n"] == 1


def test_get_market_snapshot_raises_market_data_error_on_timeout(monkeypatch):
    def fake_get(*args, **kwargs):
        raise httpx.TimeoutException("boom")

    monkeypatch.setattr(market_data.httpx, "get", fake_get)

    with pytest.raises(market_data.MarketDataError):
        market_data.get_market_snapshot(["bitcoin"], "usd")


def test_get_market_snapshot_raises_on_http_error(monkeypatch):
    monkeypatch.setattr(
        market_data.httpx, "get", lambda *a, **k: FakeHttpResponse({}, status_code=429)
    )

    with pytest.raises(market_data.MarketDataError):
        market_data.get_market_snapshot(["bitcoin"], "usd")


def test_get_market_snapshot_requires_coin_ids():
    with pytest.raises(market_data.MarketDataError):
        market_data.get_market_snapshot([], "usd")


def test_unsupported_currency_raises():
    with pytest.raises(market_data.MarketDataError):
        market_data.get_market_snapshot(["bitcoin"], "eur")


def test_get_coin_market_data_not_found(monkeypatch):
    monkeypatch.setattr(market_data.httpx, "get", lambda *a, **k: FakeHttpResponse([]))

    with pytest.raises(market_data.MarketDataError):
        market_data.get_coin_market_data("doesnotexist", "usd")


def test_get_price_history_returns_prices(monkeypatch):
    monkeypatch.setattr(
        market_data.httpx,
        "get",
        lambda *a, **k: FakeHttpResponse({"prices": [[1, 100.0], [2, 101.0]]}),
    )

    result = market_data.get_price_history("bitcoin", days=7, vs_currency="usd")

    assert result["prices"] == [[1, 100.0], [2, 101.0]]
    assert result["source"] == "CoinGecko"
    assert "retrieved_at" in result
