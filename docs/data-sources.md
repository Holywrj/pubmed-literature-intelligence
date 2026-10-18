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

PubMed does **not** provide Journal Impact Factor or JCR Quartile. Those metrics
will use a separate provider in a later phase; they are not implemented now.

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
