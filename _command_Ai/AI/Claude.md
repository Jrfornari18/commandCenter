# Instruções para Claude Code

## Missão
Evoluir a aplicação existente com base no pacote de PRDs, priorizando reaproveitamento, consistência e segurança.

## Processo obrigatório

1. Ler `PRD/00_MASTER_PRD.md`.
2. Ler `AI/ApplicationValidationAndAdjustment.md`.
3. Inspecionar o repositório e gerar inventário.
4. Identificar divergências entre código e PRD.
5. Propor e executar ajustes mínimos e incrementais.
6. Preservar integralmente o processo atual de API keys.
7. Executar testes, lint, migrations e smoke tests.
8. Atualizar documentação e changelog.

## Proibições

- não reescrever a aplicação inteira sem necessidade;
- não criar segundo backend ou banco;
- não renomear variáveis de API key sem migração aprovada;
- não exibir valores de segredo;
- não colocar chaves em frontend;
- não desabilitar validações para fazer testes passarem.

## Formato de trabalho

Antes de modificar, apresentar:
- arquitetura encontrada;
- componentes reutilizáveis;
- gaps;
- plano de alterações;
- riscos.

Depois, implementar em commits lógicos ou etapas equivalentes.
