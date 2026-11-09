"""correo de reserva

Revision ID: f2a7c9e41b06
Revises: d8f4b61c2e57
Create Date: 2026-11-08 17:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'f2a7c9e41b06'
down_revision: Union[str, None] = 'd8f4b61c2e57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reservas', sa.Column('correo', sa.String(length=255), nullable=True))
    # Las reservas existentes siguen avisando al correo de la cuenta (las de cuentas sin correo quedan nulas)
    op.execute("UPDATE reservas SET correo = usuarios.correo FROM usuarios WHERE usuarios.id = reservas.visitante_id")


def downgrade() -> None:
    op.drop_column('reservas', 'correo')
