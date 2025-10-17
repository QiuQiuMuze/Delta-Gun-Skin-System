from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db import get_database
from ..schemas import InventoryItem, UserCreate, UserPublic
from ..security import hash_password
from .auth import get_current_user

router = APIRouter()


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> UserPublic:
    if await database.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    user_doc = {
        "username": payload.username,
        "display_name": payload.display_name,
        "password_hash": hash_password(payload.password),
        "coins": 0,
        "keys": 10,
        "is_admin": False,
    }
    result = await database.users.insert_one(user_doc)
    return UserPublic(
        id=str(result.inserted_id),
        username=payload.username,
        display_name=payload.display_name,
        coins=0,
        keys=10,
        is_admin=False,
    )


@router.get("/{username}", response_model=UserPublic)
async def get_user(
    username: str,
    database: AsyncIOMotorDatabase = Depends(get_database),
    _: UserPublic = Depends(get_current_user),
) -> UserPublic:
    user_doc = await database.users.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserPublic(
        id=str(user_doc["_id"]),
        username=user_doc["username"],
        display_name=user_doc["display_name"],
        coins=user_doc.get("coins", 0),
        keys=user_doc.get("keys", 0),
        is_admin=user_doc.get("is_admin", False),
    )


@router.get("/{username}/inventory", response_model=list[InventoryItem])
async def get_inventory(
    username: str,
    database: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserPublic = Depends(get_current_user),
) -> list[InventoryItem]:
    if current_user.username != username and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to view inventory")

    items = await database.inventory.find({"username": username}).sort("acquired_at", -1).to_list(length=None)
    return [
        InventoryItem(
            _id=str(item["_id"]),
            skin_id=item["skin_id"],
            name=item["name"],
            rarity=item["rarity"],
            acquired_at=item["acquired_at"],
        )
        for item in items
    ]
