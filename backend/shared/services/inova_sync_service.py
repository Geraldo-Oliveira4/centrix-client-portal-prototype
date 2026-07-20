"""Inova sync publisher — fire-and-forget SQS dispatcher for Centrix -> Inova.

This module is the single place where the message shape for the Inova sync
queue is defined. All producers (send_shipment_instruction, update_processo,
confirm_documento_upload) should call these helpers instead of building SQS
messages by hand.

The worker lives at lambdas/shipment/apply_worker/lambda_function.py.
"""

from shared.services import sqs_service


def _require_processo_id(inova_processo_id: str | None) -> str:
    if not inova_processo_id:
        raise ValueError("inova_processo_id is required for Inova sync messages")
    return inova_processo_id


def publish_status_sync(inova_processo_id: str, status: str, metadata: dict | None = None) -> bool:
    """Queue a PATCH /status call to Inova."""
    return sqs_service.publish_inova_sync_task(
        {
            "action": "status",
            "inova_processo_id": _require_processo_id(inova_processo_id),
            "payload": {"status": status},
            "metadata": metadata or {},
        }
    )


def publish_datas_sync(
    inova_processo_id: str,
    datas: dict,
    metadata: dict | None = None,
) -> bool:
    """Queue a PATCH /datas call to Inova."""
    return sqs_service.publish_inova_sync_task(
        {
            "action": "datas",
            "inova_processo_id": _require_processo_id(inova_processo_id),
            "payload": {"datas": datas},
            "metadata": metadata or {},
        }
    )


def publish_anexo_sync(
    inova_processo_id: str,
    s3_key: str,
    nome_arquivo: str,
    cod_tipo_arquivo: int,
    metadata: dict | None = None,
) -> bool:
    """Queue a POST /anexo call to Inova."""
    return sqs_service.publish_inova_sync_task(
        {
            "action": "anexo",
            "inova_processo_id": _require_processo_id(inova_processo_id),
            "payload": {
                "s3_key": s3_key,
                "nome_arquivo": nome_arquivo,
                "cod_tipo_arquivo": cod_tipo_arquivo,
            },
            "metadata": metadata or {},
        }
    )
