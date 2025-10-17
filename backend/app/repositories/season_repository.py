from __future__ import annotations

from typing import Iterable, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..data.season_definitions import SEASON_DEFINITIONS
from ..models.season import SeasonCreate, SeasonResponse, SeasonUpdate
from ..config import settings


class SeasonRepository:
    """Data-access layer for season documents."""

    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._collection = database[settings.season_collection]

    @property
    def supports_writes(self) -> bool:
        """MongoDB-backed repository fully supports write operations."""

        return True

    async def ensure_indexes(self) -> None:
        """Create indexes required by the collection."""

        await self._collection.create_index("tagline", name="season_tagline_idx")

    async def seed_if_empty(self, *, definitions: Iterable[dict] | None = None) -> None:
        """Insert bundled season definitions if the collection is empty."""

        if await self._collection.estimated_document_count() > 0:
            return

        docs = []
        source = definitions if definitions is not None else SEASON_DEFINITIONS
        for entry in source:
            doc = dict(entry)
            doc["_id"] = doc.pop("id")
            docs.append(doc)

        if docs:
            await self._collection.insert_many(docs)

    async def list_seasons(self) -> List[SeasonResponse]:
        """Return all seasons sorted by identifier."""

        cursor = self._collection.find().sort("_id", 1)
        results = [SeasonResponse.from_mongo(doc) async for doc in cursor]
        return results

    async def get_season(self, season_id: str) -> Optional[SeasonResponse]:
        """Retrieve a single season by its identifier."""

        document = await self._collection.find_one({"_id": season_id})
        if document is None:
            return None
        return SeasonResponse.from_mongo(document)

    async def create_season(self, payload: SeasonCreate) -> SeasonResponse:
        """Create a new season document."""

        document = payload.model_dump()
        document["_id"] = document.pop("id")
        await self._collection.insert_one(document)
        created = await self._collection.find_one({"_id": document["_id"]})
        if created is None:
            raise RuntimeError("Failed to fetch the created season document")
        return SeasonResponse.from_mongo(created)

    async def update_season(self, season_id: str, payload: SeasonUpdate) -> Optional[SeasonResponse]:
        """Update an existing season document."""

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_season(season_id)

        result = await self._collection.update_one(
            {"_id": season_id},
            {"$set": update_data},
        )
        if result.matched_count == 0:
            return None
        updated = await self._collection.find_one({"_id": season_id})
        return SeasonResponse.from_mongo(updated)

    async def delete_season(self, season_id: str) -> bool:
        """Delete a season document by its identifier."""

        result = await self._collection.delete_one({"_id": season_id})
        return result.deleted_count > 0
