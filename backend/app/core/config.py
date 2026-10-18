from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Allow reserved future variables in the shared root .env.
    )

    APP_NAME: str = "PubMed Literature Intelligence"
    APP_ENV: str = "development"


settings = Settings()
