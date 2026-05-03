-- Align kyc_documents.document_type with gateway VALID_DOC_TYPES (passport, national_id, etc.).
-- Without this, INSERT fails CHECK constraint → 500 when users submit the trader KYC form.

ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_document_type_check;

ALTER TABLE kyc_documents ADD CONSTRAINT kyc_documents_document_type_check CHECK (
    document_type IN (
        'passport',
        'national_id',
        'driving_license',
        'proof_of_address',
        'address_proof',
        'selfie',
        'bank_statement',
        'id_front',
        'id_back',
        'other'
    )
);
