from collections import Counter
from datetime import date

from app.schemas.analysis import (
    AnalysisResponse,
    ArticleJournalMetrics,
    JournalCount,
    JournalMetricsSummary,
    MeshTermFrequency,
    QuartileDistribution,
    RankedArticle,
)
from app.schemas.literature import PubMedArticle
from app.services.journal_metrics import (
    JournalMetricsProvider,
    normalize_issn,
    normalize_journal_name,
)


class LiteratureAnalyzer:
    def __init__(self, metrics_provider: JournalMetricsProvider | None = None):
        self.metrics_provider = metrics_provider

    @staticmethod
    def is_recent_year(publication_year: int | None, current_year: int) -> bool:
        return publication_year is not None and current_year - 4 <= publication_year <= current_year

    @classmethod
    def recent_five_year_articles(
        cls, articles: list[PubMedArticle], current_year: int
    ) -> list[PubMedArticle]:
        return [
            article for article in articles
            if cls.is_recent_year(article.publication_year, current_year)
        ]

    def _article_metrics(self, article: PubMedArticle) -> ArticleJournalMetrics:
        records = (
            self.metrics_provider.lookup(issn=article.issn, journal_name=article.journal)
            if self.metrics_provider is not None else []
        )
        # Use one latest metric year; preserve every original category/year record.
        metric_year = max((record.metric_year for record in records), default=None)
        current = [record for record in records if record.metric_year == metric_year]
        jifs = [record.jif for record in current if record.jif is not None]
        quartiles = [record.jcr_quartile for record in current if record.jcr_quartile]
        return ArticleJournalMetrics(
            pmid=article.pmid,
            journal_name=article.journal,
            issn=article.issn,
            metric_year=metric_year,
            journal_jif=max(jifs, default=None),
            best_jcr_quartile=min(quartiles, default=None),
            records=records,
        )

    def analyze(
        self,
        articles: list[PubMedArticle],
        *,
        total_count: int | None = None,
        current_year: int | None = None,
    ) -> AnalysisResponse:
        if total_count is not None and total_count < len(articles):
            raise ValueError("total_count must be at least the number of articles")
        year = date.today().year if current_year is None else current_year
        years = Counter(
            article.publication_year for article in articles
            if article.publication_year is not None
        )
        journals = Counter(
            article.journal.strip() for article in articles
            if article.journal and article.journal.strip()
        )
        mesh = Counter(
            term.strip() for article in articles for term in article.mesh_terms
            if term.strip()
        )
        metrics = [self._article_metrics(article) for article in articles]
        quartiles = QuartileDistribution()
        journal_coverage: dict[tuple[str, str], bool] = {}
        articles_with_metrics = 0
        for article, metric in zip(articles, metrics):
            available = metric.journal_jif is not None or metric.best_jcr_quartile is not None
            articles_with_metrics += available
            name = normalize_journal_name(article.journal)
            issn = normalize_issn(article.issn)
            key = ("name", name) if name else ("issn", issn)
            if name or issn:
                journal_coverage[key] = journal_coverage.get(key, False) or available
            quartile = metric.best_jcr_quartile or "Unknown"
            setattr(quartiles, quartile, getattr(quartiles, quartile) + 1)

        recent = self.recent_five_year_articles(articles, year)
        # Pair by input position so duplicate PMIDs cannot overwrite metric records.
        ranked = [
            RankedArticle(article=article, journal_metrics=metric)
            for article, metric in zip(articles, metrics)
            if self.is_recent_year(article.publication_year, year)
        ]
        ranked.sort(key=lambda item: (
            item.journal_metrics.journal_jif is None,
            -item.journal_metrics.journal_jif if item.journal_metrics.journal_jif is not None else 0,
            -item.article.publication_year,
            item.article.pmid,
        ))
        return AnalysisResponse(
            total_count=len(articles) if total_count is None else total_count,
            analyzed_count=len(articles),
            current_year=year,
            recent_five_year_start=year - 4,
            publication_year_distribution=dict(sorted(years.items())),
            recent_five_year_count=len(recent),
            journal_distribution=[
                JournalCount(journal=name, count=count)
                for name, count in sorted(journals.items(), key=lambda item: (-item[1], item[0]))
            ],
            mesh_term_frequency=[
                MeshTermFrequency(term=term, frequency=count)
                for term, count in sorted(mesh.items(), key=lambda item: (-item[1], item[0]))[:30]
            ],
            journal_metrics_summary=JournalMetricsSummary(
                journals_with_metrics=sum(journal_coverage.values()),
                journals_without_metrics=sum(not value for value in journal_coverage.values()),
                articles_with_metrics=articles_with_metrics,
                articles_without_metrics=len(articles) - articles_with_metrics,
                quartile_distribution=quartiles,
                article_metrics=metrics,
            ),
            top_articles=ranked[:100],
        )
