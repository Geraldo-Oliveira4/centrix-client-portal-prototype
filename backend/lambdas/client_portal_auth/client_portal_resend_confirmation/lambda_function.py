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
        cognito.resend_confirmation_code(
            ClientId=_COGNITO_CLIENT_ID,
            Username=email,
        )
    except ClientError as e:
        logger.warning(
            "resend_confirmation failed silently",
            extra={"email": email, "code": e.response["Error"]["Code"]},
        )

    return build_response(
        200,
        {"message": "Código de confirmação reenviado para o e-mail."},
    )
