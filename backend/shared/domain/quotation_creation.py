"""Shared helpers for quotation creation.

Extracted from lambdas/quotation/create_quotation so that
lambdas/client_portal/create_my_quotation can reuse the same parsing,
persistence, and S3-key logic without duplicating domain knowledge.
"""

import os
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import (
    DimensaoUnidade,
    PesoUnidade,
    TipoContainer,
    TipoEmbalagem,
)
from shared.database.repositories import (
    quotation_equipment_repository,
    quotation_repository,
    quotation_volume_repository,
)
from shared.lambda_helpers import (
    parse_date,
    parse_datetime,
    parse_enum,
)
from shared.observability import logger
from shared.services import s3_service

from shared.database.models.quotation.enums import (
    CargaPerigosa,
    Currency,
    Modal,
    PriceOrPerformance,
    ServiceType,
    TipoCotacao,
    TipoEmbarque,
)

_UPLOAD_CONTENT_TYPE = "application/octet-stream"
MANUAL_SOURCE = "manual"
UPLOAD_SOURCE = "upload"
_MSG_EXTENSION = ".msg"

# Re-exported so callers only need `from shared.domain.quotation_creation
# import ACTION_QUOTATION_CREATED_BY_PORTAL` alongside MANUAL_SOURCE/
# UPLOAD_SOURCE. Defined in quotation_repository (see there for why).
ACTION_QUOTATION_CREATED_BY_PORTAL = quotation_repository.ACTION_QUOTATION_CREATED_BY_PORTAL


# ---------------------------------------------------------------------------
# S3 key builders
# ---------------------------------------------------------------------------

def build_raw_s3_key(quotation_id: str) -> str:
    return f"quotations/{quotation_id}/raw/email.msg"


def build_attachment_s3_key(quotation_id: str, filename: str) -> str:
    safe = os.path.basename(filename)
    return f"quotations/{quotation_id}/extracted/attachments/{safe}"


def build_document_s3_key(quotation_id: str, filename: str) -> str:
    safe = os.path.basename(filename)
    return f"quotations/{quotation_id}/documents/{safe}"


def resolve_file_s3_key(quotation_id: str, filename: str, source: str) -> str:
    if source == MANUAL_SOURCE:
        return build_document_s3_key(quotation_id, filename)
    return build_attachment_s3_key(quotation_id, filename)


# ---------------------------------------------------------------------------
# File classification
# ---------------------------------------------------------------------------

def classify_files(filenames: list[str]) -> tuple[Optional[str], list[str]]:
    """Separate a .msg file from attachment files.

    Returns (msg_filename_or_None, list_of_attachment_filenames).
    Raises ValueError if more than one .msg is provided.
    """
    msg_file = None
    attachments = []
    for name in filenames:
        if name.lower().endswith(_MSG_EXTENSION):
            if msg_file is not None:
                raise ValueError("Only 1 .msg file is allowed per quotation.")
            msg_file = name
        else:
            attachments.append(name)
    return msg_file, attachments


# ---------------------------------------------------------------------------
# Payload parsers
# ---------------------------------------------------------------------------

def parse_quotation_payload(body: dict) -> dict:
    """Parse and validate all quotation fields from the request body.

    Raises ValueError on invalid enum values or date formats.
    """
    return {
        "service_type": parse_enum(ServiceType, body.get("service_type")),
        "modal": parse_enum(Modal, body.get("modal")),
        "tipo_embarque": parse_enum(TipoEmbarque, body.get("tipo_embarque")),
        "tipo_cotacao": parse_enum(TipoCotacao, body.get("tipo_cotacao")),
        "carga_perigosa": parse_enum(CargaPerigosa, body.get("carga_perigosa")),
        "price_or_performance": parse_enum(PriceOrPerformance, body.get("price_or_performance")),
        "desired_deadline": parse_datetime(body.get("desired_deadline")),
        "data_cotacao": parse_date(body.get("data_cotacao")),
        "data_prontidao": parse_date(body.get("data_prontidao")),
        "data_limite_necessidade": parse_date(body.get("data_limite_necessidade")),
        "declared_value_currency": (
            parse_enum(Currency, body.get("declared_value_currency"))
            if body.get("declared_value_currency")
            else None
        ),
        "origin": body.get("origin"),
        "porto_embarque": body.get("porto_embarque"),
        "porto_destino": body.get("porto_destino") if isinstance(body.get("porto_destino"), list) else None,
        "aeroporto_embarque": body.get("aeroporto_embarque"),
        "aeroporto_destino": body.get("aeroporto_destino") if isinstance(body.get("aeroporto_destino"), list) else None,
        "incluir_entrega_destino_final": body.get("incluir_entrega_destino_final"),
        "incoterm": body.get("incoterm"),
        "product": body.get("product"),
        "declared_value": body.get("declared_value"),
        "stackability": body.get("stackability"),
        "carga_tombavel": body.get("carga_tombavel"),
        "destination_yard": body.get("destination_yard"),
        "endereco_entrega_final": body.get("endereco_entrega_final"),
        "observations": body.get("observations"),
        "un_number": body.get("un_number"),
        "imo_class": body.get("imo_class"),
        "temperatura_min": body.get("temperatura_min"),
        "temperatura_max": body.get("temperatura_max"),
        "client_reference": body.get("client_reference"),
        "agente_define_porto_embarque": body.get("agente_define_porto_embarque"),
        "agente_define_porto_destino": body.get("agente_define_porto_destino"),
        "agente_define_aeroporto_embarque": body.get("agente_define_aeroporto_embarque"),
        "agente_define_aeroporto_destino": body.get("agente_define_aeroporto_destino"),
        "agente_define_local_coleta": body.get("agente_define_local_coleta"),
        "ptax_negociada": body.get("ptax_negociada"),
    }


def parse_volumes(raw: list) -> list[dict]:
    result = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        quantity = item.get("quantity")
        if not quantity or not isinstance(quantity, int) or quantity < 1:
            continue
        result.append(
            {
                "quantity": quantity,
                "embalagem": item.get("embalagem"),
                "peso_bruto": item.get("peso_bruto"),
                "peso_unidade": item.get("peso_unidade", "KG"),
                "comprimento": item.get("comprimento"),
                "largura": item.get("largura"),
                "altura": item.get("altura"),
                "dimensao_unidade": item.get("dimensao_unidade", "CM"),
                "volume_m3": item.get("volume_m3"),
                "inspecao_iof": item.get("inspecao_iof"),
            }
        )
    return result


def parse_equipments(raw: list) -> list[dict]:
    result = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        quantity = item.get("quantity")
        tipo_container = item.get("tipo_container")
        if not quantity or not isinstance(quantity, int) or quantity < 1:
            continue
        if not tipo_container:
            continue
        result.append(
            {
                "quantity": quantity,
                "tipo_container": tipo_container,
                "volume_m3": item.get("volume_m3"),
                "peso_bruto": item.get("peso_bruto"),
                "peso_unidade": item.get("peso_unidade", "KG"),
            }
        )
    return result


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def persist_volumes(session: Session, quotation_id, volumes: list[dict]) -> list:
    result = []
    for v in volumes:
        try:
            embalagem = parse_enum(TipoEmbalagem, v["embalagem"]) if v.get("embalagem") else None
            peso_unidade = parse_enum(PesoUnidade, v["peso_unidade"]) or PesoUnidade.KG
            dimensao_unidade = parse_enum(DimensaoUnidade, v["dimensao_unidade"]) or DimensaoUnidade.CM
        except ValueError:
            continue
        vol_obj = quotation_volume_repository.create(
            session,
            quotation_id=quotation_id,
            quantity=v["quantity"],
            embalagem=embalagem,
            peso_bruto=v.get("peso_bruto"),
            peso_unidade=peso_unidade,
            comprimento=v.get("comprimento"),
            largura=v.get("largura"),
            altura=v.get("altura"),
            dimensao_unidade=dimensao_unidade,
            volume_m3=v.get("volume_m3"),
            inspecao_iof=v.get("inspecao_iof"),
        )
        result.append(vol_obj)
    return result


def persist_equipments(session: Session, quotation_id, equipments: list[dict]) -> list:
    result = []
    for eq in equipments:
        try:
            tipo_container = parse_enum(TipoContainer, eq["tipo_container"])
            if tipo_container is None:
                continue
            peso_unidade = parse_enum(PesoUnidade, eq["peso_unidade"]) or PesoUnidade.KG
        except ValueError:
            continue
        eq_obj = quotation_equipment_repository.create(
            session,
            quotation_id=quotation_id,
            quantity=eq["quantity"],
            tipo_container=tipo_container,
            volume_m3=eq.get("volume_m3"),
            peso_bruto=eq.get("peso_bruto"),
            peso_unidade=peso_unidade,
        )
        result.append(eq_obj)
    return result


# ---------------------------------------------------------------------------
# Attachment map builder
# ---------------------------------------------------------------------------

def build_attachments_map(quotation_id: str, filenames: list[str], source: str) -> dict:
    return {
        os.path.basename(f): resolve_file_s3_key(quotation_id, f, source)
        for f in filenames
    }


# ---------------------------------------------------------------------------
# Upload URL builder
# ---------------------------------------------------------------------------

def build_upload_urls(
    bucket: str,
    quotation_id: str,
    source: str,
    msg_filename: Optional[str],
    raw_s3_key: Optional[str],
    attachment_filenames: list[str],
) -> list:
    upload_urls = []
    if msg_filename and raw_s3_key:
        upload_urls.append({
            "filename": msg_filename,
            "upload_url": s3_service.generate_presigned_upload_url(
                bucket=bucket, key=raw_s3_key, content_type=_UPLOAD_CONTENT_TYPE
            ),
            "s3_key": raw_s3_key,
        })
    for filename in attachment_filenames:
        s3_key = resolve_file_s3_key(quotation_id, filename, source)
        upload_urls.append({
            "filename": filename,
            "upload_url": s3_service.generate_presigned_upload_url(
                bucket=bucket, key=s3_key, content_type=_UPLOAD_CONTENT_TYPE
            ),
            "s3_key": s3_key,
        })
    return upload_urls


# ---------------------------------------------------------------------------
# Full creation pipeline — shared by create_quotation and create_my_quotation
# ---------------------------------------------------------------------------

def create_quotation_core(
    session: Session,
    body: dict,
    *,
    analyst_id: Optional[str],
    client_id,
    is_vip: bool,
    insurance_required: Optional[bool],
    log_action: str,
    log_actor_id: Optional[str],
    default_source: str,
    log_details: Optional[dict] = None,
    observations_override: Optional[str] = None,
) -> dict:
    """Validate, persist, and log a new quotation.

    Owns the orchestration shared by the internal create_quotation lambda and
    the portal-facing create_my_quotation lambda: source/file validation,
    payload + volumes/equipments parsing, quotation_repository.create,
    volume/equipment persistence, and the audit log entry. The quotation is
    created in TRIAGEM_IA and only ever advances to COTANDO via
    rfq_dispatch_service, when the RFQ is actually dispatched to agents —
    never as a side effect of creation.

    Callers remain responsible for anything that differs between the two
    flows: authentication, resolving analyst_id/client_id/is_vip (and any
    DNA-based insurance_required/observations fallback — pass the resolved
    value as observations_override; leave it None to use body["observations"]
    as-is, which is what create_my_quotation does since the portal applies no
    DNA pre-fill), and picking log_action / the two actor ids.

    Raises ValueError with a message suitable for build_response(400, ...)
    on an invalid source, invalid file, or unparsable payload. Must be called
    inside an open `with get_session() as session:` block, since the
    quotation is created but not yet committed/serialized on return.

    Returns a dict: quotation, created_volumes, created_equipments,
    quotation_id, raw_s3_key, msg_filename, attachment_filenames, source.
    """
    source = body.get("source", default_source)
    if source not in (UPLOAD_SOURCE, MANUAL_SOURCE):
        raise ValueError(f"Invalid source '{source}'. Must be 'upload' or 'manual'")

    files = body.get("files", [])
    msg_filename, attachment_filenames = classify_files(files)

    for filename in files:
        error = s3_service.validate_file(filename, 0)
        if error:
            logger.warning("quotation_file_rejected", extra={"filename": filename, "reason": error})
            raise ValueError(f"Invalid file '{filename}': {error}")

    payload = parse_quotation_payload(body)
    if observations_override is not None:
        payload["observations"] = observations_override
    volumes = parse_volumes(body.get("volumes") or [])
    equipments = parse_equipments(body.get("equipments") or [])

    quotation_id = str(uuid.uuid4())
    raw_s3_key = build_raw_s3_key(quotation_id) if msg_filename else None
    attachments_map = build_attachments_map(quotation_id, attachment_filenames, source)

    quotation = quotation_repository.create(
        session,
        analyst_id=analyst_id,
        **payload,
        insurance_required=insurance_required,
        client_id=client_id,
        original_email_s3_key=raw_s3_key,
        attachments_s3_keys=attachments_map if attachments_map else None,
        is_vip=is_vip,
    )
    quotation.id = uuid.UUID(quotation_id)

    created_volumes = persist_volumes(session, quotation.id, volumes)
    created_equipments = persist_equipments(session, quotation.id, equipments)

    quotation_repository.append_log(
        session,
        quotation_id=quotation.id,
        action=log_action,
        user_id=log_actor_id,
        new_state=quotation.state.value,
        details={"source": source, **(log_details or {})},
    )

    return {
        "quotation": quotation,
        "created_volumes": created_volumes,
        "created_equipments": created_equipments,
        "quotation_id": quotation_id,
        "raw_s3_key": raw_s3_key,
        "msg_filename": msg_filename,
        "attachment_filenames": attachment_filenames,
        "source": source,
    }
