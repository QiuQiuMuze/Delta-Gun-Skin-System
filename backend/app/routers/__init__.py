"""FastAPI routers that expose HTTP endpoints."""

from fastapi import APIRouter

from . import seasons

api_router = APIRouter()
api_router.include_router(seasons.router)

__all__ = ["api_router", "seasons"]
