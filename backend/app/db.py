from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings


class Database:
    """MongoDB connection manager."""

    client: AsyncIOMotorClient | None = None

    async def connect(self) -> None:
        if not self.client:
            self.client = AsyncIOMotorClient(settings.mongo_url)

    async def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.client = None

    def get_db(self) -> AsyncIOMotorDatabase:
        if not self.client:
            raise RuntimeError("Database connection has not been initialised")
        return self.client[settings.mongo_db]


db = Database()


async def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency that returns the active database."""

    database = db.get_db()
    return database
