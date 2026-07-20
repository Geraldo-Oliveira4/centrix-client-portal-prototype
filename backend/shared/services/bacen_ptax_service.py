"""BACEN / BCB daily PTAX client.

Fetches the official USD/BRL and EUR/BRL PTAX rates published by the Brazilian
Central Bank (BCB) via the Olinda PTAX API. Results are cached in-memory for
one hour to avoid hammering the API during a single Lambda invocation.
"""

import json
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

from shared.observability import logger

_BRT = ZoneInfo("America/Sao_Paulo")
_CACHE_TTL_SECONDS = 3600
_cache: dict[str, tuple[float | None, float]] = {}


# BCB publishes PTAX in MM-DD-YYYY format.
_BCB_DATE_FMT = "%m-%d-%Y"


def _today_brt() -> str:
    return datetime.now(_BRT).strftime(_BCB_DATE_FMT)


def _build_usd_url(date_str: str) -> str:
    return (
        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
        f"CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='{date_str}'"
        "&$top=100&$format=json"
    )


def _build_eur_url(date_str: str) -> str:
    return (
        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
        f"CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?"
        f"@moeda='EUR'&@dataCotacao='{date_str}'"
        "&$top=100&$format=json"
    )


def _fetch_json(url: str) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Failed to fetch BCB PTAX", extra={"url": url, "error": str(exc)})
        return None


def _extract_usd_rate(data: dict | None) -> float | None:
    if not data:
        return None
    values = data.get("value") or []
    if not values:
        return None
    return float(values[0].get("cotacaoVenda", 0))


def _extract_eur_rate(data: dict | None) -> float | None:
    if not data:
        return None
    values = data.get("value") or []
    if not values:
        return None

    # Prefer the official closing PTAX bulletin when available.
    for row in values:
        if row.get("tipoBoletim") == "Fechamento PTAX":
            return float(row.get("cotacaoVenda", 0))

    # Fallback to the last available bulletin of the day.
    return float(values[-1].get("cotacaoVenda", 0))


def _cache_key(currency: str, date_str: str) -> str:
    return f"{currency.upper()}:{date_str}"


def get_daily_ptax(currency: str = "USD") -> float | None:
    """Return the BCB PTAX selling rate for the requested currency.

    Supported currencies: USD, EUR. Returns None when the API is unreachable
    or no rate is published for the current business day.
    """
    currency = currency.upper()
    if currency not in {"USD", "EUR"}:
        logger.warning("Unsupported BCB PTAX currency", extra={"currency": currency})
        return None

    date_str = _today_brt()
    key = _cache_key(currency, date_str)
    now = datetime.now(_BRT).timestamp()

    cached = _cache.get(key)
    if cached is not None and (now - cached[1]) < _CACHE_TTL_SECONDS:
        return cached[0]

    url = _build_usd_url(date_str) if currency == "USD" else _build_eur_url(date_str)
    data = _fetch_json(url)
    rate = _extract_usd_rate(data) if currency == "USD" else _extract_eur_rate(data)

    _cache[key] = (rate, now)
    if rate is None:
        logger.warning("BCB PTAX unavailable for currency", extra={"currency": currency, "date": date_str})
    return rate
