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
│   └── requirements.txt
├── frontend/
│   └── nginx.conf         # servidor web: estáticos + proxy de /api
├── compose.yaml           # la única forma de levantar la app
├── .env.example           # modelo del .env (cópialo y cambia POSTGRES_PASSWORD)
└── README.md
```

## Puesta en marcha

Solo hace falta [Docker](https://docs.docker.com/get-docker/) (con Docker Compose 2.24 o superior).
En una terminal abierta en la carpeta de `compose.yaml`:

```powershell
# 1. Configuración: copia el modelo y cambia POSTGRES_PASSWORD
Copy-Item .env.example .env        # macOS / Linux: cp .env.example .env

# 2. Valida el Compose sin imprimir contraseñas
docker compose config -q

# 3. Construye y levanta en segundo plano
docker compose up -d --build

# 4. Estado: backend y db deben quedar "healthy"
docker compose ps

# 5. Detener (conserva los datos)
docker compose down
```

| Qué                    | Dónde                                                   |
| ---------------------- | ------------------------------------------------------- |
| App                    | http://localhost:8080                                   |
| API (documentación)    | http://localhost:8000/docs o http://localhost:8080/api/docs |
| Salud de API y BD      | http://localhost:8000/health                            |
| Correos enviados       | http://localhost:8025                                   |

Todos los puertos quedan ligados a `127.0.0.1`: la app solo se abre desde el equipo que la ejecuta.

Se levantan cuatro contenedores:

- **nginx:** compila el frontend dentro de la imagen (con las versiones exactas de
  `package-lock.json`), entrega los estáticos, devuelve `index.html` en las rutas de React Router y
  redirige `/api/*` al backend quitando el prefijo ([`frontend/nginx.conf`](frontend/nginx.conf)).
  Arranca cuando el backend está sano.
- **backend:** FastAPI. Al arrancar aplica las migraciones (`alembic upgrade head`). `/health`
  comprueba también la conexión con PostgreSQL y es el healthcheck del contenedor.
- **db:** PostgreSQL 16. No publica puerto, así que no choca con uno instalado en el equipo; la API
  la alcanza como `db:5432` por la red de Compose: `docker compose exec db psql -U turismo turismo_rural`.
- **mailpit:** atrapa los correos (ver [Correos](#correos)).

Los datos quedan en volúmenes de Docker (`pgdata` para la base y `uploads` para las fotos): se
conservan entre `down`/`up` y reconstrucciones. **`docker compose down -v` los borra** y deja todo de cero.

Después de cambiar código, se vuelve a ejecutar `docker compose up -d --build`.

### Configuración

Todo se configura en `.env` (modelo en [`.env.example`](.env.example)), que no se sube al repositorio:

- `POSTGRES_PASSWORD` (obligatoria), `POSTGRES_USER`, `POSTGRES_DB`: credenciales de la base. Se
  aplican al crear el volumen `pgdata`; si ya existe, cambiarlas en `.env` no cambia la clave guardada.
- `WEB_PORT` (8080), `API_PORT` (8000), `MAIL_UI_PORT` (8025): puertos del equipo, por si alguno
  está ocupado.
- `SECRET_KEY`: firma de las sesiones. En producción, una cadena larga y aleatoria.
- `FRONTEND_URL` (por defecto `http://localhost:<WEB_PORT>`): para los enlaces de los correos y las
  páginas de pago.
- `BACKEND_URL`: destino de los avisos de pago. Con Mercado Pago, una URL pública:
  `BACKEND_URL=https://tudominio.cl/api`.
- SMTP real y Mercado Pago: ver más abajo.

Tras editarlo: `docker compose up -d`.

## Datos de prueba

```bash
docker compose exec backend python -m scripts.datos_demo
```

Crea 5 anfitriones (con 6 emprendimientos, 23 experiencias, fotos y fechas disponibles) y 4
visitantes con reservas en todos los estados. Las cuentas y lo que tiene cada una están en
[`CREDENCIALES_PRUEBA.txt`](CREDENCIALES_PRUEBA.txt); todas usan la contraseña `Rural2026`. Se puede
repetir: reemplaza las cuentas de prueba anteriores sin tocar las demás, y las fechas parten del día
en que se ejecuta.

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

Por defecto van a **Mailpit**, que los atrapa sin entregarlos: se ven en http://localhost:8025.
Para un SMTP real, define en `.env`:

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
  El aviso tiene que poder llegar al backend desde internet: en un equipo local, un túnel como
  `ngrok http 8080` (el backend se alcanza en `/api`).

```env
PROVEEDOR_PAGO=mercadopago
MP_ACCESS_TOKEN=TEST-...           # Tus integraciones > Credenciales de prueba
MP_WEBHOOK_SECRET=...              # Tus integraciones > Webhooks (opcional: verifica la firma)
MP_SANDBOX=true
BACKEND_URL=https://xxxx.ngrok-free.app/api
```

## Migraciones

Se aplican solas al arrancar el backend. Para crear una nueva (con la app levantada), montando
`backend/` para que el archivo generado quede en el proyecto:

```bash
docker compose run --rm -v ./backend:/app backend alembic revision --autogenerate -m "descripcion"
docker compose up -d --build backend
```

Importa cada modelo nuevo en `app/models/__init__.py` para que Alembic lo detecte.
