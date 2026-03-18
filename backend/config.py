import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
PROCESSED_DIR = BASE_DIR / "processed"
BLACKLIST_DIR = BASE_DIR / "blacklist"
DATA_DIR = BASE_DIR / "data"
EMBEDDINGS_FILE = DATA_DIR / "embeddings.pkl"

# Create directories on startup
for d in [UPLOAD_DIR, PROCESSED_DIR, BLACKLIST_DIR, DATA_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Detection Settings ───────────────────────────────────────────────────────
SIMILARITY_THRESHOLD = 0.45   # Cosine similarity (0–1). Higher = stricter match
DETECTION_FPS = 30             # Target processing FPS
MAX_VIDEO_SIZE_MB = 2048       # 2 GB
MAX_VIDEO_SIZE = MAX_VIDEO_SIZE_MB * 1024 * 1024

# ─── Model / Runtime ─────────────────────────────────────────────────────────
INSIGHTFACE_MODEL = "buffalo_l"          # InsightFace model pack
ONNX_PROVIDERS = [                       # Try GPU first, fall back to CPU
    "CUDAExecutionProvider",
    "CPUExecutionProvider",
]

# ─── Streaming ────────────────────────────────────────────────────────────────
JPEG_QUALITY = 75              # WebSocket stream quality (1–100)
THUMBNAIL_WIDTH = 640          # Max width for streamed frames

# ─── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

APP_VERSION = "1.0.0"
