.PHONY: setup db-up db-down migrate seed run

VENV = .venv
PY = $(VENV)/bin/python
PIP = $(VENV)/bin/pip

setup:
	python3.11 -m venv $(VENV)
	$(PIP) install -U pip
	$(PIP) install -r requirements.txt

db-up:
	docker compose -f ../docker-compose.yml up -d

db-down:
	docker compose -f ../docker-compose.yml down

migrate:
	set -a; [ -f .env ] && . ./.env; set +a; $(VENV)/bin/alembic upgrade head

seed:
	$(PY) -m scripts.seed_prototype

run:
	$(VENV)/bin/uvicorn app.main:app --reload --port 8000
