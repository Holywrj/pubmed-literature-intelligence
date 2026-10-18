from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


class SearchRequest(BaseModel):
    query: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
    ]


class PubMedArticle(BaseModel):
    pmid: str
    title: str
    abstract: str | None = None
    journal: str | None = None
    issn: str | None = None
    publication_year: int | None = None
    authors: list[str] = Field(default_factory=list)
    mesh_terms: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    query: str
    total_count: int
    returned_count: int
    articles: list[PubMedArticle]
