.PHONY: install dev up down logs test test-backend test-frontend build clean

# Install dependencies locally
install:
	cd backend && npm install
	cd frontend && npm install

# Run development servers locally (without Docker)
dev:
	@echo "Starting backend and frontend..."
	cd backend && npm run dev & cd frontend && npm run dev

# Docker commands
up:
	docker compose up -d

up-build:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

# Testing
test:
	docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

test-backend:
	docker compose -f docker-compose.test.yml up --build backend --abort-on-container-exit

test-frontend:
	docker compose -f docker-compose.test.yml up --build frontend --abort-on-container-exit

# Database
db-shell:
	docker compose exec db psql -U postgres -d watermeter

db-reset:
	docker compose down -v
	docker compose up -d db
	@echo "Database reset. Waiting for it to be ready..."
	sleep 5
	docker compose up -d

# Build for production
build:
	cd frontend && npm run build

# Clean
clean:
	docker compose down -v
	docker compose -f docker-compose.test.yml down -v
	rm -rf backend/node_modules frontend/node_modules
	rm -rf frontend/dist
