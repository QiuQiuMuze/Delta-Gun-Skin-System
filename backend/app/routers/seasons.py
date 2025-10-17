from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_database_for_request
from ..models.season import SeasonCreate, SeasonResponse, SeasonUpdate
from ..repositories.season_repository import SeasonRepository

router = APIRouter(prefix="/seasons", tags=["seasons"])


def get_repository(db=Depends(get_database_for_request)) -> SeasonRepository:
    return SeasonRepository(db)


@router.get("/", response_model=list[SeasonResponse])
async def list_seasons(repository: SeasonRepository = Depends(get_repository)) -> list[SeasonResponse]:
    """Return all available seasons."""

    return await repository.list_seasons()


@router.get("/{season_id}", response_model=SeasonResponse)
async def get_season(
    season_id: str,
    repository: SeasonRepository = Depends(get_repository),
) -> SeasonResponse:
    """Return details for a single season."""

    season = await repository.get_season(season_id)
    if season is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Season '{season_id}' not found",
        )
    return season


@router.post("/", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED)
async def create_season(
    payload: SeasonCreate,
    repository: SeasonRepository = Depends(get_repository),
) -> SeasonResponse:
    """Create a new season document."""

    existing = await repository.get_season(payload.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Season '{payload.id}' already exists",
        )
    return await repository.create_season(payload)


@router.put("/{season_id}", response_model=SeasonResponse)
async def update_season(
    season_id: str,
    payload: SeasonUpdate,
    repository: SeasonRepository = Depends(get_repository),
) -> SeasonResponse:
    """Update an existing season."""

    updated = await repository.update_season(season_id, payload)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Season '{season_id}' not found",
        )
    return updated


@router.delete("/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_season(
    season_id: str,
    repository: SeasonRepository = Depends(get_repository),
) -> None:
    """Delete a season document."""

    deleted = await repository.delete_season(season_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Season '{season_id}' not found",
        )
