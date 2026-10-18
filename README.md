# PubMed Literature Intelligence

A web demo for biomedical literature search and AI-assisted research analysis.

## Current Status

**Phase 2 / PubMed search backend.** The backend supports PubMed keyword search
and article metadata retrieval. The frontend remains a static landing screen.
Analytics, visualizations, journal metrics, and AI capabilities are planned only.

## Tech Stack

Backend: Python 3.12+, FastAPI, Uvicorn, Pydantic Settings, HTTPX.

Frontend: React, TypeScript, Vite, Oxlint.

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

Frontend, in another terminal from the repository root:

```sh
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. This landing screen does not call the backend yet;
CORS will be configured when cross-origin requests are introduced.

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
- `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`: unused future placeholders.

The application starts without `.env` or any API keys. `.env` is ignored by Git;
commit only the secret-free `.env.example`. Do not put secrets in frontend files.

## Planned Capabilities

- Literature statistics
- Research trend visualization
- Journal metrics integration
- High-impact literature ranking
- AI-assisted Chinese literature review
