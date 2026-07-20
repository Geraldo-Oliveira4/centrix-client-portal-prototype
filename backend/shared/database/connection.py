import os
import time
from contextlib import contextmanager
from typing import Callable, Generator, TypeVar

from sqlalchemy import create_engine
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from shared.observability import logger

_engine = None

T = TypeVar("T")

# Neon's serverless compute briefly rejects writes with this error while
# resuming from auto-suspend after being idle — not a permission or code
# issue, just a race between the wake-up and the first query.
_TRANSIENT_ORIG_ERROR_NAMES = {"ReadOnlySqlTransaction"}


def get_engine():
    global _engine
    if _engine is None:
        database_url = os.environ["DATABASE_URL"]
        # Prototype runs against a local Postgres served by a long-lived FastAPI
        # process (not one-shot Lambdas), so use a normal connection pool instead
        # of the Lambda-tuned pool_size=1/max_overflow=0.
        _engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
    return _engine


@contextmanager
def get_session() -> Generator[Session, None, None]:
    engine = get_engine()
    with Session(engine) as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def _is_transient_neon_error(exc: BaseException) -> bool:
    orig = getattr(exc, "orig", None)
    return orig is not None and type(orig).__name__ in _TRANSIENT_ORIG_ERROR_NAMES


def run_with_db_retry(
    fn: Callable[[], T], *, max_attempts: int = 3, base_delay_seconds: float = 1.0
) -> T:
    """Run fn() and retry on a Neon cold-start read-only transaction error.

    fn must open its own `with get_session()` block internally, so a failed
    attempt has committed nothing and a retry starts on a clean transaction
    once the compute finishes waking up. Non-transient errors (validation,
    guard rejections, anything not wrapped as a read-only-transaction error)
    propagate on the first attempt — this only absorbs the specific
    Neon cold-start race.
    """
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except DBAPIError as exc:
            if attempt == max_attempts or not _is_transient_neon_error(exc):
                raise
            logger.warning(
                "Transient Neon read-only error (attempt %d/%d), retrying",
                attempt,
                max_attempts,
            )
            time.sleep(base_delay_seconds * attempt)
