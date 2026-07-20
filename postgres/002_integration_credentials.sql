-- ================================================================
-- INTEGRATION CREDENTIALS (API keys configuráveis via Admin UI)
-- Valores sempre armazenados criptografados (AES-256-GCM, ver
-- backend/src/services/credentialStore.js). Nunca em texto plano.
-- ================================================================

CREATE TABLE integration_credentials (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration      VARCHAR(50) NOT NULL,   -- anthropic, azure_devops, microsoft_graph, freshservice, work_plane, smartleader
  key_name         VARCHAR(100) NOT NULL UNIQUE, -- ex: ADO_PAT, FRESHSERVICE_API_KEY
  value_encrypted  TEXT NOT NULL,
  updated_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_credentials_integration ON integration_credentials(integration);

CREATE TRIGGER trg_integration_credentials_upd
  BEFORE UPDATE ON integration_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
