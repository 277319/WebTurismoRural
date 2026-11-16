from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Turismo Rural"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    UPLOADS_DIR: str = "uploads"
    MAX_FOTO_MB: int = 5
    # Las fotos de la galería se comprimen al subirlas, así que se acepta un original más pesado
    MAX_FOTO_EXPERIENCIA_MB: int = 10
    # Define qué día es "hoy" para la disponibilidad (el servidor corre en UTC)
    ZONA_HORARIA: str = "America/Santiago"

    # --- Correo ---
    # Dirección pública del frontend, para los enlaces de los correos
    FRONTEND_URL: str = "http://localhost:5173"
    # Por defecto apunta a Mailpit (docker compose), que atrapa los correos sin entregarlos:
    # se ven en http://localhost:8025. En producción, los datos del proveedor SMTP real
    MAIL_SERVER: str = "localhost"
    MAIL_PORT: int = 1025
    # Sin usuario no se autentica (Mailpit no lo pide)
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "reservas@turismorural.cl"
    MAIL_FROM_NAME: str = "Turismo Rural"
    MAIL_STARTTLS: bool = False
    MAIL_SSL_TLS: bool = False
    # False para no enviar ningún correo (p. ej. en pruebas)
    MAIL_ENVIAR: bool = True

    # --- Pagos en línea ---
    # "simulado": pasarela de prueba propia, sin dinero real ni cuentas externas.
    # "mercadopago": Checkout Pro de Mercado Pago (con credenciales de prueba, en su sandbox)
    PROVEEDOR_PAGO: Literal["simulado", "mercadopago"] = "simulado"
    # Dirección del backend a la que el proveedor envía sus avisos (webhook). Mercado Pago necesita
    # una URL accesible desde internet: en desarrollo, un túnel como ngrok
    BACKEND_URL: str = "http://localhost:8000"
    # Access token de la cuenta vendedora (Tus integraciones > Credenciales)
    MP_ACCESS_TOKEN: str = ""
    # Clave secreta de los webhooks, para verificar su firma. Sin ella, igual se consulta cada pago a su API
    MP_WEBHOOK_SECRET: str = ""
    # True con credenciales de prueba: el visitante paga en el sandbox, con tarjetas de prueba
    MP_SANDBOX: bool = True


settings = Settings()
