from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    display_name: str = Field(..., min_length=1, max_length=64)


class UserPublic(UserBase):
    id: str
    display_name: str
    coins: int = 0
    keys: int = 0
    is_admin: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    exp: datetime


class SkinBase(BaseModel):
    name: str
    rarity: str = Field(..., pattern=r"^(common|rare|epic|legendary)$")
    weapon: str
    image_url: Optional[str] = None


class SkinCreate(SkinBase):
    skin_id: Optional[str] = None


class SkinPublic(SkinBase):
    id: str = Field(alias="skin_id")

    class Config:
        populate_by_name = True


class InventoryItem(BaseModel):
    id: str = Field(alias="_id")
    skin_id: str
    name: str
    rarity: str
    acquired_at: datetime

    class Config:
        populate_by_name = True


class DrawRequest(BaseModel):
    username: str
    count: int = Field(..., ge=1, le=10)


class DrawResult(BaseModel):
    items: List[InventoryItem]
    remaining_keys: int
