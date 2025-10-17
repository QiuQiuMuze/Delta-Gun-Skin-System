from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import db
from .routes import api_router

app = FastAPI(title="Delta Gun Skin System API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def startup() -> None:
    await db.connect()
    database = db.get_db()
    await database.users.create_index("username", unique=True)
    await database.skins.create_index("skin_id", unique=True)
    await database.inventory.create_index("username")


@app.on_event("shutdown")
async def shutdown() -> None:
    await db.disconnect()
