from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, ConfigDict, Field


class SeasonSkin(BaseModel):
    """Skin metadata grouped by rarity inside a season."""

    skin_id: str = Field(..., description="Unique identifier for the skin")
    name: str
    weapon: str
    rarity: str
    model_key: str
    meta: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(protected_namespaces=())


class SeasonBase(BaseModel):
    """Shared attributes for season payloads."""

    name: str
    tagline: str
    description: str
    bricks: List[SeasonSkin] = Field(default_factory=list)
    purples: List[SeasonSkin] = Field(default_factory=list)
    blues: List[SeasonSkin] = Field(default_factory=list)


class SeasonCreate(SeasonBase):
    """Payload used when creating a new season document."""

    id: str = Field(..., description="Season identifier")


class SeasonUpdate(BaseModel):
    """Payload for partial season updates."""

    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    bricks: List[SeasonSkin] | None = None
    purples: List[SeasonSkin] | None = None
    blues: List[SeasonSkin] | None = None


class SeasonInDB(SeasonBase):
    """Season representation stored in MongoDB."""

    id: str = Field(alias="_id")
    model_config = ConfigDict(populate_by_name=True)


class SeasonResponse(SeasonBase):
    """Response model exposed to API consumers."""

    id: str

    @classmethod
    def from_mongo(cls, document: Dict[str, Any]) -> "SeasonResponse":
        """Convert a MongoDB document to a response model."""

        payload = dict(document)
        payload["id"] = payload.pop("_id", payload.get("id"))
        return cls(**payload)
