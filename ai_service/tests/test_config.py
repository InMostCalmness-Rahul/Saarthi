"""Configuration tests.

The CI workflow exports GROQ_API_BASE_URL / GROQ_MODEL / GROQ_TEMPERATURE while the
service historically read API_BASE_URL / MODEL / TEMPERATURE, so those secrets were
silently ignored. Both forms are now supported and covered here.
"""

import pytest
from pydantic import ValidationError

from config import Settings

ALL_KEYS = (
    "GROQ_API_KEY",
    "API_BASE_URL",
    "GROQ_API_BASE_URL",
    "MODEL",
    "GROQ_MODEL",
    "TEMPERATURE",
    "GROQ_TEMPERATURE",
    "CORS_ORIGINS",
    "DEBUG",
    "INTERNAL_API_KEY",
)


@pytest.fixture
def clean_env(monkeypatch):
    for key in ALL_KEYS:
        monkeypatch.delenv(key, raising=False)
    return monkeypatch


def build_settings():
    # _env_file=None keeps the developer's real .env from influencing assertions.
    return Settings(_env_file=None)


def test_defaults_are_safe(clean_env):
    settings = build_settings()
    assert settings.api_base_url == "https://api.groq.com/openai/v1"
    assert settings.temperature == 0.85
    assert settings.debug is False


def test_groq_prefixed_aliases_are_honoured(clean_env):
    clean_env.setenv("GROQ_API_BASE_URL", "https://groq.example.invalid/v1")
    clean_env.setenv("GROQ_MODEL", "alias-model")
    clean_env.setenv("GROQ_TEMPERATURE", "0.5")

    settings = build_settings()
    assert settings.api_base_url == "https://groq.example.invalid/v1"
    assert settings.model == "alias-model"
    assert settings.temperature == 0.5


def test_plain_names_are_still_honoured(clean_env):
    clean_env.setenv("API_BASE_URL", "https://plain.example.invalid/v1")
    clean_env.setenv("MODEL", "plain-model")
    clean_env.setenv("TEMPERATURE", "0.2")

    settings = build_settings()
    assert settings.api_base_url == "https://plain.example.invalid/v1"
    assert settings.model == "plain-model"
    assert settings.temperature == 0.2


def test_plain_names_win_when_both_are_set(clean_env):
    clean_env.setenv("API_BASE_URL", "https://plain.example.invalid/v1")
    clean_env.setenv("GROQ_API_BASE_URL", "https://groq.example.invalid/v1")

    assert build_settings().api_base_url == "https://plain.example.invalid/v1"


def test_cors_origin_list_parsing(clean_env):
    clean_env.setenv("CORS_ORIGINS", "https://a.example.com , https://b.example.com,")
    settings = build_settings()
    assert settings.cors_origin_list == ["https://a.example.com", "https://b.example.com"]


def test_debug_flag_drives_the_reloader_setting(clean_env):
    defaults = build_settings()
    clean_env.setenv("DEBUG", "true")
    assert build_settings().debug is True
    assert defaults.debug is False


def test_temperature_range_is_validated(clean_env):
    clean_env.setenv("TEMPERATURE", "3.5")
    with pytest.raises(ValidationError):
        build_settings()
