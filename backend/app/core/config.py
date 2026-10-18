from pathlib import Path

from pydantic import Field, field_validator
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

    JOURNAL_METRICS_CSV_PATH: Path = REPOSITORY_ROOT / "data/journal_metrics.csv"

    @field_validator("JOURNAL_METRICS_CSV_PATH")
    @classmethod
    def resolve_metrics_path(cls, value: Path) -> Path:
        path = value.expanduser()
        return (path if path.is_absolute() else REPOSITORY_ROOT / path).resolve()


settings = Settings()
