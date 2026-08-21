"""Conversation history trimming shared by both chat endpoints.

History stays client-managed (sent fresh with every request) so nothing needs to be
stored in process memory — this keeps the backend safe to run on stateless/serverless
infrastructure.
"""

MAX_HISTORY_MESSAGES = 20
MAX_HISTORY_CHARS = 16000


def trim_history(messages) -> list[dict]:
    """Keep at most the last MAX_HISTORY_MESSAGES turns, bounded by a character budget.

    Always keeps at least the most recent message, even if it alone exceeds the
    character budget, so a request is never emptied out entirely.
    """
    plain = [{"role": m.role, "content": m.content} for m in messages]
    windowed = plain[-MAX_HISTORY_MESSAGES:]

    kept: list[dict] = []
    total_chars = 0
    for message in reversed(windowed):
        total_chars += len(message["content"])
        if kept and total_chars > MAX_HISTORY_CHARS:
            break
        kept.append(message)
    kept.reverse()
    return kept
