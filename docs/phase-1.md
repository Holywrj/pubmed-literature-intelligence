# Phase 1: project initialization

The backend exposes only `GET /api/health`. The frontend is a static landing screen.
No PubMed, journal metrics, analysis, charts, or LLM integration is implemented.

Configuration is read from the repository-root `.env`, resolved relative to
`backend/app/core/config.py`, regardless of the process working directory.
Only `APP_NAME` and `APP_ENV` are used now. Future API variables in `.env.example`
are optional placeholders and ignored by the current Settings model.

CORS is deferred until the frontend makes backend requests. At that point, add
the development origin through Settings and allow only the required origin.

Configuration checks use Python's standard-library unittest; no test dependency
is required. Run them from `backend/`:

```sh
python -m unittest discover -s tests -v
```

Phase 2 should begin with PubMed search and metadata retrieval, after review of
Phase 1. It is not part of this change.
