"""
video_processor.py
───────────────────
Processes uploaded videos frame-by-frame:
  1. Detect faces with InsightFace (RetinaFace + ArcFace)
  2. Compare embeddings against FAISS blacklist index
  3. Draw annotated bounding boxes on each frame
  4. Yield streaming updates via async generator (WebSocket)
  5. Write annotated video to disk for download
"""
from __future__ import annotations

import asyncio
import base64
import logging
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class Detection:
    video_id: str
    frame_idx: int
    timestamp: float          # seconds from start
    person_name: str
    confidence: float         # 0–100
    bbox: List[int]           # [x1, y1, x2, y2]
    det_score: float          # face detector confidence

    def to_dict(self) -> Dict:
        return {
            "video_id": self.video_id,
            "frame_idx": self.frame_idx,
            "timestamp": round(self.timestamp, 3),
            "person_name": self.person_name,
            "confidence": self.confidence,
            "bbox": self.bbox,
            "det_score": round(self.det_score, 3),
            "timestamp_str": _fmt_ts(self.timestamp),
        }


@dataclass
class JobStatus:
    video_id: str
    status: str = "pending"        # pending | processing | completed | error
    progress: float = 0.0          # 0–100
    current_frame: int = 0
    total_frames: int = 0
    fps: float = 0.0
    detections: List[Detection] = field(default_factory=list)
    output_path: Optional[str] = None
    error: Optional[str] = None
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None

    def to_dict(self) -> Dict:
        return {
            "video_id": self.video_id,
            "status": self.status,
            "progress": round(self.progress, 1),
            "current_frame": self.current_frame,
            "total_frames": self.total_frames,
            "fps": round(self.fps, 2),
            "detection_count": len(self.detections),
            "output_path": self.output_path,
            "error": self.error,
        }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fmt_ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    ms = int((seconds % 1) * 1000)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"
    return f"{m:02d}:{s:02d}.{ms:03d}"


def _resize_for_stream(frame: np.ndarray, max_width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    return cv2.resize(frame, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def _draw_face(
    frame: np.ndarray,
    bbox: List[int],
    label: str,
    color: tuple,
) -> np.ndarray:
    x1, y1, x2, y2 = bbox
    # Bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    # Label background
    font = cv2.FONT_HERSHEY_DUPLEX
    font_scale = 0.55
    thickness = 1
    (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)
    bg_y1 = max(y1 - th - 12, 0)
    bg_y2 = y1
    cv2.rectangle(frame, (x1, bg_y1), (x1 + tw + 8, bg_y2), color, -1)

    # Label text
    cv2.putText(frame, label, (x1 + 4, y1 - 5), font, font_scale,
                (255, 255, 255), thickness, cv2.LINE_AA)
    return frame


# ─── Main service ─────────────────────────────────────────────────────────────

class VideoProcessor:
    """
    Stateful processor that keeps a job registry for all running / completed jobs.
    """

    def __init__(self):
        from config import PROCESSED_DIR, DETECTION_FPS, SIMILARITY_THRESHOLD, JPEG_QUALITY, THUMBNAIL_WIDTH
        from models.face_analyzer import get_face_analyzer
        from services.blacklist_service import get_blacklist_service

        self._processed_dir: Path = PROCESSED_DIR
        self._target_fps: int = DETECTION_FPS
        self._threshold: float = SIMILARITY_THRESHOLD
        self._jpeg_quality: int = JPEG_QUALITY
        self._max_width: int = THUMBNAIL_WIDTH

        self._analyzer = get_face_analyzer()
        self._blacklist = get_blacklist_service()

        self._jobs: Dict[str, JobStatus] = {}

    # ── Public ────────────────────────────────────────────────────────────────

    def get_job(self, video_id: str) -> Optional[JobStatus]:
        return self._jobs.get(video_id)

    def list_jobs(self) -> List[Dict]:
        return [j.to_dict() for j in self._jobs.values()]

    async def process(
        self, video_id: str, video_path: str
    ) -> AsyncGenerator[Dict, None]:
        """
        Async generator that processes the video and yields event dicts:
          { type: "start" | "frame" | "alert" | "complete" | "error", ... }
        """
        job = JobStatus(video_id=video_id)
        self._jobs[video_id] = job

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            msg = f"Cannot open video: {video_path}"
            job.status = "error"
            job.error = msg
            yield {"type": "error", "video_id": video_id, "message": msg}
            return

        try:
            src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            target_fps = min(self._target_fps, src_fps)
            frame_skip = max(1, round(src_fps / target_fps))

            job.status = "processing"
            job.total_frames = total_frames
            job.fps = src_fps

            # Output video writer
            out_path = str(self._processed_dir / f"{video_id}_processed.mp4")
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out_writer = cv2.VideoWriter(out_path, fourcc, target_fps, (width, height))
            job.output_path = out_path

            yield {
                "type": "start",
                "video_id": video_id,
                "src_fps": round(src_fps, 2),
                "target_fps": round(target_fps, 2),
                "total_frames": total_frames,
                "width": width,
                "height": height,
            }

            frame_idx = 0
            last_yield = time.monotonic()

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                timestamp = (frame_idx - 1) / src_fps

                if frame_idx % frame_skip != 0:
                    continue

                # ── Detect & annotate ───────────────────────────────────────
                annotated, frame_dets = self._process_frame(
                    frame.copy(), video_id, frame_idx, timestamp
                )
                out_writer.write(annotated)

                job.current_frame = frame_idx
                job.progress = (frame_idx / total_frames * 100) if total_frames else 0
                job.detections.extend(frame_dets)

                # ── Encode frame for streaming ──────────────────────────────
                thumb = _resize_for_stream(annotated, self._max_width)
                _, buf = cv2.imencode(
                    ".jpg", thumb,
                    [cv2.IMWRITE_JPEG_QUALITY, self._jpeg_quality]
                )
                frame_b64 = base64.b64encode(buf).decode()

                event: Dict = {
                    "type": "frame",
                    "video_id": video_id,
                    "frame_idx": frame_idx,
                    "timestamp": round(timestamp, 3),
                    "timestamp_str": _fmt_ts(timestamp),
                    "progress": round(job.progress, 1),
                    "frame_data": frame_b64,
                    "detections": [d.to_dict() for d in frame_dets],
                    "face_count": len(frame_dets),
                    "blacklisted_count": sum(1 for d in frame_dets if d.person_name != "Unknown"),
                }
                yield event

                # ── Alert events ────────────────────────────────────────────
                for det in frame_dets:
                    if det.person_name != "Unknown":
                        yield {
                            "type": "alert",
                            "video_id": video_id,
                            **det.to_dict(),
                        }

                # Cooperative yield to event loop
                now = time.monotonic()
                if now - last_yield > 0.05:
                    await asyncio.sleep(0)
                    last_yield = now

        finally:
            cap.release()
            if "out_writer" in dir():
                out_writer.release()

        job.status = "completed"
        job.finished_at = time.time()

        yield {
            "type": "complete",
            "video_id": video_id,
            "total_frames": frame_idx,
            "total_detections": len(job.detections),
            "unique_persons": list({d.person_name for d in job.detections if d.person_name != "Unknown"}),
            "output_path": job.output_path,
        }

    # ── Private ───────────────────────────────────────────────────────────────

    def _process_frame(
        self,
        frame: np.ndarray,
        video_id: str,
        frame_idx: int,
        timestamp: float,
    ):
        faces = self._analyzer.get_faces(frame)
        detections: List[Detection] = []

        for face in faces:
            bbox = [int(v) for v in face.bbox]
            emb = face.embedding
            det_score = float(getattr(face, "det_score", 1.0))

            match = self._blacklist.search(emb, self._threshold) if emb is not None else None

            if match:
                name, conf = match
                color = (0, 0, 255)   # Red — blacklisted
                label = f"! {name}  {conf:.1f}%"
                detections.append(Detection(
                    video_id=video_id,
                    frame_idx=frame_idx,
                    timestamp=timestamp,
                    person_name=name,
                    confidence=conf,
                    bbox=bbox,
                    det_score=det_score,
                ))
            else:
                color = (50, 205, 50)  # Green — unknown / safe
                label = "Unknown"

            frame = _draw_face(frame, bbox, label, color)

        return frame, detections
