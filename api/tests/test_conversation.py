from dataclasses import dataclass

from api.models import ChatMessage
from api.services.conversation import MAX_HISTORY_CHARS, MAX_HISTORY_MESSAGES, trim_history


def _msg(role, content):
    return ChatMessage(role=role, content=content)


@dataclass
class _RawMessage:
    """Stand-in for testing trim_history's own char budget, independent of the
    per-message length cap that ChatMessage enforces at the request-validation layer."""

    role: str
    content: str


def test_trim_history_keeps_all_when_under_limits():
    messages = [_msg("user", "hi"), _msg("assistant", "hello")]
    assert trim_history(messages) == [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]


def test_trim_history_windows_to_last_n_messages():
    messages = [_msg("user", f"msg {i}") for i in range(MAX_HISTORY_MESSAGES + 10)]
    trimmed = trim_history(messages)
    assert len(trimmed) == MAX_HISTORY_MESSAGES
    assert trimmed[-1]["content"] == f"msg {MAX_HISTORY_MESSAGES + 9}"
    assert trimmed[0]["content"] == "msg 10"


def test_trim_history_respects_character_budget():
    long_content = "x" * (MAX_HISTORY_CHARS // 2 + 100)
    messages = [
        _RawMessage("user", long_content),
        _RawMessage("assistant", long_content),
        _RawMessage("user", "short recent question"),
    ]
    trimmed = trim_history(messages)
    assert trimmed[-1]["content"] == "short recent question"
    assert len(trimmed) < len(messages)


def test_trim_history_always_keeps_last_message_even_if_too_long():
    huge = "x" * (MAX_HISTORY_CHARS * 2)
    trimmed = trim_history([_RawMessage("user", huge)])
    assert len(trimmed) == 1
    assert trimmed[0]["content"] == huge
