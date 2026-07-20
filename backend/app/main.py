"""FastAPI entrypoint for the Centrix client-portal prototype.

Wraps the copied `lambdas/client_portal*` handlers as HTTP routes against a local
Postgres, with S3/SQS/Graph mocked. Run with:

    uvicorn app.main:app --reload
"""

import os

# Disable AWS X-Ray tracing before any handler/observability import — there is no
# X-Ray daemon locally. Powertools Logger still works as a normal JSON logger.
os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "true")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "centrix-portal-prototype")

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.mocks import install_mocks

# Install offline mocks before the routers import the Lambda handlers.
install_mocks()

from app.routers import auth, local_s3, portal  # noqa: E402

app = FastAPI(title="Centrix Client Portal — Prototype")

app.add_middleware(
    CORSMiddleware,
    # Local prototype: accept any localhost origin (the frontend may land on a
    # different port if 3000 is taken). Auth is a Bearer header, not a cookie,
    # so credentials mode isn't needed and "*" is safe here.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(portal.router)
app.include_router(local_s3.router)


@app.get("/health")
def health():
    return {"status": "ok"}
