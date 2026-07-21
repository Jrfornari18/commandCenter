# Relatório Executivo Azure DevOps (quarter/projetos/epics/tags/backlog)

**O que foi feito:** descompactado `commandcenter_azuredevops.zip` (subido
diretamente no GitHub, fora deste fluxo) e integrado seu conteúdo ao
projeto — não como arquivos avulsos, mas adaptado às convenções já
existentes do repo (credentialStore em vez de `process.env` direto,
router único em `routes/index.js` em vez de um `azureDevOpsRoutes.js`
separado, `authenticate` obrigatório em todo endpoint, `axios` em vez
de `https` nativo). É um módulo **complementar** ao client ADO
existente: `client.js` sincroniza `ado_work_items` (usado pelos painéis
de workstream); este módulo consulta o ADO via WIQL ao vivo para gerar
agregações executivas (throughput mensal, ranking de projetos,
hierarquia de epics, vínculo estratégia→execução por tag, backlog
ativo por projeto) e cacheia snapshots para carregamento rápido.

**Por quê:** pedido do usuário — extrair o zip e transformar seu
conteúdo (que veio como um pacote solto, sem integração real ao app)
em um módulo funcional de acesso ao Azure DevOps que efetivamente traz
dados para o Command Center.

**Desvios deliberados do conteúdo original do zip:**
- PAT/org lidos via `credentialStore.get('ADO_PAT'|'ADO_ORG')` (DB
  override > `.env`), não `process.env` cru — o zip ignorava o painel
  Admin > API Keys já existente.
- `GET /api/azure-devops/query` do zip interpolava `project`,
  `workItemType`, `state`, `tag` (vindos de query string) direto no
  WIQL sem escapar aspas — WIQL injection. Corrigido com
  `escapeWiql()` (dobra aspas simples) em
  `reportService.js`, usado em todos os pontos que interpolam valor
  vindo do usuário.
- Endpoints remontados sob `/api/integrations/ado/report/*`
  (namespace consistente com o resto de `routes/index.js`), não um
  router `/api/azure-devops/*` separado.
- `frontend/hooks/useAzureDevOps.js` e
  `frontend/services/azureDevOpsApi.js` do zip usavam `fetch` cru com
  `credentials: 'include'` (cookies) — o app usa JWT Bearer via
  interceptor Axios em `services/api.js`. Não foram copiados;
  `integAPI.adoReportLatest`/`adoReportSync` cobrem o mesmo uso.
- Migration do zip era `003_azure_devops_cache.sql`, colidindo com
  `postgres/003_integration_error_log.sql` já existente — renumerada
  para `004_azure_devops_reports.sql`.

**Arquivos criados:**
- `backend/src/integrations/azure_devops/reportService.js` — toda a
  lógica de WIQL/agregação (`getQuarterReport`, `getProjectBreakdown`,
  `getEpicsHierarchy`, `getTagLinks`, `getBacklog`, `getWeeklyReport`,
  `getQuarterMonths`, `escapeWiql`).
- `postgres/004_azure_devops_reports.sql` — tabelas
  `devops_snapshots`, `devops_project_metrics`, `devops_epic_progress`
  (aditivas).

**Arquivos alterados:**
- `backend/src/routes/index.js` — `GET/POST /integrations/ado/report/{latest,sync,quarter,projects,epics,tags,backlog,query}`,
  todos `authenticate`.
- `backend/src/services/syncRoutine.js` — `syncADOReport()` (gera
  relatório ao vivo + persiste snapshot); não entra em `runFullSync`
  porque é caro (dezenas de queries WIQL) — roda só no cron dedicado
  ou por clique manual.
- `backend/src/server.js` — cron `SYNC_ADO_REPORT_CRON` (default
  `0 11 * * 1`, segunda 8h Brasília).
- `backend/.env.example` — `SYNC_ADO_REPORT_CRON`.
- `frontend/src/services/api.js` — `integAPI.adoReportLatest/adoReportSync`.
- `frontend/src/pages/AppPage.jsx` — seção "Relatório Executivo
  Semanal" no painel Azure DevOps existente (KPIs de trimestre,
  ranking de projetos, progresso de epics), com botão "Atualizar
  Relatório".

**Estado:** implementação completa, `node --check` limpo em todos os
`.js` tocados/criados e JSX validado via `@babel/preset-react`
(sem `node_modules` instalado no frontend nesta sessão — sem `npm run
build` real). Nada commitado ainda.

**Pendente:**
- Aplicar a migration em qualquer banco já rodando:
  `docker compose exec postgres psql -U copastur -d copastur_clevel -f /docker-entrypoint-initdb.d/004_azure_devops_reports.sql`
  (bancos novos pegam automaticamente via `docker-entrypoint-initdb.d`).
- Primeiro `POST /api/integrations/ado/report/sync` (ou aguardar o
  cron de segunda-feira) para popular `devops_snapshots` — sem isso o
  painel mostra "Sem relatório gerado ainda".
- Testar contra o ADO real (`ADO_ORG`/`ADO_PAT` configurados) — não
  validado end-to-end nesta sessão.
