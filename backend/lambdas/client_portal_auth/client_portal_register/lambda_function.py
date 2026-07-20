import os

import boto3
from botocore.exceptions import ClientError

from shared.database.connection import get_session
from shared.database.repositories import client_portal_contact_repository
from shared.lambda_helpers import build_response, parse_body
from shared.observability import logger, tracer

cognito = boto3.client("cognito-idp")
_COGNITO_USER_POOL_ID = os.environ["COGNITO_USER_POOL_ID"]
_COGNITO_CLIENT_ID = os.environ["COGNITO_CLIENT_ID"]


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    user_pool_id = _COGNITO_USER_POOL_ID
    client_id = _COGNITO_CLIENT_ID

    body, err = parse_body(event)
    if err:
        return err

    email = body.get("email")
    password = body.get("password")
    name = body.get("name")

    if not email or not password or not name:
        return build_response(
            400,
            {"error": "Os campos email, password e name são obrigatórios."},
        )

    email = email.lower().strip()

    # Gate: the e-mail must be a registered portal contact on some client.
    try:
        with get_session() as session:
            contact = client_portal_contact_repository.get_by_email(session, email)
    except Exception:
        logger.exception("Database error checking portal contact")
        return build_response(500, {"error": "Internal server error"})

    if contact is None:
        logger.info("Portal register refused: e-mail not authorized", extra={"email": email})
        return build_response(
            403,
            {"error": "E-mail não autorizado para acesso ao portal."},
        )

    try:
        cognito.sign_up(
            ClientId=client_id,
            Username=email,
            Password=password,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "name", "Value": name},
            ],
        )
        return build_response(
            200,
            {
                "message": "Cadastro iniciado. Verifique seu e-mail para obter o código de confirmação.",
            },
        )

    except ClientError as e:
        error_code = e.response["Error"]["Code"]

        if error_code == "UsernameExistsException":
            try:
                cognito_user = cognito.admin_get_user(
                    UserPoolId=user_pool_id,
                    Username=email,
                )
                if cognito_user.get("UserStatus") == "UNCONFIRMED":
                    return build_response(
                        409,
                        {
                            "code": "USER_UNCONFIRMED",
                            "error": "Cadastro pendente de confirmação. Verifique seu e-mail para obter o código.",
                        },
                    )
            except ClientError:
                pass

            return build_response(
                400,
                {"error": "Este e-mail já está cadastrado. Faça login ou recupere sua senha."},
            )

        if error_code == "InvalidPasswordException":
            return build_response(400, {"error": "Senha não atende aos requisitos mínimos."})

        logger.warning(
            "Unhandled Cognito error on register",
            extra={"code": error_code, "email": email},
        )
        return build_response(
            400,
            {"error": "Não foi possível criar a conta agora. Tente novamente em instantes."},
        )
