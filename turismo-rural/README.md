# Turismo Rural

Aplicación web de turismo rural.

- **Backend:** FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL
- **Frontend:** React + TypeScript (Vite)

## Estructura

```
turismo-rural/
├── backend/
│   ├── app/
│   │   ├── main.py        # punto de entrada FastAPI
│   │   ├── models/        # modelos SQLAlchemy
│   │   ├── routers/       # endpoints
│   │   ├── schemas/       # esquemas Pydantic
│   │   └── core/          # config, db, security
│   ├── alembic/           # migraciones
│   ├── requirements.txt
│   └── .env
├── frontend/
├── docker-compose.yml
└── README.md
```

## Puesta en marcha

### Base de datos (y backend) con Docker

```bash
docker compose up -d db          # solo PostgreSQL
docker compose up -d             # PostgreSQL + backend
```

### Backend en local

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate           # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

API en http://localhost:8000 — documentación en http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App en http://localhost:5173 (las peticiones a `/api` se redirigen al backend).

## Migraciones

```bash
cd backend
alembic revision --autogenerate -m "descripcion"
alembic upgrade head
```

Importa cada modelo nuevo en `app/models/__init__.py` para que Alembic lo detecte.

Open two terminals in VS Code. The split-terminal button is handy for this.

Database: run docker compose up -d once. It stays running.
Terminal 1 (backend):
bash
   cd backend
   source .venv/bin/activate
   uvicorn app.main:app --reload
Terminal 2 (frontend):
bash
   cd frontend
   npm run dev

To check the setup end to end, call /health from a React component using import.meta.env.VITE_API_URL. If it returns {"status": "ok"}, the frontend, backend and CORS are all wired correctly, and you’re ready to start HU01.