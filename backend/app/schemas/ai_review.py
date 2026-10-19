import re
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.schemas.literature import PubMedArticle


NonblankText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PMID = Annotated[str, StringConstraints(pattern=r"^[0-9]{1,20}$", strict=True)]
Query = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class AIReviewRequest(BaseModel):
    query: Query
    articles: list[PubMedArticle] = Field(min_length=1)

    @field_validator("articles")
    @classmethod
    def valid_pmids(cls, articles: list[PubMedArticle]) -> list[PubMedArticle]:
        # This endpoint produces external PMID links; keep existing article contracts unchanged.
        if any(re.fullmatch(r"[0-9]{1,20}", article.pmid) is None for article in articles):
            raise ValueError("AI review articles must have numeric PubMed IDs")
        return articles


class ResearchDirection(BaseModel):
    title: Annotated[NonblankText, Field(max_length=150)]
    summary: Annotated[NonblankText, Field(max_length=1000)]
    evidence_pmids: list[PMID] = Field(min_length=1, max_length=100)


class ReviewContent(BaseModel):
    """Shared validation for model output and the public response."""

    research_directions: list[ResearchDirection] = Field(min_length=3, max_length=5)
    review_points: list[NonblankText] = Field(min_length=4, max_length=6)

    @field_validator("review_points")
    @classmethod
    def chinese_review_length(cls, points: list[str]) -> list[str]:
        if not 350 <= sum(len(point) for point in points) <= 800:
            raise ValueError("Review points must contain 350–800 characters in total")
        if any(re.search(r"[\u3400-\u9fff]", point) is None for point in points):
            raise ValueError("Each review point must contain Chinese text")
        return points


class AIReviewResponse(ReviewContent):
    query: Query
    source_article_count: int = Field(ge=1)
    used_article_count: int = Field(ge=1)
    evidence_pmids: list[PMID] = Field(min_length=1)
