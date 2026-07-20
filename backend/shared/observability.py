from typing import Any

from aws_lambda_powertools import Logger, Tracer

from shared.lambda_helpers import build_response

logger = Logger(service="centrix")
tracer = Tracer()


def annotate_trace(**annotations: Any) -> None:
    """Attach X-Ray trace annotations (indexed, searchable via `annotation.<key>`
    filter expressions in the X-Ray console/API — see get-trace-summaries).

    Unlike logger.append_keys() (CloudWatch Logs context only), annotations live on
    the trace itself, so a specific invocation can be found by entity ID directly in
    X-Ray without cross-referencing CloudWatch Logs. None values are skipped so
    callers can pass optional fields unconditionally.
    """
    for key, value in annotations.items():
        if value is not None:
            tracer.put_annotation(key=key, value=value)


def reject(status_code: int, reason: str, error_body: dict, **extra: Any) -> dict:
    """Log a structured rejection and build the HTTP response in one call.

    Used at every guard branch of a public (no-JWT) endpoint — invalid token,
    terminal quotation state, expired deadline, conflict, etc. Logs a fixed
    message ("public_endpoint_rejected") plus a `reason` field instead of
    free-text messages, so CloudWatch Logs Insights queries and metric filters
    keyed on `reason` survive future wording changes to the log text.

    Combining the log call and build_response() into one function means the
    logged status_code and the returned status_code can never drift apart —
    previously each guard branch typed the status code twice (once to log,
    once to respond) and nothing enforced they stayed in sync.
    """
    logger.warning("public_endpoint_rejected", extra={"reason": reason, "status_code": status_code, **extra})
    return build_response(status_code, error_body)
