# Agent C-Level AI Command Center — Pacote de PRDs

Este pacote é a fonte de verdade para geração e evolução da aplicação por Claude Code, Cursor, Lovable e demais assistentes.

## Objetivo

Construir uma aplicação executiva composta por:

- interface web responsiva;
- backend Python/FastAPI;
- PostgreSQL e Redis;
- motor multiagente CrewAI;
- APIs REST versionadas;
- integrações progressivas com Microsoft 365, Azure DevOps, Freshservice e SmartLeader;
- trilha de auditoria, aprovação humana e governança de IA.

## Ordem recomendada de leitura

1. `PRD/00_MASTER_PRD.md`
2. `AI/Claude.md`
3. `AI/ApplicationValidationAndAdjustment.md`
4. PRDs específicos da camada a implementar
5. `PRD/07_EXECUTION/Backlog.md`

## Regra crítica sobre API keys

A implementação deve preservar exatamente o mecanismo atual de carregamento, injeção, armazenamento e uso de API keys existente no repositório. Nenhuma chave deve ser movida, renomeada, exposta, copiada para frontend ou registrada em logs. Alterações somente após inventário e justificativa explícita.
