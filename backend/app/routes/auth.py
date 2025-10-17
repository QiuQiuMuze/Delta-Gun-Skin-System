from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db import get_database
from ..schemas import TokenResponse, UserPublic
from ..security import create_access_token, verify_access_token, verify_password

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


async def get_current_user(
    database: AsyncIOMotorDatabase = Depends(get_database),
    token: str = Depends(oauth2_scheme),
) -> UserPublic:
    payload = verify_access_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_doc = await database.users.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return UserPublic(
        id=str(user_doc["_id"]),
        username=user_doc["username"],
        display_name=user_doc["display_name"],
        coins=user_doc.get("coins", 0),
        keys=user_doc.get("keys", 0),
        is_admin=user_doc.get("is_admin", False),
    )


@router.post("/token", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    database: AsyncIOMotorDatabase = Depends(get_database),
) -> TokenResponse:
    user_doc = await database.users.find_one({"username": form_data.username})
    if not user_doc or not verify_password(form_data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect username or password")

    token = create_access_token(
        data={"sub": user_doc["username"]},
        expires_delta=timedelta(minutes=60),
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: UserPublic = Depends(get_current_user)) -> UserPublic:
    return current_user
