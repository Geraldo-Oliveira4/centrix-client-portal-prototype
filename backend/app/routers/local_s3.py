"""Local filesystem stand-in for S3 presigned upload/download URLs.

The mocked `s3_service` returns URLs pointing here. Files are stored under
`app.mocks.STORAGE_DIR` keyed by their S3 key path.
"""

from fastapi import APIRouter, Request, Response
from fastapi.responses import FileResponse

from app.mocks import STORAGE_DIR

router = APIRouter(tags=["local-s3"])


def _safe_path(key: str):
    # Resolve and ensure the target stays within STORAGE_DIR.
    target = (STORAGE_DIR / key).resolve()
    if not str(target).startswith(str(STORAGE_DIR)):
        raise ValueError("Invalid key")
    return target


@router.put("/_local_s3/{key:path}")
async def put_object(key: str, request: Request):
    target = _safe_path(key)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(await request.body())
    return Response(status_code=200)


@router.get("/_local_s3/{key:path}")
async def get_object(key: str):
    target = _safe_path(key)
    if not target.is_file():
        return Response(status_code=404)
    return FileResponse(target)
