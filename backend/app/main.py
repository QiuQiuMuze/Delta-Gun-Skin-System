import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .config import settings
from .db import close_mongo_connection, connect_to_mongo, get_database
from .repositories import InMemorySeasonRepository, SeasonRepository
from .state import set_season_repository_provider
from .routers import seasons

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    connected = await connect_to_mongo()
    if connected:
        repository = SeasonRepository(get_database())
        set_season_repository_provider(lambda: repository)
        try:
            await repository.ensure_indexes()
            await repository.seed_if_empty()
        except Exception:  # pragma: no cover - defensive logging
            logger.exception("Failed to prepare MongoDB collections")
            await close_mongo_connection()
            connected = False

    if not connected:
        logger.warning(
            "MongoDB connection is not available; using the in-memory season store"
        )
        memory_repository = InMemorySeasonRepository()
        set_season_repository_provider(lambda: memory_repository)
        await memory_repository.ensure_indexes()
        await memory_repository.seed_if_empty()

    yield

    await close_mongo_connection()


app = FastAPI(
    title="Delta Gun Skin System API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(seasons.router, prefix="/api")


def _build_frontend_url(path: str = "") -> str:
    base = settings.web_app_base_url.rstrip("/")
    normalized_path = path.lstrip("/")
    if not normalized_path:
        return base or settings.web_app_base_url
    return f"{base}/{normalized_path}"


@app.get("/web", include_in_schema=False)
async def redirect_web_root() -> RedirectResponse:
    """Redirect legacy /web entrypoint requests to the frontend."""

    return RedirectResponse(url=_build_frontend_url())


@app.get("/web/{path:path}", include_in_schema=False)
async def redirect_web_path(path: str) -> RedirectResponse:
    """Redirect legacy /web/* requests to the frontend."""

    return RedirectResponse(url=_build_frontend_url(path))


@app.get("/", tags=["health"])
async def healthcheck() -> dict[str, str]:
    """Simple health-check endpoint."""

    return {"status": "ok"}
