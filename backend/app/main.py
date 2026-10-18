from fastapi import FastAPI

from app.api.analysis import router as analysis_router
from app.api.search import router as search_router
from app.core.config import settings


app = FastAPI(title=settings.APP_NAME)
app.include_router(search_router)
app.include_router(analysis_router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.APP_NAME}
