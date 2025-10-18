from __future__ import annotations

from typing import Iterable, List, Optional, Protocol

from ..models.season import SeasonCreate, SeasonResponse, SeasonUpdate


class SeasonRepositoryProtocol(Protocol):
    """Protocol implemented by season data stores."""

    async def ensure_indexes(self) -> None: ...

    async def seed_if_empty(self, *, definitions: Iterable[dict] | None = None) -> None: ...

    async def list_seasons(self) -> List[SeasonResponse]: ...

    async def get_season(self, season_id: str) -> Optional[SeasonResponse]: ...

    async def create_season(self, payload: SeasonCreate) -> SeasonResponse: ...

    async def update_season(
        self, season_id: str, payload: SeasonUpdate
    ) -> Optional[SeasonResponse]: ...

    async def delete_season(self, season_id: str) -> bool: ...
