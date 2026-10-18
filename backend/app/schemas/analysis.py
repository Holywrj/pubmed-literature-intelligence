from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.schemas.literature import PubMedArticle


Quartile = Literal["Q1", "Q2", "Q3", "Q4"]
NonBlankText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class JournalMetric(BaseModel):
    journal_name: NonBlankText
    issn: str | None = None
    metric_year: int = Field(ge=1, le=9999)
    jif: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    jcr_quartile: Quartile | None = None
    category: str | None = None
    source: NonBlankText


class AnalysisRequest(BaseModel):
    articles: list[PubMedArticle]
    total_count: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_total_count(self) -> "AnalysisRequest":
        if self.total_count is not None and self.total_count < len(self.articles):
            raise ValueError("total_count must be at least the number of articles")
        return self


class JournalCount(BaseModel):
    journal: str
    count: int


class MeshTermFrequency(BaseModel):
    term: str
    frequency: int


class QuartileDistribution(BaseModel):
    Q1: int = 0
    Q2: int = 0
    Q3: int = 0
    Q4: int = 0
    Unknown: int = 0


class ArticleJournalMetrics(BaseModel):
    pmid: str
    journal_name: str | None
    issn: str | None
    metric_year: int | None = None
    journal_jif: float | None = None
    best_jcr_quartile: Quartile | None = None
    records: list[JournalMetric] = Field(default_factory=list)


class JournalMetricsSummary(BaseModel):
    journals_with_metrics: int
    journals_without_metrics: int
    articles_with_metrics: int
    articles_without_metrics: int
    quartile_distribution: QuartileDistribution
    article_metrics: list[ArticleJournalMetrics]


class RankedArticle(BaseModel):
    article: PubMedArticle
    journal_metrics: ArticleJournalMetrics


class AnalysisResponse(BaseModel):
    total_count: int
    analyzed_count: int
    current_year: int
    recent_five_year_start: int
    publication_year_distribution: dict[int, int]
    recent_five_year_count: int
    journal_distribution: list[JournalCount]
    mesh_term_frequency: list[MeshTermFrequency]
    journal_metrics_summary: JournalMetricsSummary
    top_articles: list[RankedArticle]
