"""Currency utilities — shared normalization helpers for monetary values.

All currency conversion logic lives here so adding support for a new currency
requires touching one module rather than hunting through individual services.
"""

import os


def _env_float(name: str, default: float) -> float:
    """Read a float from the environment, falling back to default when unset/blank/invalid."""
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


# USD/BRL fallback PTAX, used when an agent did not submit an exchange rate.
# Override per environment with CURRENCY_FALLBACK_PTAX (owner: finance) so the rate
# can be corrected without a code deploy.
_FALLBACK_PTAX = _env_float("CURRENCY_FALLBACK_PTAX", 5.0)

# EUR/USD cross rate used to derive EUR/BRL from the USD/BRL PTAX submitted by agents.
# EUR/BRL ≈ EUR/USD × USD/BRL. Override with CURRENCY_EUR_USD_CROSS when it drifts.
_EUR_USD_CROSS = _env_float("CURRENCY_EUR_USD_CROSS", 1.10)

# Fallback EUR/BRL when no PTAX is available (USD fallback × cross rate).
_FALLBACK_PTAX_EUR = _FALLBACK_PTAX * _EUR_USD_CROSS


def parse_negotiated_ptax_percent(raw: str | None) -> float | None:
    """Parse a free-text negotiated PTAX percentage into a numeric percent value.

    Accepts inputs such as "1%", "1,5%", "2.5" or "3 %". Returns None when the
    value is blank or cannot be parsed as a number.
    """
    if raw is None:
        return None
    cleaned = str(raw).strip().replace("%", "").replace(",", ".")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def apply_ptax_markup(daily_rate: float, percent: float | None) -> float:
    """Apply a negotiated percentage markup over a daily PTAX rate.

    Example: daily_rate=5.0 with percent=1.0 returns 5.05 (5.0 + 1%).
    """
    if percent is None:
        return daily_rate
    return daily_rate * (1 + percent / 100.0)


def normalize_to_brl(
    value: float,
    currency: str | None,
    ptax: float | None = None,
    logger=None,
) -> float:
    """Convert a monetary value to BRL for cost comparison.

    Args:
        value: The raw monetary amount.
        currency: ISO 4217 currency code (e.g. "USD", "EUR", "BRL", "CNY").
        ptax: USD/BRL exchange rate. Required when currency is USD.
              For EUR, EUR/BRL is derived as ptax × _EUR_USD_CROSS.
              Falls back to _FALLBACK_PTAX (USD) or _FALLBACK_PTAX_EUR (EUR)
              when not provided.
        logger: Optional Powertools logger. When provided, a warning is
                emitted for unsupported currencies so the skew is detectable
                in CloudWatch.

    Returns:
        The value normalized to BRL.
    """
    normalized_currency = (currency or "BRL").upper()

    if normalized_currency == "BRL":
        return value

    if normalized_currency == "USD":
        effective_ptax = float(ptax) if ptax else _FALLBACK_PTAX
        return value * effective_ptax

    if normalized_currency == "EUR":
        # EUR/BRL ≈ EUR/USD × USD/BRL (PTAX). When PTAX is absent use the
        # pre-computed fallback so EUR is never silently treated as BRL 1:1.
        effective_ptax_eur = float(ptax) * _EUR_USD_CROSS if ptax else _FALLBACK_PTAX_EUR
        return value * effective_ptax_eur

    # Unknown currency — treat as BRL and emit a warning so the silent skew
    # is observable in CloudWatch Logs rather than producing wrong scores silently.
    if logger is not None:
        logger.warning(
            "Unsupported currency in cost normalization — treating as BRL",
            extra={"currency": normalized_currency, "value": value},
        )
    return value
