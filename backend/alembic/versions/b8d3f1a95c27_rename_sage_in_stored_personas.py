"""rename Sage to the assistant in stored personas

Revision ID: b8d3f1a95c27
Revises: a3c1d7e9f2b4
Create Date: 2026-08-06 00:00:00.000000

Personas generated before the assistant lost its "Sage" name are stored free text
on the user row, and are prepended verbatim to the answering prompt — so an old
row keeps reintroducing the name no matter what the generator does now. Rewrite
them in place. `replace` is the same builtin in SQLite and Postgres, so this runs
unchanged on a dev SQLite file and on Supabase, and covers the possessive
("Sage's" -> "the assistant's") for free.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d3f1a95c27'
down_revision: Union[str, None] = 'a3c1d7e9f2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Inner replace first, so a sentence-initial "Sage" ("... precise. Sage also
    # cites ...") capitalises instead of leaving a lowercase word mid-prompt.
    op.execute(
        sa.text(
            "UPDATE users SET persona = "
            "replace(replace(persona, '. Sage', '. The assistant'), 'Sage', 'the assistant') "
            "WHERE persona LIKE '%Sage%'"
        )
    )


def downgrade() -> None:
    # Deliberately a no-op: reversing this would rewrite every "the assistant" back
    # to "Sage", including the ones that were never named in the first place. The
    # old wording isn't worth corrupting current personas to recover.
    pass
