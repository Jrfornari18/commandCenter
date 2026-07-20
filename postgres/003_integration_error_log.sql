-- ================================================================
-- INTEGRATION ERROR LOG + FIX REQUESTS (diagnóstico, admin-only)
-- Registra falhas de chamadas a APIs externas (backend/src/integrations/*)
-- para consulta pelo Administrador, que pode solicitar correção —
-- isso grava um arquivo em contexto/ para leitura em sessões futuras
-- do Claude Code (ver CLAUDE.md §18).
-- ================================================================

CREATE TABLE integration_error_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration      VARCHAR(50) NOT NULL,   -- azure_devops, freshservice, microsoft_graph, work_plane, smartleader, anthropic
  operation        VARCHAR(150),
  http_status      INTEGER,
  error_message    TEXT NOT NULL,
  error_detail     JSONB,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_error_log_integration ON integration_error_log(integration);
CREATE INDEX idx_integration_error_log_occurred ON integration_error_log(occurred_at DESC);

CREATE TABLE integration_fix_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_log_id     UUID REFERENCES integration_error_log(id) ON DELETE SET NULL,
  integration      VARCHAR(50) NOT NULL,
  title            VARCHAR(200) NOT NULL,
  description      TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, done, dismissed
  contexto_file    VARCHAR(255),
  requested_by     UUID REFERENCES users(id),
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_integration_fix_requests_status ON integration_fix_requests(status);
