from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    mongodb_uri: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection string",
        alias="MONGODB_URI",
    )
    mongodb_db_name: str = Field(
        default="delta_gun_skin",
        description="Name of the MongoDB database",
        alias="MONGODB_DB_NAME",
    )
    season_collection: str = Field(
        default="seasons",
        description="MongoDB collection storing season documents",
        alias="MONGODB_SEASON_COLLECTION",
    )
    allowed_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        description="Origins allowed to access the API",
        alias="ALLOWED_ORIGINS",
    )
    web_app_base_url: str = Field(
        default="http://localhost:3000",
        description="Base URL for the web application served by the frontend",
        alias="WEB_APP_BASE_URL",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        env_prefix = "DELTA_"


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""

    return Settings()


settings = get_settings()
