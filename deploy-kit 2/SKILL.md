---
name: deploy-kit-vibecoding
description: Use when an application developed via vibecoding (AI-assisted development) needs to be prepared for production deployment. Triggered when the project has a working local docker-compose but lacks a production-ready multi-stage Dockerfile or DevOps handoff documentation.
---

# Deploy Kit — Preparando Apps Vibecoding para Produção

## Visão Geral

Apps desenvolvidas via vibecoding funcionam bem localmente via `docker compose up`, mas o ambiente de produção (EKS/Kubernetes) exige uma **única imagem Docker** contendo frontend e backend juntos. Este skill analisa a aplicação, gera o Dockerfile multi-stage correto e produz a documentação de handoff para a equipe de DevOps.

**Quem usa:** Desenvolvedor que criou uma app com IA e quer solicitar o deploy em produção.
**O que entrega:** Dockerfile pronto para produção + `DEPLOY-HANDOFF.md` para enviar ao time de DevOps.

---

## Por Que o Dockerfile Multi-Stage é Obrigatório

O docker-compose local usa containers separados. O EKS não — exige uma única imagem:

```
Local (docker-compose):              Produção (EKS):
┌──────────┐  ┌──────────┐          ┌──────────────────────────────┐
│ frontend │  │ backend  │   →→→    │  nginx + backend             │
│ :3000    │  │ :8000    │          │  um único container, porta 80 │
└──────────┘  └──────────┘          └──────────────────────────────┘
```

O multi-stage resolve isso em dois passos dentro de um único Dockerfile:
- **Stage 1 (build):** compila o frontend e gera os arquivos estáticos
- **Stage 2 (runtime):** executa o backend + serve o frontend via nginx

---

## Protocolo de Execução

Execute os passos abaixo na ordem. Não pule nenhum.

### Passo 1 — Mapear a aplicação

Leia os seguintes arquivos do projeto e responda as perguntas antes de continuar:

**Arquivos a ler:**
- Todos os arquivos na raiz do projeto
- `docker-compose.yml` ou `docker-compose.prod.yml`
- `Dockerfile` (se existir)
- `package.json`, `requirements.txt`, `pyproject.toml`, `*.csproj` ou `go.mod`
- `.env`, `.env.example`, `.env.sample`

**Perguntas a responder:**

| Pergunta | Onde encontrar |
|----------|---------------|
| Qual é a linguagem do backend? | `package.json` = Node.js, `requirements.txt` = Python, `*.csproj` = .NET, `go.mod` = Go |
| Existe frontend separado? | Pastas: `frontend/`, `client/`, `web/`, `ui/` com `package.json` |
| Qual é o comando de build do frontend? | `package.json` → `scripts.build` |
| Qual é o comando de start do backend? | `package.json` → `scripts.start` ou arquivo principal |
| Qual porta o backend usa? | Variável `PORT` no código ou no docker-compose |
| Quais variáveis de ambiente a app precisa? | `.env.example` ou seção `environment:` do docker-compose |

**Se o projeto não tiver frontend separado:** use o padrão "Backend sem frontend" da seção de padrões.

---

### Passo 2 — Gerar o Dockerfile multi-stage

Identifique o padrão correspondente na seção **Padrões de Dockerfile** e gere o arquivo `Dockerfile` na raiz do projeto, substituindo todos os placeholders pelos valores reais encontrados no Passo 1.

**Checklist obrigatório antes de apresentar o Dockerfile:**
- [ ] `EXPOSE 80` declarado — o load balancer da AWS bate sempre na porta 80
- [ ] `ENV HOST=0.0.0.0` — sem isso o backend não aceita conexões de fora do container
- [ ] `HEALTHCHECK` apontando para `/api/health` — o EKS rejeita containers sem health check
- [ ] `Cache-Control: no-store` no nginx para `/` e `/index.html` — evita tela branca após deploy
- [ ] Nenhum secret, senha ou token dentro da imagem
- [ ] Dependências de desenvolvimento não instaladas (`--omit=dev` ou equivalente)

---

### Passo 3 — Verificar o docker-compose.yml

Leia o `docker-compose.yml` existente e verifique se há senhas ou tokens em texto claro.

**Nunca deve existir:**
```yaml
# ❌ ERRADO — senha exposta em arquivo commitado no git
environment:
  DB_PASSWORD: "minha-senha-123"
  OPENAI_API_KEY: "sk-abc123xyz"
```

**Padrão correto:**
```yaml
# ✅ CORRETO — declara só o nome, sem valor
environment:
  HOST: 0.0.0.0       # valor fixo, não é secret
  PORT: 3000          # valor fixo, não é secret
  DB_PASSWORD:        # sem valor — será configurado pela equipe de DevOps
  OPENAI_API_KEY:     # sem valor — será configurado pela equipe de DevOps
```

Se encontrar senhas ou tokens em texto claro: **informe ao desenvolvedor e aguarde correção antes de continuar**. Nunca gere a documentação de handoff com secrets expostos.

---

### Passo 4 — Verificar o endpoint /api/health

O EKS verifica se a app está funcionando chamando `/api/health`. Sem esse endpoint o deploy falha.

Procure no código se o endpoint existe. Se não existir, informe ao desenvolvedor e forneça o código de implementação correspondente à linguagem da app:

**Node.js (Express):**
```js
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
```

**Python (FastAPI):**
```python
@app.get('/api/health')
def health():
    return {'status': 'ok'}
```

**Python (Flask):**
```python
@app.route('/api/health')
def health():
    return {'status': 'ok'}
```

**Go (net/http):**
```go
http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"status":"ok"}`))
})
```

**.NET (minimal API):**
```csharp
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
```

---

### Passo 5 — Gerar o documento de handoff

Gere o arquivo `DEPLOY-HANDOFF.md` na raiz do projeto usando o template da seção **Template DEPLOY-HANDOFF.md** abaixo, preenchendo com os dados reais encontrados nos passos anteriores.

Este documento é o que o desenvolvedor envia para a equipe de DevOps para solicitar o deploy.

---

## Padrões de Dockerfile

### Node.js + Frontend (React, Vue, Angular, Svelte, Next.js, etc.)

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: Compilar o frontend ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY <PASTA_FRONTEND>/package*.json ./
RUN npm ci
COPY <PASTA_FRONTEND>/ .
RUN npm run build
# Gera arquivos estáticos em /app/dist (ou /app/build — ajuste conforme a app)

# ── Stage 2: Imagem final — Backend Node.js + Nginx ──────────────────────────
FROM node:20-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=<PORTA_BACKEND>

RUN apt-get update && apt-get install -y \
    nginx supervisor wget \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências do backend
WORKDIR /app
COPY <PASTA_BACKEND>/package*.json ./
RUN npm ci --omit=dev
COPY <PASTA_BACKEND>/ .

# Copiar frontend compilado do stage 1
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Configuração do nginx
RUN rm -f /etc/nginx/sites-enabled/default
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    # Sem cache no HTML principal — evita tela branca após deploy
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        expires 0;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        expires 0;
    }

    # Cache longo para assets com hash no nome (JS, CSS, imagens)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Redireciona chamadas de API para o backend
    location /api/ {
        proxy_pass         http://127.0.0.1:PORT_BACKEND;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        proxy_buffering    off;
    }
}
EOF

# Supervisor — inicia nginx e backend juntos no mesmo container
COPY <<'EOF' /etc/supervisor/conf.d/app.conf
[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=<COMANDO_START_BACKEND>
directory=/app
autostart=true
autorestart=true
environment=NODE_ENV="production",HOST="0.0.0.0",PORT="<PORTA_BACKEND>"
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1/api/health || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
```

**Placeholders a substituir:**
| Placeholder | Valor real |
|-------------|-----------|
| `<PASTA_FRONTEND>` | Nome real da pasta: `frontend`, `client`, `web`, `ui` |
| `<PASTA_BACKEND>` | Nome real da pasta: `backend`, `api`, `server`, ou `.` se na raiz |
| `<PORTA_BACKEND>` | Porta real do backend (ex: `3000`, `3001`, `8000`) |
| `<COMANDO_START_BACKEND>` | Comando real: `node src/server.js`, `node index.js`, etc. |
| `PORT_BACKEND` no nginx | Mesmo número da `<PORTA_BACKEND>` |
| `/app/dist` | Trocar por `/app/build` se o frontend gerar em `build/` (Create React App) |

---

### Python + Frontend

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: Compilar o frontend ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY <PASTA_FRONTEND>/package*.json ./
RUN npm ci
COPY <PASTA_FRONTEND>/ .
RUN npm run build

# ── Stage 2: Imagem final — Backend Python + Nginx ───────────────────────────
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=<PORTA_BACKEND>

RUN apt-get update && apt-get install -y \
    nginx supervisor wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY <PASTA_BACKEND>/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY <PASTA_BACKEND>/ .

COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# [incluir a mesma configuração de nginx do padrão Node.js acima]
# Ajustar: proxy_pass http://127.0.0.1:<PORTA_BACKEND>;

COPY <<'EOF' /etc/supervisor/conf.d/app.conf
[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=<COMANDO_START_BACKEND>
# Exemplos:
# FastAPI:  uvicorn main:app --host 0.0.0.0 --port <PORTA_BACKEND>
# Flask:    gunicorn -w 4 -b 0.0.0.0:<PORTA_BACKEND> app:app
# Django:   gunicorn projeto.wsgi:application --bind 0.0.0.0:<PORTA_BACKEND>
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1/api/health || exit 1

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
```

---

### Backend sem Frontend (API pura)

```dockerfile
# syntax=docker/dockerfile:1
# Para APIs sem interface web

# Escolha a imagem base correspondente à linguagem:
FROM node:20-slim
# FROM python:3.11-slim
# FROM mcr.microsoft.com/dotnet/aspnet:8.0
# FROM golang:1.22-alpine AS builder ... FROM alpine:3.19

ENV HOST=0.0.0.0 \
    PORT=<PORTA_BACKEND>

WORKDIR /app

# Node.js:
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/

# Python:
# COPY requirements.txt ./
# RUN pip install --no-cache-dir -r requirements.txt
# COPY . .

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["<COMANDO_START_BACKEND>"]
# Node.js: ["node", "src/server.js"]
# Python FastAPI: ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Python Flask/Gunicorn: ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app"]
```

---

## Padrão de Variáveis de Ambiente

### Regra fundamental

Nenhuma senha, token ou chave pode aparecer em arquivo commitado no git — nem no `docker-compose.yml`, nem no `Dockerfile`, nem em qualquer outro arquivo.

### Como identificar o que é secret

| É secret | Não é secret |
|----------|-------------|
| Senhas de banco de dados | Endereço/host do banco |
| Tokens de API (OpenAI, Stripe, etc.) | Nome do banco de dados |
| Chaves de criptografia | Porta do servidor |
| Credenciais de e-mail | Modo de execução (production) |
| Qualquer valor que começa com `sk-`, `pk-`, `Bearer` | URL do domínio da aplicação |

### Como declarar no docker-compose.yml

```yaml
services:
  app:
    environment:
      # Valores fixos — aparecem aqui normalmente
      NODE_ENV: production
      PORT: 3000
      HOST: 0.0.0.0

      # Secrets — declare só o NOME, sem valor
      # A equipe de DevOps vai configurar os valores na plataforma
      DATABASE_URL:
      DATABASE_PASSWORD:
      OPENAI_API_KEY:
      SECRET_KEY:
      SMTP_PASSWORD:
```

### Arquivo .env para desenvolvimento local

```sh
# .env.local — NUNCA commite este arquivo
DATABASE_URL=postgresql://localhost:5432/minha_app_dev
OPENAI_API_KEY=sk-minha-chave-de-dev
SECRET_KEY=dev-secret-local-nao-usar-em-prod
```

O `.gitignore` DEVE conter:
```
.env
.env.local
.env.*.local
*.env
!.env.example
```

---

## Regras Absolutas

Estas regras nunca podem ser violadas, independente da stack ou do tipo de aplicação:

| # | Regra | Por quê |
|---|-------|---------|
| 1 | `EXPOSE 80` no Dockerfile | O load balancer da AWS sempre acessa a porta 80 |
| 2 | `ENV HOST=0.0.0.0` | Sem isso o backend só responde para localhost — o nginx não consegue fazer proxy |
| 3 | `HEALTHCHECK /api/health` | O EKS precisa saber se o container está saudável — sem isso o deploy falha |
| 4 | Frontend e backend no mesmo container | O EKS não usa docker-compose — cada app é um único container |
| 5 | Nenhum secret em arquivo | Arquivos são commitados no git — secrets expostos são uma brecha de segurança grave |
| 6 | `Cache-Control: no-store` para `/index.html` | Sem isso usuários podem ver versões antigas da app por dias |

---

## Template DEPLOY-HANDOFF.md

Gerar este arquivo preenchido com os dados reais da aplicação:

```markdown
# Solicitação de Deploy — [Nome da Aplicação]

**Data:** [data de hoje]
**Desenvolvedor:** [nome]
**Repositório:** [URL do git]
**Branch:** main

---

## Sobre a Aplicação

[Descreva em 2-3 frases o que a aplicação faz]

## Estrutura do Projeto

| Componente | Pasta | Tecnologia |
|-----------|-------|-----------|
| Frontend | [pasta] | [React / Vue / Angular / etc.] |
| Backend | [pasta] | [Node.js / Python / .NET / etc.] |
| Banco de dados | — | [PostgreSQL / MySQL / MongoDB / nenhum] |

## Porta do Backend

O backend escuta na porta: **[PORTA]**

## Endpoint de Health Check

`GET /api/health` → retorna `{ "status": "ok" }` com HTTP 200

[✅ Implementado / ❌ Precisa ser implementado]

## Variáveis de Ambiente

### Configurações (não são secrets)

| Variável | Descrição | Valor de exemplo |
|----------|-----------|-----------------|
| NODE_ENV | Ambiente | production |
| PORT | Porta do backend | [PORTA] |
| DATABASE_HOST | Host do banco | [endereço] |
| [adicione as outras] | | |

### Secrets (precisam de proteção especial na plataforma)

| Variável | Descrição |
|----------|-----------|
| DATABASE_PASSWORD | Senha do banco de dados |
| [API]_KEY | Chave de API do [serviço] |
| SECRET_KEY | Chave de criptografia de sessão |
| [adicione os outros] | |

## Dependências Externas

- [ ] Banco de dados: [tipo e versão]
- [ ] Cache (Redis): [sim / não]
- [ ] Armazenamento de arquivos: [S3 / local / não usa]
- [ ] APIs externas: [liste cada uma]

## Como Testar Localmente

```bash
# Build da imagem
docker build -t minha-app:test .

# Rodar o container
docker run --rm -p 8080:80 --env-file .env.local minha-app:test

# Verificar health check
curl http://localhost:8080/api/health
# Esperado: {"status":"ok"}

# Verificar o frontend
# Abrir no browser: http://localhost:8080
```

## Checklist de Pré-Deploy

- [ ] App funciona localmente com `docker compose up`
- [ ] `docker build` conclui sem erros
- [ ] `/api/health` responde HTTP 200
- [ ] Nenhum secret em arquivo commitado no git
- [ ] Todas as variáveis de ambiente documentadas acima
- [ ] `.gitignore` inclui `.env` e variantes
```
```
