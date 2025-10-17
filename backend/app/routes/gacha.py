from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db import get_database
from ..schemas import DrawRequest, DrawResult, InventoryItem, UserPublic
from ..services.gacha import draw_skins
from .auth import get_current_user

router = APIRouter()


@router.post("/draw", response_model=DrawResult)
async def draw(
    payload: DrawRequest,
    database: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserPublic = Depends(get_current_user),
) -> DrawResult:
    if current_user.username != payload.username and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to draw for this user")

    user_doc = await database.users.find_one({"username": payload.username})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    current_keys = int(user_doc.get("keys", 0))
    if current_keys < payload.count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough keys")

    items_to_add = await draw_skins(database, payload.count)
    inventory_docs = []
    for item in items_to_add:
        doc_id = ObjectId()
        inventory_docs.append(
            {
                "_id": doc_id,
                "username": payload.username,
                **item,
            }
        )

    if inventory_docs:
        await database.inventory.insert_many(inventory_docs)

    await database.users.update_one(
        {"username": payload.username}, {"$inc": {"keys": -payload.count}}
    )

    remaining_keys = current_keys - payload.count
    inventory_items = [
        InventoryItem(
            _id=str(doc["_id"]),
            skin_id=doc["skin_id"],
            name=doc["name"],
            rarity=doc["rarity"],
            acquired_at=doc["acquired_at"],
        )
        for doc in inventory_docs
    ]
    return DrawResult(items=inventory_items, remaining_keys=remaining_keys)
