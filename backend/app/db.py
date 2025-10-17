import logging
from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> bool:
    """Initialise the MongoDB client and verify the connection."""

    global _client, _database

    if _client is not None:
        return True

    try:
        _client = AsyncIOMotorClient(
            settings.mongodb_uri,
            uuidRepresentation="standard",
            serverSelectionTimeoutMS=5000,
        )
        _database = _client[settings.mongodb_db_name]
        await _database.command("ping")
        logger.info("Connected to MongoDB database '%s'", settings.mongodb_db_name)
        return True
    except (ServerSelectionTimeoutError, PyMongoError) as exc:
        logger.warning("MongoDB connection failed: %s", exc)
        _client = None
        _database = None
        return False


async def close_mongo_connection() -> None:
    """Dispose of the MongoDB client if it exists."""

    global _client, _database

    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """Return the active MongoDB database."""

    if _database is None:
        raise RuntimeError("Database connection has not been initialised")
    return _database


async def get_database_dependency() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """FastAPI dependency that yields the active database."""

    if _database is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not ready",
        )
    yield _database


def get_database_optional() -> AsyncIOMotorDatabase | None:
    """Return the active database if available, otherwise ``None``."""

    return _database


def is_database_ready() -> bool:
    """Return ``True`` when a MongoDB connection has been established."""

    return _database is not None


async def get_database_for_request(
    db: AsyncIOMotorDatabase = Depends(get_database_dependency),
) -> AsyncIOMotorDatabase:
    """Convenience dependency for routers to access the database."""

    return db
