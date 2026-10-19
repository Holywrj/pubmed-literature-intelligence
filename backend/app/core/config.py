from pathlib import Path

from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "PubMed Literature Intelligence"
    APP_ENV: str = "development"

    PUBMED_API_KEY: str | None = Field(default=None, repr=False)
    NCBI_EMAIL: str | None = None
    NCBI_TOOL: str = "pubmed_literature_intelligence"
    PUBMED_BASE_URL: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    PUBMED_FETCH_LIMIT: int = Field(default=200, ge=1, le=10000)
    PUBMED_BATCH_SIZE: int = Field(default=100, ge=1, le=200)
    PUBMED_TIMEOUT_SECONDS: float = Field(default=20, gt=0)

    DEEPSEEK_API_KEY: str | None = Field(default=None, repr=False)
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-flash"
    AI_REVIEW_MAX_ARTICLES: int = Field(default=25, ge=1, le=100)
    AI_REVIEW_MAX_CONTEXT_CHARS: int = Field(default=30000, ge=1, le=100000)
    AI_REVIEW_MAX_ABSTRACT_CHARS: int = Field(default=2500, ge=1, le=10000)
    AI_REVIEW_TIMEOUT_SECONDS: float = Field(default=60, gt=0, le=300)
    AI_REVIEW_MAX_OUTPUT_TOKENS: int = Field(default=1800, ge=1, le=8000)

    @field_validator("DEEPSEEK_API_KEY", mode="before")
    @classmethod
    def normalize_deepseek_key(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value is not None else None

    @field_validator("DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL")
    @classmethod
    def default_blank_deepseek_config(cls, value: str, info: ValidationInfo) -> str:
        return value.strip() or cls.model_fields[info.field_name].default

    JOURNAL_METRICS_CSV_PATH: Path = REPOSITORY_ROOT / "data/journal_metrics.csv"

    @field_validator("JOURNAL_METRICS_CSV_PATH")
    @classmethod
    def resolve_metrics_path(cls, value: Path) -> Path:
        path = value.expanduser()
        return (path if path.is_absolute() else REPOSITORY_ROOT / path).resolve()


settings = Settings()
