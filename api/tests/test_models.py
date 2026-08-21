import pytest
from pydantic import ValidationError

from api.models import (
    MAX_ASSISTANT_MESSAGE_CHARS,
    MAX_MESSAGES_PER_REQUEST,
    MAX_USER_MESSAGE_CHARS,
    ChatRequest,
)


def test_valid_request_defaults_currency_to_usd():
    req = ChatRequest(messages=[{"role": "user", "content": "hi"}])
    assert req.currency == "usd"
    assert req.selected_coin_id is None


def test_rejects_invalid_role():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "system", "content": "hi"}])


def test_rejects_empty_content():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "user", "content": ""}])


def test_rejects_user_content_over_max_length():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "user", "content": "x" * (MAX_USER_MESSAGE_CHARS + 1)}])


def test_accepts_long_assistant_content_up_to_its_own_cap():
    long_reply = "x" * MAX_ASSISTANT_MESSAGE_CHARS
    req = ChatRequest(
        messages=[
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": long_reply},
            {"role": "user", "content": "and then?"},
        ]
    )
    assert req.messages[1].content == long_reply


def test_rejects_assistant_content_over_its_own_max_length():
    with pytest.raises(ValidationError):
        ChatRequest(
            messages=[
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "x" * (MAX_ASSISTANT_MESSAGE_CHARS + 1)},
            ]
        )


def test_rejects_empty_messages_list():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[])


def test_rejects_too_many_messages():
    messages = [{"role": "user", "content": "hi"} for _ in range(MAX_MESSAGES_PER_REQUEST + 1)]
    with pytest.raises(ValidationError):
        ChatRequest(messages=messages)


def test_selected_coin_id_is_normalized_to_lowercase():
    req = ChatRequest(messages=[{"role": "user", "content": "hi"}], selected_coin_id="Bitcoin")
    assert req.selected_coin_id == "bitcoin"


def test_selected_coin_id_rejects_invalid_characters():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "user", "content": "hi"}], selected_coin_id="bitcoin; DROP TABLE")


def test_currency_rejects_unsupported_value():
    with pytest.raises(ValidationError):
        ChatRequest(messages=[{"role": "user", "content": "hi"}], currency="eur")
