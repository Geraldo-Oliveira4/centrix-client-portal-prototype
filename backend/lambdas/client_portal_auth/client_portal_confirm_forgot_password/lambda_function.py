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

        email = body.get("email")
        code = body.get("confirmation_code") or body.get("code")
        new_password = body.get("new_password")

        if not email or not code or not new_password:
            return build_response(
                400,
                {"error": "Os campos email, confirmation_code e new_password são obrigatórios."},
            )

        email = email.lower().strip()

        try:
            cognito.confirm_forgot_password(
                ClientId=client_id,
                Username=email,
                ConfirmationCode=code,
                Password=new_password,
            )
            return build_response(200, {"message": "Senha redefinida com sucesso."})

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "InvalidPasswordException":
                return build_response(400, {"error": "Senha não atende aos requisitos mínimos."})
            if error_code in ("CodeMismatchException", "ExpiredCodeException"):
                return build_response(400, {"error": "Código inválido ou expirado."})

            logger.warning(
                "Unhandled Cognito error on confirm_forgot_password",
                extra={"code": error_code, "email": email},
            )
            return build_response(
                400,
                {"error": "Não foi possível redefinir a senha. Tente novamente."},
            )

    except Exception:
        logger.exception("Unhandled error in client_portal_confirm_forgot_password")
        return build_response(500, {"error": "Internal server error"})
