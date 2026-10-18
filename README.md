# PubMed Literature Intelligence

A web demo for biomedical literature search and AI-assisted research analysis.

## Current Status

**Phase 1 / project initialization.** A minimal backend health endpoint and React
landing screen are available. Business capabilities below are planned only.

## Tech Stack

Backend: Python 3.12+, FastAPI, Uvicorn, Pydantic Settings.

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
# From backend/, with its virtual environment activated
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
- `PUBMED_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`:
  reserved for future phases; unused and optional now.

The application starts without `.env` or any API keys. `.env` is ignored by Git;
commit only the secret-free `.env.example`. Do not put secrets in frontend files.

## Planned Capabilities

- PubMed literature search
- Literature statistics
- Research trend visualization
- Journal metrics integration
- High-impact literature ranking
- AI-assisted Chinese literature review
