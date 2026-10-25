from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routers import roadmaps, icebox, ai

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend para SketchTrack — Planificación y Ejecución de Estudio Autodidacta",
    version="1.0.0",
    lifespan=lifespan
)

# Configure strict CORS origins without wildcard when credentials are enabled
cors_origins = [origin.strip().rstrip("/") for origin in settings.CORS_ORIGINS if origin.strip() != "*"]
if not cors_origins:
    cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(roadmaps.router)
app.include_router(icebox.router)
app.include_router(ai.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
