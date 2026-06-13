-- ============================================================================
-- Script: create-tables.sql
-- Description: Standalone script to create the complete database schema for
--              the financial receivables system (Contas a Receber).
-- Usage: psql -U postgres -d nome_do_banco -f create-tables.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper function: updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. company_settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social    VARCHAR(255) NOT NULL,
    cnpj            VARCHAR(14) NOT NULL,
    certificate_b64 TEXT,
    certificate_pwd TEXT,
    last_sync_at    TIMESTAMP,
    last_nsu        VARCHAR(20) DEFAULT '0',
    sefaz_ambiente  VARCHAR(20) DEFAULT 'producao',
    created_at      TIMESTAMP   DEFAULT NOW(),
    updated_at      TIMESTAMP   DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_settings_cnpj
    ON company_settings(cnpj);

ALTER TABLE company_settings
    ADD CONSTRAINT ck_company_settings_sefaz_ambiente
    CHECK (sefaz_ambiente IN ('producao', 'homologacao'));

COMMENT ON TABLE  company_settings IS 'Configurações da empresa / emitente';
COMMENT ON COLUMN company_settings.certificate_b64 IS 'Certificado digital A1 em base64';
COMMENT ON COLUMN company_settings.certificate_pwd   IS 'Senha do certificado (criptografada)';
COMMENT ON COLUMN company_settings.last_nsu          IS 'Último NSU processado da SEFAZ';
COMMENT ON COLUMN company_settings.sefaz_ambiente    IS 'Ambiente SEFAZ: producao ou homologacao';

CREATE TRIGGER trg_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. customers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social    VARCHAR(255) NOT NULL,
    nome_fantasia   VARCHAR(255),
    cnpj            VARCHAR(14),
    cpf             VARCHAR(11),
    telefone        VARCHAR(20),
    email           VARCHAR(255),
    created_at      TIMESTAMP   DEFAULT NOW(),
    updated_at      TIMESTAMP   DEFAULT NOW()
);

ALTER TABLE customers
    ADD CONSTRAINT uq_customers_cnpj UNIQUE (cnpj);

ALTER TABLE customers
    ADD CONSTRAINT uq_customers_cpf UNIQUE (cpf);

CREATE INDEX IF NOT EXISTS idx_customers_razao_social
    ON customers(razao_social);

COMMENT ON TABLE  customers IS 'Clientes extraídos dos XMLs de NF-e';

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. invoices (NF-e)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    numero          VARCHAR(9)   NOT NULL,
    serie           VARCHAR(3)   NOT NULL,
    chave_acesso    VARCHAR(44)  NOT NULL,
    valor_total     NUMERIC(15,2) NOT NULL,
    data_emissao    DATE         NOT NULL,
    status_sefaz    VARCHAR(20)  NOT NULL DEFAULT 'AUTHORIZED',
    xml_content     TEXT         NOT NULL,
    nsu             VARCHAR(20),
    customer_id     UUID         NOT NULL,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

ALTER TABLE invoices
    ADD CONSTRAINT uq_invoices_chave_acesso UNIQUE (chave_acesso);

ALTER TABLE invoices
    ADD CONSTRAINT uq_invoices_numero_serie UNIQUE (numero, serie);

ALTER TABLE invoices
    ADD CONSTRAINT fk_invoices_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id);

ALTER TABLE invoices
    ADD CONSTRAINT ck_invoices_valor_total
    CHECK (valor_total >= 0);

ALTER TABLE invoices
    ADD CONSTRAINT ck_invoices_status_sefaz
    CHECK (status_sefaz IN (
        'AUTHORIZED', 'CANCELLED', 'DENIED', 'EXPIRED',
        'PROCESSING', 'EVENT_REGISTERED'
    ));

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
    ON invoices(customer_id);

CREATE INDEX IF NOT EXISTS idx_invoices_data_emissao
    ON invoices(data_emissao);

CREATE INDEX IF NOT EXISTS idx_invoices_status_sefaz
    ON invoices(status_sefaz);

COMMENT ON TABLE  invoices              IS 'Notas fiscais eletrônicas importadas da SEFAZ';
COMMENT ON COLUMN invoices.chave_acesso IS 'Chave de acesso de 44 dígitos';
COMMENT ON COLUMN invoices.status_sefaz IS 'Status da nota na SEFAZ';

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. receivables (Contas a Receber)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS receivables (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID         NOT NULL,
    numero_parcela  SMALLINT     NOT NULL DEFAULT 1,
    total_parcelas  SMALLINT     NOT NULL DEFAULT 1,
    valor           NUMERIC(15,2) NOT NULL,
    vencimento      DATE         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    payment_method  VARCHAR(20),
    paid_at         TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

ALTER TABLE receivables
    ADD CONSTRAINT fk_receivables_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id);

ALTER TABLE receivables
    ADD CONSTRAINT uq_receivables_invoice_parcela
    UNIQUE (invoice_id, numero_parcela);

ALTER TABLE receivables
    ADD CONSTRAINT ck_receivables_valor
    CHECK (valor >= 0);

ALTER TABLE receivables
    ADD CONSTRAINT ck_receivables_numero_parcela
    CHECK (numero_parcela >= 1);

ALTER TABLE receivables
    ADD CONSTRAINT ck_receivables_total_parcelas
    CHECK (total_parcelas >= 1);

ALTER TABLE receivables
    ADD CONSTRAINT ck_receivables_numero_parcela_lte_total
    CHECK (numero_parcela <= total_parcelas);

ALTER TABLE receivables
    ADD CONSTRAINT ck_receivables_status
    CHECK (status IN (
        'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'PARTIALLY_PAID'
    ));

ALTER TABLE receivables
    ADD CONSTRAINT ck_receivables_payment_method
    CHECK (payment_method IN (
        'BOLETO', 'PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'TRANSFERENCIA', 'OUTROS'
    ));

CREATE INDEX IF NOT EXISTS idx_receivables_invoice_id
    ON receivables(invoice_id);

CREATE INDEX IF NOT EXISTS idx_receivables_status
    ON receivables(status);

CREATE INDEX IF NOT EXISTS idx_receivables_vencimento
    ON receivables(vencimento);

COMMENT ON TABLE  receivables                IS 'Contas a receber geradas a partir de NF-e';
COMMENT ON COLUMN receivables.numero_parcela IS 'Número da parcela (1-based)';

CREATE TRIGGER trg_receivables_updated_at
    BEFORE UPDATE ON receivables
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id   UUID         NOT NULL,
    valor_pago      NUMERIC(15,2) NOT NULL,
    juros           NUMERIC(15,2) NOT NULL DEFAULT 0,
    multa           NUMERIC(15,2) NOT NULL DEFAULT 0,
    data_pagamento  DATE         NOT NULL,
    observacao      TEXT,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

ALTER TABLE payments
    ADD CONSTRAINT fk_payments_receivable
    FOREIGN KEY (receivable_id) REFERENCES receivables(id);

ALTER TABLE payments
    ADD CONSTRAINT ck_payments_valor_pago
    CHECK (valor_pago >= 0);

ALTER TABLE payments
    ADD CONSTRAINT ck_payments_juros
    CHECK (juros >= 0);

ALTER TABLE payments
    ADD CONSTRAINT ck_payments_multa
    CHECK (multa >= 0);

CREATE INDEX IF NOT EXISTS idx_payments_receivable_id
    ON payments(receivable_id);

CREATE INDEX IF NOT EXISTS idx_payments_data_pagamento
    ON payments(data_pagamento);

COMMENT ON TABLE payments IS 'Registros de pagamento das contas a receber';

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. financial_events (immutable audit log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   UUID,
    payload     JSONB,
    created_at  TIMESTAMP   DEFAULT NOW()
);

ALTER TABLE financial_events
    ADD CONSTRAINT ck_financial_events_event_type
    CHECK (event_type IN (
        'CREATED', 'UPDATED', 'PAID', 'CANCELLED', 'OVERDUE',
        'IMPORTED', 'EMAIL_SENT', 'NOTE_ADDED'
    ));

CREATE INDEX IF NOT EXISTS idx_financial_events_event_type
    ON financial_events(event_type);

CREATE INDEX IF NOT EXISTS idx_financial_events_entity_id
    ON financial_events(entity_id);

CREATE INDEX IF NOT EXISTS idx_financial_events_created_at
    ON financial_events(created_at);

COMMENT ON TABLE financial_events IS 'Auditoria imutável de eventos financeiros';

COMMIT;
