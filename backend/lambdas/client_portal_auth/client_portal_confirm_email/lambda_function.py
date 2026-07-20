import os

import boto3
from botocore.exceptions import ClientError
from sqlalchemy.exc import IntegrityError

from shared.database.connection import get_session
from shared.database.repositories import (
    client_portal_contact_repository,
    portal_user_repository,
)
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
    code = body.get("confirmation_code") or body.get("code")

    if not email or not code:
        return build_response(
            400,
            {"error": "Os campos email e confirmation_code são obrigatórios."},
        )

    email = email.lower().strip()

    try:
        cognito.confirm_sign_up(
            ClientId=client_id,
            Username=email,
            ConfirmationCode=code,
        )
    except ClientError as e:
        return build_response(400, {"error": e.response["Error"]["Message"]})

    try:
        cognito_user = cognito.admin_get_user(
            UserPoolId=user_pool_id,
            Username=email,
        )
        attrs = {a["Name"]: a["Value"] for a in cognito_user["UserAttributes"]}
        sub = attrs.get("sub")
        name = attrs.get("name", email)
    except ClientError:
        logger.exception("Failed to read confirmed Cognito user")
        return build_response(500, {"error": "Internal server error"})

    if not sub:
        logger.error("Cognito returned a confirmed user without sub", extra={"email": email})
        return build_response(500, {"error": "Internal server error"})

    # user_pool_id is the portal-only Cognito pool
    # (docs/refacs/cognito-dual-pool-split.md) — every account in it is a
    # portal customer by construction, so no group membership is needed to
    # distinguish them from internal staff (who live in a separate pool).

    try:
        with get_session() as session:
            contact = client_portal_contact_repository.get_by_email(session, email)
            if contact is None:
                # Defensive: the portal contact may have been removed between
                # register and confirm. Refuse rather than create an
                # orphaned PortalUser.
                logger.warning(
                    "Confirm-email: no portal contact matches e-mail at confirm time",
                    extra={"email": email},
                )
                return build_response(
                    403,
                    {"error": "E-mail não autorizado para acesso ao portal."},
                )
            existing = portal_user_repository.get(session, sub)
            if existing is None:
                try:
                    portal_user_repository.create(
                        session,
                        id=sub,
                        email=email,
                        name=name,
                        client_id=contact.client_id,
                    )
                except IntegrityError:
                    # Concurrent confirm — record already created. Safe to ignore.
                    logger.info("PortalUser already existed at confirm time", extra={"email": email})
    except Exception:
        logger.exception("Failed to persist PortalUser")
        return build_response(500, {"error": "Internal server error"})

    return build_response(200, {"message": "Cadastro confirmado com sucesso."})
