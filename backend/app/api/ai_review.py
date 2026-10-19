from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.ai_review import AIReviewRequest, AIReviewResponse
from app.services.ai_review import AIReviewError, AIReviewService


router = APIRouter(prefix="/api", tags=["ai-review"])


def get_ai_review_service() -> AIReviewService:
    return AIReviewService()


@router.post("/ai-review", response_model=AIReviewResponse)
async def ai_review(
    request: AIReviewRequest,
    service: Annotated[AIReviewService, Depends(get_ai_review_service)],
) -> AIReviewResponse:
    try:
        return await service.generate(request.query, request.articles)
    except AIReviewError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from None
