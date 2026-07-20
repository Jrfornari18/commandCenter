# Arquitetura CrewAI

## Crews
- Daily Briefing Crew
- Weekly Planning Crew
- Risk Review Crew
- Smart Inbox Crew

## Processo
Dados normalizados → tasks especializadas → agentes → orquestrador → validação Pydantic → persistência → dashboard.

## Política
CrewAI não substitui services transacionais. Agentes usam tools controladas.
