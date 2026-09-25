from typing import List

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the AI service.

    Environment lookups accept both the plain names (``API_BASE_URL``) and the
    ``GROQ_`` prefixed names that the CI workflow provides. Previously only
    ``GROQ_API_KEY`` matched, so the other CI overrides were silently ignored.
    """

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # Groq is the required provider for this project
    groq_api_key: str = Field(default="", validation_alias=AliasChoices("GROQ_API_KEY"))
    api_base_url: str = Field(
        default="https://api.groq.com/openai/v1",
        validation_alias=AliasChoices("API_BASE_URL", "GROQ_API_BASE_URL"),
    )
    model: str = Field(
        default="openai/gpt-oss-20b", validation_alias=AliasChoices("MODEL", "GROQ_MODEL")
    )
    # Mid-to-high temperature for more human-like replies. Adjust via .env
    # (0.0 = deterministic, 1.0 = very creative).
    temperature: float = Field(
        default=0.85,
        ge=0.0,
        le=2.0,
        validation_alias=AliasChoices("TEMPERATURE", "GROQ_TEMPERATURE"),
    )
    max_tokens: int = Field(default=300, gt=0)
    request_timeout_seconds: float = Field(default=15.0, gt=0)

    port: int = 8000
    host: str = "127.0.0.1"
    # Enables the uvicorn auto-reloader; must stay False outside development.
    debug: bool = False
    log_level: str = "INFO"

    # Explicit origin allow-list. A wildcard must never be combined with
    # allow_credentials, and this service is not meant to be called from browsers
    # other than the Saarthi frontend.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Optional shared secret expected in the X-Internal-Api-Key header. When empty
    # the check is skipped (local development).
    internal_api_key: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
