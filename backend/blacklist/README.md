# Blacklist Database

Place sub-folders here — one per person. Each folder should contain
multiple clear face photos (JPEG / PNG) of the same person from different angles.

## Recommended structure

```
blacklist/
├── John_Doe/
│   ├── front.jpg
│   ├── left_profile.jpg
│   ├── right_profile.jpg
│   └── glasses.jpg
├── Jane_Smith/
│   ├── img1.jpg
│   └── img2.jpg
└── ...
```

## Tips for best accuracy

* Use 3–10 images per person
* Include front-facing and slight side angles
* Minimum face size: ~80×80 px in the image
* Avoid heavy sunglasses or masks in reference images
* Good lighting is critical

After adding folders, run from the project root:

```bash
cd backend
python -c "from services.blacklist_service import get_blacklist_service; get_blacklist_service().build_index()"
```

Or call the API endpoint:
```
POST http://localhost:8000/api/blacklist/rebuild
```
