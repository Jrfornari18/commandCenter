# Deploy Kit — Contexto do Ambiente Copastur

## O que é este kit

Este kit padroniza o onboarding de aplicações para o ambiente Copastur (EKS AWS via ADO multistage). Use-o quando receber uma app nova para fazer deploy em produção.

## Arquivos do kit

| Arquivo | Audiência | Função |
|---------|-----------|--------|
| `SKILL.md` | Desenvolvedor (via Claude Code) | Skill principal — gera Dockerfile e documento de handoff |
| `README.md` | Desenvolvedor | Instruções de uso (como copiar e invocar o skill) |
| `app-auditor.md` | Desenvolvedor / DevOps (via Claude Code) | Audita a app antes do deploy |
| `CLAUDE.md` | Equipe DevOps | Contexto do ambiente Copastur para agentes especializados |
| `agents/dockerfile-fixer.md` | Equipe DevOps | Reescreve/corrige o Dockerfile para o padrão Copastur |
| `agents/pipeline-builder.md` | Equipe DevOps | Gera o `azure-pipelines.yml` multistage completo |

**Fluxo para desenvolvedor vibecoding:** `@deploy-kit/SKILL.md` → `DEPLOY-HANDOFF.md` → entrega ao DevOps

**Fluxo para equipe DevOps:** `@deploy-kit/app-auditor.md` → `@deploy-kit/agents/dockerfile-fixer.md` → `@deploy-kit/agents/pipeline-builder.md`

---

## Mapeamento de ambientes

Cada projeto define quantos ambientes precisa e quais branches disparam cada um. Não há um padrão fixo de branches — o kit se adapta ao projeto.

### Padrões mais comuns

| Padrão | Branches | Deploy |
|--------|----------|--------|
| **1 ambiente** | `main` → PROD (EKS) | Direto para EKS via pipeline |
| **2 ambientes** | `main` → PROD (EKS) + `develop` ou `homolog` → não-prod (Docker Compose on-premise) | EKS para prod; Docker Compose para não-prod |
| **3 ambientes** | `main` → PROD (EKS) + `staging` → STG (Docker Compose) + `develop` → DEV (Docker Compose) | EKS para prod; Docker Compose para os demais |

**Antes de iniciar o onboarding, mapeie:**
- Quantos ambientes o projeto precisa
- Qual branch corresponde a cada ambiente
- Qual infraestrutura cada ambiente usa (EKS vs. Docker Compose on-premise)
- Quais Variable Groups já existem ou precisam ser criados no ADO

---

## Escopo da pipeline

**A pipeline ADO deste kit é para deploy no EKS (produção) e ambientes não-prod (Docker Compose on-premise).** Não deve ser usada para outros fins: build de artefatos isolados, testes automatizados, scripts de manutenção, etc.

---

## Pipeline ADO — Estrutura Obrigatória

### Fluxo para produção (EKS)

```
trigger: [<branch-prod>]

stages:
  1. ValidateVariablesEKS  → centralized template: validate.yaml
  2. Build                 → centralized template: build.yaml, pool: docker-build (hardcoded)
  3. DeploymentEKS         → aws-auth.yaml + make.yaml + healthcheck.yaml
```

### Fluxo para ambientes não-prod (Docker Compose on-premise)

```
trigger: [<branch-dev>, <branch-stg>, ...]

stages:
  1. DeploymentDocker      → docker compose up -d --build
  2. HealthCheck           → curl https://DOMAIN/ → 200
```

**Centralized task group:**
- Repo: `centralized-task-group` (branch `main`)
- Endpoint: `centralized-template-access`
- Templates usados:
  - `custom-operation/variables/validate.yaml`
  - `custom-operation/build/backend/dotnet/build.yaml`
  - `custom-operation/tools/aws/aws-auth.yaml`
  - `custom-operation/deploy/frontend/make.yaml`
  - `custom-operation/tools/infra/healthcheck/healthcheck.yaml`

**Variable Groups por ambiente (nomes são definidos por projeto):**

| Ambiente | VGs necessários |
|----------|----------------|
| Produção (EKS) | `<APP>-PROD` + `<APP>-PROD-II` + `Copastur-Cluster-SHARED` |
| Não-prod (Docker Compose) | `<APP>-HMLG` (ou `<APP>-DEV`, `<APP>-STG`) + seu `-II` + `Copastur-Docker-Onpremise` |

**POOL_NAME** vem do variable group. `docker-build` é hardcoded no stage de Build.

---

## Dockerfile — Padrão Obrigatório

Single-image, multi-stage. Frontend e backend rodam no mesmo container via supervisord.

```
Stage 1: node:20-alpine  →  npm run build (React/Vite → dist/)
Stage 2: node:20-slim    →  runtime
  - nginx: porta 80, serve /usr/share/nginx/html + proxy /api/ → 127.0.0.1:PORT
  - backend: PORT=3002 (ou variável), HOST=0.0.0.0
  - supervisord: orquestra nginx + node
  - HEALTHCHECK: wget /api/health
  - EXPOSE 80 PORT
```

Regras absolutas:
- NUNCA secrets no Dockerfile (ENV, ARG ou hardcoded)
- NUNCA `.env` copiado para dentro da imagem
- Variáveis runtime chegam pelo docker-compose `environment:` (sem valor = ADO injeta)
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` se a app usa puppeteer

---

## Variáveis de Ambiente — Regras

**docker-compose.prod.yml:** declare o nome da variável sem valor. Em produção, o ADO injeta os valores em runtime via variable group.

```yaml
# CORRETO
environment:
  SESSION_SECRET:
  PG_PASSWORD:
  LDAP_BIND_PASSWORD:

# ERRADO — nunca faça isso
environment:
  SESSION_SECRET: "minha-secret-aqui"
```

**Pipeline:** passe secrets via `env:` no step de deploy, nunca em arquivo.

```yaml
- script: docker compose up -d --build
  env:
    SESSION_SECRET: $(SESSION_SECRET)
    PG_PASSWORD:    $(PG_PASSWORD)
```

---

## Regras que NUNCA podem ser violadas

1. Secrets jamais em arquivo — sempre via variable group ADO
2. Deploy em produção jamais fora do ADO pipeline — sem SSH direto, sem scripts manuais no EKS
3. Single-image obrigatório — frontend e backend no mesmo container
4. HEALTHCHECK obrigatório no Dockerfile — `/api/health` deve responder 200
5. Pool `docker-build` para o stage Build no EKS — hardcoded no YAML
6. Centralized templates obrigatórios para ValidateVars, Build e DeployEKS
7. `EXPOSE 80` obrigatório no Dockerfile — o NLB bate na porta 80 do container
8. Variable groups carregados com `${{ if eq(...) }}` (compile-time) — nunca com `$()`

---

## Comandos de inspeção rápida

Use estes comandos ao auditar ou diagnosticar uma aplicação:

```sh
# Verificar containers em execução (Docker Compose)
docker compose -p <app> ps

# Ver logs do container
docker compose -p <app> logs --tail=50

# Testar health check local
curl -s http://localhost:<PORT>/api/health

# Build local de teste
docker build -t <app>:test . && docker run --rm -p 8080:80 <app>:test

# Inspecionar variáveis de ambiente na imagem
docker inspect <app>:test | jq '.[0].Config.Env'

# Verificar secrets hardcoded no histórico git
git log --all -p | grep -iE "password|secret|token|key" | grep -v "^-"

# Verificar ENV/ARG declarados no Dockerfile
grep -E "^ENV|^ARG" Dockerfile

# Inspecionar .gitignore para cobertura de .env
grep -E "\.env|secret|password" .gitignore
```

---

## Como invocar os agentes no Claude Code

**Pré-requisito:** o diretório `deploy-kit/` deve estar na raiz do projeto sendo onboardado. O Claude Code resolve caminhos `@deploy-kit/...` relativos ao diretório onde está aberto — se o kit não estiver lá, as referências quebram.

```sh
# Colocar o kit na raiz do projeto (copiar do hub-sre ou de repo central):
cp -r /caminho/para/hub-sre/deploy-kit/ /raiz/do-seu-projeto/
```

Com o kit na raiz, abra o Claude Code no projeto e use:

**Opção A — referência direta (`@`):**
```
@deploy-kit/agents/app-auditor.md
@deploy-kit/agents/dockerfile-fixer.md
@deploy-kit/agents/pipeline-builder.md
```

**Opção B — copiar conteúdo para colar:**
```sh
cat deploy-kit/agents/app-auditor.md | pbcopy   # Mac
cat deploy-kit/agents/app-auditor.md | xclip    # Linux
```

**Fluxo correto:**
1. Copie `deploy-kit/` para a raiz do projeto a ser onboardado
2. Abra o Claude Code na raiz desse projeto
3. Use `@deploy-kit/agents/app-auditor.md` — o auditor guia os próximos passos
4. Siga a ordem indicada no relatório do auditor

---

## Diagnóstico rápido

**Tela branca após deploy:**
- Causa: browser cache de index.html
- Fix: nginx deve ter `Cache-Control: no-store` no location `/` e `= /index.html`
- Teste: `Ctrl+Shift+R` no browser

**Pipeline falhou no Build:**
```sh
# No servidor on-premise
docker ps | grep azure
docker logs <container_id> --tail 50
```

**Pod não sobe no EKS:**
```sh
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```
