# Baseline do Mecanismo de API Keys (sem valores)

> Gerado conforme Etapa 2 de `_command_Ai/AI/ApplicationValidationAndAdjustment.md`.
> Nenhum valor de secret é mostrado — apenas nomes de variáveis,
> arquivos e regras de precedência. Este mecanismo **não deve ser
> alterado** sem aprovação explícita e justificativa (regra crítica em
> `_command_Ai/README.md` e `_command_Ai/AI/Claude.md`).

## Nomes de variáveis (não alterar)

```
ANTHROPIC_API_KEY
JWT_SECRET, JWT_EXPIRES_IN
CREDENTIALS_ENC_KEY
ADO_ORG, ADO_PAT, ADO_SYNC_PROJECTS
AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI, GRAPH_SCOPES
FRESHSERVICE_DOMAIN, FRESHSERVICE_API_KEY
WORK_API_URL, WORK_TOKEN
SMARTLEADER_API_URL, SMARTLEADER_API_KEY
POSTGRES_PASSWORD
CORS_ORIGIN
SYNC_ADO_CRON, SYNC_FS_CRON, SYNC_WORK_CRON, SYNC_OKR_CRON, SYNC_GRAPH_CRON
```

## Arquivos/módulos responsáveis pelo carregamento

- `.env` na raiz → consumido por `docker-compose.yml` (`env_file: .env`
  em cada serviço) e repassado como variáveis de ambiente do container.
- `backend/src/server.js` → `require('dotenv').config()` no topo,
  carrega `.env` quando rodando fora de Docker.
- `backend/src/services/credentialStore.js` → módulo único responsável
  por resolver o valor final de qualquer chave configurável (ver
  precedência abaixo). Todos os integration clients
  (`azure_devops`, `microsoft_graph`, `freshservice`, `smartleader`,
  `work_plane`) e a rota de chat (`routes/index.js`) chamam
  `credentialStore.get(KEY_NAME)` — nenhum lê `process.env` diretamente
  para um valor configurável pelo Admin.

## Precedência (não alterar)

```
1. Valor salvo no painel Admin > API Keys
   → tabela `integration_credentials`, criptografado AES-256-GCM
     (chave de cifra = hash SHA-256 de CREDENTIALS_ENC_KEY)
2. Variável de ambiente (.env / container env)
3. Vazio (integração cai em fallback mock, quando existe, ou fica idle)
```

`credentialStore.loadAll()` roda uma vez no boot do backend
(`server.js`), populando um cache em memória (`Map`) a partir da
tabela; `set()`/`remove()` atualizam banco e cache juntos.

## Provider de IA atual

- Anthropic Claude, chamado via `fetch` direto para
  `https://api.anthropic.com/v1/messages` em
  `backend/src/routes/index.js` (rota de chat). Modelo:
  `claude-sonnet-4-6` (hardcoded na chamada, não configurável via env
  hoje).
- `ANTHROPIC_API_KEY` resolvido via `credentialStore.get('ANTHROPIC_API_KEY')`.

## Rotação / armazenamento

- Rotação: manual — Admin substitui o valor via painel, que faz
  `UPDATE ... ON CONFLICT` na tabela e atualiza o cache imediatamente
  (sem restart necessário).
- Armazenamento: `integration_credentials.value_encrypted` (TEXT,
  base64 de `iv(12) + authTag(16) + ciphertext`, AES-256-GCM).
- Leitura administrativa (`GET /api/admin/credentials`): **nunca**
  retorna o valor real — apenas `mask()` (últimos 4 caracteres) e
  metadados (`source`, `configured`, `updated_at`).

## Regra de parada aplicada

Nenhuma inconsistência ou vulnerabilidade foi identificada no
mecanismo atual durante esta auditoria — criptografia AES-256-GCM,
mascaramento em toda resposta de API, e precedência DB>env>vazio estão
implementados corretamente e cobrem o requisito "segredos exclusivamente
server-side" (`NonFunctionalRequirements.md`). Portanto, nenhuma
alteração é proposta para este mecanismo.
