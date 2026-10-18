import json
from pathlib import Path
import unittest
from unittest.mock import patch

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.main import app
from app.schemas.literature import SearchRequest
from app.services.pubmed import PubMedClient, PubMedServiceError, UNAVAILABLE_MESSAGE


FIXTURES = Path(__file__).parent / "fixtures"
ESEARCH = json.loads((FIXTURES / "esearch.json").read_text())
EMPTY_SEARCH = json.loads((FIXTURES / "esearch_empty.json").read_text())
EFETCH = (FIXTURES / "efetch.xml").read_bytes()


def setUpModule():
    # Any accidental use of HTTPX's real transport fails before touching a socket.
    guard = patch.object(
        httpx.AsyncHTTPTransport,
        "handle_async_request",
        side_effect=AssertionError("Automated tests must never access the network"),
    )
    guard.start()
    unittest.addModuleCleanup(guard.stop)


def config(**overrides):
    values = {"PUBMED_API_KEY": None, "NCBI_EMAIL": None}
    values.update(overrides)
    return Settings(_env_file=None, **values)


def fixture_response(request):
    if request.url.path.endswith("/esearch.fcgi"):
        return httpx.Response(200, json=ESEARCH)
    if request.url.path.endswith("/efetch.fcgi"):
        return httpx.Response(200, content=EFETCH)
    raise AssertionError("Unexpected PubMed endpoint")


def article_xml(pmids):
    records = "".join(
        f"<PubmedArticle><MedlineCitation><PMID>{pmid}</PMID><Article>"
        f"<ArticleTitle>Article {pmid}</ArticleTitle></Article>"
        "</MedlineCitation></PubmedArticle>"
        for pmid in pmids
    )
    return f"<PubmedArticleSet>{records}</PubmedArticleSet>"


class XMLTests(unittest.TestCase):
    def setUp(self):
        self.articles = PubMedClient.parse_articles(EFETCH)

    def test_pmid_and_title_with_nested_text(self):
        self.assertEqual(self.articles[0].pmid, "39000001")
        self.assertEqual(
            self.articles[0].title,
            "Immune checkpoint blockade in advanced lung cancer.",
        )

    def test_multisection_abstract_preserves_labels_and_nested_text(self):
        self.assertEqual(
            self.articles[0].abstract,
            "INTRODUCTION: Immunotherapy is evolving.\n"
            "METHODS: We studied n = 20 patients.\n"
            "RESULTS: Response improved (p < 0.05).\n"
            "CONCLUSION: Further studies are needed.",
        )

    def test_unlabelled_abstract(self):
        self.assertEqual(
            self.articles[2].abstract, "Unlabelled text with nested emphasis."
        )

    def test_missing_abstract(self):
        self.assertIsNone(self.articles[1].abstract)

    def test_journal_and_issn(self):
        self.assertEqual(self.articles[0].journal, "Journal of Clinical Research")
        self.assertEqual(self.articles[0].issn, "1234-5678")

    def test_missing_journal_and_issn(self):
        self.assertIsNone(self.articles[1].journal)
        self.assertIsNone(self.articles[1].issn)
        self.assertEqual(self.articles[2].journal, "Clinical Research")
        self.assertIsNone(self.articles[2].issn)

    def test_publication_year_prefers_journal_date(self):
        self.assertEqual(self.articles[0].publication_year, 2024)

    def test_medline_date_uses_first_year(self):
        self.assertEqual(self.articles[2].publication_year, 2021)

    def test_article_date_fallback(self):
        self.assertEqual(self.articles[3].publication_year, 2020)

    def test_history_date_fallback(self):
        xml = article_xml(["123"]).replace(
            "</PubmedArticle>",
            "<PubmedData><History><PubMedPubDate PubStatus='epublish'>"
            "<Year>2019</Year></PubMedPubDate></History></PubmedData></PubmedArticle>",
        )
        self.assertEqual(PubMedClient.parse_articles(xml)[0].publication_year, 2019)

    def test_missing_or_invalid_year(self):
        self.assertIsNone(self.articles[1].publication_year)
        xml = article_xml(["123"]).replace(
            "</Article>",
            "<Journal><JournalIssue><PubDate><MedlineDate>forthcoming</MedlineDate>"
            "</PubDate></JournalIssue></Journal></Article>",
        )
        self.assertIsNone(PubMedClient.parse_articles(xml)[0].publication_year)

    def test_personal_collective_and_partial_author_names(self):
        self.assertEqual(
            self.articles[0].authors,
            ["Tomer Meirson", "Lung Cancer Study Group", "OnlyLastName", "A Smith", "OnlyFirstName"],
        )

    def test_missing_authors(self):
        self.assertEqual(self.articles[1].authors, [])

    def test_mesh_descriptors(self):
        self.assertEqual(self.articles[0].mesh_terms, ["Lung Neoplasms", "Immunotherapy"])

    def test_missing_mesh(self):
        self.assertEqual(self.articles[1].mesh_terms, [])

    def test_incomplete_records_are_skipped(self):
        self.assertEqual(len(self.articles), 4)


class QueryTests(unittest.TestCase):
    def test_whitespace_is_trimmed(self):
        self.assertEqual(SearchRequest(query="  lung cancer  ").query, "lung cancer")

    def test_blank_and_oversized_queries_are_rejected(self):
        for value in ("", " \t\n ", "x" * 501):
            with self.subTest(value_length=len(value)), self.assertRaises(ValidationError):
                SearchRequest(query=value)
        self.assertEqual(len(SearchRequest(query="x" * 500).query), 500)


class ClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_esearch_total_and_id_parsing(self):
        async with httpx.AsyncClient(
            base_url="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/",
            transport=httpx.MockTransport(fixture_response),
        ) as http:
            total, ids = await PubMedClient(config())._search_ids(http, "lung cancer", 200)
        self.assertEqual(total, 30934)
        self.assertEqual(ids, ESEARCH["esearchresult"]["idlist"])

    async def test_fetch_parse_and_actual_returned_count(self):
        result = await PubMedClient(
            config(), transport=httpx.MockTransport(fixture_response)
        ).search("lung cancer")
        self.assertEqual(result.query, "lung cancer")
        self.assertEqual(result.total_count, 30934)
        self.assertEqual(result.returned_count, 4)
        self.assertEqual(result.returned_count, len(result.articles))
        self.assertNotEqual(result.total_count, result.returned_count)

    async def test_empty_search_does_not_fetch(self):
        requests = []

        def handler(request):
            requests.append(request)
            return httpx.Response(200, json=EMPTY_SEARCH)

        result = await PubMedClient(config(), transport=httpx.MockTransport(handler)).search("no match")
        self.assertEqual(len(requests), 1)
        self.assertEqual(result.total_count, 0)
        self.assertEqual(result.returned_count, 0)
        self.assertEqual(result.articles, [])

    async def test_default_limit_is_two_sequential_fetch_batches(self):
        requests = []
        ids = [str(39000000 + index) for index in range(200)]

        def handler(request):
            requests.append(request)
            self.assertEqual(request.url.params["db"], "pubmed")
            self.assertEqual(request.url.params["tool"], "pubmed_literature_intelligence")
            self.assertNotIn("api_key", request.url.params)
            self.assertNotIn("email", request.url.params)
            if request.url.path.endswith("/esearch.fcgi"):
                self.assertEqual(request.url.params["retmax"], "200")
                self.assertEqual(request.url.params["retmode"], "json")
                return httpx.Response(200, json={"esearchresult": {"count": "9999", "idlist": ids}})
            self.assertEqual(request.url.params["retmode"], "xml")
            batch = request.url.params["id"].split(",")
            self.assertEqual(len(batch), 100)
            return httpx.Response(200, text=article_xml(batch))

        result = await PubMedClient(config(), transport=httpx.MockTransport(handler)).search("lung cancer")
        self.assertEqual(len(requests), 3)
        self.assertEqual(result.returned_count, 200)
        self.assertEqual([a.pmid for a in result.articles], ids)

    async def test_small_explicit_limit_and_optional_identity_parameters(self):
        requests = []

        def handler(request):
            requests.append(request)
            self.assertEqual(request.url.params["api_key"], "test-placeholder")
            self.assertEqual(request.url.params["email"], "test@example.org")
            return fixture_response(request)

        result = await PubMedClient(
            config(PUBMED_API_KEY="test-placeholder", NCBI_EMAIL="test@example.org"),
            transport=httpx.MockTransport(handler),
        ).search("lung cancer", limit=2)
        self.assertEqual(requests[0].url.params["retmax"], "2")
        self.assertEqual(requests[1].url.params["id"], "39000001,39000002")
        self.assertEqual(result.returned_count, 2)

    async def test_cannot_exceed_configured_limit(self):
        result = await PubMedClient(
            config(PUBMED_FETCH_LIMIT=1), transport=httpx.MockTransport(fixture_response)
        ).search("lung cancer", limit=5)
        self.assertEqual(result.returned_count, 1)

    async def test_only_successfully_parsed_requested_records_count(self):
        def handler(request):
            if request.url.path.endswith("/esearch.fcgi"):
                return httpx.Response(200, json=ESEARCH)
            return httpx.Response(200, text=article_xml(["39000001", "99999999"]))

        result = await PubMedClient(config(), transport=httpx.MockTransport(handler)).search("lung cancer")
        self.assertEqual(result.returned_count, 1)

    async def test_errors_are_safely_mapped(self):
        cases = [
            ("rate limit", httpx.Response(429)),
            ("server error", httpx.Response(500)),
            ("unavailable", httpx.Response(503)),
            ("invalid JSON", httpx.Response(200, text="not JSON")),
            ("missing result", httpx.Response(200, json={"error": "upstream details"})),
            ("bad count", httpx.Response(200, json={"esearchresult": {"count": "bad", "idlist": []}})),
            ("bad ids", httpx.Response(200, json={"esearchresult": {"count": "2", "idlist": None}})),
            ("timeout", httpx.ReadTimeout("sensitive upstream details")),
            ("connection", httpx.ConnectError("sensitive upstream details")),
        ]
        for name, outcome in cases:
            with self.subTest(case=name):
                def handler(request):
                    if isinstance(outcome, Exception):
                        raise outcome
                    return outcome

                with self.assertRaises(PubMedServiceError) as caught:
                    await PubMedClient(config(), transport=httpx.MockTransport(handler)).search("test")
                self.assertEqual(str(caught.exception), UNAVAILABLE_MESSAGE)
                self.assertTrue(caught.exception.__suppress_context__)

    async def test_fetch_errors_and_malformed_xml_are_safe(self):
        for outcome in (
            httpx.Response(429),
            httpx.Response(502),
            httpx.Response(200, text="<PubmedArticleSet><broken>"),
            httpx.Response(200, content=b'<?xml version="1.0" encoding="unknown-encoding"?><PubmedArticleSet/>'),
            httpx.Response(200, text="<eFetchResult><ERROR>details</ERROR></eFetchResult>"),
            httpx.Response(200, text="<PubmedArticleSet><ERROR>details</ERROR></PubmedArticleSet>"),
        ):
            with self.subTest(status=outcome.status_code, body=outcome.text):
                def handler(request):
                    if request.url.path.endswith("/esearch.fcgi"):
                        return httpx.Response(200, json=ESEARCH)
                    return outcome

                with self.assertRaises(PubMedServiceError):
                    await PubMedClient(config(), transport=httpx.MockTransport(handler)).search("test")


class APITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.http = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        )
        self.addAsyncCleanup(self.http.aclose)

    async def test_search_response_shape_and_query_trimming(self):
        client = PubMedClient(config(), transport=httpx.MockTransport(fixture_response))
        with patch("app.api.search.PubMedClient", return_value=client):
            response = await self.http.post("/api/search", json={"query": "  lung cancer  "})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), {"query", "total_count", "returned_count", "articles"})
        self.assertEqual(body["query"], "lung cancer")
        self.assertEqual(body["total_count"], 30934)
        self.assertEqual(body["returned_count"], len(body["articles"]))
        self.assertEqual(
            set(body["articles"][0]),
            {"pmid", "title", "abstract", "journal", "issn", "publication_year", "authors", "mesh_terms"},
        )

    async def test_invalid_queries_never_call_pubmed(self):
        for body in ({"query": " \n "}, {"query": "x" * 501}, {}, {"query": 123}):
            with self.subTest(body=body), patch("app.api.search.PubMedClient") as factory:
                response = await self.http.post("/api/search", json=body)
                self.assertEqual(response.status_code, 422)
                factory.assert_not_called()

    async def test_http_failure_returns_safe_503(self):
        def handler(request):
            return httpx.Response(429, text="sensitive upstream details")

        client = PubMedClient(
            config(PUBMED_API_KEY="test-placeholder"), transport=httpx.MockTransport(handler)
        )
        with patch("app.api.search.PubMedClient", return_value=client):
            response = await self.http.post("/api/search", json={"query": "lung cancer"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": UNAVAILABLE_MESSAGE})
        self.assertNotIn("test-placeholder", response.text)
        self.assertNotIn("sensitive", response.text)

    async def test_health_is_still_available_without_pubmed(self):
        response = await self.http.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
