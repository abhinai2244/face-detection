"""
api/routes/video.py
────────────────────
REST endpoints for video upload, status, and file download.
WebSocket streaming lives in api/routes/ws.py.
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/video", tags=["Video"])

# Lazy singletons
_processor = None


def _get_processor():
    global _processor
    if _processor is None:
        from services.video_processor import VideoProcessor
        _processor = VideoProcessor()
    return _processor


ALLOWED_TYPES = {"video/mp4", "video/avi", "video/x-msvideo", "video/quicktime",
                 "video/x-matroska", "video/webm", "video/mpeg"}


@router.post("/upload", summary="Upload a video file")
async def upload_video(file: UploadFile = File(...)):
    from config import UPLOAD_DIR, MAX_VIDEO_SIZE

    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported video type: {file.content_type}. "
                                 f"Allowed: {', '.join(ALLOWED_TYPES)}")

    video_id = str(uuid.uuid4())
    suffix = Path(file.filename).suffix or ".mp4"
    dest = UPLOAD_DIR / f"{video_id}{suffix}"

    # Stream to disk with size guard
    size = 0
    with open(dest, "wb") as fh:
        while chunk := await file.read(1024 * 1024):  # 1 MB chunks
            size += len(chunk)
            if size > MAX_VIDEO_SIZE:
                fh.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, "File exceeds maximum size limit (2 GB).")
            fh.write(chunk)

    logger.info("Uploaded video %s → %s (%.1f MB)", video_id, dest, size / 1e6)
    return {
        "video_id": video_id,
        "filename": file.filename,
        "size_bytes": size,
        "size_mb": round(size / 1e6, 2),
        "path": str(dest),
    }


@router.get("/status/{video_id}", summary="Get processing job status")
async def get_status(video_id: str):
    job = _get_processor().get_job(video_id)
    if job is None:
        raise HTTPException(404, f"Job '{video_id}' not found.")
    return job.to_dict()


@router.get("/jobs", summary="List all processing jobs")
async def list_jobs():
    return _get_processor().list_jobs()


@router.get("/download/{video_id}", summary="Download the processed video")
async def download_video(video_id: str):
    from config import PROCESSED_DIR
    path = PROCESSED_DIR / f"{video_id}_processed.mp4"
    if not path.exists():
        raise HTTPException(404, "Processed video not found. Processing may still be running.")
    return FileResponse(
        str(path),
        media_type="video/mp4",
        filename=f"surveillance_{video_id}.mp4",
    )


@router.get("/stream-original/{video_id}", summary="Stream the original uploaded video")
async def stream_original(video_id: str):
    from config import UPLOAD_DIR
    # Find any file matching this video_id
    matches = list(UPLOAD_DIR.glob(f"{video_id}.*"))
    if not matches:
        raise HTTPException(404, "Original video not found.")
    return FileResponse(str(matches[0]), media_type="video/mp4")


@router.delete("/{video_id}", summary="Delete a video job and associated files")
async def delete_video(video_id: str):
    from config import UPLOAD_DIR, PROCESSED_DIR
    deleted = []
    for f in list(UPLOAD_DIR.glob(f"{video_id}.*")) + list(PROCESSED_DIR.glob(f"{video_id}*")):
        f.unlink(missing_ok=True)
        deleted.append(f.name)
    proc = _get_processor()
    proc._jobs.pop(video_id, None)
    return {"deleted_files": deleted}
