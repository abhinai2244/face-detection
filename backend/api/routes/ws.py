"""
api/routes/ws.py
─────────────────
WebSocket endpoint that streams detection events from VideoProcessor
to the React frontend in real time.

Protocol (server → client):
  { type: "start",    video_id, src_fps, target_fps, total_frames, width, height }
  { type: "frame",    video_id, frame_idx, timestamp_str, progress,
                      frame_data (base64 JPEG), detections[], face_count, blacklisted_count }
  { type: "alert",    video_id, person_name, confidence, bbox, timestamp_str }
  { type: "complete", video_id, total_detections, unique_persons[], output_path }
  { type: "error",    video_id, message }

Client → server:
  { action: "start",  video_id, video_path }   → begin processing
  { action: "stop" }                            → graceful stop (future)
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])

_processor = None


def _get_processor():
    global _processor
    if _processor is None:
        from services.video_processor import VideoProcessor
        _processor = VideoProcessor()
    return _processor


@router.websocket("/ws/process/{video_id}")
async def ws_process(websocket: WebSocket, video_id: str):
    """
    Connect, then send:
      { "action": "start", "video_path": "<absolute path from upload endpoint>" }
    """
    await websocket.accept()
    logger.info("WS connected for video_id=%s", video_id)

    try:
        # Wait for start command
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=30)
        msg = json.loads(raw)

        if msg.get("action") != "start":
            await websocket.send_json({"type": "error", "message": "Expected action=start"})
            return

        video_path = msg.get("video_path", "")
        if not Path(video_path).exists():
            await websocket.send_json({
                "type": "error",
                "message": f"Video file not found: {video_path}",
            })
            return

        processor = _get_processor()

        async for event in processor.process(video_id, video_path):
            try:
                await websocket.send_json(event)
            except Exception:
                logger.warning("WS send failed — client may have disconnected.")
                break

    except WebSocketDisconnect:
        logger.info("WS disconnected: video_id=%s", video_id)
    except asyncio.TimeoutError:
        await websocket.send_json({"type": "error", "message": "Timed out waiting for start command."})
    except Exception as exc:
        logger.exception("WS error for video_id=%s: %s", video_id, exc)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("WS closed: video_id=%s", video_id)
