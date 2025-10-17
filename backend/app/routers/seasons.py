from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_database_optional
from ..models.season import SeasonCreate, SeasonResponse, SeasonUpdate
from ..repositories import InMemorySeasonRepository, SeasonRepository

router = APIRouter(prefix="/seasons", tags=["seasons"])

RepositoryType = SeasonRepository | InMemorySeasonRepository
_in_memory_repository = InMemorySeasonRepository()


def get_repository(db=Depends(get_database_optional)) -> RepositoryType:
    if db is None:
        return _in_memory_repository
    return SeasonRepository(db)


def ensure_writable(repository: RepositoryType) -> None:
    if not repository.supports_writes:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB connection is not available for write operations",
        )


@router.get("/", response_model=list[SeasonResponse])
async def list_seasons(repository: RepositoryType = Depends(get_repository)) -> list[SeasonResponse]:
    """Return all available seasons."""

    return await repository.list_seasons()


@router.get("/{season_id}", response_model=SeasonResponse)
async def get_season(
    season_id: str,
    repository: RepositoryType = Depends(get_repository),
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
    repository: RepositoryType = Depends(get_repository),
) -> SeasonResponse:
    """Create a new season document."""

    ensure_writable(repository)
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
    repository: RepositoryType = Depends(get_repository),
) -> SeasonResponse:
    """Update an existing season."""

    ensure_writable(repository)
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
    repository: RepositoryType = Depends(get_repository),
) -> None:
    """Delete a season document."""

    ensure_writable(repository)
    deleted = await repository.delete_season(season_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Season '{season_id}' not found",
        )
