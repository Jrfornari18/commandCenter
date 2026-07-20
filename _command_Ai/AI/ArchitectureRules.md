# Regras de Arquitetura

- frontend não acessa banco ou provider;
- API não contém regra de negócio complexa;
- agents não acessam infraestrutura sem tools;
- repositories não chamam IA;
- services coordenam transações;
- integração externa isolada por adapter.
