from fastapi import APIRouter

from . import auth, gacha, skins, users

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(skins.router, prefix="/skins", tags=["skins"])
api_router.include_router(gacha.router, prefix="/gacha", tags=["gacha"])

__all__ = ["api_router"]
