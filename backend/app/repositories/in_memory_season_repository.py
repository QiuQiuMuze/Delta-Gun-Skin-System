"""Fallback repository that serves bundled data when MongoDB is unavailable."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from ..data.season_definitions import SEASON_DEFINITIONS
from ..models.season import SeasonResponse


class InMemorySeasonRepository:
    """Serve season data from the bundled JSON definitions."""

    def __init__(self, definitions: Iterable[dict] | None = None) -> None:
        source = list(definitions) if definitions is not None else SEASON_DEFINITIONS
        self._records: Dict[str, SeasonResponse] = {
            entry["id"]: SeasonResponse(**entry) for entry in source
        }

    @property
    def supports_writes(self) -> bool:
        """Indicate that write operations are not supported in offline mode."""

        return False

    async def list_seasons(self) -> List[SeasonResponse]:
        """Return all bundled seasons ordered by identifier."""

        return [self._records[key] for key in sorted(self._records)]

    async def get_season(self, season_id: str) -> Optional[SeasonResponse]:
        """Return a single season definition by identifier."""

        return self._records.get(season_id)

    async def create_season(self, *args, **kwargs):  # pragma: no cover - defensive
        raise RuntimeError("Write operations are not supported without MongoDB")

    async def update_season(self, *args, **kwargs):  # pragma: no cover - defensive
        raise RuntimeError("Write operations are not supported without MongoDB")

    async def delete_season(self, *args, **kwargs):  # pragma: no cover - defensive
        raise RuntimeError("Write operations are not supported without MongoDB")
