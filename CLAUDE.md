# CLAUDE.md — Copastur C-Level AI Command Center
> Arquivo de contexto para Claude Code. Leia este arquivo inteiramente antes de qualquer ação.

---

## 1. Identidade do Projeto

**Nome:** Copastur C-Level AI Command Center  
**Versão:** 2.0  
**Owner:** João Fornari Jr — CPTO, Grupo Copastur  
**Repositório:** https://github.com/Jrfornari18/commandCenter  
**Domínio de produção:** https://commandcenter.copastur.com.br  
**Stack principal:** Node.js 20 + Express · React 18 · PostgreSQL 15 · Docker Compose  

Plataforma executiva de suporte estratégico que consolida Azure DevOps, Freshservice,
Microsoft Graph, Work/Plane TI Boards e SmartLeader OKRs em um único painel de comando,
com IA (Claude Sonnet 4.6) avaliando cada decisão contra as 7 Expectativas de C-Level.

---

## 2. Regras Absolutas (nunca violar)

### 2.1 Human-in-the-loop — INVIOLÁVEL
Toda ação consequencial retorna `requires_human_approval: true` e NUNCA é executada
automaticamente. Esta regra é uma restrição de negócio, não preferência técnica.

**Ações bloqueadas:**
- Envio de qualquer email (Microsoft Graph)
- Aprovação ou rejeição de orçamento
- Criação, atualização ou fechamento de work item no Azure DevOps
- Fechamento ou atualização de ticket no Freshservice
- Criação de issue no Work/Plane com assignee (risco de drop silencioso)
- Qualquer comunicação com clientes externos

```typescript
// Padrão obrigatório em TODA write op de integração
return {
  requires_human_approval: true,
  action: 'ado_update_work_item | graph_send_email | fs_close_ticket | ...',
  payload: { /* dados que seriam enviados */ },
  approved_by: userId,
  message: 'Aguardando aprovação humana explícita antes da execução'
};
```

### 2.2 Segurança de secrets — NUNCA expor
Nunca escrever, logar, commitar ou retornar em resposta API:
- `ANTHROPIC_API_KEY`
- `ADO_PAT`
- `AZURE_CLIENT_SECRET`
- `FRESHSERVICE_API_KEY`
- `WORK_TOKEN`
- `SMARTLEADER_API_KEY`
- `JWT_SECRET`
- `CREDENTIALS_ENC_KEY`
- Senhas de banco de dados

Usar sempre variáveis de ambiente. Azure Key Vault em produção.

As API keys de integração (seção 5) também podem ser configuradas via
painel **Admin > API Keys** (`/api/admin/credentials`, admin-only). Ficam
criptografadas (AES-256-GCM, chave = `CREDENTIALS_ENC_KEY`) na tabela
`integration_credentials` e um valor salvo ali tem prioridade sobre o
`.env`. As rotas de leitura NUNCA retornam o valor real — apenas os
últimos 4 caracteres mascarados. Ver `backend/src/services/credentialStore.js`.

### 2.3 Gitignore — nunca commitar
```
.env
backend/.env
*.env            (exceto *.env.example)
node_modules/
*/node_modules/
frontend/build/
postgres/data/
*.log
```

### 2.4 As 7 Expectativas — sempre presentes
Toda análise da IA deve referenciar quais das 7 Expectativas se aplicam.
Nunca tratar as expectativas como contexto opcional ou decorativo.

---

## 3. Estrutura do Repositório

```
commandCenter/
├── CLAUDE.md                          ← ESTE ARQUIVO
├── README.md
├── docker-compose.yml                 ← orquestração: postgres + backend + frontend
├── .env.example                       ← template sem secrets
├── .gitignore
│
├── postgres/
│   └── 001_schema.sql                 ← 14 tabelas + seed (3 usuários)
│
├── backend/                           ← Node.js 20 + Express 4
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js                  ← entry point + cron sync jobs
│       ├── db/
│       │   └── index.js               ← pg Pool (20 conexões)
│       ├── middleware/
│       │   └── auth.js                ← JWT verify middleware
│       ├── routes/
│       │   └── index.js               ← TODAS as rotas unificadas
│       └── integrations/
│           ├── azure_devops/client.js
│           ├── microsoft_graph/client.js
│           ├── freshservice/client.js
│           ├── work_plane/client.js
│           └── smartleader/client.js
│
└── frontend/                          ← React 18
    ├── Dockerfile
    ├── nginx.conf                     ← reverse proxy + SPA fallback
    ├── package.json
    └── src/
        ├── index.jsx                  ← entry + routing
        ├── context/
        │   └── AuthContext.jsx        ← estado global de auth
        ├── services/
        │   └── api.js                 ← Axios + interceptors JWT
        ├── styles/
        │   └── global.css             ← design system executivo
        └── pages/
            ├── LoginPage.jsx
            └── AppPage.jsx            ← app principal, 10 painéis
```

---

## 4. Stack e Dependências

### Backend (backend/package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "uuid": "^9.0.0",
    "express-validator": "^7.0.1",
    "morgan": "^1.10.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.5",
    "@azure/msal-node": "^2.6.1"
  }
}
```

### Frontend (frontend/package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "axios": "^1.6.2",
    "react-scripts": "5.0.1"
  }
}
```

### Runtimes e serviços
| Serviço | Versão | Porta |
|---------|--------|-------|
| Node.js | 20 LTS | — |
| PostgreSQL | 15-alpine | 5432 |
| React (dev) | 18 | 3000 |
| Express API | — | 3001 |
| Nginx (prod) | alpine | 80 |

---

## 5. Configurações de Ambiente

### Variáveis obrigatórias (.env na raiz para docker-compose)

```env
# AI
ANTHROPIC_API_KEY=sk-ant-...

# JWT
JWT_SECRET=minimo-64-caracteres-change-in-production
JWT_EXPIRES_IN=8h

# Microsoft Entra ID (single-tenant Copastur)
AZURE_TENANT_ID=5ffc8daf-9a54-46be-9c74-c98d30a2a81a
AZURE_CLIENT_ID=<client-id-do-app-registration>
AZURE_CLIENT_SECRET=<revogar-e-regenerar-se-exposto>
AZURE_REDIRECT_URI=https://commandcenter.copastur.com.br/auth/callback
GRAPH_SCOPES=User.Read,Calendars.Read,Mail.Read

# Azure DevOps
ADO_ORG=copastur-dev
ADO_PAT=<pat-com-work-items-read-write>
ADO_SYNC_PROJECTS=Q2-2026,Copastur Energy (Forge-SinergIA),Smart Operations,IA First

# Freshservice
FRESHSERVICE_DOMAIN=copastur.freshservice.com
FRESHSERVICE_API_KEY=<api-key>

# Work/Plane TI Boards
WORK_API_URL=https://work.cnext.app/api/plane/v1/workspaces/copastur
WORK_TOKEN=<token-novo-apos-revogacao>
WORK_BOARD_PORTFOLIO_TI=6b3ee0f0-eab1-49d4-a853-ef112b41bdab
WORK_BOARD_BACKLOG_PMO=10d50cea-a195-41ee-8648-241ecb2e3101
WORK_BOARD_PORTFOLIO_PMO=c327a196-ef24-497c-bd18-a914daa989cb
WORK_BOARD_ONBOARDING=ec5a12bd-db20-4a0f-adf8-63a143a80a75

# SmartLeader
SMARTLEADER_API_URL=https://api.smartleader.com.br
SMARTLEADER_API_KEY=<api-key>

# CORS
CORS_ORIGIN=https://commandcenter.copastur.com.br

# Cron Sync (produção)
SYNC_ADO_CRON=0 */4 * * *
SYNC_FS_CRON=0 */2 * * *
SYNC_WORK_CRON=*/15 * * * *
SYNC_OKR_CRON=0 8 * * *
SYNC_GRAPH_CRON=*/30 * * * *
```

### Configurações fixas (não alterar)
```
Azure Tenant ID:   5ffc8daf-9a54-46be-9c74-c98d30a2a81a
ADO Org:           copastur-dev
ADO API Version:   7.1
Work Workspace:    copastur
FS Domain:         copastur.freshservice.com
AI Model:          claude-sonnet-4-6
DB Name:           copastur_clevel
DB User:           copastur
```

---

## 6. Banco de Dados

### Esquema: 14 tabelas

```
CORE
  roles               → perfis: ceo, cto, cfo, coo, cpto, cio, board, admin
  users               → email, password_hash (bcrypt 12), azure_oid, role_id
  audit_log           → log de todas as ações (user_id, action, metadata, ip)

7 EXPECTATIVAS
  expectativas        → 7 registros fixos com prompt_base

AI COMMAND CENTER
  conversations       → sessões de chat (user_id, domain, expectativas[])
  messages            → role, content, parsed_response (JSONB), tokens_used

GESTÃO EXECUTIVA
  decisions           → requires_human_approval, approved_by, approved_at
  riscos              → nivel: critico|alto|medio|baixo, origem, origem_ref
  iniciativas         → workstream, ado_epic_id, progresso (0-100)

INTEGRAÇÕES
  graph_tokens        → access_token, refresh_token, expires_at por user
  calendar_events     → UNIQUE(ms_event_id), start_dt, end_dt, is_online
  email_digest        → UNIQUE(ms_message_id), ai_priority, ai_summary
  ado_work_items      → UNIQUE(ado_id, project), workstream, iteration_path, tags[]
  ado_sync_log        → histórico de sincronizações por projeto
  fs_tickets          → UNIQUE(fs_id), status, priority, due_by
  work_projects       → is_ti_board flag, plane_id
  work_issues         → UNIQUE(plane_id), state_group, priority
  okr_objectives      → cycle (Q2-2026), progress, status
  okr_key_results     → FK objective, baseline, target, current_value
  integration_sync    → health de cada integração (status, last_sync_at)
  executive_briefings → briefing_date, content (JSONB), is_read
```

### Usuários seed (alterar em produção)
```
admin@copastur.com.br       / Copastur@2025  → admin
ceo@copastur.com.br         / Copastur@2025  → ceo
joao.fornari@copastur.com.br / Copastur@2025 → cpto
```

### Convenções SQL
- UUIDs via `uuid_generate_v4()` (extension uuid-ossp)
- Hashes via `crypt()` + `gen_salt('bf',12)` (extension pgcrypto)
- `updated_at` via trigger automático em todas as tabelas principais
- Indexes em todas as FKs e colunas de filtro frequente

---

## 7. Integrações — Quirks Críticos

### 7.1 Azure DevOps

```
Auth:        Basic auth — Base64(":PAT")
Endpoint:    https://dev.azure.com/copastur-dev
API Version: 7.1

WIQL cap:    1.000 resultados — quebrar queries longas por mês
Batch:       work item details em lotes de 200 (/workitems?ids=...)
Datas:       @Today - N (N = dias corridos)
Done states: Resolved, Closed, Tested (Removed excluído do denominador)
Grouping:    System.IterationPath (não tags) para workstreams
Tags WIQL:   [System.Tags] CONTAINS 'TagName'
PAT atual:   read-only — write ops retornam 401
```

**Workstreams via IterationPath:**
```
Q2-2026\Ai-First | SmartHotel | SmartSaving | 8BPay
Q2-2026\Plataforma CMais Core | PME Fast | Smart Integration | Zuri | Energy
```

**Projeto Energy (Forge-SinergIA):**
```
ID: 8b54465b-9067-4db6-92a7-3c732d55f2b1
Conteúdo: 13 Epics · 21 User Stories · 148 Tasks
Template: MSFT Hosted Agile
```

### 7.2 Microsoft Graph

```
Tenant:      5ffc8daf-9a54-46be-9c74-c98d30a2a81a (single-tenant)
Base URL:    https://graph.microsoft.com/v1.0
Auth:        Bearer {access_token} (via MSAL OAuth PKCE)
Scopes:      User.Read, Calendars.Read, Mail.Read
Sync:        calendarView (48h ahead), messages (48h back, top 30)
```

### 7.3 Freshservice

```
Domain:    copastur.freshservice.com
Base URL:  https://copastur.freshservice.com/api/v2
Auth:      Basic Base64("API_KEY:X")
Priority:  1=urgent, 2=high, 3=medium, 4=low
Status:    2=open, 3=pending, 4=resolved, 5=closed
Fallback:  mock data quando API_KEY ausente (não quebra o fluxo)
```

### 7.4 Work/Plane TI Boards

```
Base URL:  https://work.cnext.app/api/plane/v1/workspaces/copastur
Auth:      Header X-API-Key (NÃO Authorization: Bearer)
```

**4 TI Boards confirmados via live API:**
```
Portfólio de Soluções de TI:   6b3ee0f0-eab1-49d4-a853-ef112b41bdab  (573 issues)
Backlog PMO de TI 2026:         10d50cea-a195-41ee-8648-241ecb2e3101  (306 issues)
Portfólio PMO de TI 2026:       c327a196-ef24-497c-bd18-a914daa989cb  (76 issues)
Onboarding Técnico TI:          ec5a12bd-db20-4a0f-adf8-63a143a80a75  (1 issue)
```

**Quirks obrigatórios:**
```
Paginação:   next_page_results (bool) + next_cursor (string, URL-encode antes de usar)
Envelope:    /projects/ e /issues/ → { results: [] }
             /members/ → flat list direta (sem envelope)
per_page:    máximo 100 testado
create_issue: assignee não-membro → HTTP 200 mas assignee silenciosamente descartado
             verificar _assignee_warning na resposta
expand:      issues suportam ?expand=state para inline state objects
states:      retornam envelope OU flat list → usar defensive handling em ambos
```

### 7.5 SmartLeader

```
Base URL:  https://api.smartleader.com.br
Auth:      Bearer token
Ciclo:     Q2-2026 (parâmetro configurável)
Fallback:  mock data com OKRs realistas quando API_KEY ausente
```

---

## 8. Padrões de Código

### 8.1 Backend (Node.js / Express)

```javascript
// Estrutura padrão de rota
router.get('/recurso', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT ...', [params]);
    res.json({ data: rows });
  } catch (err) {
    console.error('[ROTA]', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Audit log — sempre registrar ações sensíveis
await db.query(
  `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, metadata)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [req.user.id, 'action_name', 'entity', id, req.ip, JSON.stringify(meta)]
);

// Write op de integração — padrão obrigatório
return {
  requires_human_approval: true,
  action: 'integration_action_name',
  payload: { /* dados */ },
  approved_by: req.user.id,
  message: 'Aguardando aprovação humana explícita'
};
```

### 8.2 Frontend (React)

```jsx
// Chamada de API — sempre com tratamento de erro
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

const loadData = async () => {
  setLoading(true);
  try {
    const res = await integAPI.endpoint(params);
    setData(res.data);
  } catch (err) {
    console.error('[COMPONENTE]', err.message);
  } finally {
    setLoading(false);
  }
};

// Padrão de panel/painel
<div className={`panel ${panel === 'nome' ? 'active' : ''}`}>
  <div className="panel-scroll">
    {/* conteúdo */}
  </div>
</div>
```

### 8.3 SQL (PostgreSQL)

```sql
-- Sempre usar ON CONFLICT para upserts de sync
INSERT INTO tabela (col1, col2, ...)
VALUES ($1, $2, ...)
ON CONFLICT (unique_col) DO UPDATE SET
  col2 = EXCLUDED.col2,
  synced_at = NOW();

-- Indexes obrigatórios para colunas de filtro frequente
CREATE INDEX idx_table_col ON table(col);

-- Paginação cursor (Work/Plane pattern)
-- next_page_results + next_cursor (URL-encoded)
```

### 8.4 Resposta estruturada da IA

Todo response do Claude deve ser JSON com este schema:
```json
{
  "expectativas_aplicadas": ["01 — Visão Sistêmica", "05 — Guardiões da Cultura"],
  "executive_summary": ["bullet 1", "bullet 2", "bullet 3"],
  "assessment": "avaliação crítica da situação",
  "recommendation": "direção recomendada com trade-offs",
  "phases": [
    {
      "phase": "Nome da Fase",
      "objective": "objetivo específico",
      "actions": "ações-chave",
      "owner": "papel executivo responsável",
      "kpi": "métrica de sucesso",
      "risk": "principal risco desta fase"
    }
  ],
  "risks": [
    {
      "area": "área de risco",
      "level": "High | Medium | Low",
      "description": "descrição do risco",
      "mitigation": "como mitigar"
    }
  ],
  "decision_required": "O que o executivo precisa decidir agora",
  "next_action": "Um próximo passo concreto e imediato"
}
```

Para perguntas simples: `{"simple": true, "text": "resposta direta"}`

---

## 9. As 7 Expectativas de C-Level — Referência Completa

> Critério de permanência na Copastur em 2025. Incorporar em toda análise da IA.

```
01 — Visão Sistêmica + Execução Impecável
     Enxergar o todo enquanto entrega o detalhe.
     Pré-requisito para todas as demais.

02 — Comportamento de Sócio
     "Se isso fosse 100% do meu patrimônio, eu faria assim?"
     Pergunta permanente antes de qualquer decisão relevante.

03 — Liderança que Forma Líderes
     C-Level não é o melhor operador — é o multiplicador.
     Falta de pipeline de liderança é falha direta do C-Level, não do RH.

04 — Dados acima de Opiniões, com Sensibilidade Humana
     Dados como ponto de partida obrigatório.
     Opiniões sem dados são hipóteses. Dados sem sensibilidade são armadilhas.

05 — Guardiões da Cultura
     "Cultura não é slide, é decisão difícil tomada corretamente."
     O C-Level guarda a cultura quando o custo de guardá-la é alto.
     Critério central na reengenharia cultural atual.

06 — Inquietação Positiva e Visão de Futuro
     Inconformismo produtivo com o status quo.
     Inquietação sem proposta é reclamação.

07 — Alinhamento Radical com o CEO
     Conselho ativo + braço executor.
     Divergir em privado, executar com comprometimento público.
     Pré-requisito de todas as outras expectativas.
```

---

## 10. Workstreams Q2/Q3 2026

| Workstream | Stakeholder | ADO IterationPath | Status |
|-----------|------------|-------------------|--------|
| AI-First | João Fornari Jr | `Q2-2026\Ai-First` | Ativo |
| SmartHotel | Virginia/Gustavo Bergamini | `Q2-2026\SmartHotel` | At risk |
| SmartSaving | Ernani Torquato (lead dev) | `Q2-2026\SmartSaving` | Behind |
| Smart Integration | — | `Q2-2026\Smart Integration` | Ativo |
| CMais / C+ | — | `Q2-2026\Plataforma CMais Core` | Ativo |
| Zuri | — | `Q2-2026\Zuri` | Ativo |
| 8BPay | — | `Q2-2026\8BPay` | Planejamento |
| PME Fast | — | `Q2-2026\PME Fast` | Ativo |
| Energy [Forge-SinergIA] | — | proj `8b54465b` | Ativo |

**Outros stakeholders:**
- **Tamiriam** — Migração de dados
- **Paula Porto** — Engenharia de dados
- **Cristina Amador** — Segurança

---

## 11. Docker e Deploy

### Desenvolvimento local

```bash
# Clonar e configurar
git clone https://github.com/Jrfornari18/commandCenter.git
cd commandCenter
cp .env.example .env
# Editar .env com credenciais reais

# Subir todos os serviços
docker compose up --build -d

# Verificar saúde
docker compose ps
curl http://localhost:3001/health

# Acessar
# Frontend: http://localhost:3000
# API:      http://localhost:3001/api
# DB:       localhost:5432 (copastur/copastur123)
```

### Serviços Docker

```yaml
postgres:   postgres:15-alpine  → porta 5432
backend:    node:20-alpine      → porta 3001  (Express API + cron sync)
frontend:   nginx:alpine        → porta 3000  (React build + proxy /api/)
```

### Nginx (frontend/nginx.conf)
```nginx
# Proxy /api/ → backend:3001
# SPA fallback → index.html
# Cache 1 ano para assets estáticos
```

### Produção (DigitalOcean)
```
Região:  NYC3 (menor latência para SP — sem região Brasil)
Compute: Droplet Basic 2 vCPU/4 GB (~US$24/mês)
DB:      Managed PostgreSQL v16
Cache:   Managed Valkey (Redis 7.2.4 compat.)
HTTPS:   Caddy (Let's Encrypt automático)

ATENÇÃO: DO Managed Valkey expõe apenas DB 0
→ Usar key prefixes, não índices separados (DB 1, DB 2 inválidos)
```

---

## 12. Endpoints da API — Referência

```
# Autenticação
POST   /api/auth/login              { email, password } → { token, user }
GET    /api/auth/me                 → user atual
POST   /api/auth/logout
POST   /api/auth/change-password    { current_password, new_password }

# Chat (proxy Anthropic)
GET    /api/chat/conversations
POST   /api/chat/conversations      { title?, domain? }
GET    /api/chat/conversations/:id/messages
POST   /api/chat/conversations/:id/messages  { content } → AI response
DELETE /api/chat/conversations/:id  (arquiva)

# Dashboard
GET    /api/dashboard               → métricas + status integrações

# Gestão executiva
GET    /api/decisions
POST   /api/decisions               { titulo, prioridade, responsavel, prazo }
PATCH  /api/decisions/:id           { status, prioridade }
GET    /api/risks
POST   /api/risks                   { area, nivel, descricao, mitigacao }
GET    /api/expectativas

# Integrações — Status e Sync
GET    /api/integrations/status
POST   /api/integrations/sync-all

# Azure DevOps
GET    /api/integrations/ado/workstreams
GET    /api/integrations/ado/items     ?workstream=&type=&state=&limit=
POST   /api/integrations/ado/sync

# Freshservice
GET    /api/integrations/freshservice/tickets  ?limit=
POST   /api/integrations/freshservice/sync

# Work/Plane
GET    /api/integrations/work/boards
GET    /api/integrations/work/issues   ?board=&priority=&state_group=&limit=
POST   /api/integrations/work/sync

# Microsoft Graph
GET    /api/integrations/graph/calendar
GET    /api/integrations/graph/email
POST   /api/integrations/graph/sync
GET    /api/integrations/graph/auth-url  → URL OAuth Microsoft

# SmartLeader OKRs
GET    /api/integrations/okr/summary   ?cycle=Q2-2026
POST   /api/integrations/okr/sync      { cycle }

# Usuários (admin/ceo only)
GET    /api/users
POST   /api/users                   { email, full_name, role_name, password }
```

---

## 13. Segurança

### Rate Limiting
```javascript
// Geral: 200 req / 15 min
// Chat (AI): 30 msg / min (Anthropic tem custo por token)
```

### JWT
```javascript
// Payload: { userId, email, role }
// Expiração: 8h (configurável via JWT_EXPIRES_IN)
// Storage: localStorage (cpst_token)
// Interceptor: attach automático em todo request Axios
// 401: redirect automático para /login
```

### bcrypt
```javascript
// rounds: 12 (balanceado entre segurança e velocidade)
// Nunca armazenar senhas em plain text
// Nunca logar hashes
```

### Headers HTTP (Helmet.js)
```javascript
// CSP desabilitado (React inline scripts)
// CORS: apenas CORS_ORIGIN configurado
```

---

## 14. Fluxos Críticos

### Fluxo de Login
```
1. POST /api/auth/login { email, password }
2. bcrypt.compare(password, stored_hash)
3. jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '8h' })
4. UPDATE users SET last_login_at = NOW()
5. INSERT audit_log action='login_success'
6. Return { token, user: { id, email, full_name, avatar_initials, role_name, role_label } }
7. Frontend: localStorage.setItem('cpst_token', token)
```

### Fluxo de Chat com IA
```
1. POST /api/chat/conversations/:id/messages { content }
2. INSERT messages (role='user', content)
3. SELECT history FROM messages WHERE conversation_id ORDER BY created_at
4. POST https://api.anthropic.com/v1/messages
   - model: claude-sonnet-4-6
   - system: SYSTEM_PROMPT (com 7 Expectativas + contexto Copastur)
   - messages: history completo
5. Parse JSON response (extrair expectativas_aplicadas[])
6. INSERT messages (role='assistant', parsed_response JSONB, expectativas[])
7. UPDATE conversations SET title, expectativas (se primeira msg)
8. Return { message: { parsed_response, expectativas } }
```

### Fluxo de Sync de Integração
```
1. POST /api/integrations/sync-all
2. Para cada integração em paralelo:
   a. Fetch dados da API externa
   b. UPSERT no PostgreSQL (ON CONFLICT DO UPDATE)
   c. UPDATE integration_sync SET status, last_sync_at, items_synced
3. Return { results: { ado, freshservice, work_plane, okr, graph } }
```

### Fluxo de Autenticação Microsoft Graph
```
1. GET /api/integrations/graph/auth-url
2. Frontend redireciona para URL MSAL (Entra ID)
3. Usuário autentica → callback com code + state
4. Backend troca code por access_token via MSAL
5. INSERT/UPDATE graph_tokens (user_id, access_token, refresh_token, expires_at)
6. Sync automático a cada 30 minutos (SYNC_GRAPH_CRON)
```

---

## 15. Comandos Frequentes

```bash
# Desenvolvimento
cd commandCenter
docker compose up -d                    # subir todos os serviços
docker compose logs -f backend          # ver logs do backend
docker compose exec postgres psql -U copastur -d copastur_clevel  # acesso ao banco

# Rebuild após mudança de código
docker compose build backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend

# Sync manual das integrações
curl -X POST http://localhost:3001/api/integrations/sync-all \
  -H "Authorization: Bearer $TOKEN"

# Ver status das integrações
curl http://localhost:3001/api/integrations/status \
  -H "Authorization: Bearer $TOKEN"

# Git — atualizar repositório
git add .
git commit -m "feat: descrição"
git push origin main

# Banco de dados — reset completo (DEV ONLY)
docker compose down -v
docker compose up -d postgres
# aguardar init do schema
docker compose up -d
```

---

## 16. O Que Não Fazer

```
❌ Adicionar nova write op de integração sem requires_human_approval
❌ Commitar qualquer arquivo .env com secrets reais
❌ Usar índices Redis (DB 1, DB 2) em DO Managed Valkey — apenas DB 0
❌ Remover as 7 Expectativas do system prompt da IA
❌ Criar endpoint público (sem authenticate middleware)
❌ Expor detalhes de erro interno em produção (usar NODE_ENV check)
❌ Fazer queries WIQL sem verificar o cap de 1.000 resultados
❌ Assumir que /members/ do Work/Plane tem envelope — é flat list
❌ Usar Authorization: Bearer para autenticar no Work/Plane (usar X-API-Key)
❌ Criar issue no Work/Plane com assignee sem verificar _assignee_warning
❌ Docker Compose healthcheck com sintaxe inline YAML — usar multi-line
❌ Alterar os UUIDs dos 4 TI Boards — confirmados via live API
❌ Ignorar audit_log em ações sensíveis
```

---

## 17. Decisões de Arquitetura (ADRs)

| Decisão | Escolha | Razão |
|---------|---------|-------|
| Backend principal | Node.js 20 + Express (v2) | Simplicidade, performance, JavaScript unificado com frontend |
| ORM | pg direto (Pool) | Sem overhead de ORM para queries simples |
| Auth | JWT stateless | Sem necessidade de sessão server-side para API |
| AI | Claude Sonnet 4.6 | Melhor análise executiva estruturada testada |
| Orquestração | Docker Compose | Suficiente para escala atual; Kubernetes quando necessário |
| Agent Layer | Sem LangGraph | Reavaliação quando tool count > 8 ou orquestração paralela necessária |
| Secrets | Azure Key Vault (prod) | Padrão corporativo Copastur |
| Workstream grouping | IterationPath (não tags) | ADO Q2-2026 usa IterationPath como grouping primário |
| Redis em DO | Key prefixes (não DB index) | Managed Valkey expõe apenas DB 0 |

---

## 18. Pasta `contexto/` — Cache de Execução

Diretório na raiz do projeto (`contexto/`) que armazena, em Markdown, o
histórico do que foi executado na criação e adaptação do commandCenter.

```
contexto/
├── README.md              ← convenção (este item)
└── YYYY-MM-DD-slug.md      ← um arquivo por execução relevante
```

**Regras:**
- Toda execução relevante de criação/adaptação do sistema (feature nova,
  mudança estrutural, integração, migração de schema, decisão de arquitetura)
  gera um `.md` em `contexto/` nomeado `YYYY-MM-DD-slug-curto.md`.
- Conteúdo mínimo de cada arquivo: o que foi feito, por quê, e quais
  arquivos/serviços foram tocados. Sem prosa longa — objetivo e factual.
- **Antes de rodar um build** (`docker compose build`, `docker compose up
  --build`, etc.), releia os arquivos em `contexto/` para reconstituir o
  estado acumulado do desenvolvimento — eles funcionam como cache de
  execução entre sessões, já que o Claude Code não retém memória de
  conversas anteriores automaticamente.
- Não duplicar aqui o que já vive em CLAUDE.md (convenções, stack,
  regras absolutas) — `contexto/` é para o histórico de execuções, não
  para documentação permanente do projeto.

---

*Este arquivo deve ser lido integralmente pelo Claude Code antes de qualquer ação no projeto.*  
*Última atualização: Julho 2026 — Copastur CPTO Team*
