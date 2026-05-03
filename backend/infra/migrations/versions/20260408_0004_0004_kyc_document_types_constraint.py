"""Align kyc_documents.document_type CHECK constraint with gateway VALID_DOC_TYPES.

Without this, INSERT fails CHECK constraint and users get a 400 error on KYC submission.

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

_DOC_TYPES = (
    "passport",
    "national_id",
    "driving_license",
    "proof_of_address",
    "address_proof",
    "selfie",
    "bank_statement",
    "id_front",
    "id_back",
    "other",
)


def upgrade() -> None:
    types_sql = ", ".join(f"'{t}'" for t in _DOC_TYPES)
    op.execute("ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_document_type_check;")
    op.execute(
        f"ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_document_type_check "
        f"CHECK (document_type IN ({types_sql}));"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_document_type_check;")
