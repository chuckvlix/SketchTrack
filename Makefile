.PHONY: install dev dev-backend dev-frontend test build

install:
	cd backend && uv venv && uv pip install -r requirements.txt
	cd frontend && pnpm install

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-frontend:
	cd frontend && pnpm run dev

test:
	cd backend && .venv/bin/pytest -v
	cd frontend && pnpm run build

build:
	cd frontend && pnpm run build
