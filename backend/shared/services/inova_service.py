"""Inova API client for Freitas COMEX process synchronization.

Covers all endpoints documented in docs/ge/API CENTRIX INOVA.pdf:
    GET  /api/centrix/processo/{id}          — fetch full process data
    GET  /api/centrix/tipos-arquivo          — list available file type codes
    PATCH /api/centrix/processo/{id}/status  — update process status
    PATCH /api/centrix/processo/{id}/datas   — update timeline dates
    POST  /api/centrix/processo/{id}/anexo   — attach a document (URL or base64)

Authentication: HTTP Basic, fixed credential.
HTTP client: urllib.request — no SDK, consistent with microsoft_graph_service.

Required env vars:
    INOVA_API_BASE_URL — e.g. https://apinova.freitascomex.com.br
    INOVA_API_AUTH     — full Authorization header value, e.g. "Basic <base64>"

If INOVA_API_BASE_URL is empty both functions return early — caller receives
"skipped". This allows the integration to be disabled per-environment without
code changes (dev has no Inova instance).

Status values accepted by patch_status — use the constants below (INOVA_STATUS_*).
The API is case-sensitive and accent-required; the PDF claim of "case-insensitive"
is incorrect (confirmed by integration tests on 2026-06-15):
    "Solicitado"         → Aguardando prontidão da carga
    "Prontidão"          → Prontidão carga - Ag. coleta na origem
    "Coletado"           → Coletado na origem - Ag. chegada armazém de origem
    "Embarcado"          → Liberado - Ag. embarque
    "Em Trânsito"        → Em trânsito - Ag. chegada
    "Chegada Confirmada" → Aguardando depósito numerário

GET /processo/{id} quirks (confirmed 2026-06-15):
    - "status" field returns a numeric string code (e.g. "4"), not the label above.
      The code-to-label table was confirmed with Lucas (via Geraldo Santos,
      2026-06-21) and is implemented in INOVA_STATUS_CODE_TO_LABEL — translate it
      with inova_status_label().
    - ID not found returns 500 "Erro ao buscar processo" instead of 404.
      get_processo() handles this transparently by returning None.
"""

import json
import os
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from typing import Optional

def _max_retries() -> int:
    """Return the configured Inova API max retry count.

    Read at request time (not import time) so environment changes take effect
    on the next invocation without a redeploy.
    """
    return int(os.environ.get("INOVA_MAX_RETRIES", "3"))


def _backoff_base() -> float:
    """Return the configured retry backoff base in seconds."""
    return float(os.environ.get("INOVA_RETRY_BACKOFF_BASE", "1.0"))

# Exact status strings accepted by PATCH /status.
# The API is case-sensitive and accent-required — always use these constants.
INOVA_STATUS_SOLICITADO = "Solicitado"
INOVA_STATUS_PRONTIDAO = "Prontidão"
INOVA_STATUS_COLETADO = "Coletado"
INOVA_STATUS_EMBARCADO = "Embarcado"
INOVA_STATUS_EM_TRANSITO = "Em Trânsito"
INOVA_STATUS_CHEGADA_CONFIRMADA = "Chegada Confirmada"

# --- Status code -> label (ARB-2292) ----------------------------------------
# GET /processo/{id} returns "status" as a numeric string code (e.g. "4"), not a
# readable label. The table below was confirmed with Lucas (via Geraldo Santos,
# 2026-06-21); the PDF documents none of it. Codes run 1-12 and 14-29 — there is
# no code 13. Labels repeat across codes because the import and export flows
# reuse the same wording at different stages (e.g. "AGUARDANDO REGISTRO" is both
# 5 and 16). Keys are strings to match the raw API value; translate with
# inova_status_label().
INOVA_STATUS_CODE_TO_LABEL: dict[str, str] = {
    "1": "AGUARDANDO EMBARQUE",
    "2": "EM TRÂNSITO - AG. CHEGADA",
    "3": "AGUARDANDO DEPÓSITO NUMERÁRIO",
    "4": "AGUARDANDO PRESENÇA DE CARGA",
    "5": "AGUARDANDO REGISTRO",
    "6": "REGISTRADO - AG. DESEMBARAÇO",
    "7": "DESEMBARAÇADO - AG. LIBERAÇÃO",
    "8": "LIBERADO - AG. CARREGAMENTO",
    "9": "CARREGADO - AG. ENVIO P/ FATURAMENTO",
    "10": "AGUARDANDO FATURAMENTO",
    "11": "FATURADO - AG. ENVIO AO CLIENTE",
    "12": "FINALIZADO",
    "14": "AGUARDANDO PRONTIDÃO DA CARGA",
    "15": "AGUARDANDO DOCUMENTOS",
    "16": "AGUARDANDO REGISTRO",
    "17": "REGISTRADO - AG. DRAFT",
    "18": "REGISTRADO (DRAFT) - AG. LIBERAÇÃO",
    "19": "LIBERADO - AG. EMBARQUE",
    "20": "EMBARQUE CONFIRMADO - AG. ENVIO DOCS",
    "21": "DOCUMENTOS ENVIADOS - AG. AVERBAÇÃO",
    "22": "AVERBADO - AG. ENVIO P/ FATURAMENTO",
    "23": "AGUARDANDO FATURAMENTO",
    "24": "FATURADO - AG. ENVIO AO CLIENTE",
    "25": "FINALIZADO",
    "26": "REGISTRADO - AG. LIBERAÇÃO",
    "27": "DOCUMENTOS ENVIADOS - AG. ENVIO P/ FATURAMENTO",
    "28": "PRONTIDÃO CARGA - AG. COLETA NA ORIGEM",
    "29": "COLETADO NA ORIGEM - AG. CHEGADA ARMAZÉM DE ORIGEM",
}


def inova_status_label(code) -> Optional[str]:
    """Translate an Inova numeric status code to its human-readable label.

    Accepts the raw string the API returns (e.g. "4") or an int. Returns None
    for unknown, empty, or None codes so callers can fall back to the raw value.
    """
    if code is None:
        return None
    return INOVA_STATUS_CODE_TO_LABEL.get(str(code).strip())

# --- File type curation (ARB-2293) ------------------------------------------
# GET /tipos-arquivo returns ~217 types; showing all of them in the document
# upload selector is impractical for the operator. Product (Freitas, via
# Eduarda Ribeiro / Geraldo Santos, 2026-06-18) confirmed a short list for the
# day-to-day of import/export; everything else stays under an "Outros" option.
#
# All codes below were resolved against the full live GET /tipos-arquivo list
# (217 types, fetched 2026-06-21). The comment on each code is the exact
# `descricao` the API returns for it. The five labels product confirmed but had
# no documented code for (DI/DUIMP, PO, Descrição de Mercadoria, Certificado de
# análise, Cotação de Frete) were matched to their real codes here, closing the
# former CURATED_TIPO_ARQUIVO_PENDING_LABELS gap. ARB-2293.
CURATED_TIPO_ARQUIVO_CODES: tuple[int, ...] = (
    2,    # Invoice
    3,    # Packing List
    145,  # PO
    122,  # Descrição de Mercadoria
    9,    # DI/DUIMP (Declaração de Importação)
    36,   # B.L. (Bill of Lading)
    37,   # AWB (Airway Bill)
    43,   # Certificado de análise
    121,  # Cotação de Frete
    76,   # Documentos diversos
    144,  # Diversos (Invoice, Packing e Conhecimento)
)

# The full type list rarely changes, but list_tipos_arquivo() hits Inova on
# every call. Cache it in module memory (survives across calls within a warm
# Lambda) with a 24h TTL.
_TIPOS_ARQUIVO_CACHE_TTL = 24 * 60 * 60
_tipos_arquivo_cache: Optional[list[dict]] = None
_tipos_arquivo_cache_at: float = 0.0

_REQUEST_TIMEOUT = 10


class InovaError(Exception):
    """Raised when the Inova API returns a non-2xx response."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


def _get_config() -> tuple[str, str]:
    """Return (base_url, auth_header). Raises RuntimeError if auth is missing."""
    base_url = os.environ.get("INOVA_API_BASE_URL", "").rstrip("/")
    auth = os.environ.get("INOVA_API_AUTH", "")
    if base_url and not auth:
        raise RuntimeError("INOVA_API_AUTH must be set when INOVA_API_BASE_URL is configured")
    return base_url, auth


def _is_retryable_error(exc: Exception) -> bool:
    """Return True when the request should be retried.

    Retry on transient network/transport errors and on HTTP 429/5xx.
    Do not retry on 4xx (client errors) except 429, because repeating the
    same request is unlikely to succeed.
    """
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code == 429 or exc.code >= 500
    if isinstance(exc, urllib.error.URLError):
        return True
    return False


def _request(
    method: str,
    path: str,
    body: Optional[dict] = None,
) -> Optional[dict]:
    """Execute an authenticated request to the Inova API with retry/backoff.

    Returns the parsed JSON body, or None for empty responses.
    Raises InovaError on non-2xx responses after exhausting retries.
    """
    base_url, auth = _get_config()
    url = f"{base_url}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": auth}
    if data is not None:
        headers["Content-Type"] = "application/json"

    max_retries = _max_retries()
    backoff_base = _backoff_base()
    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read()).get("message", exc.reason)
            except Exception:
                detail = exc.reason
            last_error = InovaError(
                f"Inova API {method} {path} failed: {exc.code} — {detail}",
                status_code=exc.code,
            )
            if not _is_retryable_error(exc):
                raise last_error from exc
        except urllib.error.URLError as exc:
            last_error = InovaError(
                f"Inova API {method} {path} transport error: {exc.reason}",
            )
            if not _is_retryable_error(exc):
                raise last_error from exc

        if attempt < max_retries:
            backoff = backoff_base * (2 ** attempt)
            time.sleep(backoff)

    # Exhausted all retries; surface the last error.
    raise last_error


def get_processo(processo_id: str) -> Optional[dict]:
    """Fetch full process data from Inova (timeline, status, agent, containers).

    Returns None if INOVA_API_BASE_URL is not set or the process does not exist.
    Raises InovaError on genuine API errors.

    Note: Inova returns 500 "Erro ao buscar processo" for unknown IDs instead of
    404 — this quirk is handled here so callers can treat None as "not found".
    """
    base_url, _ = _get_config()
    if not base_url:
        return None
    try:
        return _request("GET", f"/api/centrix/processo/{processo_id}")
    except InovaError as exc:
        if exc.status_code == 500 and "Erro ao buscar processo" in str(exc):
            return None
        raise


def list_tipos_arquivo(force_refresh: bool = False) -> list[dict]:
    """Return available file type codes for use in post_anexo.

    Each item has `codigo` (int) and `descricao` (str). The full list (~217
    types) is cached in module memory for 24h since it rarely changes; pass
    force_refresh=True to bypass the cache.

    Returns empty list if INOVA_API_BASE_URL is not set.
    Raises InovaError on API errors.
    """
    global _tipos_arquivo_cache, _tipos_arquivo_cache_at
    base_url, _ = _get_config()
    if not base_url:
        return []
    now = time.monotonic()
    if (
        not force_refresh
        and _tipos_arquivo_cache is not None
        and now - _tipos_arquivo_cache_at < _TIPOS_ARQUIVO_CACHE_TTL
    ):
        return _tipos_arquivo_cache
    tipos = _request("GET", "/api/centrix/tipos-arquivo") or []
    _tipos_arquivo_cache = tipos
    _tipos_arquivo_cache_at = now
    return tipos


def get_curated_tipos_arquivo() -> dict:
    """Split the full file-type list into the curated short list plus "Outros".

    Returns {"curated": [...], "outros": [...]}: `curated` holds only the
    CURATED_TIPO_ARQUIVO_CODES (in that order) and `outros` is everything else,
    so the upload selector in the GE workspace can show the common types up
    front and keep the long tail behind an "Outros" option (ARB-2293).

    Returns empty lists if INOVA_API_BASE_URL is not set.
    """
    tipos = list_tipos_arquivo()
    by_code = {t.get("codigo"): t for t in tipos}
    curated = [by_code[c] for c in CURATED_TIPO_ARQUIVO_CODES if c in by_code]
    curated_codes = set(CURATED_TIPO_ARQUIVO_CODES)
    outros = [t for t in tipos if t.get("codigo") not in curated_codes]
    return {"curated": curated, "outros": outros}


def patch_status(processo_id: str, status: str) -> str:
    """Update the process status in Inova.

    Args:
        processo_id: Inova process number, e.g. "FRT0585.II".
        status:      Exact status string — use the INOVA_STATUS_* constants.
                     The API is case-sensitive and accent-required.

    Returns "ok" on success, "skipped" if INOVA_API_BASE_URL is not set.
    Raises InovaError on API errors.
    """
    base_url, _ = _get_config()
    if not base_url:
        return "skipped"
    _request("PATCH", f"/api/centrix/processo/{processo_id}/status", {"status": status})
    return "ok"


def patch_datas(processo_id: str, datas: dict) -> str:
    """Update timeline dates for a process in Inova.

    All date fields are optional — only provided keys are updated.
    Accepted keys (ISO 8601 datetime strings or date objects):
        data_prev_pront_merc, data_pront_merc,
        data_prev_coleta_ori, data_coleta_ori,
        data_prev_che_arm_ori, data_che_arm_ori,
        data_prev_emb, data_embarque,
        data_prev_chegada, data_chegada

    Returns "ok" on success, "skipped" if INOVA_API_BASE_URL is not set.
    Raises InovaError on API errors.
    """
    base_url, _ = _get_config()
    if not base_url:
        return "skipped"
    if not datas:
        raise ValueError("patch_datas requires at least one date field")
    serialized = {
        k: _serialize_date(v) for k, v in datas.items() if v is not None
    }
    _request("PATCH", f"/api/centrix/processo/{processo_id}/datas", serialized)
    return "ok"


def post_anexo(
    processo_id: str,
    arquivo: str,
    nome_arquivo: str,
    cod_tipo_arquivo: int,
) -> Optional[dict]:
    """Attach a document to a process in Inova.

    Args:
        processo_id:      Inova process number, e.g. "FRT0585.II".
        arquivo:          File URL or base64-encoded content. Inova detects the
                          type automatically. URL mode: the Inova server has no
                          public internet access, so an arbitrary public URL
                          fails with 500 (confirmed ARB-2280). It CAN, however,
                          fetch from an S3 presigned URL on the Centrix bucket
                          (confirmed live against FRT0585.II, ARB-2291/ARB-2377,
                          2026-07-01) — Inova and the bucket share the AWS
                          network. Strategy (Option A): the caller passes a
                          presigned URL straight through; there is no need to
                          download from S3 and base64-encode.
        nome_arquivo:     File name with extension, e.g. "Invoice_2026.pdf".
        cod_tipo_arquivo: Type code from list_tipos_arquivo().
                          Common values: 2=Invoice, 3=Packing List, 36=BL,
                          37=AWB, 76=Documentos diversos, 144=Diversos.

    Returns the parsed response dict (contains "sequencia") on success, or
    None if INOVA_API_BASE_URL is not set. Raises InovaError on API errors.
    """
    base_url, _ = _get_config()
    if not base_url:
        return None
    return _request(
        "POST",
        f"/api/centrix/processo/{processo_id}/anexo",
        {
            "arquivo": arquivo,
            "nome_arquivo": nome_arquivo,
            "cod_tipo_arquivo": cod_tipo_arquivo,
        },
    )


def _serialize_date(value) -> str:
    """Convert a date/datetime/str to ISO 8601 format expected by Inova."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day).isoformat()
    return str(value)
