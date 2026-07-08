# deploy-kit — Preparando sua App para Deploy

## O que é este kit

O **deploy-kit** é um guia interativo para o **Claude Code** que ajuda desenvolvedores a preparar suas aplicações para deploy em produção.

Se você desenvolveu sua aplicação com auxílio de IA (vibecoding) e ela funciona bem no seu servidor local via `docker compose up`, este kit vai te guiar para deixá-la pronta para que a equipe de DevOps possa colocá-la em produção.

---

## Para quem é

- Desenvolvedor que criou uma app com IA e quer solicitar deploy em produção
- Aplicações que funcionam localmente via `docker-compose` mas precisam de deploy em Kubernetes (EKS)
- Qualquer stack: Node.js, Python, .NET, Go, etc.

---

## Como usar

### Passo 1 — Copie o deploy-kit para o seu projeto

Abra o terminal na pasta do seu projeto e execute:

```bash
cp -r /caminho/onde/baixou/deploy-kit/ ./deploy-kit/
```

Após copiar, a estrutura do seu projeto ficará assim:

```
seu-projeto/
├── deploy-kit/          ← kit copiado aqui
│   ├── SKILL.md
│   ├── README.md        ← este arquivo
│   └── app-auditor.md
├── frontend/
├── backend/
├── docker-compose.yml
└── ...
```

### Passo 2 — Abra o Claude Code na raiz do seu projeto

No terminal, dentro da pasta do seu projeto, execute:

```bash
claude
```

Ou abra o Claude Code pelo seu editor e certifique-se de que está na pasta do projeto.

### Passo 3 — Invoque o skill de preparação para deploy

No chat do Claude Code, escreva:

```
@deploy-kit/SKILL.md prepare minha app para deploy
```

O Claude Code vai:
1. Analisar a estrutura do seu projeto
2. Identificar o frontend e o backend
3. Gerar o **Dockerfile** no formato correto para produção
4. Verificar se há senhas ou tokens expostos nos seus arquivos
5. Verificar se existe o endpoint `/api/health` (obrigatório para o EKS)
6. Gerar o documento **`DEPLOY-HANDOFF.md`** para enviar à equipe de DevOps

### Passo 4 — Envie para o DevOps

Após o Claude Code terminar:

1. Certifique-se de que o `Dockerfile` foi gerado/atualizado na raiz do projeto
2. Envie o arquivo `DEPLOY-HANDOFF.md` (gerado na raiz) para a equipe de DevOps
3. Compartilhe o link do seu repositório (com o `Dockerfile` atualizado)

---

## Verificar se sua app está pronta (auditoria)

Antes de chamar a equipe de DevOps, você pode fazer uma auditoria completa da sua app:

```
@deploy-kit/app-auditor.md audite minha app
```

O auditor vai gerar um relatório dizendo o que está OK e o que precisa ser corrigido antes do deploy.

---

## O que é o Dockerfile multi-stage e por que é obrigatório

No seu servidor local, o `docker-compose` sobe containers separados para o frontend e o backend. O ambiente de produção (EKS/Kubernetes) **não funciona assim** — ele precisa de uma única imagem com tudo junto.

O Dockerfile multi-stage coloca frontend e backend em uma única imagem:

```
Seu docker-compose local:              Produção (EKS):
┌──────────┐  ┌──────────┐           ┌──────────────────────────┐
│ frontend │  │ backend  │   →→→     │  nginx + backend         │
│ :3000    │  │ :8000    │           │  um único container       │
└──────────┘  └──────────┘           └──────────────────────────┘
```

O skill cuida de gerar esse Dockerfile para você.

---

## Arquivos deste kit

| Arquivo | Para quem | Função |
|---------|-----------|--------|
| `README.md` | Desenvolvedor | Instruções de uso (este arquivo) |
| `SKILL.md` | Claude Code | Skill principal com todos os padrões de deploy |
| `app-auditor.md` | Claude Code | Auditor — verifica se a app está pronta para deploy |

---

## Perguntas frequentes

**Minha app não tem frontend, é só uma API. Funciona?**
Sim. O skill identifica automaticamente quando não há frontend e usa o padrão de API pura.

**Minha app usa Python/FastAPI, não Node.js. Funciona?**
Sim. O skill suporta Node.js, Python, .NET, Go e outros backends. Ele identifica a linguagem automaticamente.

**O Claude Code vai modificar meu código?**
Apenas o `Dockerfile` e possivelmente o `docker-compose.yml` (se precisar de ajustes). O código da sua aplicação não será alterado.

**Tenho senhas no meu docker-compose.yml. O que faço?**
O skill vai identificar isso e te avisar. Você precisará remover as senhas do arquivo antes de continuar. As senhas serão configuradas pela equipe de DevOps na plataforma de forma segura.
