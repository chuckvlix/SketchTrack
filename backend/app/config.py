import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "SketchTrack Backend"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./sketchtrack.db"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    DEMO_RATE_LIMIT_PER_HOUR: int = 20
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
