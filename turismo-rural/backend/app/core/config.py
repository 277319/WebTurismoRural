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


settings = Settings()
