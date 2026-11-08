"""Store first and last names separately for faculty accounts."""

from alembic import op

revision = "f42c1de7a903"
down_revision = "d1e6c4a93f2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)
        """
    )


def downgrade() -> None:
    # Retain explicitly entered surnames if the app is rolled back.
    pass
