# Data sources

## NCBI PubMed / E-utilities

The backend uses the official [NCBI E-utilities API](https://www.ncbi.nlm.nih.gov/books/NBK25499/).
ESearch returns the real total match count and a bounded list of PMIDs. EFetch
retrieves article metadata in XML using batches of those IDs.

Metadata obtained from PubMed:

- PMID
- Article title
- Abstract (all available sections, with labels)
- Journal
- ISSN
- Publication year
- Authors (including collective authors)
- MeSH headings (descriptor names)

Missing optional fields are returned as `null` or empty lists. Titles and
abstracts preserve inline XML text. The publication year prefers the journal's
publication date, then MedlineDate, ArticleDate, and print/electronic publication
history dates. It is not inferred from indexing dates.

PubMed does **not** provide Journal Impact Factor or JCR Quartile. The optional
CSV metrics provider below is separate from PubMed retrieval.

## Limits and failure behavior

The default fetch limit is 200 candidates, with sequential EFetch batches of 100.
A normal full search makes one ESearch request and two EFetch requests; an empty
search makes only ESearch. `total_count` is independent of `returned_count`.
Records without a PMID or title are skipped. Book records (`PubmedBookArticle`)
are not parsed in this phase, so returned articles can be fewer than candidates.

Each HTTP request has a configurable timeout (20 seconds by default). Failures,
invalid upstream JSON/XML, and HTTP errors such as 429 or 5xx produce a safe 503
response. There are no automatic retries or partial responses after a failed
batch. TLS verification remains enabled; request URLs and API keys are not logged
by application code.

NCBI usage guidance: [E-utilities introduction](https://www.ncbi.nlm.nih.gov/books/NBK25497/).
This demo uses sequential batches. A shared rate limiter across concurrent users
and processes is deferred; NCBI may return 429 during bursts.

Automated tests use synthetic fixtures and HTTPX MockTransport/ASGITransport.
The real HTTP transport is disabled during those tests. Live smoke tests are
manual only and must never print credentials or credential-bearing URLs.

## Journal metrics provenance

Journal Impact Factor (JIF) and JCR Quartile are metrics from Clarivate Journal
Citation Reports (JCR). The official [Web of Science Journals API](https://developer.clarivate.com/apis/wos-journal)
provides journal metrics and requires paid licensed access. It is not integrated
in this phase. [Clarivate's quartile documentation](https://support.clarivate.com/ScientificandAcademicResearch/s/article/Journal-Citation-Reports-Quartile-rankings-and-other-metrics?language=en_US)
describes category-specific quartile rankings.

`JournalMetricsProvider` defines a local lookup contract. Its current implementation,
`CsvJournalMetricsProvider`, uses Python's standard-library `csv` module and makes
no network requests. Local CSV data may contain legitimately obtained JCR metrics
under the applicable license. Never fabricate metrics, scrape Clarivate or random
websites, or ship copyrighted JCR datasets. SJR and SJR Quartile are different
metrics and must never be mislabeled as JIF or JCR Quartile; no SCImago integration
is implemented here.

The optional file defaults to repository-root `data/journal_metrics.csv` and is
ignored by Git. `JOURNAL_METRICS_CSV_PATH` can override the path; relative values
resolve against the repository root. The supplied `.example.csv` is a synthetic
template only, with no numeric JIF values, and is never loaded automatically.

Required CSV columns:

```csv
journal_name,issn,metric_year,jif,jcr_quartile,category,source
```

`journal_name`, `metric_year`, and a nonblank `source` are required for every row.
Blank optional values become `None`. JIF must be finite and nonnegative. Quartile
must be exactly Q1, Q2, Q3, Q4, or blank. One journal may have multiple rows for
different categories and years; the model retains all of them. Invalid rows are
skipped, counted by the provider's `invalid_row_count`, and never used as metrics.
Missing files return no matches. Unreadable/malformed files or missing headers
return no data with a provider `load_error`; they do not prevent startup or analysis.
These diagnostics are available on the provider, not exposed in the API yet.

Lookup uses normalized ISSN first (strip outer whitespace, remove hyphens,
uppercase X). Only when there is no ISSN match does it fall back to the normalized
journal title (strip/collapse whitespace and casefold). There is no fuzzy matching
or print/electronic ISSN alias registry.

## Deterministic analysis rules

`POST /api/analysis` accepts `{"articles": [...]}` and makes no PubMed request.
An optional `total_count` preserves a previous search's match count and must be at
least the submitted article count. Otherwise it defaults to the input length.
`analyzed_count` is always the input length. Each submitted record is counted once;
callers should submit the deduplicated search results. All statistics describe the
submitted sample, not the full matching PubMed corpus.

- Year distribution ignores missing years and sorts ascending. JSON object year
  keys are strings. The recent five-year window is runtime current year minus four
  through current year inclusive; future and missing years are excluded from it.
- Journal distribution trims outer whitespace, ignores blank names, preserves
  display spelling/case, and sorts by count descending then name ascending.
- MeSH frequency counts supplied descriptor occurrences, trims only surrounding
  whitespace, preserves case/internal spacing, and sorts by frequency descending
  then term ascending. Only the top 30 terms are returned.
- For each matched journal, use its latest supplied `metric_year` for summary and
  ranking. Choose the best available category quartile in that year: Q1, then Q2,
  Q3, Q4. Preserve **all** original year/category/source records in
  `journal_metrics_summary.article_metrics[].records`, including older years and
  articles outside the recent window. If that latest year has no usable metrics,
  do not silently substitute older years. If same-year records disagree on JIF,
  select the highest supplied JIF deterministically and retain the conflicting
  source records for inspection. This is not automatic data verification.
- Quartile distribution is article-level across all analyzed articles; every
  article contributes exactly once to Q1/Q2/Q3/Q4/Unknown. This best-quartile
  simplification does not imply that every category has that quartile.
- Coverage counts a usable JIF **or** quartile in the selected year as available.
  Source/category rows without either metric do not count as coverage. Journal
  coverage uses distinct normalized journal titles, falling back to ISSN when a
  title is absent. Records with neither identity count in article coverage but
  not journal coverage. A journal group is covered if any of its submitted articles
  has a match; article coverage still counts each article separately.
- Top Articles include only the recent five-year window and return at most 100.
  Sort by available journal JIF first, JIF descending, publication year descending,
  and PMID ascending as text. Missing JIF remains `null` and sorts after available
  JIF; a legitimate numeric zero remains a valid metric. Without any JIF, sort by
  year descending and PMID. `top_articles[]` contains the article and its explicit
  `journal_metrics`, not an article-level impact score.

This ranking means **articles published in journals with higher Journal Impact
Factor**. It does not measure article-level impact, citations, relevance, or quality.
The latest supplied journal metrics are used across the whole recent publication
window; this phase does not estimate historical article impact or field-normalize
JIF values. No licensed metrics are bundled with the project.
