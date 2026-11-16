"""pagos en linea

Revision ID: d8f4b61c2e57
Revises: c5d2a8e17f30
Create Date: 2026-11-05 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'd8f4b61c2e57'
down_revision: Union[str, None] = 'c5d2a8e17f30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE metodo_pago ADD VALUE IF NOT EXISTS 'en_linea'")
    op.create_table(
        'pagos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reserva_id', sa.Integer(), nullable=False),
        sa.Column('proveedor', sa.String(length=30), nullable=False),
        sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            'estado',
            sa.Enum('pendiente', 'aprobado', 'rechazado', name='estado_pago'),
            server_default='pendiente',
            nullable=False,
        ),
        sa.Column('id_cobro', sa.String(length=100), nullable=True),
        sa.Column('id_transaccion', sa.String(length=100), nullable=True),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('monto > 0', name='ck_pagos_monto'),
        sa.ForeignKeyConstraint(['reserva_id'], ['reservas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_pagos_reserva_id'), 'pagos', ['reserva_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_pagos_reserva_id'), table_name='pagos')
    op.drop_table('pagos')
    sa.Enum(name='estado_pago').drop(op.get_bind(), checkfirst=True)
    # PostgreSQL no permite quitar valores de un enum: las reservas pagadas en línea pasan a tarjeta
    # (el visitante pagó con tarjeta, solo que en la web) y se recrea el tipo sin 'en_linea'
    op.execute("UPDATE reservas SET metodo_pago = 'tarjeta' WHERE metodo_pago = 'en_linea'")
    op.execute("ALTER TYPE metodo_pago RENAME TO metodo_pago_anterior")
    op.execute("CREATE TYPE metodo_pago AS ENUM ('efectivo', 'transferencia', 'tarjeta')")
    op.execute(
        "ALTER TABLE reservas ALTER COLUMN metodo_pago TYPE metodo_pago USING metodo_pago::text::metodo_pago"
    )
    op.execute("DROP TYPE metodo_pago_anterior")
