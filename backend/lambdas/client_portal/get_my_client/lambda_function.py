from shared.database.connection import get_session
from shared.database.repositories import client_repository
from shared.lambda_helpers import build_response
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id, serialize_client_for_portal


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            client = client_repository.get(session, client_id)
            if client is None:
                return build_response(404, {"error": "Client not found"})

            return build_response(200, {"client": serialize_client_for_portal(client)})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
