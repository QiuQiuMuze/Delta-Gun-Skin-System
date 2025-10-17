from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from ..db import get_database
from ..schemas import SkinCreate, SkinPublic
from .auth import get_current_user

router = APIRouter()


@router.get("", response_model=list[SkinPublic])
async def list_skins(database: AsyncIOMotorDatabase = Depends(get_database)) -> list[SkinPublic]:
    skins = await database.skins.find({}).sort("rarity", 1).to_list(length=None)
    return [
        SkinPublic(
            skin_id=skin["skin_id"],
            name=skin["name"],
            rarity=skin["rarity"],
            weapon=skin["weapon"],
            image_url=skin.get("image_url"),
        )
        for skin in skins
    ]


@router.post("", response_model=SkinPublic, status_code=status.HTTP_201_CREATED)
async def create_skin(
    payload: SkinCreate,
    database: AsyncIOMotorDatabase = Depends(get_database),
    current_user=Depends(get_current_user),
) -> SkinPublic:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    skin_id = payload.skin_id or uuid.uuid4().hex
    if await database.skins.find_one({"skin_id": skin_id}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Skin already exists")

    skin_doc = payload.model_dump()
    skin_doc["skin_id"] = skin_id
    await database.skins.insert_one(skin_doc)
    return SkinPublic(**skin_doc)


@router.put("/{skin_id}", response_model=SkinPublic)
async def update_skin(
    skin_id: str,
    payload: SkinCreate,
    database: AsyncIOMotorDatabase = Depends(get_database),
    current_user=Depends(get_current_user),
) -> SkinPublic:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    update_doc = payload.model_dump(exclude_unset=True)
    update_doc["skin_id"] = skin_id
    result = await database.skins.find_one_and_update(
        {"skin_id": skin_id},
        {"$set": update_doc},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skin not found")
    return SkinPublic(**result)


@router.delete("/{skin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skin(
    skin_id: str,
    database: AsyncIOMotorDatabase = Depends(get_database),
    current_user=Depends(get_current_user),
) -> None:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await database.skins.delete_one({"skin_id": skin_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skin not found")
