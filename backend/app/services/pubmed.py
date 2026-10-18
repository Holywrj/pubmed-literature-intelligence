import re
import xml.etree.ElementTree as ET

import httpx

from app.core.config import Settings, settings
from app.schemas.literature import PubMedArticle, SearchResponse


UNAVAILABLE_MESSAGE = (
    "PubMed service is temporarily unavailable. Please try again later."
)


class PubMedServiceError(Exception):
    """A safe error with no upstream response, request URL, or credentials."""


class PubMedClient:
    def __init__(
        self,
        config: Settings = settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.config = config
        self.transport = transport

    async def search(self, query: str, *, limit: int | None = None) -> SearchResponse:
        fetch_limit = self.config.PUBMED_FETCH_LIMIT
        if limit is not None:
            if limit < 1:
                raise ValueError("limit must be positive")
            fetch_limit = min(limit, fetch_limit)

        try:
            async with httpx.AsyncClient(
                base_url=self.config.PUBMED_BASE_URL.rstrip("/") + "/",
                timeout=self.config.PUBMED_TIMEOUT_SECONDS,
                transport=self.transport,
            ) as client:
                total_count, pmids = await self._search_ids(client, query, fetch_limit)
                fetched: dict[str, PubMedArticle] = {}
                batch_size = self.config.PUBMED_BATCH_SIZE
                for start in range(0, len(pmids), batch_size):
                    batch = pmids[start : start + batch_size]
                    for article in await self._fetch_articles(client, batch):
                        fetched[article.pmid] = article
        except (httpx.HTTPError, ValueError, LookupError, TypeError, ET.ParseError):
            # Suppress upstream exception chains: HTTPX errors may contain api_key URLs.
            raise PubMedServiceError(UNAVAILABLE_MESSAGE) from None

        # Preserve candidate order, omit incomplete records and ignore unexpected IDs.
        articles = [fetched[pmid] for pmid in pmids if pmid in fetched]
        return SearchResponse(
            query=query,
            total_count=total_count,
            returned_count=len(articles),
            articles=articles,
        )

    def _common_params(self) -> dict[str, str]:
        params = {"db": "pubmed", "tool": self.config.NCBI_TOOL}
        if self.config.PUBMED_API_KEY:
            params["api_key"] = self.config.PUBMED_API_KEY
        if self.config.NCBI_EMAIL:
            params["email"] = self.config.NCBI_EMAIL
        return params

    async def _search_ids(
        self, client: httpx.AsyncClient, query: str, limit: int
    ) -> tuple[int, list[str]]:
        response = await client.get(
            "esearch.fcgi",
            params={
                **self._common_params(),
                "term": query,
                "retmode": "json",
                "retmax": limit,
            },
        )
        response.raise_for_status()
        result = response.json()["esearchresult"]
        count = result["count"]
        if isinstance(count, bool) or not isinstance(count, (str, int)):
            raise ValueError("Invalid PubMed count")
        total_count = int(count)
        pmids = result["idlist"]
        if (
            total_count < 0
            or not isinstance(pmids, list)
            or any(not isinstance(pmid, str) or not pmid.isdecimal() for pmid in pmids)
        ):
            raise ValueError("Invalid PubMed search response")
        return total_count, list(dict.fromkeys(pmids))[:limit]

    async def _fetch_articles(
        self, client: httpx.AsyncClient, pmids: list[str]
    ) -> list[PubMedArticle]:
        response = await client.get(
            "efetch.fcgi",
            params={**self._common_params(), "id": ",".join(pmids), "retmode": "xml"},
        )
        response.raise_for_status()
        return self.parse_articles(response.content)

    @staticmethod
    def _text(node: ET.Element | None) -> str | None:
        if node is None:
            return None
        return " ".join("".join(node.itertext()).split()) or None

    @classmethod
    def _publication_year(cls, record: ET.Element) -> int | None:
        paths = (
            "MedlineCitation/Article/Journal/JournalIssue/PubDate/Year",
            "MedlineCitation/Article/Journal/JournalIssue/PubDate/MedlineDate",
            "MedlineCitation/Article/ArticleDate/Year",
            "PubmedData/History/PubMedPubDate[@PubStatus='ppublish']/Year",
            "PubmedData/History/PubMedPubDate[@PubStatus='epublish']/Year",
        )
        for path in paths:
            value = cls._text(record.find(path))
            if value:
                match = re.search(r"\b[12]\d{3}\b", value)
                if match:
                    return int(match.group())
        return None

    @classmethod
    def parse_articles(cls, xml: bytes | str) -> list[PubMedArticle]:
        root = ET.fromstring(xml)
        if root.tag != "PubmedArticleSet" or root.find("ERROR") is not None:
            raise ValueError("Invalid PubMed XML response")

        articles = []
        for record in root.findall("PubmedArticle"):
            citation = record.find("MedlineCitation")
            if citation is None:
                continue
            pmid = cls._text(citation.find("PMID"))
            article = citation.find("Article")
            if not pmid or article is None:
                continue
            title = cls._text(article.find("ArticleTitle"))
            if not title:
                continue

            sections = []
            for section in article.findall("Abstract/AbstractText"):
                text = cls._text(section)
                if text:
                    label = section.get("Label")
                    sections.append(f"{label}: {text}" if label else text)

            authors = []
            for author in article.findall("AuthorList/Author"):
                name = cls._text(author.find("CollectiveName"))
                if not name:
                    first = cls._text(author.find("ForeName")) or cls._text(
                        author.find("Initials")
                    )
                    last = cls._text(author.find("LastName"))
                    name = " ".join(part for part in (first, last) if part)
                if name:
                    authors.append(name)

            mesh_terms = []
            for descriptor in citation.findall("MeshHeadingList/MeshHeading/DescriptorName"):
                term = cls._text(descriptor)
                if term:
                    mesh_terms.append(term)

            articles.append(
                PubMedArticle(
                    pmid=pmid,
                    title=title,
                    abstract="\n".join(sections) or None,
                    journal=cls._text(article.find("Journal/Title")),
                    issn=cls._text(article.find("Journal/ISSN")),
                    publication_year=cls._publication_year(record),
                    authors=authors,
                    mesh_terms=mesh_terms,
                )
            )
        return articles
