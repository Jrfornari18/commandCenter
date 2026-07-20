# Callback OAuth do Microsoft Graph (`/auth/callback`)

**O que foi feito:** implementado o passo do fluxo de autenticação
Microsoft Graph (CLAUDE.md §14) que faltava — o backend só gerava a
`auth-url` (`GET /api/integrations/graph/auth-url`), mas não existia
nada para processar o retorno da Microsoft em
`https://commandcenter.copastur.com.br/auth/callback` (valor já
configurado em `AZURE_REDIRECT_URI` via credentialStore/DB, com
prioridade sobre `.env`).

**Por quê:** sem esse endpoint, o botão "Conectar conta Microsoft" no
painel Graph abria a tela de login da Microsoft, mas o `code` retornado
nunca era trocado por token — `graph_tokens` nunca era populado e o
sync do Graph (`SYNC_GRAPH_CRON`) não tinha o que sincronizar.

**Arquivos tocados:**
- `backend/src/integrations/microsoft_graph/client.js` —
  `exchangeCodeForToken(code, redirectUri)` (POST direto ao endpoint
  `/oauth2/v2.0/token` do Entra ID via axios, mesmo padrão dos demais
  clients — não usa `@azure/msal-node` para manter o `refresh_token`
  explícito, já que o schema `graph_tokens` espera essa coluna) e
  `saveGraphToken(userId, tokenData)` (upsert em `graph_tokens`,
  `ON CONFLICT (user_id)`). `getAuthUrl` agora pede `offline_access`
  no scope para garantir que a Microsoft devolva `refresh_token`.
- `backend/src/routes/index.js` — `POST /integrations/graph/callback`
  (`authenticate`): decodifica `state`, valida que pertence ao usuário
  autenticado e que tem menos de 10 min, troca o code, salva o token,
  grava `audit_log` (`graph_oauth_connected`).
- `frontend/src/pages/AuthCallbackPage.jsx` (novo) — lê `code`/`state`/
  `error` da query string, chama o backend, mostra sucesso/erro.
- `frontend/src/index.jsx` — rota pública `/auth/callback` (a página
  já herda o JWT do `localStorage` via interceptor do Axios).
- `frontend/src/services/api.js` — `integAPI.graphCallback(code, state)`.

**Estado:** testado end-to-end nesta sessão (rebuild via
`docker compose build backend frontend` + `up -d`):
- `GET /auth-url` retorna a URL correta com
  `redirect_uri=https://commandcenter.copastur.com.br/auth/callback`
  e `scope` incluindo `offline_access`.
- `POST /callback` valida corretamente: sem `code`/`state` → 400; state
  inválido (não-base64/JSON) → 400; sem JWT → 401.
- Rota `/auth/callback` no frontend responde 200 (SPA fallback via
  nginx) e a página carrega.
- **Não testado**: troca real de `code` por token (exige um login real
  via Microsoft Entra ID, não reproduzível nesta sessão) — a validação
  foi até o ponto de chamar `exchangeCodeForToken`; erros dessa chamada
  já caem no log de integração (`integration_error_log`, painel Admin
  > Logs de Integração) para diagnóstico caso a troca real falhe em
  produção.
