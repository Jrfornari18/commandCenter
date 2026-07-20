# Inventário da Aplicação Atual — Copastur C-Level AI Command Center

> Gerado por Claude Code em 2026-07-20, conforme Etapa 1 de
> `_command_Ai/AI/ApplicationValidationAndAdjustment.md`. Nenhum valor de
> secret é mostrado neste arquivo — apenas nomes de variáveis.

## Árvore do repositório (topo)

```
commandCenter/
├── CLAUDE.md                 ← contexto v2.0 (autoritativo hoje)
├── CLAUDE_v3.md               ← proposta de unificação PRD (não aplicada)
├── _command_Ai/                ← pacote de PRDs (AI/, PRD/01_PRODUCT, PRD/05_AI)
├── contexto/                  ← cache de execução (convenção CLAUDE.md §18)
├── docker-compose.yml
├── .env.example / backend/.env.example
├── postgres/
│   ├── 001_schema.sql          ← schema base (14 tabelas)
│   └── 002_integration_credentials.sql
├── backend/                   ← Node.js 20 + Express 4
└── frontend/                  ← React 18 (JavaScript, react-scripts)
```

## Backend — Node.js 20 + Express 4

```
backend/src/
├── server.js                  ← entry point, helmet/cors/rate-limit, cron sync jobs
├── db/index.js                ← pg Pool
├── middleware/auth.js         ← JWT verify
├── config/integrationFlags.js ← feature flag SMARTLEADER_ENABLED
├── docs/swaggerDef.js         ← OpenAPI spec servida em /api/docs
├── services/
│   ├── credentialStore.js     ← API keys: DB (AES-256-GCM) > .env > vazio
│   ├── credentialTest.js      ← teste de conectividade por integração
│   └── syncRoutine.js         ← lógica única de sync, usada por cron e endpoint manual
├── integrations/
│   ├── azure_devops/client.js
│   ├── microsoft_graph/client.js
│   ├── freshservice/client.js
│   ├── work_plane/client.js
│   └── smartleader/client.js  ← desativado via integrationFlags
└── routes/index.js            ← todas as rotas (auth, chat, dashboard, integrations, admin)
```

**Dependências principais (`backend/package.json`):** express, pg, bcryptjs,
jsonwebtoken, cors, dotenv, express-rate-limit, helmet, uuid,
express-validator, morgan, node-cron, axios, @azure/msal-node,
swagger-jsdoc, swagger-ui-express. Dev: nodemon.

**Sem testes, sem linter configurado, sem CI** (nenhum `*.test.js`,
`.eslintrc*` ou `.github/workflows` encontrados no repositório).

## Frontend — React 18 (JavaScript puro, `react-scripts`)

```
frontend/src/
├── index.jsx                  ← entry + routing
├── context/AuthContext.jsx
├── services/api.js            ← Axios + interceptors JWT
├── styles/global.css          ← design system executivo (CSS puro)
└── pages/
    ├── LoginPage.jsx
    └── AppPage.jsx             ← app principal: chat, dashboard, 5 integrações, admin (usuários + API keys)
```

Sem TypeScript, sem Vite (usa `react-scripts`/CRA), sem Tailwind (CSS
custom properties + classes utilitárias manuais).

## Banco de dados — PostgreSQL 15

- `postgres/001_schema.sql`: roles, users, audit_log, expectativas (7
  fixas), conversations, messages, decisions, riscos, iniciativas,
  graph_tokens, calendar_events, email_digest, ado_work_items,
  ado_sync_log, fs_tickets, work_projects, work_issues,
  okr_objectives, okr_key_results, integration_sync,
  executive_briefings.
- `postgres/002_integration_credentials.sql`: `integration_credentials`
  (API keys criptografadas, ver Etapa 2 abaixo).
- Sem Alembic/SQLAlchemy — migrations são arquivos `.sql` numerados,
  montados via `docker-entrypoint-initdb.d`.
- Sem Redis — nenhuma dependência de cache/fila no `docker-compose.yml`
  ou no código.

## Docker / Deploy

```
docker-compose.yml → postgres:15-alpine, backend (node:20-alpine), frontend (nginx:alpine)
```

Sem worker separado, sem Celery/Redis, sem serviço de agentes
dedicado. Sync roda via `node-cron` dentro do próprio processo Express
(`server.js`), condicionado a `NODE_ENV=production`.

## Endpoints existentes (`backend/src/routes/index.js`, prefixo `/api`)

```
Auth:          POST /auth/login · GET /auth/me · POST /auth/logout
Chat:          GET/POST /chat/conversations · GET/POST /chat/conversations/:id/messages · DELETE /chat/conversations/:id
Dashboard:     GET /dashboard
Gestão:        GET/POST /decisions · PATCH /decisions/:id · GET/POST /risks · GET /expectativas
Integrações:   GET /integrations/status · POST /integrations/sync-all
Azure DevOps:  GET /integrations/ado/workstreams|items · POST /integrations/ado/sync
Freshservice:  GET /integrations/freshservice/tickets · POST /integrations/freshservice/sync
Work/Plane:    GET /integrations/work/boards|issues · POST /integrations/work/sync
MS Graph:      GET /integrations/graph/calendar|email|auth-url · POST /integrations/graph/sync
SmartLeader:   GET /integrations/okr/summary · POST /integrations/okr/sync (desativado)
Usuários:      GET/POST /users
Admin API Keys: GET/PUT/DELETE /admin/credentials · POST /admin/credentials/test/:integration
Docs:          GET /api/docs.json · GET /api/docs (Swagger UI)
```

Não versionado (`/api/...`, não `/api/v1/...`), diferente do que
`CLAUDE_v3.md` propõe.

## Modelo de resposta da IA

Chat único (`POST /chat/conversations/:id/messages`) chama a API
Anthropic diretamente via `fetch`, com `SYSTEM_PROMPT` embutido em
`routes/index.js` (referencia as 7 Expectativas). Não há CrewAI, não
há múltiplos agentes/crews, não há `ai_runs`/`crew_runs`, não há
biblioteca de prompts versionada — é um único prompt de sistema por
chamada de chat.

## Mecanismo de API keys (ver `docs/api-key-handling-baseline.md`
para o detalhamento pedido na Etapa 2)

- `.env` (raiz, consumido por `docker-compose.yml` via `env_file`) é a
  fonte primária de configuração de ambiente.
- `backend/src/services/credentialStore.js` permite override por
  integração via painel Admin, persistido criptografado
  (AES-256-GCM) em `integration_credentials`, com prioridade
  **DB > .env > vazio**.
- Todos os clients de integração (`azure_devops`, `freshservice`,
  `microsoft_graph`, `smartleader`, `work_plane`) e o chat (Claude)
  leem via `credentialStore.get(KEY)` — nenhum lê `process.env`
  diretamente para valores configuráveis.
- Nenhuma rota retorna valor real de secret — apenas
  `credentialStore.mask()` (últimos 4 caracteres).

## Segurança — human-in-the-loop já implementado

Write ops de integração (`azure_devops`, `microsoft_graph`,
`freshservice`, `work_plane` clients) já retornam
`{ requires_human_approval: true, action, payload, approved_by,
message }` em vez de executar automaticamente — ver §2.1 de
`CLAUDE.md` e confirmado por grep em
`backend/src/integrations/*/client.js`.
