from fastapi import APIRouter, HTTPException

from app.schemas.literature import SearchRequest, SearchResponse
from app.services.pubmed import PubMedClient, PubMedServiceError, UNAVAILABLE_MESSAGE


router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> SearchResponse:
    try:
        return await PubMedClient().search(request.query)
    except PubMedServiceError:
        raise HTTPException(status_code=503, detail=UNAVAILABLE_MESSAGE) from None
