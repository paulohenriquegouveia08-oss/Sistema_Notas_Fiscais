-- ============================================================================
-- Seed: 001_seed_settings
-- Description: Inserts the initial company_settings row with placeholder data.
-- Run after the migration has been applied.
-- ============================================================================

INSERT INTO company_settings (
    razao_social,
    cnpj,
    certificate_b64,
    certificate_pwd,
    last_sync_at,
    last_nsu,
    sefaz_ambiente
) VALUES (
    'NOME DA EMPRESA LTDA',
    '00000000000000',
    '',
    '',
    NULL,
    '0',
    'homologacao'
)
ON CONFLICT (cnpj) DO NOTHING;
