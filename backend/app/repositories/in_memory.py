from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from ..data.season_definitions import SEASON_DEFINITIONS
from ..models.season import SeasonCreate, SeasonResponse, SeasonUpdate
from .protocols import SeasonRepositoryProtocol


class InMemorySeasonRepository(SeasonRepositoryProtocol):
    """In-memory fallback repository used when MongoDB is unavailable."""

    def __init__(self) -> None:
        self._store: Dict[str, SeasonResponse] = {}

    async def ensure_indexes(self) -> None:
        """No-op for the in-memory implementation."""

    async def seed_if_empty(self, *, definitions: Iterable[dict] | None = None) -> None:
        if self._store:
            return

        source = definitions if definitions is not None else SEASON_DEFINITIONS
        for entry in source:
            season = SeasonResponse(**entry)
            self._store[season.id] = season

    async def list_seasons(self) -> List[SeasonResponse]:
        return [self._store[key] for key in sorted(self._store.keys())]

    async def get_season(self, season_id: str) -> Optional[SeasonResponse]:
        return self._store.get(season_id)

    async def create_season(self, payload: SeasonCreate) -> SeasonResponse:
        season = SeasonResponse(**payload.model_dump())
        self._store[season.id] = season
        return season

    async def update_season(
        self, season_id: str, payload: SeasonUpdate
    ) -> Optional[SeasonResponse]:
        existing = await self.get_season(season_id)
        if existing is None:
            return None

        data = existing.model_dump()
        updates = payload.model_dump(exclude_unset=True)
        data.update(updates)
        season = SeasonResponse(**data)
        self._store[season.id] = season
        return season

    async def delete_season(self, season_id: str) -> bool:
        return self._store.pop(season_id, None) is not None
