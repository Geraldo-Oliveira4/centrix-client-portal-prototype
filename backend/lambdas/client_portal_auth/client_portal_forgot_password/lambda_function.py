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
    client_id = _COGNITO_CLIENT_ID

    body, err = parse_body(event)
    if err:
        return err

    email = body.get("email")
    if not email:
        return build_response(400, {"error": "O campo email é obrigatório."})

    email = email.lower().strip()

    # Always return 200 to avoid e-mail enumeration. Cognito errors are
    # logged for diagnostics only.
    try:
        cognito.forgot_password(ClientId=client_id, Username=email)
    except ClientError as e:
        logger.warning(
            "forgot_password failed silently",
            extra={"email": email, "code": e.response["Error"]["Code"]},
        )

    return build_response(
        200,
        {"message": "Se o e-mail existir, um código foi enviado para redefinição."},
    )
