PYTHON  := .venv/bin/python
NPM     := npm

.PHONY: help install install-backend install-frontend dev backend frontend

help:
	@echo ""
	@echo "Usage:"
	@echo "  make install          Install all dependencies (frontend + backend)"
	@echo "  make dev              Run frontend and backend concurrently"
	@echo "  make backend          Run only the FastAPI backend (port 8000)"
	@echo "  make frontend         Run only the Vite dev server (port 5173)"
	@echo ""

# ── Install ──────────────────────────────────────────────────────────────────

install: install-backend install-frontend

install-backend:
	python3 -m venv .venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r backend/requirements.txt

install-frontend:
	$(NPM) install

# ── Dev servers ──────────────────────────────────────────────────────────────

# Run both servers in parallel; Ctrl-C stops both.
dev:
	@trap 'kill 0' INT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

# cd into backend/ so that `from src.*` resolves to backend/src/, not frontend src/
backend:
	cd backend && ../.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

frontend:
	$(NPM) run dev
