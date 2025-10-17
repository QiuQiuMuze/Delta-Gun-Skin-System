import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import close_mongo_connection, connect_to_mongo, get_database
from .repositories.season_repository import SeasonRepository
from .routers import seasons

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    connected = await connect_to_mongo()
    if connected:
        try:
            repository = SeasonRepository(get_database())
            await repository.ensure_indexes()
            await repository.seed_if_empty()
        except Exception:  # pragma: no cover - defensive logging
            logger.exception("Failed to prepare MongoDB collections")
    else:
        logger.warning("MongoDB connection is not available; API will return 503 responses")

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


@app.get("/", tags=["health"])
async def healthcheck() -> dict[str, str]:
    """Simple health-check endpoint."""

    return {"status": "ok"}
