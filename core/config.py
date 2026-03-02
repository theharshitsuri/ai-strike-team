"""
core/config.py — Centralized settings via pydantic-settings.
All workflows import `settings` from here.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # --- LLM ---
    openai_api_key: str = Field("", env="OPENAI_API_KEY")
    anthropic_api_key: str = Field("", env="ANTHROPIC_API_KEY")
    llm_provider: str = Field("openai", env="LLM_PROVIDER")
    openai_model: str = Field("gpt-4o", env="OPENAI_MODEL")
    anthropic_model: str = Field("claude-3-5-sonnet-20241022", env="ANTHROPIC_MODEL")

    # --- Database ---
    database_url: str = Field("", env="DATABASE_URL")

    # --- Logging ---
    log_level: str = Field("INFO", env="LOG_LEVEL")
    log_format: str = Field("json", env="LOG_FORMAT")

    # --- Email ---
    email_imap_host: str = Field("imap.gmail.com", env="EMAIL_IMAP_HOST")
    email_imap_port: int = Field(993, env="EMAIL_IMAP_PORT")
    email_address: str = Field("", env="EMAIL_ADDRESS")
    email_password: str = Field("", env="EMAIL_PASSWORD")

    # --- Slack ---
    slack_bot_token: str = Field("", env="SLACK_BOT_TOKEN")
    slack_channel_id: str = Field("", env="SLACK_CHANNEL_ID")

    # --- Workflow ---
    max_tokens: int = Field(4096, env="MAX_TOKENS")
    confidence_threshold: float = Field(0.75, env="CONFIDENCE_THRESHOLD")
    llm_retry_count: int = Field(3, env="LLM_RETRY_COUNT")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
