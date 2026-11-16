"""estados pagada y rechazada

Revision ID: b3e71f0c9a42
Revises: 82c0e367bc84
Create Date: 2026-11-04 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b3e71f0c9a42'
down_revision: Union[str, None] = '82c0e367bc84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE estado_reserva ADD VALUE IF NOT EXISTS 'pagada' AFTER 'confirmada'")
    op.execute("ALTER TYPE estado_reserva ADD VALUE IF NOT EXISTS 'rechazada'")


def downgrade() -> None:
    # PostgreSQL no permite quitar valores de un enum: se pasan las reservas a su estado más
    # cercano (las rechazadas ya liberaron sus cupos, igual que las canceladas) y se recrea el tipo
    op.execute("UPDATE reservas SET estado = 'confirmada' WHERE estado = 'pagada'")
    op.execute("UPDATE reservas SET estado = 'cancelada' WHERE estado = 'rechazada'")
    op.execute("ALTER TYPE estado_reserva RENAME TO estado_reserva_anterior")
    op.execute("CREATE TYPE estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada')")
    op.execute("ALTER TABLE reservas ALTER COLUMN estado DROP DEFAULT")
    op.execute("ALTER TABLE reservas ALTER COLUMN estado TYPE estado_reserva USING estado::text::estado_reserva")
    op.execute("ALTER TABLE reservas ALTER COLUMN estado SET DEFAULT 'pendiente'")
    op.execute("DROP TYPE estado_reserva_anterior")
