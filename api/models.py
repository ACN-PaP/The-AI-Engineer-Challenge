"""Pydantic request/response models for the chat API."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator

# User input gets the tighter cap (abuse defense). Assistant messages are our own
# generated content replayed back as history, so they get a more generous cap sized
# for the long structured answers this assistant produces (market snapshot + sources).
MAX_USER_MESSAGE_CHARS = 4000
MAX_ASSISTANT_MESSAGE_CHARS = 8000
MAX_MESSAGES_PER_REQUEST = 50
SUPPORTED_CURRENCIES = ("usd", "thb")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def _validate_content_length(cls, value: str, info: ValidationInfo) -> str:
        role = info.data.get("role")
        limit = MAX_ASSISTANT_MESSAGE_CHARS if role == "assistant" else MAX_USER_MESSAGE_CHARS
        if len(value) > limit:
            raise ValueError(f"content must be at most {limit} characters for role={role!r}.")
        return value


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES_PER_REQUEST)
    selected_coin_id: Optional[str] = None
    currency: Literal["usd", "thb"] = "usd"

    @field_validator("selected_coin_id")
    @classmethod
    def _validate_coin_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip().lower()
        if not value:
            return None
        if len(value) > 64 or not all(c.isalnum() or c in "-_" for c in value):
            raise ValueError("selected_coin_id must be a short alphanumeric coin id.")
        return value
