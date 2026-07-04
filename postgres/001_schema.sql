-- ================================================================
-- COPASTUR C-LEVEL AI COMMAND CENTER
-- Schema Completo v2.0 — Todas as Integrações
-- PostgreSQL 15+
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- CORE: USUÁRIOS E AUTENTICAÇÃO
-- ================================================================

CREATE TABLE roles (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(50) UNIQUE NOT NULL,
  label  VARCHAR(100) NOT NULL,
  level  SMALLINT DEFAULT 2
);

INSERT INTO roles (name, label, level) VALUES
  ('ceo',   'Chief Executive Officer',       1),
  ('cto',   'Chief Technology Officer',      2),
  ('cfo',   'Chief Financial Officer',       2),
  ('coo',   'Chief Operating Officer',       2),
  ('cpto',  'Chief Product & Tech Officer',  2),
  ('cio',   'Chief Information Officer',     2),
  ('board', 'Board Member',                  1),
  ('admin', 'Platform Administrator',        1);

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  full_name        VARCHAR(255) NOT NULL,
  role_id          INTEGER REFERENCES roles(id),
  avatar_initials  VARCHAR(3),
  azure_oid        VARCHAR(255) UNIQUE,  -- Microsoft Entra ID object ID
  is_active        BOOLEAN DEFAULT TRUE,
  last_login_at    TIMESTAMPTZ,
  preferences      JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id),
  action       VARCHAR(100) NOT NULL,
  entity_type  VARCHAR(100),
  entity_id    TEXT,
  metadata     JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user    ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ================================================================
-- 7 EXPECTATIVAS COPASTUR
-- ================================================================

CREATE TABLE expectativas (
  id          SERIAL PRIMARY KEY,
  numero      SMALLINT UNIQUE NOT NULL,
  titulo      VARCHAR(200) NOT NULL,
  descricao   TEXT NOT NULL,
  criterio    TEXT,
  prompt_base TEXT NOT NULL,
  ordem       SMALLINT DEFAULT 0
);

INSERT INTO expectativas (numero, titulo, descricao, criterio, prompt_base) VALUES
(1,'Visão Sistêmica + Execução Impecável','Enxergar o todo enquanto entrega o detalhe. Decisões que conectam estratégia e operação sem lacunas de execução.','Pré-requisito para todas as demais expectativas.','Como avalio e melhoro minha visão sistêmica e execução impecável como C-Level da Copastur?'),
(2,'Comportamento de Sócio','"Se isso fosse 100% do meu patrimônio, eu faria assim?" — critério permanente de avaliação de risco, recurso e prioridade.','Pergunta permanente antes de qualquer decisão relevante.','Se isso fosse 100% do meu patrimônio, eu faria assim? Como aplico o critério de sócio nas decisões da Copastur?'),
(3,'Liderança que Forma Líderes','O C-Level não é o melhor operador — é o multiplicador. A métrica é o desenvolvimento visível dos líderes que reportam.','A falta de pipeline de liderança é falha direta do C-Level, não do RH.','Como estruturo minha atuação para formar líderes de segunda e terceira linha na Copastur?'),
(4,'Dados acima de Opiniões, com Sensibilidade Humana','Dados como ponto de partida obrigatório. Sensibilidade humana como filtro de contexto. Jamais o contrário.','Opiniões sem dados são hipóteses. Dados sem sensibilidade são armadilhas.','Como equilibrar rigor de dados com leitura humana de contexto nas decisões da Copastur?'),
(5,'Guardiões da Cultura','"Cultura não é slide, é decisão difícil tomada corretamente." O C-Level guarda a cultura quando o custo de guardá-la é alto.','Critério central na reengenharia cultural atual. Não há negociação sobre isso.','Como tomo decisões difíceis que reforçam cultura na Copastur?'),
(6,'Inquietação Positiva e Visão de Futuro','Inconformismo produtivo com o status quo. Olhar para o futuro com antecipação, não ansiedade. Gerar movimento, não ruído.','Inquietação sem proposta é reclamação. A expectativa é de movimento com direção.','Como mantenho inquietação positiva e visão de futuro no contexto de pressão e incerteza da Copastur?'),
(7,'Alinhamento Radical com o CEO','Conselho ativo + braço executor. Divergir em privado, executar com comprometimento público. Alinhamento radical não é concordância cega.','Pré-requisito de todas as outras expectativas. Sem alinhamento com o CEO, tudo se fragmenta.','Como opero como conselho ativo e braço executor do CEO da Copastur de forma efetiva?');

-- ================================================================
-- AI COMMAND CENTER: CONVERSAS
-- ================================================================

CREATE TABLE conversations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(500),
  domain       VARCHAR(100),
  expectativas SMALLINT[],
  token_count  INTEGER DEFAULT 0,
  is_archived  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conv_user    ON conversations(user_id);
CREATE INDEX idx_conv_updated ON conversations(updated_at DESC);

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
  content          TEXT NOT NULL,
  parsed_response  JSONB,
  expectativas     SMALLINT[],
  tokens_used      INTEGER DEFAULT 0,
  model            VARCHAR(100) DEFAULT 'claude-sonnet-4-6',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_msg_conv    ON messages(conversation_id);
CREATE INDEX idx_msg_created ON messages(created_at);

-- ================================================================
-- GESTÃO EXECUTIVA: DECISÕES, RISCOS, INICIATIVAS
-- ================================================================

CREATE TABLE decisions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id),
  conversation_id  UUID REFERENCES conversations(id),
  titulo           VARCHAR(500) NOT NULL,
  descricao        TEXT,
  status           VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  prioridade       VARCHAR(20) DEFAULT 'media' CHECK (prioridade IN ('critica','alta','media','baixa')),
  responsavel      VARCHAR(255),
  prazo            DATE,
  expectativa_id   INTEGER REFERENCES expectativas(id),
  requires_human_approval BOOLEAN DEFAULT TRUE,
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dec_user   ON decisions(user_id);
CREATE INDEX idx_dec_status ON decisions(status);

CREATE TABLE riscos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id),
  area             VARCHAR(200) NOT NULL,
  nivel            VARCHAR(20) DEFAULT 'medio' CHECK (nivel IN ('critico','alto','medio','baixo')),
  descricao        TEXT NOT NULL,
  mitigacao        TEXT,
  status           VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo','monitorando','mitigado','aceito')),
  expectativa_id   INTEGER REFERENCES expectativas(id),
  origem           VARCHAR(50) DEFAULT 'manual',  -- manual, azure_devops, freshservice, ai_gerado
  origem_ref       VARCHAR(255),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_risk_user  ON riscos(user_id);
CREATE INDEX idx_risk_nivel ON riscos(nivel);

CREATE TABLE iniciativas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id),
  titulo       VARCHAR(500) NOT NULL,
  descricao    TEXT,
  domain       VARCHAR(100),
  workstream   VARCHAR(100),  -- AI-First, SmartHotel, SmartSaving, Smart-Integration, CMais, Zuri
  status       VARCHAR(50) DEFAULT 'planejamento',
  prioridade   VARCHAR(20) DEFAULT 'media',
  progresso    SMALLINT DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  owner        VARCHAR(255),
  prazo        DATE,
  expectativas SMALLINT[],
  ado_epic_id  VARCHAR(100),  -- link Azure DevOps Epic
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INTEGRAÇÃO: MICROSOFT GRAPH (Calendar + Email)
-- ================================================================

CREATE TABLE graph_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  scopes          TEXT[],
  tenant_id       VARCHAR(100) DEFAULT '5ffc8daf-9a54-46be-9c74-c98d30a2a81a',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_graph_token_user ON graph_tokens(user_id);

CREATE TABLE calendar_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id),
  ms_event_id      VARCHAR(500) UNIQUE,
  subject          VARCHAR(1000),
  start_dt         TIMESTAMPTZ,
  end_dt           TIMESTAMPTZ,
  organizer_email  VARCHAR(255),
  attendees        JSONB DEFAULT '[]',
  is_online        BOOLEAN DEFAULT FALSE,
  join_url         TEXT,
  body_preview     TEXT,
  importance       VARCHAR(20) DEFAULT 'normal',
  synced_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cal_user     ON calendar_events(user_id);
CREATE INDEX idx_cal_start    ON calendar_events(start_dt);
CREATE INDEX idx_cal_ms_event ON calendar_events(ms_event_id);

CREATE TABLE email_digest (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID REFERENCES users(id),
  ms_message_id    VARCHAR(500) UNIQUE,
  subject          VARCHAR(1000),
  from_email       VARCHAR(255),
  from_name        VARCHAR(255),
  received_at      TIMESTAMPTZ,
  body_preview     TEXT,
  importance       VARCHAR(20) DEFAULT 'normal',
  is_read          BOOLEAN DEFAULT FALSE,
  has_attachments  BOOLEAN DEFAULT FALSE,
  categories       TEXT[],
  ai_priority      VARCHAR(20),   -- ai-classified
  ai_summary       TEXT,
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_user     ON email_digest(user_id);
CREATE INDEX idx_email_received ON email_digest(received_at DESC);

-- ================================================================
-- INTEGRAÇÃO: AZURE DEVOPS
-- ================================================================

CREATE TABLE ado_work_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ado_id           INTEGER NOT NULL,
  project          VARCHAR(255) NOT NULL,
  work_item_type   VARCHAR(100),  -- Epic, Feature, User Story, Task, Bug
  title            VARCHAR(1000),
  state            VARCHAR(100),
  assigned_to      VARCHAR(255),
  iteration_path   VARCHAR(500),  -- Q2-2026\Ai-First etc
  area_path        VARCHAR(500),
  tags             TEXT[],
  priority         INTEGER,
  story_points     NUMERIC(5,1),
  parent_id        INTEGER,
  created_date     TIMESTAMPTZ,
  changed_date     TIMESTAMPTZ,
  closed_date      TIMESTAMPTZ,
  workstream       VARCHAR(100),   -- AI-First, SmartHotel, SmartSaving, etc
  raw_data         JSONB,
  synced_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ado_id, project)
);
CREATE INDEX idx_ado_project    ON ado_work_items(project);
CREATE INDEX idx_ado_type       ON ado_work_items(work_item_type);
CREATE INDEX idx_ado_state      ON ado_work_items(state);
CREATE INDEX idx_ado_iteration  ON ado_work_items(iteration_path);
CREATE INDEX idx_ado_workstream ON ado_work_items(workstream);
CREATE INDEX idx_ado_tags       ON ado_work_items USING GIN(tags);

CREATE TABLE ado_sync_log (
  id          BIGSERIAL PRIMARY KEY,
  project     VARCHAR(255),
  items_synced INTEGER DEFAULT 0,
  items_total  INTEGER DEFAULT 0,
  status      VARCHAR(50) DEFAULT 'running',
  error_msg   TEXT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- ================================================================
-- INTEGRAÇÃO: FRESHSERVICE
-- ================================================================

CREATE TABLE fs_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fs_id           INTEGER UNIQUE NOT NULL,
  subject         VARCHAR(1000),
  description     TEXT,
  status          VARCHAR(50),   -- open, pending, resolved, closed
  priority        VARCHAR(20),   -- urgent, high, medium, low
  type            VARCHAR(100),
  requester_email VARCHAR(255),
  requester_name  VARCHAR(255),
  agent_email     VARCHAR(255),
  group_name      VARCHAR(255),
  category        VARCHAR(255),
  subcategory     VARCHAR(255),
  tags            TEXT[],
  created_at_fs   TIMESTAMPTZ,
  updated_at_fs   TIMESTAMPTZ,
  due_by          TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  ai_priority     VARCHAR(20),
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fs_status   ON fs_tickets(status);
CREATE INDEX idx_fs_priority ON fs_tickets(priority);
CREATE INDEX idx_fs_created  ON fs_tickets(created_at_fs DESC);

-- ================================================================
-- INTEGRAÇÃO: WORK/PLANE (TI Boards)
-- ================================================================

CREATE TABLE work_projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plane_id        VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(500),
  identifier      VARCHAR(50),
  description     TEXT,
  network         VARCHAR(20),
  total_issues    INTEGER DEFAULT 0,
  is_ti_board     BOOLEAN DEFAULT FALSE,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_issues (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plane_id         VARCHAR(100) UNIQUE NOT NULL,
  project_plane_id VARCHAR(100) REFERENCES work_projects(plane_id),
  sequence_id      INTEGER,
  title            VARCHAR(2000),
  description      TEXT,
  state            VARCHAR(100),
  state_group      VARCHAR(50),  -- backlog, unstarted, started, completed, cancelled
  priority         VARCHAR(20),  -- urgent, high, medium, low, none
  assignee_ids     TEXT[],
  label_ids        TEXT[],
  due_date         DATE,
  start_date       DATE,
  estimate         INTEGER,      -- points
  created_at_plane TIMESTAMPTZ,
  updated_at_plane TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  cycle_id         VARCHAR(100),
  module_id        VARCHAR(100),
  parent_id        VARCHAR(100),
  raw_data         JSONB,
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_work_project  ON work_issues(project_plane_id);
CREATE INDEX idx_work_state    ON work_issues(state);
CREATE INDEX idx_work_priority ON work_issues(priority);

-- ================================================================
-- INTEGRAÇÃO: SMARTLEADER / OKRs
-- ================================================================

CREATE TABLE okr_objectives (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sl_id         VARCHAR(100) UNIQUE,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  owner         VARCHAR(255),
  cycle         VARCHAR(100),   -- Q1-2026, Q2-2026, Q3-2026
  status        VARCHAR(50),
  progress      NUMERIC(5,2) DEFAULT 0,
  target_value  NUMERIC(10,2),
  current_value NUMERIC(10,2),
  expectativa_id INTEGER REFERENCES expectativas(id),
  raw_data      JSONB,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_okr_cycle  ON okr_objectives(cycle);
CREATE INDEX idx_okr_owner  ON okr_objectives(owner);

CREATE TABLE okr_key_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id    UUID REFERENCES okr_objectives(id) ON DELETE CASCADE,
  sl_id           VARCHAR(100) UNIQUE,
  title           VARCHAR(500) NOT NULL,
  metric_unit     VARCHAR(50),
  baseline        NUMERIC(10,2),
  target          NUMERIC(10,2),
  current_value   NUMERIC(10,2),
  progress        NUMERIC(5,2) DEFAULT 0,
  owner           VARCHAR(255),
  status          VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- BRIEFINGS EXECUTIVOS (AI-GENERATED)
-- ================================================================

CREATE TABLE executive_briefings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  briefing_date   DATE NOT NULL,
  briefing_type   VARCHAR(50) DEFAULT 'daily',  -- daily, weekly, ad_hoc
  content         JSONB NOT NULL,
  model_used      VARCHAR(100),
  tokens_used     INTEGER DEFAULT 0,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_briefing_user ON executive_briefings(user_id);
CREATE INDEX idx_briefing_date ON executive_briefings(briefing_date DESC);

-- ================================================================
-- SYNC STATUS (integrations health)
-- ================================================================

CREATE TABLE integration_sync (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration   VARCHAR(50) NOT NULL,  -- azure_devops, microsoft_graph, freshservice, work_plane, smartleader
  status        VARCHAR(50) DEFAULT 'idle',  -- idle, running, success, error
  last_sync_at  TIMESTAMPTZ,
  next_sync_at  TIMESTAMPTZ,
  items_synced  INTEGER DEFAULT 0,
  error_msg     TEXT,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO integration_sync (integration, status) VALUES
  ('azure_devops',     'idle'),
  ('microsoft_graph',  'idle'),
  ('freshservice',     'idle'),
  ('work_plane',       'idle'),
  ('smartleader',      'idle');

-- ================================================================
-- TRIGGERS
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd         BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conv_upd          BEFORE UPDATE ON conversations  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dec_upd           BEFORE UPDATE ON decisions       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_risk_upd          BEFORE UPDATE ON riscos          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inic_upd          BEFORE UPDATE ON iniciativas     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_graph_token_upd   BEFORE UPDATE ON graph_tokens    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_int_sync_upd      BEFORE UPDATE ON integration_sync FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- SEED USERS
-- password: Copastur@2025
-- ================================================================

INSERT INTO users (email, password_hash, full_name, role_id, avatar_initials) VALUES
  ('admin@copastur.com.br', crypt('Copastur@2025', gen_salt('bf',12)), 'Administrador Copastur', (SELECT id FROM roles WHERE name='admin'), 'ADM'),
  ('ceo@copastur.com.br',   crypt('Copastur@2025', gen_salt('bf',12)), 'CEO Copastur',           (SELECT id FROM roles WHERE name='ceo'),   'CEO'),
  ('joao.fornari@copastur.com.br', crypt('Copastur@2025', gen_salt('bf',12)), 'João Fornari Jr', (SELECT id FROM roles WHERE name='cpto'),  'JFJ');
