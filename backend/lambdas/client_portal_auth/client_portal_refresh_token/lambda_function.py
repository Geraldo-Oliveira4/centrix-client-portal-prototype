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
        client_id = _COGNITO_CLIENT_ID

        body, err = parse_body(event)
        if err:
            return err

        refresh_token = body.get("refresh_token")
        if not refresh_token:
            return build_response(400, {"error": "Refresh token is required"})

        try:
            response = cognito.initiate_auth(
                ClientId=client_id,
                AuthFlow="REFRESH_TOKEN_AUTH",
                AuthParameters={"REFRESH_TOKEN": refresh_token},
            )
            auth_result = response["AuthenticationResult"]
            return build_response(200, {
                "access_token": auth_result["AccessToken"],
                "id_token": auth_result["IdToken"],
            })

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            logger.warning("Portal refresh failed", extra={"code": error_code})
            return build_response(401, {"error": "Invalid refresh token"})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
