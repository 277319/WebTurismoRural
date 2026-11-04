"""rol visitante por defecto

Revision ID: 360db41da1de
Revises: d217417295c5
Create Date: 2026-11-04 04:19:37.290580

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '360db41da1de'
down_revision: Union[str, None] = 'd217417295c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Los usuarios con rol 'cliente' pasan automáticamente a 'visitante'
    op.execute("ALTER TYPE rol_usuario RENAME VALUE 'cliente' TO 'visitante'")
    op.alter_column('usuarios', 'rol', server_default='visitante')


def downgrade() -> None:
    op.execute("ALTER TYPE rol_usuario RENAME VALUE 'visitante' TO 'cliente'")
    op.alter_column('usuarios', 'rol', server_default='cliente')
