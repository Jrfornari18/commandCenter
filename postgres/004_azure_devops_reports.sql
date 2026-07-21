-- Migration: cache de relatórios executivos Azure DevOps (quarter/projetos/epics)
-- Complementa ado_work_items (001_schema.sql): aqui ficam snapshots agregados
-- gerados por reportService.getWeeklyReport, usados pelo painel para carregar
-- rápido sem golpear a API do ADO a cada request (WIQL ao vivo é caro).

CREATE TABLE IF NOT EXISTS devops_snapshots (
  id            SERIAL PRIMARY KEY,
  report_type   VARCHAR(50) NOT NULL,     -- 'weekly', 'quarter', 'epics', 'backlog', 'tags'
  report_data   JSONB NOT NULL,
  quarter       VARCHAR(10),              -- 'Q2-2026', 'Q3-2026'
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devops_snapshots_type ON devops_snapshots(report_type);
CREATE INDEX IF NOT EXISTS idx_devops_snapshots_quarter ON devops_snapshots(quarter);
CREATE INDEX IF NOT EXISTS idx_devops_snapshots_generated ON devops_snapshots(generated_at DESC);

CREATE TABLE IF NOT EXISTS devops_project_metrics (
  id            SERIAL PRIMARY KEY,
  project_name  VARCHAR(100) NOT NULL,
  period_label  VARCHAR(20) NOT NULL,     -- 'Abril', 'Maio', 'Junho'
  created_count INTEGER NOT NULL DEFAULT 0,
  closed_count  INTEGER NOT NULL DEFAULT 0,
  throughput    DECIMAL(5,1),
  balance       INTEGER,
  snapshot_id   INTEGER REFERENCES devops_snapshots(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devops_metrics_project ON devops_project_metrics(project_name);
CREATE INDEX IF NOT EXISTS idx_devops_metrics_period ON devops_project_metrics(period_label);
CREATE INDEX IF NOT EXISTS idx_devops_metrics_snapshot ON devops_project_metrics(snapshot_id);

CREATE TABLE IF NOT EXISTS devops_epic_progress (
  id              SERIAL PRIMARY KEY,
  epic_id         INTEGER NOT NULL,
  epic_title      VARCHAR(200) NOT NULL,
  project         VARCHAR(100) NOT NULL,
  iteration       VARCHAR(100),
  total_items     INTEGER NOT NULL DEFAULT 0,
  done_items      INTEGER NOT NULL DEFAULT 0,
  pending_items   INTEGER NOT NULL DEFAULT 0,
  completion_pct  INTEGER NOT NULL DEFAULT 0,
  states_json     JSONB,
  snapshot_id     INTEGER REFERENCES devops_snapshots(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devops_epics_project ON devops_epic_progress(project);
CREATE INDEX IF NOT EXISTS idx_devops_epics_snapshot ON devops_epic_progress(snapshot_id);

COMMENT ON TABLE devops_snapshots IS 'Snapshots de relatórios agregados do Azure DevOps (reportService) para o Command Center';
COMMENT ON TABLE devops_project_metrics IS 'Métricas mensais por projeto, associadas a um snapshot';
COMMENT ON TABLE devops_epic_progress IS 'Progresso de epics no momento do snapshot';
