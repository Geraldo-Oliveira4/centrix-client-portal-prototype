"""Auth stubs for the prototype.

There is no Cognito. The prototype auto-logs-in as the seeded demo client (see
app.event_shim.DEMO_SUB), so these endpoints exist only so the login/registration
screens don't error if a user lands on them. `login` returns a fake token bundle;
registration/confirmation/password-reset are accepted no-ops.
"""

import time

from fastapi import APIRouter

from app.event_shim import DEMO_EMAIL, DEMO_SUB

router = APIRouter(prefix="/portal/auth", tags=["portal-auth"])

_FAKE_TOKEN = "prototype-fake-token"


def _token_bundle() -> dict:
    return {
        "access_token": _FAKE_TOKEN,
        "id_token": _FAKE_TOKEN,
        "refresh_token": _FAKE_TOKEN,
        "expires_in": 3600,
        "expires_at": int((time.time() + 3600) * 1000),
        "user": {"sub": DEMO_SUB, "email": DEMO_EMAIL, "name": "Cliente Demo"},
    }


@router.post("/login")
async def login():
    return _token_bundle()


@router.post("/refresh-token")
async def refresh_token():
    return _token_bundle()


@router.post("/register")
async def register():
    return {"status": "ok", "message": "Registro simulado no protótipo."}


@router.post("/confirm-email")
async def confirm_email():
    return {"status": "ok"}


@router.post("/resend-confirmation")
async def resend_confirmation():
    return {"status": "ok"}


@router.post("/forgot-password")
async def forgot_password():
    return {"status": "ok"}


@router.post("/confirm-forgot-password")
async def confirm_forgot_password():
    return {"status": "ok"}
