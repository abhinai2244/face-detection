# 👁 FaceGuard — AI Face Recognition Surveillance System

Real-time face detection and blacklist matching using **InsightFace (ArcFace)**, **FAISS**, **FastAPI**, and **React**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (React)                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Video Upload │  │  Dual Video View  │  │  Detection Logs  │  │
│  │  (Dropzone)  │  │ Original │ AI-Ann │  │  + Alert Panel   │  │
│  └──────┬───────┘  └──────────┴───────┘  └──────────────────┘  │
│         │ REST POST /api/video/upload  WebSocket /ws/process/:id │
└─────────┼────────────────────────────────────────┬──────────────┘
          │                                         │ JSON frames (base64 JPEG)
┌─────────▼─────────────────────────────────────────▼─────────────┐
│                       FastAPI Backend (Python)                    │
│                                                                   │
│   VideoProcessor ──► InsightFace (RetinaFace + ArcFace)          │
│        │                      │ embedding (512-d float32)         │
│        │             BlacklistService                             │
│        │                      │ FAISS IndexFlatIP (cosine sim)    │
│        └──────────────────────┘                                  │
│                                                                   │
│   /api/video/*        /api/blacklist/*        /ws/process/:id    │
└──────────────────────────────────────────────────────────────────┘
```

### Key Technology Choices

| Component | Library | Why |
|-----------|---------|-----|
| Face detector | InsightFace RetinaFace | State-of-the-art accuracy, runs inside the same model pack |
| Face embedder | ArcFace (buffalo_l) | Top-ranked on LFW, 512-d embeddings |
| Vector search | FAISS IndexFlatIP | Sub-millisecond cosine search on thousands of embeddings |
| Runtime | ONNX Runtime (CPU/GPU) | Drop-in GPU acceleration without changing code |
| Streaming | FastAPI WebSocket | Low-latency frame delivery to browser |
| Video I/O | OpenCV | Battle-tested, supports all major codecs |

---

## Folder Structure

```
face-surveillance/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # All tunable settings
│   ├── cli.py                   # Command-line management tool
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── api/
│   │   └── routes/
│   │       ├── video.py         # Upload / status / download endpoints
│   │       ├── blacklist.py     # Blacklist CRUD endpoints
│   │       └── ws.py            # WebSocket processing endpoint
│   ├── models/
│   │   └── face_analyzer.py     # InsightFace singleton wrapper
│   ├── services/
│   │   ├── blacklist_service.py # FAISS index + embedding management
│   │   └── video_processor.py   # Frame-by-frame processing pipeline
│   ├── blacklist/               # ← Put person folders here
│   │   └── PersonName/
│   │       ├── img1.jpg
│   │       └── img2.jpg
│   ├── uploads/                 # Incoming videos (auto-created)
│   ├── processed/               # Annotated output videos (auto-created)
│   └── data/
│       └── embeddings.pkl       # Cached FAISS embeddings (auto-generated)
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── VideoUpload.jsx
│       │   ├── DualVideoPanel.jsx
│       │   ├── ProgressPanel.jsx
│       │   ├── AlertPanel.jsx
│       │   ├── DetectionLog.jsx
│       │   └── BlacklistManager.jsx
│       ├── pages/
│       │   └── SurveillancePage.jsx
│       ├── hooks/
│       │   ├── useProcessing.js  # WS lifecycle + state
│       │   └── useBlacklist.js   # Blacklist CRUD state
│       ├── services/
│       │   └── api.js            # Axios + WS factory
│       └── utils/
│           └── helpers.js
│
├── docker-compose.yml
└── README.md                    ← you are here
```

---

## Installation Guide

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10 or 3.11 |
| Node.js | 18 or 20 |
| npm / pnpm | latest |
| (Optional) CUDA | 11.8+ for GPU acceleration |

---

### 1 — Clone / download

```bash
git clone <repo-url> face-surveillance
cd face-surveillance
```

---

### 2 — Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

> **GPU acceleration:** swap the two ONNX lines in `requirements.txt`:
> ```
> # Comment out:  onnxruntime==1.18.0
> # Uncomment:    onnxruntime-gpu==1.18.0
> # Also swap:    faiss-cpu  →  faiss-gpu
> ```

The **InsightFace `buffalo_l` model** (~340 MB) is downloaded automatically
on first startup into `~/.insightface/models/buffalo_l/`.

---

### 3 — Add blacklist persons

```
backend/blacklist/
├── John_Doe/
│   ├── front.jpg
│   └── side.jpg
└── Jane_Smith/
    └── photo.png
```

Then build the FAISS index:

```bash
# Option A — Python (while venv is active)
python cli.py build

# Option B — via API (after server starts)
curl -X POST http://localhost:8000/api/blacklist/rebuild
```

---

### 4 — Start the backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs available at: **http://localhost:8000/docs**

---

### 5 — Frontend setup

```bash
cd frontend

# Copy environment template
cp .env.example .env.local

npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Docker (recommended for production)

```bash
# From project root
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

---

## Configuration

All settings live in `backend/config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `SIMILARITY_THRESHOLD` | `0.45` | Cosine similarity cutoff (0–1). Increase for stricter matching. |
| `DETECTION_FPS` | `10` | Frames-per-second to process |
| `MAX_VIDEO_SIZE_MB` | `2048` | Maximum upload size in MB |
| `INSIGHTFACE_MODEL` | `buffalo_l` | InsightFace model pack |
| `JPEG_QUALITY` | `75` | WebSocket stream quality (1–100) |
| `THUMBNAIL_WIDTH` | `640` | Max width of streamed frames |

---

## API Reference

### Video

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/video/upload` | Upload video (multipart) |
| `GET` | `/api/video/status/{id}` | Get job status + progress |
| `GET` | `/api/video/download/{id}` | Download processed video |
| `DELETE` | `/api/video/{id}` | Delete video and job |

### Blacklist

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/blacklist/` | List all persons |
| `POST` | `/api/blacklist/add` | Add person (multipart: name + images) |
| `DELETE` | `/api/blacklist/{name}` | Remove person |
| `POST` | `/api/blacklist/rebuild` | Rebuild FAISS index from disk |
| `GET` | `/api/blacklist/stats` | Index statistics |

### WebSocket

| Path | Description |
|------|-------------|
| `WS /ws/process/{video_id}` | Real-time frame streaming |

---

## CLI Tools

```bash
cd backend && source .venv/bin/activate

python cli.py build                          # Rebuild FAISS index
python cli.py list                           # List all blacklisted persons
python cli.py add "John Doe" img1.jpg img2.jpg   # Add person from images
python cli.py remove "John_Doe"              # Remove person
python cli.py test photo.jpg                 # Test detection on a single image
python cli.py process surveillance.mp4       # Process video offline (no server needed)
```

---

## Performance Notes

* **CPU-only** (default): processes ≈ 8–15 FPS on a modern laptop
* **GPU (CUDA)**: processes ≈ 30–60 FPS on RTX 3060+
* FAISS search for 10,000 embeddings takes < 1 ms
* Video is processed asynchronously — the browser receives frames as they are ready

### Tuning for speed

1. Lower `DETECTION_FPS` in `config.py` (e.g. 5 FPS is fine for most surveillance use-cases)
2. Use `buffalo_s` model instead of `buffalo_l` (smaller, faster, slightly less accurate)
3. Enable GPU: swap `onnxruntime` → `onnxruntime-gpu` in `requirements.txt`
4. Reduce `THUMBNAIL_WIDTH` to 480 for faster WebSocket streaming

---

## Troubleshooting

**"No module named insightface"**
→ Make sure your venv is activated: `source .venv/bin/activate`

**"Model download fails"**
→ InsightFace downloads from a CDN on first run. Ensure internet access. Models are cached in `~/.insightface/`.

**"No faces detected in blacklist images"**
→ Use clear, well-lit, front-facing photos. Minimum recommended face size is 80×80 px within the image.

**"CORS error in browser"**
→ Add your frontend origin to `ALLOWED_ORIGINS` in `backend/config.py`

**"WebSocket connection refused"**
→ Confirm the backend is running on port 8000 and check `VITE_WS_URL` in `frontend/.env.local`

**Out of memory on GPU**
→ Reduce `det_size` in `face_analyzer.py` from `(640, 640)` to `(320, 320)`
