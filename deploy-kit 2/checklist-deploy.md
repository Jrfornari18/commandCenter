# Checklist de Deploy — Ambiente Copastur

Percorra este checklist antes de qualquer merge para as branches de deploy configuradas no projeto. Todos os itens devem estar marcados.

---

## 0. Mapeamento de ambientes

- [ ] Ambientes definidos: quantos existem e qual branch dispara cada um
- [ ] VG names definidos e confirmados com o ADO (os nomes precisam existir para a pipeline funcionar)
- [ ] Infraestrutura por ambiente documentada: EKS (produção) vs. Docker Compose on-premise (não-prod)

---

## 1. Dockerfile

- [ ] Dockerfile existe na raiz do projeto
- [ ] Multi-stage build: stage 1 faz build do frontend, stage 2 é o runtime
- [ ] Stage 1 usa `node:20-alpine` (ou versão LTS equivalente)
- [ ] Stage 2 usa `node:20-slim`
- [ ] Frontend e backend rodam no **mesmo container** via supervisord
- [ ] Nginx configurado: porta 80, serve `/usr/share/nginx/html`, proxy `/api/` → `127.0.0.1:<PORT>`
- [ ] Backend roda com `HOST=0.0.0.0` e porta declarada via `PORT` env
- [ ] `HEALTHCHECK` configurado apontando para `/api/health` (HTTP 200 obrigatório)
- [ ] `EXPOSE 80` declarado (e a porta do backend se diferente de 3002)
- [ ] **Nenhum secret hardcoded** (senhas, tokens, connection strings)
- [ ] **Nenhum `.env` copiado** para dentro da imagem
- [ ] `Cache-Control: no-store` no nginx para `/index.html` e `/`
- [ ] Se usa puppeteer: `ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`

---

## 2. docker-compose.prod.yml (ambientes não-EKS)

> Aplicável apenas a projetos com deploy em servidor on-premise (homolog, dev, staging, etc.).

- [ ] Arquivo `docker-compose.prod.yml` existe na raiz
- [ ] Todos os secrets estão declarados como **nomes sem valores** em `environment:`
- [ ] `HOST=0.0.0.0` declarado em `environment:` do container principal
- [ ] Volumes de dados e logs mapeados (`/opt/<app>/data`, `/opt/<app>/logs`)
- [ ] Healthcheck configurado no serviço principal
- [ ] Limites de recursos (`deploy.resources.limits`) declarados
- [ ] Nenhuma senha ou token em texto claro no arquivo
- [ ] `restart: unless-stopped` (não `always`)
- [ ] `container_name` explícito

---

## 3. azure-pipelines.yml

> Esta seção cobre **todos os ambientes configurados no projeto**. Use o agente `pipeline-builder` para gerar o arquivo com base no padrão do ambiente.

- [ ] Arquivo `azure-pipelines.yml` gerado a partir do template em `deploy-kit/padroes/pipeline.md`
- [ ] Trigger comentado (`trigger: none`) até a pipeline estar validada
- [ ] Variable groups preenchidos com os nomes reais criados no ADO
- [ ] Secrets passados via `env:` nos steps — **nunca hardcoded**
- [ ] Para cada branch de deploy configurada: existe o stage correspondente com a `condition:` correta
- [ ] Stage Build usa `pool: name: docker-build` hardcoded (não `$(POOL_NAME)`)
- [ ] Variable groups carregados com `${{ if eq(...) }}` — não com `$()`
- [ ] Cada stage DeploymentDocker tem `dependsOn: []` explícito
- [ ] Pipeline executada manualmente no ADO e validada antes de habilitar o trigger

---

## 4. Variáveis de Ambiente

> As variáveis de ambiente da aplicação devem ser configuradas nos **Variable Groups do ADO** antes de executar a pipeline. Os valores declarados no `docker-compose.prod.yml` (sem valor hardcoded) serão injetados em runtime pelo agente ADO a partir desses grupos. Sem os Variable Groups configurados corretamente, a pipeline não consegue passar os valores para os containers.

- [ ] Todas as variáveis necessárias estão documentadas (nomes e finalidade)
- [ ] Nenhuma variável sensível em texto claro em nenhum arquivo commitado
- [ ] Variable Groups criados no ADO para cada ambiente configurado

---

## 5. Health Check

- [ ] Endpoint `/api/health` implementado na aplicação, retornando HTTP 200
- [ ] Testado localmente: `curl http://localhost:<PORT>/api/health`
- [ ] Testado no container: `docker run --rm -e ... <image> wget -qO- http://127.0.0.1/api/health`

---

## 6. Validação final

- [ ] Build local sem erros: `docker build -t <app>:test .`
- [ ] Container sobe e health check passa: `docker run --rm -p 8080:80 <app>:test`
- [ ] Nenhum `.env`, senha ou token no histórico de commits: `git log --all -p | grep -iE "password|secret|token|key" | grep -v "^-"`
- [ ] Pipeline ADO testada em ambiente não-prod antes do merge para a branch de produção
