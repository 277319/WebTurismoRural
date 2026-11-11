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
├── docker-compose.yml     # la única forma de levantar la app
├── .env.example           # configuración opcional
└── README.md
```

## Puesta en marcha

Solo hace falta [Docker](https://docs.docker.com/get-docker/) (con Docker Compose 2.24 o superior).
En cualquier ordenador:

```bash
docker compose up -d --build
```

| Qué                    | Dónde                       |
| ---------------------- | --------------------------- |
| App                    | http://localhost            |
| API (documentación)    | http://localhost/api/docs   |
| Correos enviados       | http://localhost:8025       |

Se levantan cuatro contenedores:

- **nginx:** compila el frontend dentro de la imagen (con las versiones exactas de
  `package-lock.json`), entrega los estáticos, devuelve `index.html` en las rutas de React Router y
  redirige `/api/*` al backend quitando el prefijo ([`frontend/nginx.conf`](frontend/nginx.conf)).
- **backend:** FastAPI. Al arrancar aplica las migraciones (`alembic upgrade head`). No publica
  puerto: solo se llega por `/api`.
- **db:** PostgreSQL 16. Tampoco publica puerto, así que no choca con uno instalado en el equipo:
  `docker compose exec db psql -U turismo turismo_rural`.
- **mailpit:** atrapa los correos (ver [Correos](#correos)).

Los datos quedan en volúmenes de Docker (`pgdata` para la base y `uploads` para las fotos): se
conservan entre reinicios y reconstrucciones. `docker compose down -v` los borra y deja todo de cero.

Después de cambiar código, se vuelve a ejecutar `docker compose up -d --build`.

### Configuración

No hace falta ningún archivo extra. Para cambiar algo, copia [`.env.example`](.env.example) a `.env`
(junto a `docker-compose.yml`) y edita lo que necesites:

- `SECRET_KEY`: firma de las sesiones. En producción, una cadena larga y aleatoria.
- `PUERTO`: si el 80 está ocupado (p. ej. `PUERTO=8080`; entonces `FRONTEND_URL=http://localhost:8080`).
- `FRONTEND_URL` (por defecto `http://localhost`): para los enlaces de los correos y las páginas de pago.
- `BACKEND_URL`: destino de los avisos de pago. Con Mercado Pago, una URL pública:
  `BACKEND_URL=https://tudominio.cl/api`.
- SMTP real y Mercado Pago: ver más abajo.

El `.env` no se sube al repositorio. Tras editarlo: `docker compose up -d`.

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
  `ngrok http 80` (el backend se alcanza en `/api`).

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
