const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Copastur C-Level AI Command Center — API',
      version: '2.0.0',
      description:
        'API do AI Command Center: chat estratégico com IA (7 Expectativas de C-Level), ' +
        'dashboard executivo, decisões/riscos e integrações (Azure DevOps, Freshservice, ' +
        'Microsoft Graph, Work/Plane TI Boards, SmartLeader OKRs).\n\n' +
        'Toda ação consequencial de integração retorna `requires_human_approval: true` e ' +
        'nunca é executada automaticamente. Faça login em **Auth → /auth/login** e cole o ' +
        '`token` retornado no botão **Authorize** para testar as rotas protegidas.'
    },
    servers: [
      { url: '/api', description: 'Servidor atual (via proxy nginx ou direto)' }
    ],
    tags: [
      { name: 'Auth', description: 'Autenticação e sessão' },
      { name: 'Chat', description: 'Strategic Chat — IA Command Center' },
      { name: 'Dashboard', description: 'Pulso executivo consolidado' },
      { name: 'Integrations — Azure DevOps', description: 'copastur-dev · 186 projetos' },
      { name: 'Integrations — Freshservice', description: 'ITSM · copastur.freshservice.com' },
      { name: 'Integrations — Work/Plane', description: '4 TI Boards' },
      { name: 'Integrations — Microsoft Graph', description: 'Calendar & Email (OAuth)' },
      { name: 'Integrations — SmartLeader', description: 'OKRs' },
      { name: 'Integrations — Geral', description: 'Status e sync agregado de todas as integrações' },
      { name: 'Decisions & Risks', description: 'Gestão executiva' },
      { name: 'Expectativas', description: 'As 7 Expectativas de C-Level' },
      { name: 'Users', description: 'Gestão de usuários (admin/ceo)' },
      { name: 'Admin — API Keys', description: 'Configuração de credenciais de integração (admin-only)' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Mensagem de erro' } }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            full_name: { type: 'string' },
            avatar_initials: { type: 'string' },
            role_name: { type: 'string', example: 'admin' },
            role_label: { type: 'string', example: 'Platform Administrator' },
            is_active: { type: 'boolean' },
            last_login_at: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        Conversation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            domain: { type: 'string', nullable: true },
            expectativas: { type: 'array', items: { type: 'integer' } },
            message_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        AiParsedResponse: {
          type: 'object',
          description: 'Resposta estruturada da IA (schema completo) ou { simple: true, text } para perguntas diretas',
          properties: {
            simple: { type: 'boolean' },
            text: { type: 'string' },
            expectativas_aplicadas: { type: 'array', items: { type: 'string' }, example: ['01 — Visão Sistêmica'] },
            executive_summary: { type: 'array', items: { type: 'string' } },
            assessment: { type: 'string' },
            recommendation: { type: 'string' },
            phases: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  phase: { type: 'string' }, objective: { type: 'string' }, actions: { type: 'string' },
                  owner: { type: 'string' }, kpi: { type: 'string' }, risk: { type: 'string' }
                }
              }
            },
            risks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string' }, level: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                  description: { type: 'string' }, mitigation: { type: 'string' }
                }
              }
            },
            decision_required: { type: 'string' },
            next_action: { type: 'string' }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['user', 'assistant'] },
            content: { type: 'string' },
            parsed_response: { $ref: '#/components/schemas/AiParsedResponse' },
            expectativas: { type: 'array', items: { type: 'integer' } },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Decision: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            titulo: { type: 'string' },
            descricao: { type: 'string' },
            prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
            status: { type: 'string', example: 'pendente' },
            responsavel: { type: 'string' },
            prazo: { type: 'string', format: 'date', nullable: true },
            expectativa_id: { type: 'string', format: 'uuid', nullable: true },
            expectativa_titulo: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Risk: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            area: { type: 'string' },
            nivel: { type: 'string', enum: ['baixo', 'medio', 'alto', 'critico'] },
            descricao: { type: 'string' },
            mitigacao: { type: 'string' },
            status: { type: 'string', example: 'ativo' },
            expectativa_id: { type: 'string', format: 'uuid', nullable: true }
          }
        },
        Expectativa: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            numero: { type: 'integer', example: 1 },
            titulo: { type: 'string' },
            descricao: { type: 'string' },
            prompt_base: { type: 'string' }
          }
        },
        AdoWorkstreamSummary: {
          type: 'object',
          properties: {
            workstream: { type: 'string', example: 'AI-First' },
            total: { type: 'integer' }, done: { type: 'integer' },
            epics: { type: 'integer' }, bugs: { type: 'integer' }
          }
        },
        AdoWorkItem: {
          type: 'object',
          properties: {
            ado_id: { type: 'integer' }, project: { type: 'string' },
            work_item_type: { type: 'string', example: 'User Story' },
            title: { type: 'string' }, state: { type: 'string' },
            assigned_to: { type: 'string', nullable: true },
            iteration_path: { type: 'string' }, workstream: { type: 'string', nullable: true },
            priority: { type: 'integer', nullable: true }, story_points: { type: 'number', nullable: true },
            changed_date: { type: 'string', format: 'date-time' }
          }
        },
        FsTicket: {
          type: 'object',
          properties: {
            fs_id: { type: 'integer' }, subject: { type: 'string' },
            status: { type: 'string' }, priority: { type: 'string' },
            category: { type: 'string', nullable: true }, created_at_fs: { type: 'string', format: 'date-time' }
          }
        },
        WorkIssue: {
          type: 'object',
          properties: {
            plane_id: { type: 'string' }, project_plane_id: { type: 'string' },
            board_name: { type: 'string' }, title: { type: 'string' },
            state: { type: 'string' }, state_group: { type: 'string' },
            priority: { type: 'string' }, due_date: { type: 'string', format: 'date', nullable: true }
          }
        },
        OkrObjective: {
          type: 'object',
          properties: {
            title: { type: 'string' }, owner: { type: 'string' }, cycle: { type: 'string' },
            status: { type: 'string', enum: ['on_track', 'at_risk', 'off_track'] },
            progress: { type: 'number' }
          }
        },
        CalendarEvent: {
          type: 'object',
          properties: {
            subject: { type: 'string' }, start_dt: { type: 'string', format: 'date-time' },
            end_dt: { type: 'string', format: 'date-time' }, is_online: { type: 'boolean' }
          }
        },
        EmailDigestItem: {
          type: 'object',
          properties: {
            subject: { type: 'string' }, from_name: { type: 'string' }, from_email: { type: 'string' },
            received_at: { type: 'string', format: 'date-time' }, is_read: { type: 'boolean' }
          }
        },
        IntegrationStatus: {
          type: 'object',
          properties: {
            integration: { type: 'string', example: 'azure_devops' },
            status: { type: 'string', enum: ['idle', 'running', 'success', 'error'] },
            last_sync_at: { type: 'string', format: 'date-time', nullable: true },
            items_synced: { type: 'integer' },
            error_msg: { type: 'string', nullable: true }
          }
        },
        CredentialField: {
          type: 'object',
          description: 'Nunca contém o valor real de campos secretos — apenas os últimos 4 caracteres mascarados',
          properties: {
            key: { type: 'string', example: 'ADO_PAT' },
            label: { type: 'string', example: 'Personal Access Token' },
            secret: { type: 'boolean' },
            configured: { type: 'boolean' },
            source: { type: 'string', enum: ['database', 'env', 'none'] },
            masked_value: { type: 'string', example: '••••••••1234' },
            updated_at: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        CredentialGroup: {
          type: 'object',
          properties: {
            integration: { type: 'string', example: 'azure_devops' },
            label: { type: 'string', example: 'Azure DevOps' },
            fields: { type: 'array', items: { $ref: '#/components/schemas/CredentialField' } }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
