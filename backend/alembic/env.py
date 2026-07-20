import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Block alembic stamp unconditionally. Stamping writes a revision to
# alembic_version without running any DDL, causing silent schema drift
# (columns missing in the DB while the ORM model expects them).
# Always use 'make migrate-dev' or 'make migrate-prod'.
if "stamp" in sys.argv:
    print("ERROR: 'alembic stamp' is blocked in this project.", file=sys.stderr)
    print("Reason: stamp records a revision without applying DDL, causing silent schema drift.", file=sys.stderr)
    print("Use 'make migrate-dev' or 'make migrate-prod' to apply migrations correctly.", file=sys.stderr)
    sys.exit(1)

from shared.database.models.base import Base
# Import all models so their tables are registered on Base.metadata
import shared.database.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    url = os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    if not url:
        raise ValueError("DATABASE_URL environment variable is not set")
    return url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
