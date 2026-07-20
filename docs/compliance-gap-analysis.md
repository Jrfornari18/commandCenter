# Matriz de Conformidade — App Atual (Node.js v2.0) vs. PRD (`_command_Ai/`)

> Gerado por Claude Code em 2026-07-20, conforme Etapa 3 de
> `_command_Ai/AI/ApplicationValidationAndAdjustment.md`.
>
> **Decisão de escopo confirmada com o owner (João Fornari Jr):** ajuste
> incremental sobre o backend Node.js/Express e frontend React/JS
> existentes — **sem** trocar para Python/FastAPI/CrewAI/Celery/Redis
> nem para TypeScript/Vite/Tailwind, conforme proibido em
> `_command_Ai/AI/Claude.md` ("não reescrever a aplicação inteira sem
> necessidade"). `CLAUDE_v3.md` é tratado como referência de visão de
> produto, não como mandato de stack.

| Área | Estado atual | Requisito PRD | Gap | Ação recomendada | Risco |
|---|---|---|---|---|---|
| Estrutura | Node/Express monolito, rotas em `routes/index.js` (596 linhas) | Camadas separadas: repositories/services/agents/tools (`AI/ArchitectureRules.md`) | Rotas fazem query SQL direto, sem repository layer | Extrair queries de `dashboard`/`decisions`/`risks` para módulos `services/*Service.js` — só onde reduzir duplicação real, sem criar abstração especulativa | Baixo — refactor mecânico, sem mudar contrato de API |
| Dados | Tabelas `decisions`, `riscos`, `iniciativas` sem `priority` P0–P3 nem `risk_level` padronizado | `executive_tasks` com `priority IN (P0..P3)`, `risk_level`, `rationale`, `facts`, `inferences`, `recommendation`, `source_type/source_id` (`BusinessRules.md`, `FunctionalRequirements.md` FR-009) | Sem classificação P0-P3 nem separação fatos/inferências/recomendação persistida | Nova migration `003_executive_tasks.sql` aditiva (não remove `decisions`/`riscos` para não quebrar o que já funciona); popular via chat/IA existente | Médio — requer decidir se `decisions`/`riscos` são migradas ou mantidas em paralelo por um tempo |
| API | Rotas não versionadas (`/api/...`) | `/api/v1/...`, formato de erro padronizado com `code`/`correlation_id` (`CLAUDE_v3.md` §5) | Sem versionamento, erros retornam `{ error: string }` simples | Não versionar agora (quebraria frontend atual sem ganho real); adicionar `correlation_id` ao formato de erro é viável e barato | Baixo se não versionar; Alto se versionar sem necessidade real (quebra frontend) |
| Frontend | React 18 JS, CRA, CSS custom | React + TypeScript strict + Design System (`PriorityBadge`, `RiskBadge`, `AIInsightPanel`, `ApprovalDialog` etc.) | Sem tipagem, sem componentes de prioridade/risco dedicados | Adicionar componentes visuais (`PriorityBadge`, `RiskBadge`) em JS puro no design system atual, sem migrar para TS/Vite | Baixo — aditivo, não quebra nada existente |
| CrewAI / Multiagente | Um único prompt de sistema no chat (`SYSTEM_PROMPT` em `routes/index.js`), sem crews/agents separados, sem `ai_runs`/`crew_runs` | 4 crews (`daily_briefing`, `weekly_planning`, `risk_review`, `smart_inbox`) + 8 agentes especializados, todos CrewAI/Python (`PRD/05_AI/*`) | Não há orquestração multiagente nem execução agendada de "briefing diário" | **Fora do escopo desta rodada** — implementar um "Daily Briefing" como rotina Node determinística (sem framework de agentes) que já teríamos capacidade de fazer é uma opção futura; requer alinhamento à parte, não incluir na primeira leva de ajustes | Alto se forçado agora — é o item de maior esforço e mais distante da arquitetura atual |
| Workers | `node-cron` dentro do processo Express, sem fila, sem retry/dead-letter | Celery + Beat, idempotência, dead-letter (`NonFunctionalRequirements.md`) | Sem fila de jobs, sem idempotency_key | Manter `node-cron` (funciona, já testado nesta sessão); considerar `bull`/`bullmq` + Redis **só se** volume justificar — não implementar especulativamente | Baixo manter como está; Médio se adicionar Redis sem necessidade comprovada |
| Segurança / API keys | `credentialStore.js`: DB (AES-256-GCM) > `.env` > vazio; nenhuma rota retorna valor real | "Segredos exclusivamente server-side"; preservar nomes/mecanismo atual (`ApplicationValidationAndAdjustment.md` Etapa 2) | **Nenhum gap** — mecanismo atual já atende ao requisito | Nenhuma ação — não alterar | — |
| Observabilidade | `morgan` (access log) + `console.error`/`console.warn` ad hoc, sem `correlation_id`, sem structlog | Logs estruturados com `correlation_id` em toda execução (`NonFunctionalRequirements.md`, `CLAUDE_v3.md` §13) | Sem correlation_id, sem logging estruturado JSON | Adicionar `correlation_id` (UUID por request, middleware simples) e padronizar `console.error` para incluir esse campo — não trocar para `structlog` (é biblioteca Python) | Baixo — aditivo |
| Testes | Nenhum teste automatizado, sem CI | "testes para regras críticas" (`DeveloperRules.md`), testes de regressão de prompt | Zero cobertura de teste | Introduzir `jest`/`supertest` no backend começando pelas rotas críticas (`/auth/login`, `/integrations/sync-all`, `/admin/credentials`); não bloquear entrega por cobertura total | Médio — esforço real, mas baixo risco técnico |
| Documentação | `CLAUDE.md` (v2.0) é a fonte viva; `CLAUDE_v3.md` e `_command_Ai/` chegaram depois e descrevem alvo diferente | `README.md`, `CHANGELOG.md`, docs por camada (`CLAUDE_v3.md` §3) | `CLAUDE.md` não reflete os novos arquivos `_command_Ai/`/`CLAUDE_v3.md`; sem `CHANGELOG.md` | Adicionar seção em `CLAUDE.md` referenciando `_command_Ai/` e este gap-analysis como fonte de decisões de escopo; não substituir `CLAUDE.md` por `CLAUDE_v3.md` | Baixo |

## Itens sem gap (já conformes, não tocar)

- Human-in-the-loop em toda write op de integração
  (`requires_human_approval: true`) — já implementado em todos os 4
  clients de integração.
- Mecanismo de API keys (nomes, precedência, criptografia, mascaramento).
- 7 Expectativas de C-Level — presentes no schema (`expectativas`), no
  `SYSTEM_PROMPT` do chat e na UI (`Expectativas.jsx`/painel).
- Fallback para dados mock quando API key ausente (Freshservice,
  SmartLeader) — já implementado e testado nesta sessão.

## Recomendação de ordem de execução (se aprovado)

1. Correções que impedem execução → **nenhuma pendente** (app já
   valida e roda limpo via `docker compose up --build`, testado
   end-to-end nesta sessão).
2. Observabilidade leve (`correlation_id` em erros) — baixo risco, alto valor para depuração.
3. Componentes visuais de prioridade/risco no frontend atual (aditivo).
4. Testes automatizados nas rotas críticas.
5. Nova tabela `executive_tasks` (aditiva, sem remover `decisions`/`riscos`) — **decisão do owner necessária** antes de iniciar, pois envolve escolha de modelo de dados definitivo.
6. Daily Briefing determinístico em Node — **fora desta rodada**, tratar como proposta separada.

Este documento não inclui nenhuma implementação — é a base para a
próxima decisão de escopo.
