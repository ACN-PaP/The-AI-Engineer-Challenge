import json
from types import SimpleNamespace

from api.services import crypto_agent
from api.services.market_data import MarketDataError


def _event(type_, **kwargs):
    return SimpleNamespace(type=type_, **kwargs)


class _FakeResponse:
    def __init__(self, id_, output):
        self.id = id_
        self.output = output


def _function_call(name, arguments, call_id):
    return SimpleNamespace(type="function_call", name=name, arguments=arguments, call_id=call_id)


def test_run_agent_stream_executes_tool_then_streams_grounded_answer(monkeypatch):
    calls = {"n": 0}

    def fake_get_coin_market_data(coin_id, vs_currency):
        calls["n"] += 1
        return {
            "id": "bitcoin",
            "symbol": "BTC",
            "name": "Bitcoin",
            "price": 71000.0,
            "change_24h_pct": 5.0,
            "market_cap": 1e12,
            "volume_24h": 3e10,
            "vs_currency": vs_currency,
            "retrieved_at": "2026-08-21T00:00:00+00:00",
            "source": "CoinGecko",
            "source_url": "https://www.coingecko.com/en/coins/bitcoin",
        }

    monkeypatch.setattr(crypto_agent, "get_coin_market_data", fake_get_coin_market_data)

    round_1_events = [
        _event("response.output_item.added"),
        _event("response.function_call_arguments.delta"),
        _event(
            "response.completed",
            response=_FakeResponse(
                "resp_1",
                [_function_call("get_coin_market_data", json.dumps({"coin_id": "bitcoin", "vs_currency": "usd"}), "call_1")],
            ),
        ),
    ]
    round_2_events = [
        _event("response.output_text.delta", delta="Bitcoin is "),
        _event("response.output_text.delta", delta="$71,000."),
        _event("response.completed", response=_FakeResponse("resp_2", [])),
    ]

    create_calls = []

    class FakeResponses:
        def create(self, **kwargs):
            create_calls.append(kwargs)
            return iter(round_1_events if len(create_calls) == 1 else round_2_events)

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setattr(crypto_agent, "get_client", lambda: FakeClient())
    monkeypatch.setattr(crypto_agent, "get_model", lambda: "test-model")

    events = list(
        crypto_agent.run_agent_stream([{"role": "user", "content": "What is the current Bitcoin price?"}])
    )

    assert [e[0] for e in events] == ["token", "token", "citations", "done"]
    assert events[0][1] == "Bitcoin is "
    assert events[1][1] == "$71,000."

    citations = events[2][1]
    assert len(citations) == 1
    assert citations[0]["url"] == "https://www.coingecko.com/en/coins/bitcoin"

    assert calls["n"] == 1
    assert create_calls[0].get("previous_response_id") is None
    assert create_calls[0]["instructions"]
    assert create_calls[1]["previous_response_id"] == "resp_1"
    assert "instructions" not in create_calls[1]


def test_run_agent_stream_general_question_streams_directly_without_tools(monkeypatch):
    events_seq = [
        _event("response.output_text.delta", delta="Proof of stake works by..."),
        _event("response.completed", response=_FakeResponse("resp_1", [])),
    ]

    class FakeResponses:
        def create(self, **kwargs):
            return iter(events_seq)

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setattr(crypto_agent, "get_client", lambda: FakeClient())
    monkeypatch.setattr(crypto_agent, "get_model", lambda: "test-model")

    events = list(
        crypto_agent.run_agent_stream([{"role": "user", "content": "How does proof of stake work?"}])
    )

    assert [e[0] for e in events] == ["token", "done"]


def test_run_agent_stream_reports_error_when_market_data_unavailable(monkeypatch):
    def fake_get_coin_market_data(coin_id, vs_currency):
        raise MarketDataError("CoinGecko request timed out.")

    monkeypatch.setattr(crypto_agent, "get_coin_market_data", fake_get_coin_market_data)

    call_output = _FakeResponse(
        "resp_1",
        [_function_call("get_coin_market_data", json.dumps({"coin_id": "bitcoin", "vs_currency": "usd"}), "call_1")],
    )
    round_1_events = [_event("response.completed", response=call_output)]
    round_2_events = [
        _event("response.output_text.delta", delta="Current market data is unavailable right now."),
        _event("response.completed", response=_FakeResponse("resp_2", [])),
    ]

    create_calls = []

    class FakeResponses:
        def create(self, **kwargs):
            create_calls.append(kwargs)
            return iter(round_1_events if len(create_calls) == 1 else round_2_events)

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setattr(crypto_agent, "get_client", lambda: FakeClient())
    monkeypatch.setattr(crypto_agent, "get_model", lambda: "test-model")

    events = list(
        crypto_agent.run_agent_stream([{"role": "user", "content": "What is the current Bitcoin price?"}])
    )

    # No citations event: the tool failed, so nothing should be cited.
    assert [e[0] for e in events] == ["token", "done"]
    assert "unavailable" in events[0][1]

    # The failed tool's output must tell the model it failed, not silently omit it.
    second_call_input = create_calls[1]["input"]
    failure_payload = json.loads(second_call_input[0]["output"])
    assert failure_payload["error"] == "market_data_unavailable"


def test_run_agent_stream_yields_error_event_on_empty_stream(monkeypatch):
    class FakeResponses:
        def create(self, **kwargs):
            return iter([_event("response.completed", response=_FakeResponse("resp_1", []))])

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setattr(crypto_agent, "get_client", lambda: FakeClient())
    monkeypatch.setattr(crypto_agent, "get_model", lambda: "test-model")

    events = list(crypto_agent.run_agent_stream([{"role": "user", "content": "hello"}]))

    assert events[-1][0] == "error"
    assert events[-1][1]["code"] == "empty_response"


def test_run_agent_once_aggregates_tokens_and_citations(monkeypatch):
    events_seq = [
        _event("response.output_text.delta", delta="General knowledge answer."),
        _event("response.completed", response=_FakeResponse("resp_1", [])),
    ]

    class FakeResponses:
        def create(self, **kwargs):
            return iter(events_seq)

    class FakeClient:
        responses = FakeResponses()

    monkeypatch.setattr(crypto_agent, "get_client", lambda: FakeClient())
    monkeypatch.setattr(crypto_agent, "get_model", lambda: "test-model")

    result = crypto_agent.run_agent_once([{"role": "user", "content": "How does staking work?"}])

    assert result == {"reply": "General knowledge answer.", "citations": []}
