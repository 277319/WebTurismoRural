from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.db import get_db

router = APIRouter(tags=["health"])


# La usa el healthcheck de Docker: responde 503 si la API no llega a PostgreSQL
@router.get("/health")
def health(response: Response, db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "error", "base_de_datos": "sin conexión"}
    return {"status": "ok", "base_de_datos": "conectada"}
