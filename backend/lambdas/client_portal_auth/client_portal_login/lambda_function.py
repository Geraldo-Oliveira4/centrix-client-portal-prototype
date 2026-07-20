import os

import boto3
from botocore.exceptions import ClientError

from shared.lambda_helpers import build_response, parse_body
from shared.observability import logger, tracer

cognito = boto3.client("cognito-idp")
_COGNITO_CLIENT_ID = os.environ["COGNITO_CLIENT_ID"]


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        body, err = parse_body(event)
        if err:
            return err

        email = body.get("email")
        password = body.get("password")

        if not email or not password:
            return build_response(400, {"error": "Email and password are required"})

        email = email.lower()
        logger.info("Portal login attempt", extra={"email": email})

        try:
            response = cognito.initiate_auth(
                ClientId=_COGNITO_CLIENT_ID,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={
                    "USERNAME": email,
                    "PASSWORD": password,
                },
            )

            # _COGNITO_CLIENT_ID belongs to the portal-only Cognito pool
            # (docs/refacs/cognito-dual-pool-split.md) — internal staff live
            # in a separate pool entirely, so a successful initiate_auth here
            # already proves this is a portal customer. No group check needed.
            return build_response(200, {
                "access_token": response["AuthenticationResult"]["AccessToken"],
                "id_token": response["AuthenticationResult"]["IdToken"],
                "refresh_token": response["AuthenticationResult"]["RefreshToken"],
            })

        except ClientError as e:
            # Generic response to the client to avoid user enumeration; full
            # Cognito error is logged for internal diagnostics.
            error_code = e.response["Error"]["Code"]
            logger.warning(
                "Portal login failed",
                extra={"email": email, "code": error_code},
            )
            return build_response(401, {"error": "Invalid credentials"})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
