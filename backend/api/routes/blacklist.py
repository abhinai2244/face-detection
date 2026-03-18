"""
api/routes/blacklist.py
────────────────────────
CRUD endpoints for managing the blacklist database.
"""
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/blacklist", tags=["Blacklist"])

_service = None


def _get_service():
    global _service
    if _service is None:
        from services.blacklist_service import get_blacklist_service
        _service = get_blacklist_service()
    return _service


@router.get("/", summary="List all blacklisted persons")
async def list_persons():
    svc = _get_service()
    persons = svc.list_persons()
    return {
        "persons": persons,
        "total_persons": svc.person_count,
        "total_embeddings": svc.embedding_count,
    }


@router.post("/add", summary="Add a new person to the blacklist")
async def add_person(
    name: str = Form(..., description="Unique person identifier (e.g. 'John_Doe')"),
    images: List[UploadFile] = File(..., description="One or more face images"),
):
    if not name.strip():
        raise HTTPException(400, "Name cannot be empty.")
    if not images:
        raise HTTPException(400, "At least one image is required.")

    image_files = []
    for img in images:
        if img.content_type not in {"image/jpeg", "image/png", "image/bmp", "image/webp"}:
            raise HTTPException(400, f"Unsupported image type: {img.content_type}")
        data = await img.read()
        image_files.append((img.filename, data))

    result = _get_service().add_person(name.strip(), image_files)
    if result["extracted_embeddings"] == 0:
        raise HTTPException(
            422,
            "No faces detected in any of the uploaded images. "
            "Please use clear, front-facing photos."
        )
    return result


@router.delete("/{name}", summary="Remove a person from the blacklist")
async def delete_person(name: str):
    ok = _get_service().delete_person(name)
    if not ok:
        raise HTTPException(404, f"Person '{name}' not found in blacklist.")
    return {"deleted": name}


@router.post("/rebuild", summary="Rebuild the FAISS index from disk images")
async def rebuild_index():
    summary = _get_service().build_index()
    return {"message": "Index rebuilt successfully.", **summary}


@router.get("/image/{name}/{filename}", summary="Serve a blacklist reference image")
async def get_image(name: str, filename: str):
    from config import BLACKLIST_DIR
    path = BLACKLIST_DIR / name / filename
    if not path.exists():
        raise HTTPException(404, "Image not found.")
    return FileResponse(str(path))


@router.get("/stats", summary="Return index statistics")
async def stats():
    svc = _get_service()
    return {
        "persons": svc.person_count,
        "total_embeddings": svc.embedding_count,
        "persons_detail": svc.list_persons(),
    }
