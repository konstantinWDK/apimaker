"""add saved_requests to datasets

Revision ID: 2f842d4ee197
Revises: 40ef4bcb03a8
Create Date: 2026-05-11 00:33:25.853176

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '2f842d4ee197'
down_revision: Union[str, Sequence[str], None] = '40ef4bcb03a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('datasets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('saved_requests', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('datasets', schema=None) as batch_op:
        batch_op.drop_column('saved_requests')
