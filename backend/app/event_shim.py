"""Translate a FastAPI request into the AWS API Gateway HTTP API v2 event dict
that the copied Lambda handlers expect, call the handler, and translate its
`{statusCode, headers, body}` return value back into a FastAPI Response.

Auto-login: there is no Cognito. Every request is stamped with the demo portal
user's Cognito `sub` (see DEMO_SUB), which `get_portal_client_id` resolves to the
seeded demo client via the `centrix_portal_users` table. The seed script inserts
a portal_user row with exactly this sub.
"""

import json
import os

from fastapi import Request, Response

# Must match the `cognito_sub` of the portal_user row created by
# scripts/seed_prototype.py.
DEMO_SUB = os.environ.get("DEMO_PORTAL_SUB", "demo-portal-user-sub")
DEMO_EMAIL = os.environ.get("DEMO_PORTAL_EMAIL", "demo@cliente.local")


class _FakeLambdaContext:
    """Minimal stand-in for the AWS Lambda `context` object.

    Powertools' `@logger.inject_lambda_context` reads these attributes to build
    its context model; passing `None` raises AttributeError.
    """

    function_name = "centrix-portal-prototype"
    function_version = "$LATEST"
    invoked_function_arn = "arn:aws:lambda:local:000000000000:function:centrix-portal-prototype"
    memory_limit_in_mb = 512
    aws_request_id = "local-request"


_FAKE_CONTEXT = _FakeLambdaContext()


def build_event(request: Request, path_params: dict, body: str | None) -> dict:
    return {
        "requestContext": {
            "http": {
                "method": request.method,
                "path": request.url.path,
            },
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": DEMO_SUB,
                        "email": DEMO_EMAIL,
                        "username": DEMO_EMAIL,
                    }
                }
            },
            "requestId": "prototype-local",
        },
        "pathParameters": {k: str(v) for k, v in (path_params or {}).items()},
        "queryStringParameters": dict(request.query_params) or None,
        "body": body,
    }


def to_response(result: dict) -> Response:
    """Convert a Lambda-style dict into a FastAPI Response."""
    status = result.get("statusCode", 200)
    body = result.get("body", "")
    headers = {
        k: v
        for k, v in (result.get("headers") or {}).items()
        # Drop CORS/cache headers — CORS is handled by FastAPI middleware.
        if k.lower() not in {
            "access-control-allow-origin",
            "access-control-allow-credentials",
        }
    }
    media_type = headers.pop("Content-Type", None) or headers.pop(
        "content-type", "application/json"
    )
    return Response(content=body, status_code=status, headers=headers, media_type=media_type)


async def invoke(handler, request: Request, path_params: dict | None = None) -> Response:
    """Read the request body, build the event, run the sync handler, and adapt
    the response. Handlers are synchronous (no async), so a threadpool isn't
    strictly needed for correctness at prototype scale — we call directly.
    """
    raw = await request.body()
    body_str = raw.decode("utf-8") if raw else None
    event = build_event(request, path_params or {}, body_str)
    result = handler(event, _FAKE_CONTEXT)
    return to_response(result)
