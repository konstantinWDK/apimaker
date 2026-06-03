# DoApi - Project Rules

## Main Stack
- **Backend**: Python 3.11+, FastAPI, SQLModel, SQLAlchemy, Pydantic
- **Frontend**: React 18, TypeScript, Vite, Zustand, react-router-dom v7
- **Database**: SQLite (dev), PostgreSQL/MySQL (prod)
- **Tests**: pytest (backend), vitest (frontend)
- **Infra**: Docker, docker-compose

## Project Structure
```
apimaker/
├── backend/          # FastAPI + SQLModel
│   ├── app/
│   │   ├── routers/  # 14 routers HTTP
│   │   ├── services/ # 7 business services
│   │   ├── db_models.py  # 18 SQLAlchemy models
│   │   ├── models.py     # Pydantic schemas
│   │   ├── security.py   # JWT, auth guards
│   │   └── main.py       # App FastAPI
│   └── tests/        # 8 test files
├── frontend/         # React + Vite + TypeScript
│   └── src/
│       ├── components/   # 48 components
│       ├── hooks/        # useAuth, useProjectBuilder (Zustand)
│       ├── lib/          # api.ts, faker.ts, etc.
│       └── types/        # schemas.ts
├── generator/        # Templates Jinja2
│   └── templates/    # fastapi/, express/, nest/, sdk/, deploy/
├── docs/             # Documentation
└── infra/            # Terraform (planned)
```

## Code Conventions
- **Backend**: snake_case in Python, SQLModel for ORM, services separated from routers
- **Frontend**: camelCase in TypeScript, functional components, lucide-react for icons
- **Styles**: global styles.css (no tailwind), look for existing classes before creating new ones
- **API**: endpoints accept project_id as UUID or slug
- **Commits**: messages in English, short descriptive format

## Useful Commands
- Backend: `cd backend && uvicorn app.main:app --reload --port 8000`
- Backend tests: `cd backend && pytest -q`
- Frontend: `cd frontend && npm run dev`
- Frontend lint: `cd frontend && npm run lint`
- Frontend tests: `cd frontend && npm test`
- Alembic: `cd backend && alembic upgrade head`
- Docker compose: `docker compose up -d`
