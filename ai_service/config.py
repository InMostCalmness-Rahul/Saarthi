from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    groq_api_key: str = ""
    api_base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-3.5-turbo"
    temperature: float = 0.7
    max_tokens: int = 300
    port: int = 8000
    host: str = "127.0.0.1"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
