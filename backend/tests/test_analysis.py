import csv
from datetime import date
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx
from pydantic import ValidationError

from app.api.analysis import get_journal_metrics_provider
from app.core.config import REPOSITORY_ROOT, Settings
from app.main import app
from app.schemas.analysis import AnalysisRequest, JournalMetric
from app.schemas.literature import PubMedArticle
from app.services.analysis import LiteratureAnalyzer
from app.services.journal_metrics import (
    CsvJournalMetricsProvider,
    normalize_issn,
    normalize_journal_name,
)


FIXTURE = Path(__file__).parent / "fixtures/journal_metrics.csv"


def setUpModule():
    guard = patch.object(
        httpx.AsyncHTTPTransport,
        "handle_async_request",
        side_effect=AssertionError("Automated tests must never access the network"),
    )
    guard.start()
    unittest.addModuleCleanup(guard.stop)


def article(pmid="1", year=2026, journal=None, issn=None, mesh=None):
    return PubMedArticle(
        pmid=pmid, title=f"Synthetic article {pmid}", publication_year=year,
        journal=journal, issn=issn, mesh_terms=mesh or [],
    )


def sample_articles():
    return [
        article("1", 2022, "Synthetic Alpha", "0000000x", ["Lung Cancer", " Therapy ", "EGFR"]),
        article("2", 2026, "Synthetic Alpha", "0000-000X", ["Lung Cancer", "therapy", "EGFR"]),
        article("3", 2025, "Synthetic Beta", "1111-1111"),
        article("4", 2021, "Synthetic Gamma", "2222-2222"),
        article("5", 2024, "Unmatched Journal"),
        article("6", 2023, "Synthetic Quartile Only", "3333-3333"),
        article("7", None),
        article("8", 2027, "Synthetic Unknown", "4444-4444"),
    ]


class CsvProviderTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "metrics.csv"
        self.provider = CsvJournalMetricsProvider(FIXTURE)

    def write_rows(self, rows):
        with self.path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=[
                "journal_name", "issn", "metric_year", "jif", "jcr_quartile", "category", "source"
            ])
            writer.writeheader()
            for row in rows:
                writer.writerow({
                    "journal_name": "Synthetic Test Journal", "issn": "0000-0000",
                    "metric_year": "2025", "jif": "3", "jcr_quartile": "Q2",
                    "category": "Synthetic category", "source": "synthetic test data",
                    **row,
                })

    def test_issn_normalization(self):
        self.assertEqual(normalize_issn(" 0000-000x "), "0000000X")
        self.assertEqual(normalize_issn(None), "")
        records = self.provider.lookup(issn=" 0000000x ", journal_name=None)
        self.assertEqual(len(records), 3)

    def test_journal_name_normalization_and_fallback(self):
        self.assertEqual(normalize_journal_name("  SYNTHETIC   Alpha "), "synthetic alpha")
        records = self.provider.lookup(issn="not-found", journal_name="  SYNTHETIC   Alpha ")
        self.assertEqual(len(records), 3)

    def test_issn_takes_priority_over_conflicting_title(self):
        records = self.provider.lookup(issn="11111111", journal_name="Synthetic Alpha")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].journal_name, "Synthetic Beta")

    def test_no_fuzzy_matching(self):
        self.assertEqual(self.provider.lookup(issn=None, journal_name="Synthetic Alph"), [])

    def test_missing_or_disabled_csv(self):
        for path in (self.path, None):
            with self.subTest(path=path):
                provider = CsvJournalMetricsProvider(path)
                self.assertEqual(provider.lookup(issn="00000000", journal_name="Synthetic Alpha"), [])
                self.assertIsNone(provider.load_error)

    def test_valid_csv_parses_typed_records(self):
        records = self.provider.lookup(issn="1111-1111", journal_name=None)
        self.assertEqual(records[0].metric_year, 2025)
        self.assertEqual(records[0].jif, 8.0)
        self.assertEqual(records[0].jcr_quartile, "Q3")
        self.assertEqual(self.provider.invalid_row_count, 0)

    def test_blank_optional_metrics_remain_none(self):
        record = self.provider.lookup(issn="4444-4444", journal_name=None)[0]
        self.assertIsNone(record.jif)
        self.assertIsNone(record.jcr_quartile)
        self.assertIsNone(record.category)

    def test_invalid_quartile_skips_row_without_losing_valid_rows(self):
        self.write_rows([{"jcr_quartile": "Q5"}, {"jcr_quartile": "Q1"}])
        provider = CsvJournalMetricsProvider(self.path)
        self.assertEqual(provider.invalid_row_count, 1)
        self.assertEqual(provider.lookup(issn="00000000", journal_name=None)[0].jcr_quartile, "Q1")

    def test_invalid_metric_values_are_not_available(self):
        self.write_rows([
            {"jif": "NaN"}, {"jif": "inf"}, {"jif": "-1"},
            {"metric_year": "invalid"}, {"source": ""},
        ])
        provider = CsvJournalMetricsProvider(self.path)
        self.assertEqual(provider.invalid_row_count, 5)
        self.assertEqual(provider.lookup(issn="00000000", journal_name=None), [])

    def test_multiple_categories_and_metric_years_are_retained(self):
        records = self.provider.lookup(issn="0000000X", journal_name=None)
        self.assertEqual({r.category for r in records}, {"Synthetic Category A", "Synthetic Category B"})
        self.assertEqual({r.metric_year for r in records}, {2024, 2025})

    def test_missing_columns_do_not_crash(self):
        self.path.write_text("journal_name,jif\nSynthetic Test Journal,2\n")
        provider = CsvJournalMetricsProvider(self.path)
        self.assertIsNotNone(provider.load_error)
        self.assertEqual(provider.lookup(issn=None, journal_name="Synthetic Test Journal"), [])

    def test_missing_cells_are_rejected(self):
        self.write_rows([])
        with self.path.open("a") as file:
            file.write("Synthetic broken row,0000-0000\n")
        provider = CsvJournalMetricsProvider(self.path)
        self.assertEqual(provider.invalid_row_count, 1)

    def test_non_readable_csv_does_not_crash(self):
        provider = CsvJournalMetricsProvider(Path(self.directory.name))
        self.assertIsNotNone(provider.load_error)

    def test_quartile_model_validation(self):
        for quartile in ("Q1", "Q2", "Q3", "Q4", None):
            record = JournalMetric(journal_name="Synthetic", metric_year=2025, jcr_quartile=quartile, source="synthetic test")
            self.assertEqual(record.jcr_quartile, quartile)
        with self.assertRaises(ValidationError):
            JournalMetric(journal_name="Synthetic", metric_year=2025, jcr_quartile="q1", source="synthetic test")

    def test_csv_path_defaults_to_root_and_relative_paths_resolve_to_root(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(Settings(_env_file=None).JOURNAL_METRICS_CSV_PATH, REPOSITORY_ROOT / "data/journal_metrics.csv")
        self.assertEqual(
            Settings(_env_file=None, JOURNAL_METRICS_CSV_PATH="data/custom.csv").JOURNAL_METRICS_CSV_PATH,
            REPOSITORY_ROOT / "data/custom.csv",
        )


class AnalyzerTests(unittest.TestCase):
    def setUp(self):
        self.articles = sample_articles()
        self.analyzer = LiteratureAnalyzer(CsvJournalMetricsProvider(FIXTURE))
        self.result = self.analyzer.analyze(self.articles, current_year=2026)

    def test_year_distribution_is_ascending_and_ignores_missing_year(self):
        distribution = self.result.publication_year_distribution
        self.assertEqual(list(distribution), [2021, 2022, 2023, 2024, 2025, 2026, 2027])
        self.assertEqual(sum(distribution.values()), 7)

    def test_five_year_inclusive_boundaries_exclude_future_and_unknown(self):
        values = [article(str(i), year) for i, year in enumerate([2021, 2022, 2026, 2027, None])]
        recent = self.analyzer.recent_five_year_articles(values, 2026)
        self.assertEqual([a.publication_year for a in recent], [2022, 2026])
        self.assertEqual(self.result.recent_five_year_count, 5)

    def test_runtime_calendar_year_is_used(self):
        with patch("app.services.analysis.date") as clock:
            clock.today.return_value = date(2031, 4, 1)
            result = self.analyzer.analyze([article(year=2027), article(year=2026)])
        self.assertEqual(result.current_year, 2031)
        self.assertEqual(result.recent_five_year_start, 2027)
        self.assertEqual(result.recent_five_year_count, 1)

    def test_journal_distribution_and_stable_ties(self):
        counts = [(item.journal, item.count) for item in self.result.journal_distribution]
        self.assertEqual(counts[0], ("Synthetic Alpha", 2))
        self.assertEqual([name for name, count in counts[1:]], sorted(name for name, count in counts[1:]))

    def test_missing_and_blank_journals_are_ignored_in_distribution(self):
        result = self.analyzer.analyze([article(journal=None), article(journal="   ")])
        self.assertEqual(result.journal_distribution, [])

    def test_mesh_frequency_strips_only_surrounding_whitespace(self):
        frequencies = [(item.term, item.frequency) for item in self.result.mesh_term_frequency]
        self.assertEqual(frequencies, [("EGFR", 2), ("Lung Cancer", 2), ("Therapy", 1), ("therapy", 1)])
        result = self.analyzer.analyze([article(mesh=["A  B", "A B", " "])])
        self.assertEqual([item.term for item in result.mesh_term_frequency], ["A  B", "A B"])

    def test_mesh_top_30(self):
        result = self.analyzer.analyze([article(mesh=[f"Term {i:02}" for i in range(40)])])
        self.assertEqual(len(result.mesh_term_frequency), 30)
        self.assertEqual(result.mesh_term_frequency[-1].term, "Term 29")

    def test_missing_mesh(self):
        self.assertEqual(self.analyzer.analyze([article()]).mesh_term_frequency, [])

    def test_latest_metric_year_and_best_quartile(self):
        metric = self.result.journal_metrics_summary.article_metrics[0]
        self.assertEqual(metric.metric_year, 2025)
        self.assertEqual(metric.journal_jif, 8)
        self.assertEqual(metric.best_jcr_quartile, "Q1")
        self.assertEqual(len(metric.records), 3)

    def test_quartile_distribution_counts_each_analyzed_article_once(self):
        self.assertEqual(
            self.result.journal_metrics_summary.quartile_distribution.model_dump(),
            {"Q1": 2, "Q2": 1, "Q3": 1, "Q4": 1, "Unknown": 3},
        )

    def test_metric_coverage_counts(self):
        coverage = self.result.journal_metrics_summary
        self.assertEqual(coverage.journals_with_metrics, 4)
        self.assertEqual(coverage.journals_without_metrics, 2)
        self.assertEqual(coverage.articles_with_metrics, 5)
        self.assertEqual(coverage.articles_without_metrics, 3)

    def test_journal_coverage_deduplicates_normalized_names_and_uses_issn_fallback(self):
        result = self.analyzer.analyze([
            article("1", journal="Synthetic Alpha"),
            article("2", journal="  SYNTHETIC   ALPHA  "),
            article("3", issn="11111111"),
            article("4", issn="1111-1111"),
            article("5"),
        ])
        self.assertEqual(result.journal_metrics_summary.journals_with_metrics, 2)
        self.assertEqual(result.journal_metrics_summary.articles_without_metrics, 1)

    def test_missing_metrics_are_none_and_never_fake_zero(self):
        metric = self.result.journal_metrics_summary.article_metrics[4]
        self.assertIsNone(metric.journal_jif)
        self.assertIsNone(metric.best_jcr_quartile)
        self.assertEqual(metric.records, [])

    def test_legitimate_zero_jif_counts_as_available(self):
        result = self.analyzer.analyze([
            article("1", 2022, "Synthetic Zero"), article("2", 2026, "Unmatched Journal")
        ], current_year=2026)
        self.assertEqual(result.journal_metrics_summary.articles_with_metrics, 1)
        self.assertEqual(result.top_articles[0].article.pmid, "1")
        self.assertEqual(result.top_articles[0].journal_metrics.journal_jif, 0)
        self.assertIsNone(result.top_articles[1].journal_metrics.journal_jif)

    def test_missing_latest_metrics_do_not_silently_use_older_years(self):
        result = self.analyzer.analyze([article(journal="Synthetic Latest Missing")], current_year=2026)
        metric = result.journal_metrics_summary.article_metrics[0]
        self.assertEqual(metric.metric_year, 2025)
        self.assertIsNone(metric.journal_jif)
        self.assertIsNone(metric.best_jcr_quartile)
        self.assertEqual(len(metric.records), 2)
        self.assertEqual(result.journal_metrics_summary.articles_with_metrics, 0)

    def test_no_provider_is_supported(self):
        result = LiteratureAnalyzer().analyze(self.articles, current_year=2026)
        self.assertEqual(result.journal_metrics_summary.articles_with_metrics, 0)
        self.assertEqual(result.journal_metrics_summary.articles_without_metrics, 8)
        self.assertEqual(result.journal_metrics_summary.quartile_distribution.Unknown, 8)

    def test_jif_ranking_then_year_and_unavailable_metrics(self):
        self.assertEqual([item.article.pmid for item in self.result.top_articles], ["2", "3", "1", "5", "6"])
        self.assertEqual([item.journal_metrics.journal_jif for item in self.result.top_articles], [8, 8, 8, None, None])

    def test_higher_jif_beats_newer_year(self):
        result = self.analyzer.analyze([
            article("1", 2022, "Synthetic Alpha"), article("2", 2026, "Synthetic Gamma")
        ], current_year=2026)
        self.assertEqual([item.article.pmid for item in result.top_articles], ["1", "2"])

    def test_pmid_stable_tie_breaker_and_input_order_independence(self):
        values = [article("20", journal="Synthetic Alpha"), article("10", journal="Synthetic Alpha")]
        first = self.analyzer.analyze(values, current_year=2026)
        second = self.analyzer.analyze(list(reversed(values)), current_year=2026)
        self.assertEqual([item.article.pmid for item in first.top_articles], ["10", "20"])
        self.assertEqual(first.top_articles, second.top_articles)

    def test_top_100_filters_old_future_and_missing_years(self):
        values = [article(f"{i:03}", 2026, "Synthetic Gamma") for i in range(150)]
        values += [article("old", 2021, "Synthetic Alpha"), article("future", 2027), article("none", None)]
        result = self.analyzer.analyze(values, current_year=2026)
        self.assertEqual(result.recent_five_year_count, 150)
        self.assertEqual(len(result.top_articles), 100)
        self.assertEqual(result.top_articles[-1].article.pmid, "099")

    def test_empty_input(self):
        result = self.analyzer.analyze([], current_year=2026)
        self.assertEqual(result.total_count, 0)
        self.assertEqual(result.analyzed_count, 0)
        self.assertEqual(result.top_articles, [])
        self.assertEqual(result.publication_year_distribution, {})
        self.assertEqual(result.journal_metrics_summary.quartile_distribution.Unknown, 0)

    def test_original_search_total_is_preserved_only_when_supplied(self):
        result = self.analyzer.analyze(self.articles, total_count=30934)
        self.assertEqual(result.total_count, 30934)
        self.assertEqual(result.analyzed_count, 8)
        self.assertEqual(self.result.total_count, 8)
        with self.assertRaises(ValueError):
            self.analyzer.analyze(self.articles, total_count=1)


class AnalysisAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_overrides = app.dependency_overrides.copy()
        app.dependency_overrides[get_journal_metrics_provider] = lambda: CsvJournalMetricsProvider(FIXTURE)
        self.addCleanup(self.restore_overrides)
        self.http = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")
        self.addAsyncCleanup(self.http.aclose)

    def restore_overrides(self):
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous_overrides)

    async def test_analysis_response_shape_and_no_external_calls(self):
        with patch("app.services.analysis.date") as clock, patch("app.services.pubmed.PubMedClient.search") as search:
            clock.today.return_value = date(2026, 10, 18)
            response = await self.http.post("/api/analysis", json={
                "articles": [item.model_dump() for item in sample_articles()], "total_count": 30934,
            })
            search.assert_not_called()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total_count"], 30934)
        self.assertEqual(body["analyzed_count"], 8)
        self.assertEqual(body["recent_five_year_count"], 5)
        self.assertEqual(list(body["publication_year_distribution"]), [str(year) for year in range(2021, 2028)])
        self.assertEqual(set(body), {
            "total_count", "analyzed_count", "current_year", "recent_five_year_start",
            "publication_year_distribution", "recent_five_year_count", "journal_distribution",
            "mesh_term_frequency", "journal_metrics_summary", "top_articles",
        })
        self.assertEqual(body["top_articles"][0]["journal_metrics"]["journal_jif"], 8)
        self.assertEqual(len(body["journal_metrics_summary"]["article_metrics"][0]["records"]), 3)

    async def test_minimal_request_without_csv(self):
        app.dependency_overrides[get_journal_metrics_provider] = lambda: CsvJournalMetricsProvider(None)
        response = await self.http.post("/api/analysis", json={"articles": [article().model_dump()]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_count"], 1)
        self.assertEqual(response.json()["journal_metrics_summary"]["articles_without_metrics"], 1)

    async def test_invalid_total_count_and_invalid_articles(self):
        for body in (
            {"articles": [article().model_dump()], "total_count": 0},
            {"articles": [], "total_count": -1}, {"articles": [{}]}, {},
        ):
            with self.subTest(body=body):
                self.assertEqual((await self.http.post("/api/analysis", json=body)).status_code, 422)
