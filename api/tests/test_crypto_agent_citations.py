from api.services.crypto_agent import citation_from_entry, citations_from_tool_result


def _entry(coin_id="bitcoin", name="Bitcoin", symbol="BTC"):
    return {
        "id": coin_id,
        "name": name,
        "symbol": symbol,
        "retrieved_at": "2026-08-21T00:00:00+00:00",
        "source": "CoinGecko",
        "source_url": f"https://www.coingecko.com/en/coins/{coin_id}",
    }


def test_citation_from_entry_shape():
    citation = citation_from_entry(_entry())
    assert citation["source"] == "CoinGecko"
    assert citation["url"] == "https://www.coingecko.com/en/coins/bitcoin"
    assert citation["retrievedAt"] == "2026-08-21T00:00:00+00:00"
    assert "Bitcoin" in citation["title"] and "BTC" in citation["title"]


def test_citations_from_single_coin_tool_result():
    citations = citations_from_tool_result("get_coin_market_data", _entry())
    assert len(citations) == 1


def test_citations_from_price_history_tool_result():
    entry = _entry()
    entry["prices"] = [[1, 100.0]]
    citations = citations_from_tool_result("get_price_history", entry)
    assert len(citations) == 1


def test_citations_from_snapshot_tool_result_returns_one_per_coin():
    result = {"items": [_entry("bitcoin"), _entry("ethereum", "Ethereum", "ETH")]}
    citations = citations_from_tool_result("get_market_snapshot", result)
    assert len(citations) == 2
    assert {c["url"] for c in citations} == {
        "https://www.coingecko.com/en/coins/bitcoin",
        "https://www.coingecko.com/en/coins/ethereum",
    }


def test_no_citation_when_tool_result_errored():
    citations = citations_from_tool_result(
        "get_coin_market_data", {"error": "market_data_unavailable", "message": "boom"}
    )
    assert citations == []


def test_no_citation_for_unrecognized_tool():
    citations = citations_from_tool_result("some_other_tool", _entry())
    assert citations == []
