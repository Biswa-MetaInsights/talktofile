"""add user avatar

Revision ID: 9e2a7c4b1d83
Revises: 1f5b209d190b
Create Date: 2026-06-30 00:00:00.000000

Stores the profile photo as a small (client-downscaled) data URL directly on the
user row. Kept tiny on the frontend before saving, so a Text column is fine.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e2a7c4b1d83'
down_revision: Union[str, None] = '1f5b209d190b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('avatar', sa.Text(), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('avatar')
