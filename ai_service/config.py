from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    groq_api_key: str = ""
    api_base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-3.5-turbo"
    # Use a mid-to-high temperature to encourage more human-like, creative replies.
    # Adjust via .env if you prefer different randomness (0.0 - deterministic, 1.0 - very creative).
    temperature: float = 0.85
    max_tokens: int = 300
    port: int = 8000
    host: str = "127.0.0.1"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
