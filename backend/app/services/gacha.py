from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any, Dict, List

from motor.motor_asyncio import AsyncIOMotorDatabase

RARITY_WEIGHTS = {
    "legendary": 1,
    "epic": 5,
    "rare": 20,
    "common": 74,
}


async def draw_skins(database: AsyncIOMotorDatabase, count: int) -> List[Dict[str, Any]]:
    """Draw skins based on rarity weights."""

    skins = await database.skins.find({}).to_list(length=None)
    if not skins:
        raise ValueError("No skins available for drawing")

    weighted_pool: List[Dict[str, Any]] = []
    for skin in skins:
        weight = RARITY_WEIGHTS.get(skin.get("rarity", "common"), 1)
        weighted_pool.extend([skin] * weight)

    results: List[Dict[str, Any]] = []
    for _ in range(count):
        selected = random.choice(weighted_pool)
        results.append(selected)

    now = datetime.now(timezone.utc)
    inventory_items = [
        {
            "skin_id": skin["skin_id"],
            "name": skin["name"],
            "rarity": skin["rarity"],
            "acquired_at": now,
        }
        for skin in results
    ]
    return inventory_items
