# CLAUDE.md — Copastur C-Level AI Command Center v3.0
> **Arquivo de contexto permanente para Claude Code.**
> Leia este arquivo integralmente antes de qualquer ação no repositório.
> Versão unificada: estrutura atual v2.0 + PRD novo = plataforma v3.0

---

## 0. PROCESSO OBRIGATÓRIO PARA CLAUDE CODE

```
1. Ler este arquivo (CLAUDE.md) integralmente
2. Ler PRD/00_MASTER_PRD.md
3. Ler AI/ApplicationValidationAndAdjustment.md
4. Inspecionar o repositório e gerar inventário (docs/current-application-inventory.md)
5. Identificar gaps entre código e PRD (docs/compliance-gap-analysis.md)
6. Propor plano de alterações ANTES de modificar qualquer arquivo
7. Implementar em commits lógicos incrementais
8. Executar testes, lint, migrations e smoke tests após cada etapa
9. Atualizar documentação e changelog
```

**Proibido sem aprovação explícita:**
- Reescrever a aplicação inteira do zero
- Criar segundo backend ou banco paralelo
- Renomear variáveis de API key
- Exibir valores de segredos em qualquer output
- Expor chaves no frontend
- Desabilitar validações para fazer testes passarem
- Adicionar write op de integração sem `requires_human_approval`

---

## 1. Identidade do Projeto

```
Nome:         Copastur C-Level AI Command Center
Versão alvo:  3.0 (unificação v2.0 atual + PRD novo)
Owner:        João Fornari Jr — CPTO, Grupo Copastur
Repositório:  https://github.com/Jrfornari18/commandCenter
Domínio prod: https://commandcenter.copastur.com.br
```

**Proposta de valor:** Transformar dados fragmentados de múltiplos sistemas em uma
agenda executiva priorizada (P0→P3), explicável (fatos + inferências + recomendação)
e acionável — avaliada contra as 7 Expectativas de C-Level Copastur como critério
permanente de governança.

---

## 2. Stack Alvo (v3.0)

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | React + TypeScript + Vite | 18 / strict / 5.x |
| **Estilo** | Tailwind CSS | 3.x |
| **Backend** | Python + FastAPI + Pydantic v2 | 3.12+ / 0.115+ |
| **ORM** | SQLAlchemy 2.x async + asyncpg | 2.x |
| **Migrations** | Alembic | latest |
| **Banco** | PostgreSQL | 15/16 |
| **Cache/Queue** | Redis 7 | 7.x |
| **Workers** | Celery 5 + Beat | 5.x |
| **IA** | CrewAI + Claude Sonnet 4.6 | latest |
| **Auth** | Microsoft Entra ID + JWT | MSAL |
| **Container** | Docker + Docker Compose | 3.9 |
| **Proxy** | Nginx (dev) / Caddy (prod) | alpine |

**Nota de migração:** O backend Node.js/Express atual (v2.0) deve ser substituído
pelo FastAPI Python — que já existe como Fase 2 (`c-level-ai-command-center-fase2.zip`).
Reutilizar a Fase 2 como base em vez de reescrever do zero.

---

## 3. Estrutura Completa do Repositório (v3.0 alvo)

```
commandCenter/
│
├── CLAUDE.md                          ← ESTE ARQUIVO (contexto Claude Code)
├── README.md                          ← documentação geral
├── CHANGELOG.md                       ← histórico de versões
├── docker-compose.yml                 ← dev: api, worker, postgres, redis, frontend
├── docker-compose.prod.yml            ← prod: + caddy, sem pgadmin
├── .env.example                       ← template sem secrets
├── .gitignore
├── Makefile                           ← comandos convenientes
│
├── PRD/                               ← fonte de verdade do produto
│   ├── 00_MASTER_PRD.md
│   ├── 01_PRODUCT/
│   │   ├── Vision.md
│   │   ├── Personas.md
│   │   ├── BusinessRules.md
│   │   ├── FunctionalRequirements.md
│   │   └── NonFunctionalRequirements.md
│   ├── 02_UX/
│   │   ├── DesignSystem.md
│   │   ├── Dashboard.md               ← Executive Home
│   │   ├── SmartInbox.md
│   │   ├── Meetings.md
│   │   ├── OKRs.md
│   │   ├── Delivery.md
│   │   ├── Support.md
│   │   ├── Managers.md
│   │   ├── Approvals.md
│   │   ├── WeeklyPlanning.md
│   │   └── Settings.md
│   ├── 03_BACKEND/
│   │   ├── Architecture.md
│   │   ├── Database.md
│   │   ├── DomainModel.md
│   │   ├── Services.md
│   │   ├── Workers.md
│   │   ├── Authentication.md
│   │   └── Docker.md
│   ├── 04_API/
│   │   ├── REST.md
│   │   ├── DashboardAPI.md
│   │   ├── CrewAPI.md
│   │   ├── Integrations.md
│   │   └── OpenAPI.md
│   ├── 05_AI/
│   │   ├── CrewArchitecture.md
│   │   ├── Agents.md
│   │   ├── Tasks.md
│   │   ├── Memory.md
│   │   ├── PromptLibrary.md
│   │   ├── Governance.md
│   │   └── Evaluation.md
│   ├── 06_INFRA/
│   │   ├── Docker.md
│   │   ├── Kubernetes.md              ← fase futura
│   │   ├── Terraform.md               ← fase futura
│   │   ├── Observability.md
│   │   └── Security.md
│   └── 07_EXECUTION/
│       ├── Backlog.md
│       ├── Roadmap.md
│       ├── Sprint01.md                ← Baseline + validação
│       ├── Sprint02.md                ← Daily Briefing Crew
│       ├── Sprint03.md                ← Frontend integrado
│       └── Sprint04.md                ← Expansão (Weekly, Risk, Approvals)
│
├── AI/                                ← instruções para ferramentas de IA
│   ├── Claude.md                      ← instruções específicas Claude Code
│   ├── ApplicationValidationAndAdjustment.md
│   ├── DeveloperRules.md
│   ├── ArchitectureRules.md
│   ├── CodingStandards.md
│   ├── PromptRules.md
│   ├── Cursor.md
│   ├── Lovable.md
│   ├── CrewAI.md
│   └── Copilot.md
│
├── COMMANDS/                          ← comandos prontos por fase
│   ├── 01_validate_current_application.md
│   ├── 02_implement_backend_and_data.md
│   ├── 03_implement_daily_briefing_crew.md
│   ├── 04_integrate_web_interface.md
│   └── 05_run_final_validation.md
│
├── backend/                           ← Python 3.12 + FastAPI
│   ├── Dockerfile
│   ├── pyproject.toml                 ← ou requirements.txt
│   ├── alembic.ini
│   ├── .env.example
│   └── app/
│       ├── main.py                    ← FastAPI app + lifespan
│       ├── core/
│       │   ├── config.py              ← Settings via pydantic-settings
│       │   ├── security.py            ← JWT, bcrypt
│       │   ├── logging.py             ← structlog JSON + correlation_id
│       │   └── exceptions.py          ← handlers globais
│       │
│       ├── db/
│       │   ├── engine.py              ← async engine + session factory
│       │   ├── base.py                ← Base declarativa
│       │   └── migrations/            ← Alembic versions
│       │
│       ├── models/                    ← SQLAlchemy models
│       │   ├── user.py
│       │   ├── source_item.py         ← normalização de todas as fontes
│       │   ├── executive_task.py      ← tarefas P0-P3 com racional
│       │   ├── priority_score.py      ← classificações por item
│       │   ├── briefing.py            ← snapshots diário/semanal
│       │   ├── approval_request.py    ← entidade de aprovação
│       │   ├── ai_run.py              ← execuções de LLM
│       │   ├── crew_run.py            ← execuções CrewAI
│       │   ├── ai_prompt_version.py   ← biblioteca de prompts versionados
│       │   ├── audit_log.py
│       │   ├── meeting.py             ← calendar events
│       │   ├── okr.py                 ← objectives + key_results
│       │   ├── work_item.py           ← ADO work items
│       │   ├── support_ticket.py      ← Freshservice tickets
│       │   ├── initiative.py          ← Work/Plane issues
│       │   ├── conversation.py        ← Strategic Chat (manter)
│       │   ├── expectativa.py         ← 7 Expectativas Copastur (manter)
│       │   └── integration_sync.py
│       │
│       ├── schemas/                   ← Pydantic v2
│       │   ├── user.py
│       │   ├── source_item.py
│       │   ├── executive_task.py
│       │   ├── briefing.py
│       │   ├── approval.py
│       │   ├── dashboard.py           ← response schemas por tela
│       │   ├── crew.py
│       │   └── common.py              ← PaginatedResponse, ErrorResponse
│       │
│       ├── repositories/              ← data access layer
│       │   ├── base.py
│       │   ├── user_repo.py
│       │   ├── source_item_repo.py
│       │   ├── executive_task_repo.py
│       │   ├── briefing_repo.py
│       │   ├── approval_repo.py
│       │   ├── ai_run_repo.py
│       │   └── crew_run_repo.py
│       │
│       ├── services/                  ← business logic (sem acesso direto a IA)
│       │   ├── priority_service.py    ← classificação P0-P3
│       │   ├── risk_service.py        ← classificação low/medium/high/critical
│       │   ├── briefing_service.py    ← montagem de snapshots
│       │   ├── planning_service.py    ← planejamento semanal
│       │   ├── dashboard_service.py   ← agregação por tela
│       │   ├── ai_service.py          ← abstração multi-provider (OpenAI/Azure/Claude/mock)
│       │   ├── crew_execution_service.py
│       │   ├── audit_service.py       ← before/after logging
│       │   ├── approval_service.py    ← human-in-the-loop
│       │   └── integration_sync_service.py
│       │
│       ├── agents/                    ← CrewAI agents
│       │   ├── executive_orchestrator.py
│       │   ├── email_intelligence.py
│       │   ├── meeting_intelligence.py
│       │   ├── okr_strategy.py
│       │   ├── delivery_intelligence.py
│       │   ├── support_intelligence.py
│       │   ├── approval_budget.py
│       │   └── manager_control.py
│       │
│       ├── crews/                     ← CrewAI crews
│       │   ├── daily_briefing_crew.py
│       │   ├── weekly_planning_crew.py
│       │   ├── risk_review_crew.py
│       │   └── smart_inbox_crew.py
│       │
│       ├── tools/                     ← tools para agentes (sem acesso ad hoc ao banco)
│       │   ├── read_emails.py
│       │   ├── read_calendar.py
│       │   ├── read_okrs.py
│       │   ├── read_work_items.py
│       │   ├── read_tickets.py
│       │   ├── read_approvals.py
│       │   ├── read_meetings.py
│       │   └── create_executive_task.py
│       │
│       ├── integrations/              ← adapters isolados (sem regra de negócio)
│       │   ├── microsoft_graph/
│       │   │   └── client.py          ← Calendar + Email (tenant 5ffc8daf)
│       │   ├── azure_devops/
│       │   │   └── client.py          ← org copastur-dev, 186 proj, WIQL
│       │   ├── freshservice/
│       │   │   └── client.py          ← copastur.freshservice.com
│       │   ├── work_plane/
│       │   │   └── client.py          ← 4 TI Boards confirmados
│       │   └── smartleader/
│       │       └── client.py          ← OKRs
│       │
│       ├── workers/                   ← Celery tasks
│       │   ├── celery_app.py
│       │   ├── daily_briefing_job.py
│       │   ├── weekly_planning_job.py
│       │   ├── risk_review_job.py
│       │   ├── smart_inbox_job.py
│       │   └── sync_integrations_job.py
│       │
│       ├── api/
│       │   └── v1/
│       │       ├── router.py          ← inclui todos os sub-routers
│       │       └── endpoints/
│       │           ├── auth.py        ← /auth/login, /auth/me, /auth/logout
│       │           ├── dashboard.py   ← /dashboard/home|inbox|meetings|okrs|...
│       │           ├── crews.py       ← /crews/daily-briefing|weekly-planning|...
│       │           ├── agents.py      ← /agents/email|meeting|okr|...
│       │           ├── approvals.py   ← /approvals/{id}/decision
│       │           ├── chat.py        ← /chat/conversations (Strategic Chat)
│       │           ├── expectativas.py← /expectativas (7 Expectativas)
│       │           ├── integrations.py← /integrations/status|sync
│       │           └── users.py       ← /users (admin)
│       │
│       ├── auth/
│       │   ├── entra_auth.py          ← MSAL OAuth PKCE
│       │   ├── token_store.py         ← Redis token storage
│       │   ├── dependencies.py        ← FastAPI Depends: CurrentUser, RoleGuard
│       │   └── graph_client.py        ← Microsoft Graph client
│       │
│       └── prompts/
│           └── crewai/
│               └── v1/               ← prompts versionados com metadados
│                   ├── daily_briefing.py
│                   ├── weekly_planning.py
│                   ├── email_intelligence.py
│                   ├── meeting_intelligence.py
│                   ├── okr_strategy.py
│                   ├── delivery_intelligence.py
│                   ├── support_intelligence.py
│                   ├── approval_budget.py
│                   └── executive_orchestrator.py
│
├── frontend/                          ← React 18 + TypeScript + Vite + Tailwind
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx                   ← entry point
│       ├── App.tsx                    ← router + providers
│       │
│       ├── types/                     ← TypeScript types (gerados do OpenAPI ou manuais)
│       │   ├── dashboard.ts
│       │   ├── crew.ts
│       │   ├── approval.ts
│       │   └── common.ts
│       │
│       ├── context/
│       │   ├── AuthContext.tsx
│       │   └── ThemeContext.tsx
│       │
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useDashboard.ts
│       │   ├── useApprovals.ts
│       │   └── useCrewRun.ts
│       │
│       ├── services/
│       │   └── api.ts                 ← Axios + interceptors JWT
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Topbar.tsx
│       │   │   └── AppLayout.tsx
│       │   │
│       │   ├── ui/                    ← Design System (Tailwind)
│       │   │   ├── ExecutiveCard.tsx
│       │   │   ├── PriorityBadge.tsx  ← P0/P1/P2/P3
│       │   │   ├── RiskBadge.tsx      ← low/medium/high/critical
│       │   │   ├── StatusBadge.tsx
│       │   │   ├── DataTable.tsx
│       │   │   ├── FilterBar.tsx
│       │   │   ├── AIInsightPanel.tsx ← fatos + inferências + recomendação
│       │   │   ├── ApprovalDialog.tsx ← confirmação obrigatória
│       │   │   ├── Skeleton.tsx
│       │   │   ├── EmptyState.tsx
│       │   │   └── ErrorState.tsx
│       │   │
│       │   └── shared/
│       │       ├── ExpectativasTag.tsx ← 7 Expectativas badge
│       │       └── SyncAllButton.tsx
│       │
│       └── pages/
│           ├── LoginPage.tsx
│           └── app/
│               ├── ExecutiveHome.tsx      ← Dashboard principal
│               ├── SmartInbox.tsx         ← Email classificado por IA
│               ├── Meetings.tsx           ← Calendar + briefing de reunião
│               ├── OKRs.tsx              ← SmartLeader OKRs
│               ├── Delivery.tsx           ← Azure DevOps workstreams
│               ├── Support.tsx            ← Freshservice tickets
│               ├── Managers.tsx           ← Gestão por gerente (NOVO)
│               ├── Approvals.tsx          ← Aprovações com human-in-the-loop (NOVO)
│               ├── WeeklyPlanning.tsx     ← Planejamento semanal (NOVO)
│               ├── Settings.tsx           ← Configurações (NOVO)
│               ├── StrategicChat.tsx      ← Chat com IA + 7 Expectativas (MANTER)
│               └── Expectativas.tsx       ← 7 Expectativas Copastur (MANTER)
│
├── postgres/
│   ├── 001_schema.sql                 ← schema base (legado v2)
│   └── 002_v3_additions.sql           ← adições v3 (source_items, crew_runs, etc.)
│
└── docs/                              ← gerados pelo Claude Code durante validação
    ├── current-application-inventory.md
    ├── compliance-gap-analysis.md
    ├── api-key-handling-baseline.md
    └── adjustment-report.md
```

---

## 4. Banco de Dados — Schema v3.0

### Tabelas mantidas da v2.0
```sql
roles, users, audit_log
expectativas          -- 7 Expectativas Copastur (diferencial — manter intacto)
conversations         -- Strategic Chat
messages              -- mensagens + parsed_response JSONB
integration_sync      -- health monitor das integrações
graph_tokens, calendar_events, email_digest
okr_objectives, okr_key_results
work_issues, work_projects
```

### Tabelas renomeadas/expandidas
```sql
-- v2: decisions → v3: executive_tasks (expandido com P0-P3, racional, source)
executive_tasks (
  id UUID PK,
  user_id UUID FK users,
  source_item_id UUID FK source_items,   -- origem
  title VARCHAR,
  description TEXT,
  priority VARCHAR CHECK IN ('P0','P1','P2','P3'),
  risk_level VARCHAR CHECK IN ('low','medium','high','critical'),
  rationale TEXT,                        -- racional obrigatório em P0/P1
  facts TEXT,                            -- fatos separados de inferências
  inferences TEXT,
  recommendation TEXT,
  source_type VARCHAR,                   -- email|calendar|ado|freshservice|okr|work
  source_id VARCHAR,
  status VARCHAR,
  owner VARCHAR,
  due_date DATE,
  expectativa_id INTEGER FK expectativas,
  requires_human_approval BOOLEAN DEFAULT TRUE,
  approved_by UUID FK users,
  approved_at TIMESTAMPTZ,
  crew_run_id UUID FK crew_runs,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

-- v2: ado_work_items + fs_tickets → v3: source_items (normalizado)
source_items (
  id UUID PK,
  external_id VARCHAR NOT NULL,          -- ID original no sistema externo
  source_type VARCHAR NOT NULL,          -- ado|freshservice|graph_email|graph_calendar|okr|work_plane
  source_name VARCHAR,                   -- nome legível do sistema
  title VARCHAR,
  description TEXT,
  status VARCHAR,
  priority VARCHAR,
  risk_level VARCHAR,
  due_date TIMESTAMPTZ,
  assignee VARCHAR,
  metadata JSONB,                        -- dados extras por fonte
  ai_priority VARCHAR,                   -- P0/P1/P2/P3 classificado pela IA
  ai_summary TEXT,
  synced_at TIMESTAMPTZ,
  UNIQUE (external_id, source_type)
)
```

### Tabelas novas (v3.0)
```sql
-- Execuções de LLM (toda chamada registrada)
ai_runs (
  id UUID PK,
  user_id UUID FK users,
  crew_run_id UUID FK crew_runs,
  prompt_key VARCHAR,
  prompt_version VARCHAR,
  model VARCHAR,
  provider VARCHAR,
  input_tokens INTEGER,
  output_tokens INTEGER,
  latency_ms INTEGER,
  input_hash VARCHAR,                    -- hash do input (sem conteúdo sensível)
  output_summary TEXT,
  cost_usd NUMERIC(10,6),
  correlation_id VARCHAR,
  created_at TIMESTAMPTZ
)

-- Execuções CrewAI (grupo de ai_runs)
crew_runs (
  id UUID PK,
  user_id UUID FK users,
  crew_name VARCHAR,                     -- daily_briefing|weekly_planning|risk_review|smart_inbox
  status VARCHAR,                        -- running|success|failed|partial
  trigger VARCHAR,                       -- scheduled|manual|webhook
  correlation_id VARCHAR UNIQUE,
  input_summary TEXT,
  output_summary TEXT,
  items_processed INTEGER,
  items_created INTEGER,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_msg TEXT,
  created_at TIMESTAMPTZ
)

-- Snapshots de briefing (para dashboard ler sem disparar IA)
briefing_snapshots (
  id UUID PK,
  user_id UUID FK users,
  crew_run_id UUID FK crew_runs,
  snapshot_date DATE NOT NULL,
  snapshot_type VARCHAR,                 -- daily|weekly
  top_items JSONB,                       -- Top 5/10 prioridades
  risk_radar JSONB,                      -- riscos identificados
  recommendations JSONB,                 -- recomendações com fatos/inferências
  meetings_summary JSONB,
  okr_health JSONB,
  raw_output JSONB,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ
)

-- Solicitações de aprovação (entidade de domínio)
approval_requests (
  id UUID PK,
  user_id UUID FK users,
  requester VARCHAR,
  title VARCHAR NOT NULL,
  description TEXT,
  type VARCHAR,                          -- budget|contract|authorization|email|ado_update
  amount NUMERIC,
  currency VARCHAR DEFAULT 'BRL',
  risk_level VARCHAR,
  ai_analysis TEXT,                      -- análise da IA
  ai_recommendation VARCHAR,             -- approve|reject|defer
  rationale TEXT,
  status VARCHAR DEFAULT 'pending',      -- pending|approved|rejected|deferred
  decided_by UUID FK users,
  decided_at TIMESTAMPTZ,
  source_type VARCHAR,
  source_id VARCHAR,
  crew_run_id UUID FK crew_runs,
  requires_human_approval BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

-- Versões de prompts (biblioteca versionada)
ai_prompt_versions (
  id UUID PK,
  prompt_key VARCHAR NOT NULL,
  version VARCHAR NOT NULL,
  content TEXT NOT NULL,
  owner VARCHAR,
  approved_at TIMESTAMPTZ,
  schema_version VARCHAR,
  changelog TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  UNIQUE (prompt_key, version)
)

-- Priority scores por item
priority_scores (
  id UUID PK,
  source_item_id UUID FK source_items,
  executive_task_id UUID FK executive_tasks,
  priority VARCHAR,                      -- P0/P1/P2/P3
  risk_level VARCHAR,
  score NUMERIC(5,2),
  factors JSONB,                         -- fatores que determinaram a prioridade
  model VARCHAR,
  crew_run_id UUID FK crew_runs,
  created_at TIMESTAMPTZ
)
```

### Convenções SQL (v3.0)
```
- UUID PK via uuid_generate_v4()
- Timestamps UTC
- JSONB apenas para payloads variáveis (não para dados estruturados)
- correlation_id em toda execução de IA
- Indexes em: external_id, source_type, status, priority, risk_level, due_date, created_at
- Migrations via Alembic (versionadas)
- Triggers de updated_at em todas as tabelas mutáveis
- Dados sensíveis (tokens, keys) NUNCA em JSONB de log
```

---

## 5. APIs — Referência Completa v3.0

**Base path:** `/api/v1`
**Formato de erro:**
```json
{
  "code": "PRIORITY_NOT_FOUND",
  "message": "Executive task not found",
  "details": {},
  "correlation_id": "uuid"
}
```

### Auth
```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password
GET    /api/v1/auth/microsoft/login    ← Entra ID OAuth URL
GET    /api/v1/auth/microsoft/callback ← OAuth callback
```

### Dashboard (snapshots — sem disparar IA)
```
GET    /api/v1/dashboard/home          ← briefing + Top5 + Risk Radar + reuniões
GET    /api/v1/dashboard/inbox         ← emails classificados
GET    /api/v1/dashboard/meetings      ← reuniões com contexto
GET    /api/v1/dashboard/okrs          ← saúde de OKRs
GET    /api/v1/dashboard/delivery      ← work items, atrasos, bloqueios
GET    /api/v1/dashboard/support       ← tickets críticos, SLA
GET    /api/v1/dashboard/managers      ← pendências por gerente
GET    /api/v1/dashboard/approvals     ← aprovações pendentes
GET    /api/v1/dashboard/weekly-planning ← planejamento semanal
GET    /api/v1/dashboard/risks         ← radar de riscos
```

### Crews (disparam execução de IA)
```
POST   /api/v1/crews/daily-briefing/run     { idempotency_key }
POST   /api/v1/crews/weekly-planning/run    { idempotency_key }
POST   /api/v1/crews/risk-review/run        { idempotency_key }
POST   /api/v1/crews/smart-inbox/run        { idempotency_key }
GET    /api/v1/crews/runs/{id}              ← status + resultado
GET    /api/v1/crews/runs                   ← histórico paginado
```

### Agents (análises pontuais on-demand)
```
POST   /api/v1/agents/email/draft-reply     { email_id, context }
POST   /api/v1/agents/meeting/briefing      { meeting_id }
POST   /api/v1/agents/meeting/summary       { meeting_id, notes }
POST   /api/v1/agents/okr/analyze           { okr_id }
POST   /api/v1/agents/delivery/analyze      { work_item_id }
POST   /api/v1/agents/support/analyze       { ticket_id }
POST   /api/v1/agents/approval/analyze      { approval_id }
```

### Aprovações (human-in-the-loop obrigatório)
```
GET    /api/v1/approvals                    ← lista paginada
GET    /api/v1/approvals/{id}
POST   /api/v1/approvals/{id}/decision      { action: approve|reject|defer, comment }
```

### Chat Executivo (Strategic Chat — manter da v2)
```
GET    /api/v1/chat/conversations
POST   /api/v1/chat/conversations
GET    /api/v1/chat/conversations/{id}/messages
POST   /api/v1/chat/conversations/{id}/messages   { content }
DELETE /api/v1/chat/conversations/{id}
```

### 7 Expectativas (diferencial Copastur — manter)
```
GET    /api/v1/expectativas
GET    /api/v1/expectativas/{id}
POST   /api/v1/expectativas/{id}/analyze    { context } → dispara análise IA
```

### Integrações
```
GET    /api/v1/integrations/status
POST   /api/v1/integrations/sync            { integration?: all|ado|graph|fs|work|okr }
GET    /api/v1/integrations/microsoft/auth-url
GET    /api/v1/integrations/ado/workstreams
GET    /api/v1/integrations/ado/items
GET    /api/v1/integrations/work/boards
GET    /api/v1/integrations/work/issues
```

### Usuários
```
GET    /api/v1/users                        ← admin/executive only
POST   /api/v1/users
PATCH  /api/v1/users/{id}
GET    /api/v1/users/{id}/audit-log
```

---

## 6. Regras de Negócio — Imutáveis

### 6.1 Classificação de Prioridade
```
P0 — Crise: operação parada, risco jurídico/financeiro grave, cliente crítico
     → Gera ExecutiveTask obrigatoriamente + alerta imediato
P1 — Decisão necessária em até 24h
     → Gera ExecutiveTask + aparece no Top 5 do dashboard
P2 — Importante, planejável ou delegável
P3 — Informativo, sem ação imediata
```

### 6.2 Classificação de Risco
```
critical → requer ação imediata (P0 automático)
high     → requer ação em 24h (candidato a P1)
medium   → monitorar
low      → informativo
```

### 6.3 Human-in-the-Loop — INVIOLÁVEL
```
Toda ação consequencial retorna requires_human_approval: true
NUNCA executa automaticamente:
- Envio de email
- Aprovação/rejeição de orçamento ou contrato
- Alteração em Azure DevOps
- Fechamento/atualização de ticket Freshservice
- Criação de issue no Work/Plane com assignee
- Comunicação com clientes
```

```python
# Padrão obrigatório para toda write op de integração
def create_write_operation(params: dict, approved_by: str) -> dict:
    return {
        "requires_human_approval": True,
        "action": "ado_update_work_item | graph_send_email | fs_close_ticket",
        "payload": params,
        "approved_by": approved_by,
        "message": "Aguardando aprovação humana explícita antes da execução"
    }
```

### 6.4 Governança de IA
```
- Separar sempre: fatos | inferências | recomendação
- Toda recomendação deve ter: source_type + source_id + racional
- Toda execução de IA registrada em ai_runs com: model, provider, tokens, latência, custo
- Toda execução de crew registrada em crew_runs
- Dados sensíveis MASCARADOS em logs e prompts
- P0/P1 exigem racional explícito (não aceitam campo vazio)
- Mudança de prompt exige nova versão + teste de regressão
```

---

## 7. Integrações — Configurações e Quirks

### 7.1 Microsoft Entra ID (Auth)
```
Tenant ID:    5ffc8daf-9a54-46be-9c74-c98d30a2a81a
Tipo:         Single-tenant (apenas @copastur.com.br)
Flow:         OAuth 2.0 Authorization Code + PKCE
Redirect:     https://commandcenter.copastur.com.br/auth/callback
```

### 7.2 Microsoft Graph (Calendar + Email)
```
Base:    https://graph.microsoft.com/v1.0
Auth:    Bearer {access_token} via MSAL
Scopes:  User.Read, Calendars.Read, Mail.Read
Sync:    calendarView (48h ahead) + messages (48h back, top 30)
Write:   requires_human_approval SEMPRE
```

### 7.3 Azure DevOps
```
Org:       copastur-dev (186 projetos)
API:       v7.1
Auth:      Basic Base64(":PAT")
WIQL cap:  1.000 resultados → quebrar por mês
Batch:     work items em lotes de 200
Done:      Resolved, Closed, Tested (Removed excluído)
Grouping:  System.IterationPath (não tags) para workstreams

Workstreams Q2/Q3:
  Q2-2026\Ai-First | SmartHotel | SmartSaving | 8BPay
  Q2-2026\Plataforma CMais Core | PME Fast | Smart Integration | Zuri | Energy

Projeto Energy:  8b54465b-9067-4db6-92a7-3c732d55f2b1
```

### 7.4 Freshservice
```
Domain:    copastur.freshservice.com
Auth:      Basic Base64("API_KEY:X")
Priority:  1=urgent, 2=high, 3=medium, 4=low
Status:    2=open, 3=pending, 4=resolved, 5=closed
Fallback:  mock quando API_KEY ausente
```

### 7.5 Work/Plane (TI Boards)
```
URL:   https://work.cnext.app/api/plane/v1/workspaces/copastur
Auth:  Header X-API-Key  ← NÃO Authorization: Bearer

4 TI Boards (UUIDs confirmados via live API):
  Portfólio de Soluções de TI:  6b3ee0f0-eab1-49d4-a853-ef112b41bdab (573 issues)
  Backlog PMO de TI 2026:       10d50cea-a195-41ee-8648-241ecb2e3101 (306 issues)
  Portfólio PMO de TI 2026:     c327a196-ef24-497c-bd18-a914daa989cb (76 issues)
  Onboarding Técnico TI:        ec5a12bd-db20-4a0f-adf8-63a143a80a75 (1 issue)

Quirks:
  - /projects/ e /issues/ → envelope { results: [] }
  - /members/ → flat list direta (sem envelope)
  - Paginação: next_page_results (bool) + next_cursor (URL-encode antes de usar)
  - per_page max: 100
  - create_issue com assignee não-membro → HTTP 200 mas assignee descartado silenciosamente
    → verificar _assignee_warning na resposta
```

### 7.6 SmartLeader (OKRs)
```
URL:      https://api.smartleader.com.br
Auth:     Bearer token
Ciclo:    Q2-2026 (parâmetro configurável)
Fallback: mock com OKRs realistas quando KEY ausente
```

---

## 8. Agentes e Crews CrewAI

### Crews (execuções programadas e on-demand)
```
daily_briefing_crew     → 07h30 diário
  Fluxo: coleta dados → classifica P0-P3 → identifica riscos
         → cria ExecutiveTasks → persiste briefing_snapshot → atualiza dashboard

weekly_planning_crew    → domingo 22h
  Fluxo: revisa semana → Top 10 → plano por dia → reuniões críticas → delegações

risk_review_crew        → 13h diário
  Fluxo: varredura de riscos emergentes → atualiza risk_radar → alerta P0/P1

smart_inbox_crew        → a cada 30min (horário comercial)
  Fluxo: classifica emails → prioriza → identifica ação requerida do CPTO
```

### Agentes (8 especializados)
```
ExecutiveOrchestrator    → orquestra crews, toma decisão de escalonamento
EmailIntelligence        → classifica emails, rascunha respostas (draft, sem enviar)
MeetingIntelligence      → prepara contexto de reuniões, extrai follow-ups
OKRStrategy              → analisa saúde de OKRs, identifica riscos de meta
DeliveryIntelligence     → analisa work items, atrasos, bloqueios ADO/Work
SupportIntelligence      → analisa tickets Freshservice, SLA, recorrência
ApprovalBudget           → analisa aprovações, classifica risco financeiro/jurídico
ManagerControl           → consolida pendências por gerente, 1:1s, delegações
```

### Tools disponíveis para agentes (sem acesso ad hoc ao banco)
```python
read_emails(hours=48) → List[SourceItem]
read_calendar(hours=48) → List[SourceItem]
read_okrs(cycle="Q2-2026") → List[OKR]
read_work_items(workstream=None, limit=50) → List[WorkItem]
read_tickets(status="open", limit=50) → List[Ticket]
read_approvals(status="pending") → List[Approval]
read_meetings(hours=48) → List[Meeting]
create_executive_task(priority, title, rationale, source) → ExecutiveTask
  # requires_human_approval SEMPRE
```

---

## 9. Design System (Frontend v3.0)

### Componentes obrigatórios
```
ExecutiveCard    → card padrão para itens executivos (prioridade, risco, ação)
PriorityBadge   → P0 (vermelho) / P1 (laranja) / P2 (amarelo) / P3 (cinza)
RiskBadge       → critical (vermelho) / high (laranja) / medium (amarelo) / low (verde)
StatusBadge     → pendente / em_andamento / concluida / cancelada
DataTable       → tabela com sort, filtro, paginação
FilterBar       → filtros persistentes na sessão
AIInsightPanel  → painel de análise: fatos | inferências | recomendação | fonte
ApprovalDialog  → dialog de confirmação com análise de risco visível
Skeleton        → loading state
EmptyState      → estado vazio com CTA
ErrorState      → erro com retry e correlation_id
ExpectativasTag → badge das 7 Expectativas (diferencial Copastur)
```

### Estados obrigatórios em toda tela
```
loading       → Skeleton components
empty         → EmptyState com orientação
populated     → conteúdo real
partial-failure → conteúdo + aviso de dados parciais
permission-denied → mensagem adequada ao perfil
stale-data    → banner de dados desatualizados com timestamp
```

### Regras de interação
```
- Ações críticas (P0, aprovações, envio de email) → ApprovalDialog obrigatório
- Recomendações da IA → sempre mostrar fonte e racional (AIInsightPanel)
- P0 e P1 → visualmente distintos (cor + ícone + badge)
- Filtros → persistir na sessão (sessionStorage)
- Acessibilidade → WCAG 2.1 AA
- Tipagem → TypeScript strict mode
- Componentes → pequenos e focados (máx. 200 linhas)
```

---

## 10. As 7 Expectativas de C-Level — Copastur

> Critério de permanência em 2025. Incorporar em toda análise da IA.
> Diferencial desta plataforma — não presente no PRD padrão.

```
01 — Visão Sistêmica + Execução Impecável
     Pré-requisito para todas as demais.

02 — Comportamento de Sócio
     "Se isso fosse 100% do meu patrimônio, eu faria assim?"

03 — Liderança que Forma Líderes
     C-Level não é o melhor operador — é o multiplicador.

04 — Dados acima de Opiniões, com Sensibilidade Humana
     Dados como ponto de partida obrigatório.

05 — Guardiões da Cultura
     "Cultura não é slide, é decisão difícil tomada corretamente."

06 — Inquietação Positiva e Visão de Futuro
     Inconformismo produtivo com o status quo.

07 — Alinhamento Radical com o CEO
     Conselho ativo + braço executor.
```

**Embedding no sistema:**
- System prompt da IA: sempre presentes como contexto de avaliação
- Toda análise executiva: referenciar quais expectativas se aplicam
- Executive Home: painel de alerta de aderência às expectativas
- ExecutiveTask: campo `expectativa_id` opcional para rastreamento

---

## 11. Workstreams Copastur Q2/Q3 2026

| Workstream | Stakeholder | Status |
|-----------|------------|--------|
| AI-First | João Fornari Jr | Ativo |
| SmartHotel | Virginia/Gustavo Bergamini | At risk |
| SmartSaving | Ernani Torquato | Behind |
| Smart Integration | — | Ativo |
| CMais / C+ | — | Ativo |
| Zuri | — | Ativo |
| 8BPay | — | Planejamento |
| PME Fast | — | Ativo |
| Energy [Forge-SinergIA] | — | Ativo (proj `8b54465b`) |

---

## 12. Perfis e RBAC

| Perfil | Acesso |
|--------|--------|
| `admin` | Tudo + gestão de usuários, configurações, integrações |
| `executive` | Tudo (CEO, CPTO, CFO, CTO, COO, CIO) |
| `manager` | Dashboard + tarefas próprias + OKRs da área |
| `analyst` | Dashboard read-only + preparação de reuniões |
| `auditor` | Read-only em audit_log, ai_runs, crew_runs, decisões |

---

## 13. Observabilidade

```python
# Padrão de log estruturado obrigatório
import structlog
log = structlog.get_logger()

log.info("crew_run_started",
    crew_name="daily_briefing",
    correlation_id=correlation_id,
    user_id=user_id,
    trigger="scheduled"
)

log.error("integration_failed",
    integration="azure_devops",
    correlation_id=correlation_id,
    error=str(e),
    # NUNCA incluir: tokens, API keys, senhas, PII
)
```

**Métricas a monitorar:**
- Latência de endpoints (p95 < 800ms para leituras de snapshot)
- Taxa de erro por integração
- Custo por crew_run (tokens × preço do provider)
- Precisão de prioridade P0/P1 (dataset de avaliação)
- Fila de workers (depth + lag)

---

## 14. Variáveis de Ambiente

```env
# === SERVIDOR ===
PORT=8000
NODE_ENV=production
ENVIRONMENT=production
LOG_LEVEL=info

# === BANCO DE DADOS ===
DATABASE_URL=postgresql+asyncpg://copastur:copastur123@postgres:5432/copastur_clevel

# === REDIS / CELERY ===
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0   # DB 0 — DO Managed Valkey suporta apenas DB 0
CELERY_RESULT_BACKEND=redis://redis:6379/0?key_prefix=result:

# === AI ===
AI_PROVIDER=anthropic                    # openai | azure | anthropic | mock
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...

# === JWT ===
JWT_SECRET=min-64-chars-change-in-production
JWT_EXPIRES_IN=8h

# === MICROSOFT ENTRA ID ===
AZURE_TENANT_ID=5ffc8daf-9a54-46be-9c74-c98d30a2a81a
AZURE_CLIENT_ID=<client-id>
AZURE_CLIENT_SECRET=<revogar-e-regenerar-se-exposto>
AZURE_REDIRECT_URI=https://commandcenter.copastur.com.br/auth/callback
GRAPH_SCOPES=User.Read,Calendars.Read,Mail.Read

# === AZURE DEVOPS ===
ADO_ORG=copastur-dev
ADO_PAT=<pat-com-work-items-read-write>
ADO_SYNC_PROJECTS=Q2-2026,Copastur Energy (Forge-SinergIA)

# === FRESHSERVICE ===
FRESHSERVICE_DOMAIN=copastur.freshservice.com
FRESHSERVICE_API_KEY=<api-key>

# === WORK/PLANE ===
WORK_API_URL=https://work.cnext.app/api/plane/v1/workspaces/copastur
WORK_TOKEN=<token>
WORK_BOARD_PORTFOLIO_TI=6b3ee0f0-eab1-49d4-a853-ef112b41bdab
WORK_BOARD_BACKLOG_PMO=10d50cea-a195-41ee-8648-241ecb2e3101
WORK_BOARD_PORTFOLIO_PMO=c327a196-ef24-497c-bd18-a914daa989cb
WORK_BOARD_ONBOARDING=ec5a12bd-db20-4a0f-adf8-63a143a80a75

# === SMARTLEADER ===
SMARTLEADER_API_URL=https://api.smartleader.com.br
SMARTLEADER_API_KEY=<api-key>

# === CORS ===
CORS_ORIGIN=https://commandcenter.copastur.com.br

# === CRON (Celery Beat) ===
CREW_DAILY_BRIEFING_CRON=30 7 * * 1-5
CREW_RISK_REVIEW_CRON=0 13 * * 1-5
CREW_WEEKLY_PLANNING_CRON=0 22 * * 0
CREW_SMART_INBOX_CRON=*/30 8-18 * * 1-5
SYNC_INTEGRATIONS_CRON=0 */2 * * *
```

---

## 15. Roadmap de Sprints

### Sprint 01 — Baseline (atual)
```
☐ Executar validação da aplicação existente
☐ Gerar docs/current-application-inventory.md
☐ Garantir Docker Compose funcional
☐ Validar banco, Redis, workers e testes
☐ Produzir docs/compliance-gap-analysis.md
```

### Sprint 02 — Daily Briefing Crew
```
☐ Implementar tools de leitura (read_emails, read_calendar, etc.)
☐ Criar Email Agent + Executive Orchestrator
☐ Criar Daily Briefing Crew
☐ Persistir crew_runs + briefing_snapshots
☐ Expor GET /api/v1/dashboard/home
☐ Expor POST /api/v1/crews/daily-briefing/run
```

### Sprint 03 — Frontend Integrado
```
☐ Migrar para TypeScript + Vite + Tailwind
☐ Criar Design System (ExecutiveCard, PriorityBadge, etc.)
☐ Implementar todos os estados de UI (loading/empty/error/stale)
☐ Conectar Executive Home à API real
☐ Conectar Smart Inbox à API real
☐ Testes E2E básicos
```

### Sprint 04 — Expansão
```
☐ Weekly Planning Crew
☐ Risk Review Crew
☐ Telas: Managers, Approvals, WeeklyPlanning, Settings
☐ Aprovações com human-in-the-loop completo
☐ Observabilidade: métricas de custo, latência, precisão
☐ Avaliação de prompts (dataset + regressão)
```

---

## 16. O Que Não Fazer (Anti-patterns)

```
❌ Adicionar write op de integração sem requires_human_approval
❌ Commitar arquivo .env com secrets reais
❌ Expor API key em log, resposta de API ou frontend
❌ Criar segundo banco ou backend paralelo
❌ Agents acessando banco diretamente (usar tools)
❌ Repositories chamando IA
❌ Regra de negócio na camada de API (FastAPI coordena HTTP, não decide)
❌ Usar DB index 1 ou 2 no DO Managed Valkey (apenas DB 0)
❌ WIQL sem paginação por mês (cap 1.000 resultados)
❌ /members/ do Work/Plane tratado como envelope (é flat list)
❌ Authorization: Bearer no Work/Plane (usar X-API-Key)
❌ create_issue no Plane sem verificar _assignee_warning
❌ Mudança de prompt sem nova versão em ai_prompt_versions
❌ ai_runs sem correlation_id
❌ P0/P1 sem campo rationale preenchido
❌ Remover as 7 Expectativas do system prompt da IA
❌ Endpoint público sem authenticate dependency
❌ Dados sensíveis em JSONB de audit_log ou ai_runs
❌ Desabilitar validações para fazer testes passarem
```

---

## 17. Decisões de Arquitetura Registradas

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Runtime backend | Python 3.12 + FastAPI | Fase 2 já implementada; CrewAI é Python-native |
| IA orchestration | CrewAI | Multiagente com tools controladas, política de approval embutida |
| Armazenamento AI | PostgreSQL (ai_runs + crew_runs) | Auditabilidade e reprodução de execuções |
| Dashboard reads | Snapshots persistidos | P95 < 800ms sem disparar IA por request |
| Auth | Microsoft Entra ID + JWT | Padrão corporativo Copastur, já implementado na Fase 3 |
| Workers | Celery + Beat | Substituir node-cron; idempotência e dead-letter |
| Deploy | Docker Compose → Kubernetes (futuro) | Estabilidade antes de complexidade |
| Redis em DO | Key prefixes (não DB index) | Managed Valkey expõe apenas DB 0 |
| Prompt management | Biblioteca versionada em PostgreSQL | Auditabilidade + rollback + teste de regressão |
| Frontend lang | TypeScript strict | Contratos gerados do OpenAPI, type-safety end-to-end |
| 7 Expectativas | Integradas ao sistema (diferencial) | Não presentes no PRD padrão — exclusivo Copastur |

---

*Leia este arquivo integralmente antes de qualquer ação. Última atualização: Julho 2026.*
*Copastur CPTO Team — João Fornari Jr*
