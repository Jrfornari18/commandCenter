# Log de Erros de Integração + Fluxo de Solicitação de Correção

**O que foi feito:** implementado o item 2 (observabilidade leve) da
recomendação de ordem de execução em
`docs/compliance-gap-analysis.md`, na forma de um log centralizado de
erros de chamadas a APIs externas, consultável apenas pelo Admin, com
um fluxo para transformar um erro em "solicitação de correção" — que
grava automaticamente uma nota em `contexto/` para a próxima sessão do
Claude Code encontrar (convenção CLAUDE.md §18).

**Por quê:** as integrações (ADO, Freshservice, Graph, Work/Plane,
SmartLeader, chamada ao Anthropic no chat) já tratavam erro localmente
(mock fallback, log de sync), mas sem um lugar único para o Admin ver
"o que está falhando agora" nem um jeito de encaminhar isso para
correção sem depender de olhar logs de container.

**Arquivos/serviços tocados:**
- `postgres/003_integration_error_log.sql` — novas tabelas
  `integration_error_log` e `integration_fix_requests` (aditivas, não
  alteram schema existente).
- `backend/src/services/errorLog.js` — `logIntegrationError()`,
  sanitiza campos sensíveis (`token|key|secret|password|authorization|pat`)
  antes de persistir; falha ao gravar nunca interrompe o fluxo chamador.
- `backend/src/services/fixRequestFile.js` — `writeFixRequestFile()`,
  gera `contexto/YYYY-MM-DD-fix-<integracao>-<titulo>.md` a partir de
  um erro registrado.
- `backend/src/integrations/{azure_devops,freshservice,microsoft_graph,smartleader,work_plane}/client.js`
  — chamam `errorLog.logIntegrationError` nos catches existentes
  (nenhuma mudança de comportamento de fallback/mock).
- `backend/src/routes/index.js` — `GET /admin/integration-errors`,
  `GET /admin/fix-requests`, `POST /admin/fix-requests`,
  `PATCH /admin/fix-requests/:id` (todas `authenticate` + `requireAdmin`);
  também loga erro da chamada ao Anthropic no chat quando `!aiRes.ok`.
  Documentação `@openapi` inline — Swagger já aponta para
  `./src/routes/*.js`, sem necessidade de registrar em outro lugar.
- `frontend/src/services/api.js` — `errorLogAPI` (list, fixRequests,
  createFixRequest, updateFixRequest).
- `frontend/src/pages/AppPage.jsx` — novo painel Admin "Logs de
  Integração" (lista de erros + criação/gestão de solicitações de
  correção), item de menu com badge de contagem.
- `docker-compose.yml` — volume `./contexto:/app/contexto` no serviço
  `backend`, necessário para `fixRequestFile.js` gravar no host a
  partir do container.

**Estado:** implementação completa, verificada com `node --check` em
todos os arquivos `.js` tocados/criados (sintaticamente válidos).
**Pendente:** migration `003_integration_error_log.sql` ainda não
aplicada em nenhum banco rodando (sem acesso ao Docker daemon nesta
sessão para validar end-to-end); rodar
`docker compose exec postgres psql -U copastur -d copastur_clevel -f /docker-entrypoint-initdb.d/003_integration_error_log.sql`
ou recriar o container do zero para bancos novos. Nenhum teste
automatizado adicionado (ver item 4 do gap-analysis, ainda não
iniciado). Nada disso foi commitado ainda.
