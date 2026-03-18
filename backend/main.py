"""
main.py
────────
FastAPI application entry point.
Run with:  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
from config import ALLOWED_ORIGINS, APP_VERSION, PROCESSED_DIR, UPLOAD_DIR

app = FastAPI(
    title="Face Recognition Surveillance API",
    version=APP_VERSION,
    description=(
        "Real-time face detection + blacklist matching using "
        "InsightFace (ArcFace) and FAISS."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file mounts ─────────────────────────────────────────────────────────
app.mount("/uploads",   StaticFiles(directory=str(UPLOAD_DIR)),    name="uploads")
app.mount("/processed", StaticFiles(directory=str(PROCESSED_DIR)), name="processed")

# ── Routers ────────────────────────────────────────────────────────────────────
from api.routes.video import router as video_router
from api.routes.blacklist import router as blacklist_router
from api.routes.ws import router as ws_router

app.include_router(video_router,     prefix="/api")
app.include_router(blacklist_router, prefix="/api")
app.include_router(ws_router)          # WS paths are already absolute: /ws/...

# ── Health / root ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "Face Surveillance API", "version": APP_VERSION}


@app.get("/health", tags=["Health"])
async def health():
    from services.blacklist_service import get_blacklist_service
    svc = get_blacklist_service()
    return {
        "status": "healthy",
        "blacklist_persons": svc.person_count,
        "blacklist_embeddings": svc.embedding_count,
    }


# ── Startup event ──────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("=== Face Surveillance API starting up ===")
    # Warm up models (downloads on first run)
    from models.face_analyzer import get_face_analyzer
    from services.blacklist_service import get_blacklist_service
    get_face_analyzer()
    svc = get_blacklist_service()
    logger.info(
        "Blacklist ready: %d persons, %d embeddings",
        svc.person_count,
        svc.embedding_count,
    )
    logger.info("API docs: http://localhost:8000/docs")


# ── Dev runner ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
