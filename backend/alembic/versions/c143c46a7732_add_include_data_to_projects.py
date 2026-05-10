"""add include_data to projects

Revision ID: c143c46a7732
Revises: 2f842d4ee197
Create Date: 2026-05-11 00:48:41.471925

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c143c46a7732'
down_revision: Union[str, Sequence[str], None] = '2f842d4ee197'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


import sqlmodel

def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('include_data', sa.Boolean(), nullable=False, server_default='1'))

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('include_data')
