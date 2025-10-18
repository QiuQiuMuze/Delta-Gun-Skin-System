from __future__ import annotations

from typing import Callable

from .repositories.protocols import SeasonRepositoryProtocol

_season_repository_provider: Callable[[], SeasonRepositoryProtocol] | None = None


def set_season_repository_provider(
    provider: Callable[[], SeasonRepositoryProtocol]
) -> None:
    """Register a callable that returns the active season repository."""

    global _season_repository_provider
    _season_repository_provider = provider


def get_season_repository_dependency() -> SeasonRepositoryProtocol:
    """FastAPI dependency returning the configured season repository."""

    if _season_repository_provider is None:
        raise RuntimeError("Season repository provider has not been configured")
    return _season_repository_provider()
