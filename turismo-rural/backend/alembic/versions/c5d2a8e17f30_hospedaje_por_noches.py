"""hospedaje por noches

Revision ID: c5d2a8e17f30
Revises: b3e71f0c9a42
Create Date: 2026-11-05 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'c5d2a8e17f30'
down_revision: Union[str, None] = 'b3e71f0c9a42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE tipo_experiencia ADD VALUE IF NOT EXISTS 'hospedaje'")
    # Las reservas existentes son de un día: quedan con 1 noche
    op.add_column('reservas', sa.Column('noches', sa.Integer(), server_default='1', nullable=False))
    op.create_check_constraint('ck_reservas_noches', 'reservas', 'noches > 0')


def downgrade() -> None:
    # PostgreSQL no permite quitar valores de un enum, y no hay otro tipo al que pasar un hospedaje sin
    # inventar datos: si quedan hospedajes, hay que borrarlos o cambiarlos de tipo antes de bajar
    hospedajes = op.get_bind().scalar(sa.text("SELECT count(*) FROM experiencias WHERE tipo = 'hospedaje'"))
    if hospedajes:
        raise RuntimeError(
            f"Hay {hospedajes} experiencias de hospedaje: bórralas o cámbialas de tipo antes de bajar esta migración"
        )
    op.drop_constraint('ck_reservas_noches', 'reservas', type_='check')
    op.drop_column('reservas', 'noches')
    op.execute("ALTER TYPE tipo_experiencia RENAME TO tipo_experiencia_anterior")
    op.execute(
        "CREATE TYPE tipo_experiencia AS ENUM ('senderismo', 'cabalgata', 'gastronomia', 'agroturismo', "
        "'artesania', 'pesca', 'acuatica', 'avistamiento', 'cultural')"
    )
    op.execute(
        "ALTER TABLE experiencias ALTER COLUMN tipo TYPE tipo_experiencia USING tipo::text::tipo_experiencia"
    )
    op.execute("DROP TYPE tipo_experiencia_anterior")
