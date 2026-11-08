"""Add current account and project columns before seeding the admin."""

from alembic import op

revision = "d1e6c4a93f2b"
down_revision = "8f7e9d2c4b5a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS title VARCHAR(20),
            ADD COLUMN IF NOT EXISTS must_set_password BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS profile_image_data BYTEA,
            ADD COLUMN IF NOT EXISTS profile_image_content_type VARCHAR(100)
        """
    )
    op.execute(
        """
        ALTER TABLE projects
            ADD COLUMN IF NOT EXISTS document_data BYTEA,
            ADD COLUMN IF NOT EXISTS document_content_type VARCHAR,
            ADD COLUMN IF NOT EXISTS document_storage VARCHAR,
            ADD COLUMN IF NOT EXISTS images JSON,
            ADD COLUMN IF NOT EXISTS featured_image_index INTEGER
        """
    )


def downgrade() -> None:
    # Some databases already had these columns before this revision.
    # Keep them and their data when rolling back the migration version.
    pass
