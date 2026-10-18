from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.analysis import LiteratureAnalyzer
from app.services.journal_metrics import CsvJournalMetricsProvider, JournalMetricsProvider


router = APIRouter(prefix="/api", tags=["analysis"])


def get_journal_metrics_provider() -> JournalMetricsProvider:
    return CsvJournalMetricsProvider(settings.JOURNAL_METRICS_CSV_PATH)


@router.post("/analysis", response_model=AnalysisResponse)
def analysis(
    request: AnalysisRequest,
    provider: Annotated[JournalMetricsProvider, Depends(get_journal_metrics_provider)],
) -> AnalysisResponse:
    return LiteratureAnalyzer(provider).analyze(
        request.articles, total_count=request.total_count
    )
