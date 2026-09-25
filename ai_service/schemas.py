"""Shared response contract for the Saarthi AI service.

The backend previously received an untyped ``dict`` and re-derived fields with
regexes. These models make the contract explicit and machine-checked on both the
engine side and the FastAPI side (``response_model``).
"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

ALLOWED_TRUST_PHASES = ("listening", "momentum", "accountability")


class ResponseData(BaseModel):
    """Structured payload returned for every generation."""

    model_config = ConfigDict(extra="ignore")

    content: str = Field(description="Full natural-language reply shown to the user")
    emotional_validation: Optional[str] = None
    reconnection_nudge: Optional[str] = None
    tiny_action: Optional[str] = None
    followup_question: Optional[str] = None
    risk_flags: List[str] = Field(default_factory=list)
    trust_phase: Optional[str] = None


class GenerateResponseRequest(BaseModel):
    """Request body accepted by POST /generate-response."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)
    trust_phase: str = "listening"
    user_id: Optional[str] = None


class GenerateResponseResponse(BaseModel):
    """Envelope returned by POST /generate-response."""

    model_config = ConfigDict(extra="forbid")

    success: bool
    data: ResponseData
