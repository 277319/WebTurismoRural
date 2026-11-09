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

## Correos

Los cambios de estado de una reserva se avisan por correo con
[fastapi-mail](https://sabuhish.github.io/fastapi-mail/), como tareas en segundo plano
(`BackgroundTasks`): la respuesta no espera al envío, y si falla solo queda en el log.

| Evento                          | Destinatario          | Plantilla                 |
| ------------------------------- | --------------------- | ------------------------- |
| Nueva solicitud (`POST /reservas`) | visitante y anfitrión | `nueva_solicitud.html`    |
| `PATCH /reservas/{id}/confirmar`   | visitante             | `reserva_confirmada.html` |
| `PATCH /reservas/{id}/rechazar`    | visitante             | `reserva_rechazada.html`  |
| `PATCH /reservas/{id}/marcar-pagada` | visitante           | `reserva_pagada.html`     |

Las plantillas Jinja están en `backend/app/templates/correos/` (`base.html` es el diseño común y
`_componentes.html` las piezas compartidas). Al reservar se pide un correo (se propone el de la cuenta):
los avisos de esa reserva van ahí, así que también les llegan a quienes se registraron solo con teléfono.

En desarrollo, `docker compose up -d` levanta **Mailpit**, que atrapa los correos sin entregarlos:
se ven en http://localhost:8025. Para un SMTP real, define en `backend/.env`:

```env
MAIL_SERVER=smtp.ejemplo.com
MAIL_PORT=587
MAIL_USERNAME=usuario
MAIL_PASSWORD=contraseña
MAIL_FROM=reservas@tudominio.cl
MAIL_STARTTLS=true
FRONTEND_URL=https://tudominio.cl   # para los enlaces de los correos
```

`MAIL_ENVIAR=false` desactiva el envío.

## Pagos en línea

Cuando el anfitrión confirma una reserva con precio, el visitante puede pagarla desde **Mis reservas**:

1. `POST /pagos` crea el cobro en el proveedor y devuelve la página donde se paga.
2. El visitante paga allí y vuelve a `/pagos/{id}/exito` o `/pagos/{id}/fallo`.
3. El proveedor avisa el resultado a `POST /pagos/webhook`. Recién entonces la reserva pasa a
   **pagada** y se envía `reserva_pagada.html`. La página de éxito consulta el pago hasta que llega el aviso.

Los proveedores implementan la interfaz `ProveedorPago` (`backend/app/pagos/base.py`): crear un
cobro y leer sus avisos. Para agregar otro, se implementan esos dos métodos y se registra en
`app/pagos/__init__.py`. Se elige con `PROVEEDOR_PAGO`:

- **`simulado`** (por defecto): pasarela de prueba propia, sin dinero real ni cuentas externas. Su
  página (`/pagos/{id}/simulado`) deja aprobar o rechazar el pago, y el resultado llega al webhook
  como un aviso HTTP firmado, igual que el de un proveedor real.
- **`mercadopago`**: Checkout Pro de Mercado Pago. Con credenciales de prueba se paga en su sandbox,
  con [tarjetas de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
  El aviso tiene que poder llegar al backend desde internet: en desarrollo, un túnel como
  `ngrok http 8000`.

```env
PROVEEDOR_PAGO=mercadopago
MP_ACCESS_TOKEN=TEST-...           # Tus integraciones > Credenciales de prueba
MP_WEBHOOK_SECRET=...              # Tus integraciones > Webhooks (opcional: verifica la firma)
MP_SANDBOX=true
BACKEND_URL=https://xxxx.ngrok-free.app
```

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