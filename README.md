# PubMed Literature Intelligence

A web demo for biomedical literature search and AI-assisted research analysis.

## Current Status

**Phase 5 / AI Research Review.** Search PubMed, explore a deterministic analytics
dashboard, inspect article abstracts, and optionally generate research directions
and a Chinese literature review with DeepSeek. Journal metric enrichment remains
optional and uses legitimately obtained local data.

## Tech Stack

Backend: Python 3.12+, FastAPI, Uvicorn, Pydantic Settings, HTTPX,
LangChain Core and `langchain-openai` ChatOpenAI with the DeepSeek
OpenAI-compatible Chat Completions API.

Frontend: React, TypeScript, Recharts, Vite, Oxlint.

Use Node.js 22.12+ (Node.js 24 is also supported) and npm for frontend development.

## Local Development

From the repository root, optionally prepare local configuration:

```sh
cp .env.example .env
```

Backend, from the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Check <http://localhost:8000/api/health>:

```json
{"status": "ok", "app": "PubMed Literature Intelligence"}
```

Search the backend (this makes real PubMed requests):

```sh
curl -X POST http://localhost:8000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"lung cancer immunotherapy"}'
```

The response contains `query`, the actual PubMed `total_count`, `returned_count`,
and `articles`. Each article includes PMID, title, abstract, journal, ISSN,
publication year, authors, and MeSH descriptors. The default retrieval limit is
200 candidates, fetched in batches of 100. Optional metadata may be absent;
incomplete records are skipped, and `returned_count` equals the articles actually
returned. Queries are trimmed, must not be blank, and are limited to 500 characters.
Invalid queries return 422; upstream failures return a safe 503 error.
See [data sources and limitations](docs/data-sources.md).

Analyze previously retrieved articles without calling PubMed again:

```sh
curl -X POST http://localhost:8000/api/analysis \
  -H 'Content-Type: application/json' \
  -d '{"articles":[{"pmid":"sample-1","title":"Sample article","publication_year":2025}]}'
```

Send the `articles` array from `/api/search`. Optionally include its `total_count`
to preserve the original PubMed match count; without it, analysis `total_count`
defaults to the input length. `analyzed_count` always equals the input length.
Statistics describe this submitted sample, not all PubMed matches.

The response includes year/journal distributions, the recent five-year count,
top 30 MeSH terms, metric coverage, category-specific metric records, an
article-level best-quartile distribution, and at most 100 recent articles ranked
by the publishing journal's JIF. This is not an article-level impact factor.
The response exposes the runtime `current_year` and `recent_five_year_start`.

Optional metrics are read from `data/journal_metrics.csv` (ignored by Git).
Missing data is returned as unavailable; the application runs without the file.
See `data/journal_metrics.example.csv` for the format. Its journals and quartiles
are explicitly synthetic and its JIF values are blank. It is not loaded by default
and must not be presented as real JCR data. Supply only legitimately obtained
metrics. See [analysis rules and metric provenance](docs/data-sources.md).

Frontend, in another terminal from the repository root:

```sh
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The frontend calls the backend through Vite's `/api`
development proxy to `http://127.0.0.1:8000`. Search results feed the deterministic
analytics dashboard. **Generate AI Review** makes a separate, user-triggered
request; search never automatically invokes the LLM. AI failures preserve the
search results and dashboard. Starting a new search clears old AI results/errors
and cancels the browser's pending review request. A provider call already sent
may still finish on the server.

## AI Research Review

`POST /api/ai-review` accepts the search `query` (trimmed, nonblank, at most 500
characters) and at least one article from the search response. The article shape
is unchanged; use numeric PubMed IDs. It makes no additional PubMed requests.

```json
{
  "query": "lung cancer immunotherapy",
  "articles": [
    {
      "pmid": "12345678",
      "title": "Replace with the actual retrieved article title",
      "abstract": "Replace with the actual retrieved abstract"
    }
  ]
}
```

This example shows the request shape only; it is not evidence or a sample result.
Submit real metadata from `/api/search` to obtain a literature review.

Context selection is deterministic and preserves incoming PubMed relevance order.
It ignores absent/blank abstracts, skips duplicate PMIDs, and takes at most 25
abstracts. Each abstract contributes at most 2,500 characters. The complete
rendered article context (including metadata, delimiters, and separators) fits
within 30,000 characters. Whole blocks that do not fit are skipped; later smaller
blocks can still be selected. No partial article blocks are sent. Each block
includes PMID, year, title, journal, MeSH terms, and the bounded abstract.
Authors, JIF, and JCR are not included. The character budget applies to article
context; the bounded query and system/format instructions are additional.

One async LangChain pipeline formats a `ChatPromptTemplate`, invokes ChatOpenAI
against DeepSeek, checks complete JSON, and parses it with `PydanticOutputParser`.
It uses [DeepSeek JSON object mode](https://api-docs.deepseek.com/guides/json_mode/)
with `response_format={"type":"json_object"}` and explicit JSON format instructions.
There are no tools, agents, automatic repair calls, or automatic provider retries.
The default timeout is 60 seconds and the output limit is 1,800 tokens.

The response contains:

- `query`, `source_article_count` (submitted articles), and `used_article_count`
  (abstracts actually selected).
- `research_directions`: 3–5 items, each with a nonblank `title`, `summary`, and
  at least one supporting `evidence_pmids` entry.
- `review_points`: 4–6 Chinese points, targeting approximately 500 characters
  (validated to 350–800 characters in total).
- `evidence_pmids`: unique direction citations in first appearance order,
  derived by the server rather than trusted from the model.

Article text is treated as untrusted data, with escaped block boundaries and
explicit prompt instructions to ignore source instructions. Every direction's
PMIDs are checked against the **exact selected context**, including rejecting IDs
from unselected articles. Invalid citations fail the whole review. These checks
verify citation membership, not whether each cited abstract supports a claim.
AI synthesis can still contain errors; verify important conclusions against the
linked PubMed records and original studies. This is abstract-based literature
exploration, not patient-specific diagnosis or treatment advice. A bounded sample
must not be described as all PubMed results.

Safe endpoint errors:

| HTTP | Condition |
| --- | --- |
| 422 | Invalid input, no usable abstracts, or no complete block fits the context budget |
| 503 | AI is not configured, or DeepSeek is unavailable/times out |
| 502 | Invalid JSON/schema, incomplete output, or unsupported PMID citation |

Missing `DEEPSEEK_API_KEY` leaves search, analytics, and application startup fully
functional. The model is instantiated only when a valid AI request is used.

Validation:

```sh
# From backend/, with its virtual environment activated (fully offline tests)
python -m unittest discover -s tests -v

# From frontend/
npm run build
npm run lint
```

## Environment Variables

The backend always reads **repository-root/.env**, including when started from
`backend/`. `app/core/config.py` resolves this absolute path from its own file
location. Process environment variables take precedence over `.env` values.

- `APP_NAME`: application title and health-response name; defaults to
  `PubMed Literature Intelligence`.
- `APP_ENV`: environment label; defaults to `development`.
- `PUBMED_API_KEY`: optional NCBI API key; sent only when configured.
- `NCBI_EMAIL`: optional contact email sent to NCBI.
- `NCBI_TOOL`: client identifier; defaults to `pubmed_literature_intelligence`.
- `PUBMED_BASE_URL`: defaults to `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`.
- `PUBMED_FETCH_LIMIT`: maximum candidate IDs (default 200; range 1–10000).
- `PUBMED_BATCH_SIZE`: IDs per sequential EFetch request (default 100; range 1–200).
- `PUBMED_TIMEOUT_SECONDS`: positive timeout per HTTP request; defaults to 20.
- `JOURNAL_METRICS_CSV_PATH`: optional local metrics file; defaults to
  repository-root `data/journal_metrics.csv`. Relative overrides are also resolved
  against the repository root, including when starting from `backend/`.
- `DEEPSEEK_API_KEY`: optional server-only key; blank/whitespace means unconfigured.
- `DEEPSEEK_BASE_URL`: defaults to `https://api.deepseek.com`.
- `DEEPSEEK_MODEL`: defaults to `deepseek-flash`. Blank legacy model/base URL values
  fall back to their defaults.
- `AI_REVIEW_MAX_ARTICLES`: default 25, range 1–100.
- `AI_REVIEW_MAX_CONTEXT_CHARS`: default 30000, range 1–100000.
- `AI_REVIEW_MAX_ABSTRACT_CHARS`: default 2500, range 1–10000.
- `AI_REVIEW_TIMEOUT_SECONDS`: default 60, positive and at most 300. The browser's
  existing request timeout is 90 seconds, so deployments using a longer server
  timeout should coordinate their client/proxy timeouts.
- `AI_REVIEW_MAX_OUTPUT_TOKENS`: default 1800, range 1–8000.

The application starts without `.env` or any API keys. `.env` is ignored by Git;
commit only the secret-free `.env.example`. Do not put secrets in frontend files.

Automated tests use fixtures, fakes, dependency overrides, and mocked transports.
AI tests block network transports and sockets and verify the actual ChatOpenAI
request serialization offline. They do not test DeepSeek availability or call
paid LLM services. Keep provider SDK debug logging and external LangChain tracing
disabled when processing literature: full prompts, model responses, and secrets
must not be logged or sent to a tracing service.
