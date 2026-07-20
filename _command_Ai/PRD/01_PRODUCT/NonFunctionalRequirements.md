# Requisitos Não Funcionais

- Segurança: segredos exclusivamente server-side.
- Disponibilidade: health checks de API, banco, Redis e provider.
- Observabilidade: logs estruturados com correlation_id.
- Desempenho: endpoints de leitura p95 abaixo de 800 ms sem execução de IA.
- Resiliência: timeout, retry controlado e fallback.
- Auditabilidade: toda mutação deve possuir ator, origem e timestamp.
- Portabilidade: execução local via Docker Compose.
- Manutenibilidade: modularidade, tipagem e testes automatizados.
