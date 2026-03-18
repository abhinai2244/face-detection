"""
blacklist_service.py
─────────────────────
Manages the blacklist database:
  • Scans blacklist/ directory for person sub-folders
  • Extracts ArcFace embeddings via InsightFace
  • Persists embeddings to disk (pickle)
  • Builds a FAISS flat-IP index (cosine similarity after L2-norm)
  • Provides fast nearest-neighbour search
"""
from __future__ import annotations

import logging
import os
import pickle
import shutil
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import faiss  # type: ignore
import numpy as np

logger = logging.getLogger(__name__)

_service_lock = threading.Lock()
_service_instance: Optional["BlacklistService"] = None


def get_blacklist_service() -> "BlacklistService":
    global _service_instance
    if _service_instance is None:
        with _service_lock:
            if _service_instance is None:
                _service_instance = BlacklistService()
    return _service_instance


class BlacklistService:
    EMBEDDING_DIM = 512
    IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    def __init__(self):
        from config import BLACKLIST_DIR, EMBEDDINGS_FILE
        from models.face_analyzer import get_face_analyzer

        self._blacklist_dir: Path = BLACKLIST_DIR
        self._embeddings_file: Path = EMBEDDINGS_FILE
        self._analyzer = get_face_analyzer()

        # Runtime state
        self._embeddings: Dict[str, List[np.ndarray]] = {}  # name → list of 512-d vecs
        self._flat_labels: List[str] = []                   # parallel to FAISS rows
        self._index: Optional[faiss.IndexFlatIP] = None
        self._rebuild_lock = threading.Lock()

        self._load_or_build()

    # ──────────────────────────────────────────────────────────────────────────
    # Persistence
    # ──────────────────────────────────────────────────────────────────────────

    def _load_or_build(self) -> None:
        if self._embeddings_file.exists():
            try:
                self._load_from_disk()
                logger.info("Loaded %d embedding vectors for %d persons.",
                            len(self._flat_labels), len(self._embeddings))
                return
            except Exception as exc:
                logger.warning("Failed to load embeddings cache (%s). Rebuilding…", exc)
        self.build_index()

    def _load_from_disk(self) -> None:
        with open(self._embeddings_file, "rb") as fh:
            data = pickle.load(fh)
        self._embeddings = data["embeddings"]
        self._flat_labels = data["labels"]
        vectors = data.get("vectors", [])
        if vectors:
            self._build_faiss(np.array(vectors, dtype="float32"))

    def _save_to_disk(self) -> None:
        flat_vecs: List[np.ndarray] = []
        flat_labels: List[str] = []
        for name, embs in self._embeddings.items():
            for emb in embs:
                flat_vecs.append(emb)
                flat_labels.append(name)

        self._flat_labels = flat_labels
        payload = {
            "embeddings": self._embeddings,
            "labels": flat_labels,
            "vectors": flat_vecs,
        }
        tmp = self._embeddings_file.with_suffix(".tmp")
        with open(tmp, "wb") as fh:
            pickle.dump(payload, fh)
        shutil.move(str(tmp), str(self._embeddings_file))

        if flat_vecs:
            self._build_faiss(np.array(flat_vecs, dtype="float32"))
        logger.info("Saved %d embeddings (%d persons).", len(flat_labels), len(self._embeddings))

    # ──────────────────────────────────────────────────────────────────────────
    # FAISS helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _build_faiss(self, vectors: np.ndarray) -> None:
        vectors = vectors.astype("float32")
        faiss.normalize_L2(vectors)
        index = faiss.IndexFlatIP(self.EMBEDDING_DIM)
        index.add(vectors)
        self._index = index

    # ──────────────────────────────────────────────────────────────────────────
    # Build / Rebuild
    # ──────────────────────────────────────────────────────────────────────────

    def build_index(self) -> Dict:
        """
        Scan the blacklist directory and (re)build all embeddings + FAISS index.
        Returns a summary dict.
        """
        with self._rebuild_lock:
            logger.info("Building blacklist index from '%s'…", self._blacklist_dir)
            new_embeddings: Dict[str, List[np.ndarray]] = {}
            skipped = 0

            for person_dir in sorted(self._blacklist_dir.iterdir()):
                if not person_dir.is_dir():
                    continue
                name = person_dir.name
                person_embs: List[np.ndarray] = []

                for img_path in sorted(person_dir.iterdir()):
                    if img_path.suffix.lower() not in self.IMG_EXTS:
                        continue
                    img = cv2.imread(str(img_path))
                    if img is None:
                        skipped += 1
                        continue
                    emb = self._analyzer.get_best_embedding(img)
                    if emb is not None:
                        person_embs.append(emb.astype("float32"))
                    else:
                        skipped += 1
                        logger.debug("No face detected in %s", img_path)

                if person_embs:
                    new_embeddings[name] = person_embs
                    logger.info("  %s: %d embeddings", name, len(person_embs))
                else:
                    logger.warning("  %s: no valid embeddings — skipped", name)

            self._embeddings = new_embeddings
            self._save_to_disk()

            summary = {
                "persons": len(new_embeddings),
                "total_embeddings": sum(len(v) for v in new_embeddings.values()),
                "skipped_images": skipped,
            }
            logger.info("Index built: %s", summary)
            return summary

    # ──────────────────────────────────────────────────────────────────────────
    # Search
    # ──────────────────────────────────────────────────────────────────────────

    def search(
        self,
        embedding: np.ndarray,
        threshold: float,
        top_k: int = 1,
    ) -> Optional[Tuple[str, float]]:
        """
        Find the closest person in the FAISS index.

        Returns (name, confidence_pct) if similarity ≥ threshold, else None.
        """
        if self._index is None or self._index.ntotal == 0:
            return None
        if embedding is None:
            return None

        query = embedding.astype("float32").reshape(1, -1)
        faiss.normalize_L2(query)

        k = min(top_k, self._index.ntotal)
        distances, indices = self._index.search(query, k)

        best_sim = float(distances[0][0])
        best_idx = int(indices[0][0])

        if best_idx < 0 or best_sim < threshold:
            return None

        name = self._flat_labels[best_idx]
        confidence = round(best_sim * 100, 2)
        return name, confidence

    # ──────────────────────────────────────────────────────────────────────────
    # Mutation
    # ──────────────────────────────────────────────────────────────────────────

    def add_person(self, name: str, image_files: List[Tuple[str, bytes]]) -> Dict:
        """
        Add a new person (or update existing) from uploaded image bytes.
        image_files: list of (filename, raw_bytes).
        """
        person_dir = self._blacklist_dir / name
        person_dir.mkdir(parents=True, exist_ok=True)

        saved, extracted = 0, 0
        new_embs: List[np.ndarray] = []

        for fname, data in image_files:
            safe_name = Path(fname).name
            dest = person_dir / safe_name
            dest.write_bytes(data)
            saved += 1

            arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                continue
            emb = self._analyzer.get_best_embedding(img)
            if emb is not None:
                new_embs.append(emb.astype("float32"))
                extracted += 1

        if name not in self._embeddings:
            self._embeddings[name] = []
        self._embeddings[name].extend(new_embs)
        self._save_to_disk()

        return {"name": name, "saved_images": saved, "extracted_embeddings": extracted}

    def delete_person(self, name: str) -> bool:
        person_dir = self._blacklist_dir / name
        if not person_dir.exists():
            return False
        shutil.rmtree(str(person_dir))
        self._embeddings.pop(name, None)
        self._save_to_disk()
        return True

    # ──────────────────────────────────────────────────────────────────────────
    # Queries
    # ──────────────────────────────────────────────────────────────────────────

    def list_persons(self) -> List[Dict]:
        result = []
        for name, embs in sorted(self._embeddings.items()):
            person_dir = self._blacklist_dir / name
            imgs = [
                f.name
                for f in person_dir.iterdir()
                if f.suffix.lower() in self.IMG_EXTS
            ] if person_dir.exists() else []
            result.append(
                {
                    "name": name,
                    "embedding_count": len(embs),
                    "image_count": len(imgs),
                    "images": imgs,
                }
            )
        return result

    @property
    def person_count(self) -> int:
        return len(self._embeddings)

    @property
    def embedding_count(self) -> int:
        return self._index.ntotal if self._index else 0
