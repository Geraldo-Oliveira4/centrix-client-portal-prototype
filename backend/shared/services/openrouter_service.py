"""Low-level HTTP client for OpenRouter with retry and model fallback.

Used by extractors (T08), client identification (T09), and semantic
audit rules (T10). No SDK — plain HTTP per architectural decision.
"""

import json
import logging
import os
import random
import time
from typing import Any, Optional

import urllib3

logger = logging.getLogger(__name__)

_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
_TIMEOUT_SECONDS = 30
_MAX_TOKENS = 2048
_MAX_ATTEMPTS = 3
_BASE_DELAY_SECONDS = 2

# Fail-fast profile for agent-facing (synchronous) extraction. The caller runs
# inside a 25s Lambda / 29s API Gateway budget, so a single slow upstream call
# must fail before that budget rather than being amplified by retries + model
# fallback. Render (~3s) + one attempt (<=18s) stays under 25s; anything slower
# fails cleanly and the portal falls back to manual form filling.
SYNC_HTTP_TIMEOUT_SECONDS = 18
SYNC_MAX_ATTEMPTS = 1
_RETRYABLE_STATUS_CODES = {408, 429, 502, 503}
_RETRYABLE_MESSAGES = [
    "rate limit",
    "too many requests",
    "timeout",
    "timed out",
    "overloaded",
    "provider returned error",
    "no content generated",
    "unterminated string",
    "unexpected token",
    "unexpected end of json",
    "bad control character",
    "property name",
    "connection aborted",
    "remote end closed connection",
    "remote disconnected",
    "connection reset",
    "broken pipe",
]

_http = urllib3.PoolManager(timeout=urllib3.Timeout(total=_TIMEOUT_SECONDS))


def _get_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY environment variable is not set")
    return key


def get_primary_model() -> str:
    return os.environ.get("OPENROUTER_PRIMARY_MODEL", "google/gemini-3-flash-preview")


def get_fallback_model() -> str:
    return os.environ.get("OPENROUTER_FALLBACK_MODEL", "openai/gpt-4.1-mini")


def _backoff_delay(attempt: int) -> float:
    jitter = random.uniform(0, 0.25)
    return _BASE_DELAY_SECONDS * (2 ** attempt) + jitter


def _is_retryable(status_code: Optional[int], message: str) -> bool:
    if status_code and status_code in _RETRYABLE_STATUS_CODES:
        return True
    lower = message.lower()
    return any(phrase in lower for phrase in _RETRYABLE_MESSAGES)


def _send_request(
    model: str,
    messages: list[dict],
    temperature: float,
    response_format: Optional[dict] = None,
    timeout: Optional[float] = None,
) -> dict:
    """Send a single request to OpenRouter. Returns parsed JSON response."""
    api_key = _get_api_key()
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": _MAX_TOKENS,
    }
    if response_format:
        body["response_format"] = response_format

    # When timeout is None, fall back to the PoolManager default (_TIMEOUT_SECONDS).
    request_kwargs: dict[str, Any] = {}
    if timeout is not None:
        request_kwargs["timeout"] = urllib3.Timeout(total=timeout)

    resp = _http.request(
        "POST",
        _BASE_URL,
        body=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        **request_kwargs,
    )
    data = json.loads(resp.data.decode("utf-8"))

    if resp.status >= 400:
        error_msg = data.get("error", {}).get("message", f"HTTP {resp.status}")
        raise OpenRouterError(error_msg, status_code=resp.status, raw=data)

    if data.get("error", {}).get("message"):
        raise OpenRouterError(
            data["error"]["message"],
            status_code=data.get("error", {}).get("code"),
            raw=data,
        )

    return data


def call(
    messages: list[dict],
    temperature: float = 0.1,
    response_format: Optional[dict] = None,
    model: Optional[str] = None,
    max_attempts: int = _MAX_ATTEMPTS,
    use_fallback: bool = True,
    timeout: Optional[float] = None,
) -> dict:
    """Call OpenRouter with retry (exponential backoff) and optional model fallback.

    Args:
        max_attempts: attempts per model before giving up (default 3).
        use_fallback: try the fallback model after the primary fails (default True).
            Ignored when an explicit ``model`` is passed.
        timeout: per-request HTTP timeout in seconds. None uses the pool default
            (_TIMEOUT_SECONDS). Synchronous callers should pass a tighter value
            (see SYNC_HTTP_TIMEOUT_SECONDS) to stay within their Lambda budget.

    Returns the parsed JSON content from the first choice.
    Raises OpenRouterError if all attempts fail on every model tried.
    """
    primary = model or get_primary_model()
    fallback = get_fallback_model()
    models_to_try = [primary] if (model or not use_fallback) else [primary, fallback]

    last_error: Optional[Exception] = None

    for current_model in models_to_try:
        for attempt in range(max_attempts):
            try:
                data = _send_request(current_model, messages, temperature, response_format, timeout=timeout)

                choice = (data.get("choices") or [{}])[0]
                if choice.get("finish_reason") == "error":
                    raise OpenRouterError(
                        data.get("error", {}).get("message", "Provider returned error"),
                        raw=data,
                    )

                text = (choice.get("message", {}).get("content") or "").strip()
                if not text:
                    raise OpenRouterError("No content generated by provider")

                result = json.loads(text)
                if isinstance(result, list) and len(result) == 1:
                    result = result[0]

                return {"result": result, "model": current_model}

            except (OpenRouterError, json.JSONDecodeError, Exception) as exc:
                last_error = exc
                status = getattr(exc, "status_code", None)
                msg = str(exc)

                if attempt < max_attempts - 1 and _is_retryable(status, msg):
                    delay = _backoff_delay(attempt)
                    logger.warning(
                        "OpenRouter transient error, retrying: model=%s attempt=%d/%d delay=%.1fs error=%s",
                        current_model, attempt + 1, max_attempts, delay, msg,
                    )
                    time.sleep(delay)
                    continue

                logger.error(
                    "OpenRouter call failed: model=%s attempt=%d error=%s",
                    current_model, attempt + 1, msg,
                )
                break  # move to fallback model

        if current_model != models_to_try[-1]:
            logger.warning("Falling back to model %s", fallback)

    raise OpenRouterError(
        f"All attempts exhausted: {last_error}",
        status_code=getattr(last_error, "status_code", None),
    )


class OpenRouterError(Exception):
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        raw: Optional[dict] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.raw = raw
