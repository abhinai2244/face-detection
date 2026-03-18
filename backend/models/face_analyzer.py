"""
face_analyzer.py
─────────────────
Singleton wrapper around InsightFace FaceAnalysis.
Provides face detection + ArcFace embedding in one call.
"""
from __future__ import annotations

import logging
import threading
from typing import List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_instance: Optional["FaceAnalyzer"] = None


def get_face_analyzer() -> "FaceAnalyzer":
    """Thread-safe singleton accessor."""
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = FaceAnalyzer()
    return _instance


class FaceAnalyzer:
    """
    Wraps insightface.app.FaceAnalysis.
    Downloads model on first run (cached in ~/.insightface/).
    """

    def __init__(self):
        # Lazy import so the module can be loaded without the GPU present
        from insightface.app import FaceAnalysis  # type: ignore

        from config import INSIGHTFACE_MODEL, ONNX_PROVIDERS

        logger.info("Loading InsightFace model '%s'…", INSIGHTFACE_MODEL)
        self._app = FaceAnalysis(
            name=INSIGHTFACE_MODEL,
            providers=ONNX_PROVIDERS,
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace model loaded successfully.")

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def get_faces(self, bgr_frame: np.ndarray) -> List:
        """
        Detect all faces in *bgr_frame* and return list of Face objects.
        Each object has `.bbox` (x1,y1,x2,y2), `.embedding` (512-d float32),
        `.det_score` (confidence 0–1), and `.age` / `.gender`.
        """
        if bgr_frame is None or bgr_frame.size == 0:
            return []
        return self._app.get(bgr_frame)

    def get_best_embedding(self, bgr_image: np.ndarray) -> Optional[np.ndarray]:
        """
        Return the ArcFace embedding for the *largest* face in the image.
        Returns None if no face is detected.
        """
        faces = self.get_faces(bgr_image)
        if not faces:
            return None
        # Pick the face with the largest bounding-box area
        best = max(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
        )
        return best.embedding  # shape (512,) float32

    # ──────────────────────────────────────────────────────────────────────────
    # Utility
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def read_image(path: str) -> Optional[np.ndarray]:
        """Read an image from *path* with error handling."""
        img = cv2.imread(path)
        if img is None:
            logger.warning("Could not read image: %s", path)
        return img
