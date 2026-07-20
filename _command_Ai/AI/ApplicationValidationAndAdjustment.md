# Validação da Aplicação Atual e Ajustes Controlados

## Objetivo

Auditar a aplicação existente, comparar com os PRDs e aplicar somente os ajustes necessários para atingir a arquitetura alvo, sem romper funcionalidades atuais e sem alterar o processo existente de API keys.

## Etapa 1 — Inventário obrigatório

Inspecionar e documentar:

- árvore do repositório;
- frontend, backend, workers e banco;
- Dockerfile(s) e compose;
- arquivos de configuração;
- mecanismo de carregamento de ambiente;
- nomes das variáveis de API key, sem mostrar valores;
- provider de IA atual;
- modelos SQLAlchemy e migrations;
- endpoints existentes;
- testes;
- scripts de execução;
- dependências e versões.

## Etapa 2 — Política de API keys

Manter como está:

- nomes das variáveis;
- arquivos e módulos responsáveis pelo carregamento;
- precedência entre ambiente local, container e produção;
- provider atual;
- injeção nos serviços;
- rotação e armazenamento, quando existentes.

Não realizar:

- migração automática para outro secret manager;
- renomeação de variáveis;
- duplicação de chaves;
- fallback hardcoded;
- envio de chave ao browser;
- registro de valor em logs, testes, fixtures ou documentação.

Caso seja necessário acrescentar uma nova chave, seguir exatamente o padrão atual e adicionar apenas o nome vazio no arquivo de exemplo apropriado.

## Etapa 3 — Matriz de conformidade

Criar tabela com:

| Área | Estado atual | Requisito PRD | Gap | Ação | Risco |
|---|---|---|---|---|---|

Áreas mínimas:
- estrutura;
- dados;
- API;
- frontend;
- CrewAI;
- workers;
- segurança;
- observabilidade;
- testes;
- documentação.

## Etapa 4 — Ajustes

Aplicar em ordem:

1. correções que impedem execução;
2. configuração e Docker;
3. banco e migrations;
4. contratos de API;
5. Daily Briefing Crew;
6. persistência e auditoria;
7. integração com dashboard;
8. testes.

## Etapa 5 — Validação final

Executar:

- build;
- lint;
- type check;
- testes unitários;
- testes de integração;
- migrations em banco limpo;
- subida via Docker Compose;
- health checks;
- execução mock da Daily Briefing Crew;
- consulta do dashboard.

## Saídas obrigatórias

- `docs/current-application-inventory.md`
- `docs/compliance-gap-analysis.md`
- `docs/api-key-handling-baseline.md` sem valores secretos
- `docs/adjustment-report.md`
- lista de arquivos alterados
- comandos executados
- testes e resultados
- riscos remanescentes

## Regra de parada

Se o mecanismo atual de API keys estiver inseguro, não alterá-lo silenciosamente. Documentar o risco e criar recomendação separada, mantendo compatibilidade até aprovação explícita.
