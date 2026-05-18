import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from audity_api.routes.encode import router as encode_router
from audity_api.routes.effects import router as effects_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Audity API", version="0.1.0")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3100").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(encode_router, prefix="/api")
app.include_router(effects_router, prefix="/api")


@app.get("/api/health")
async def health():
    import shutil

    ffmpeg_available = shutil.which("ffmpeg") is not None
    return {"status": "ok", "ffmpeg": ffmpeg_available}
