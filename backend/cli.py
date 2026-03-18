#!/usr/bin/env python3
"""
cli.py — Command-line interface for the Face Surveillance blacklist

Usage:
  python cli.py build                     # Rebuild FAISS index from blacklist/
  python cli.py list                      # List all persons and their embedding counts
  python cli.py add <name> <img> [img…]   # Add a person with one or more images
  python cli.py remove <name>             # Remove a person from the blacklist
  python cli.py test <image>              # Test face detection on an image
  python cli.py process <video>           # Process a video offline (no WebSocket)
"""
import sys
import os

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(__file__))

import argparse
import cv2
import json
from pathlib import Path


def cmd_build(args):
    from services.blacklist_service import get_blacklist_service
    svc = get_blacklist_service()
    result = svc.build_index()
    print(json.dumps(result, indent=2))


def cmd_list(args):
    from services.blacklist_service import get_blacklist_service
    svc = get_blacklist_service()
    persons = svc.list_persons()
    if not persons:
        print("Blacklist is empty.")
        return
    print(f"\n{'NAME':<30} {'IMAGES':>7} {'EMBEDDINGS':>12}")
    print("-" * 52)
    for p in persons:
        print(f"{p['name']:<30} {p['image_count']:>7} {p['embedding_count']:>12}")
    print(f"\nTotal: {len(persons)} person(s), {svc.embedding_count} embedding(s)")


def cmd_add(args):
    from services.blacklist_service import get_blacklist_service
    svc = get_blacklist_service()
    image_files = []
    for path in args.images:
        data = Path(path).read_bytes()
        image_files.append((Path(path).name, data))
    result = svc.add_person(args.name, image_files)
    print(json.dumps(result, indent=2))


def cmd_remove(args):
    from services.blacklist_service import get_blacklist_service
    svc = get_blacklist_service()
    ok = svc.delete_person(args.name)
    print("Deleted." if ok else f"Person '{args.name}' not found.")


def cmd_test(args):
    from models.face_analyzer import get_face_analyzer
    analyzer = get_face_analyzer()
    img = cv2.imread(args.image)
    if img is None:
        print(f"Cannot read: {args.image}")
        return
    faces = analyzer.get_faces(img)
    print(f"\nDetected {len(faces)} face(s) in '{args.image}':")
    for i, f in enumerate(faces, 1):
        print(f"  #{i}  bbox={[int(v) for v in f.bbox]}  score={f.det_score:.3f}  embedding_shape={f.embedding.shape}")


def cmd_process(args):
    """Offline video processing — writes annotated video next to source file."""
    import asyncio
    from services.video_processor import VideoProcessor
    import uuid

    video_id = str(uuid.uuid4())[:8]
    proc = VideoProcessor()

    async def run():
        frame_count = 0
        async for event in proc.process(video_id, args.video):
            if event["type"] == "frame":
                frame_count += 1
                if frame_count % 30 == 0:
                    print(f"  Frame {event['frame_idx']}  {event['progress']:.1f}%  "
                          f"detections={len(event['detections'])}", end="\r")
            elif event["type"] == "alert":
                print(f"\n  ⚠  ALERT: {event['person_name']}  {event['confidence']}%  @ {event['timestamp_str']}")
            elif event["type"] == "complete":
                print(f"\n\nDone! {event['total_detections']} detections. Output: {event['output_path']}")
            elif event["type"] == "error":
                print(f"\nError: {event['message']}")

    asyncio.run(run())


def main():
    parser = argparse.ArgumentParser(description="FaceGuard CLI")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("build",  help="Rebuild FAISS index")
    sub.add_parser("list",   help="List blacklist persons")

    p_add = sub.add_parser("add", help="Add person to blacklist")
    p_add.add_argument("name")
    p_add.add_argument("images", nargs="+")

    p_rm = sub.add_parser("remove", help="Remove person from blacklist")
    p_rm.add_argument("name")

    p_test = sub.add_parser("test", help="Test face detection on image")
    p_test.add_argument("image")

    p_proc = sub.add_parser("process", help="Process a video file offline")
    p_proc.add_argument("video")

    args = parser.parse_args()

    dispatch = {
        "build":   cmd_build,
        "list":    cmd_list,
        "add":     cmd_add,
        "remove":  cmd_remove,
        "test":    cmd_test,
        "process": cmd_process,
    }

    if args.cmd not in dispatch:
        parser.print_help()
        return

    dispatch[args.cmd](args)


if __name__ == "__main__":
    main()
