const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const adoClient = require('../integrations/azure_devops/client');
const graphClient = require('../integrations/microsoft_graph/client');
const fsClient = require('../integrations/freshservice/client');
const workClient = require('../integrations/work_plane/client');
const okrClient = require('../integrations/smartleader/client');
const credentialStore = require('../services/credentialStore');
const credentialTest = require('../services/credentialTest');
const syncRoutine = require('../services/syncRoutine');
const { SMARTLEADER_ENABLED } = require('../config/integrationFlags');

const router = express.Router();

// ================================================================
// AUTH
// ================================================================

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: admin@copastur.com.br }
 *               password: { type: string, format: password, minLength: 6 }
 *     responses:
 *       200:
 *         description: Login OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400: { description: Payload inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: Credenciais inválidas ou conta desativada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const { email, password } = req.body;
    const { rows } = await db.query(
      `SELECT u.*, r.name as role_name, r.label as role_label, r.level as role_level
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = $1`, [email]);

    if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const user = rows[0];
    if (!user.is_active) return res.status(401).json({ error: 'Conta desativada' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await db.query(`INSERT INTO audit_log (user_id, action, ip_address) VALUES ($1,'login_failed',$2)`, [user.id, req.ip]);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role_name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    await db.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]);
    await db.query(`INSERT INTO audit_log (user_id, action, ip_address) VALUES ($1,'login_success',$2)`, [user.id, req.ip]);

    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, avatar_initials: user.avatar_initials, role_name: user.role_name, role_label: user.role_label } });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Usuário autenticado atual
 *     responses:
 *       200:
 *         description: OK
 *         content: { application/json: { schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } } } }
 *       401: { description: Token ausente/inválido/expirado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/auth/me', authenticate, (req, res) => res.json({ user: req.user }));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Encerrar sessão (audit log)
 *     responses:
 *       200: { description: OK }
 */
router.post('/auth/logout', authenticate, async (req, res) => {
  await db.query(`INSERT INTO audit_log (user_id, action, ip_address) VALUES ($1,'logout',$2)`, [req.user.id, req.ip]);
  res.json({ message: 'Sessão encerrada' });
});

// ================================================================
// CHAT (AI Command Center)
// ================================================================

const SYSTEM_PROMPT = `Você é o C-Level AI Command Center da Copastur: conselheiro executivo de alto nível para CEOs, CTOs, CPTOs, CIOs, CFOs, COOs e board members.

AS 7 EXPECTATIVAS DE C-LEVEL — COPASTUR (contrato de liderança, critério de permanência em 2025):
1. Visão Sistêmica + Execução Impecável
2. Comportamento de Sócio ("se isso fosse 100% meu patrimônio, eu faria assim?")
3. Liderança que Forma Líderes
4. Dados acima de Opiniões, com sensibilidade humana
5. Guardiões da Cultura ("cultura não é slide, é decisão difícil tomada corretamente")
6. Inquietação Positiva e Visão de Futuro
7. Alinhamento Radical com o CEO (conselho ativo + braço executor)

CONTEXTO OPERACIONAL COPASTUR — WORKSTREAMS Q2/Q3 2026:
- AI-First: agentes de IA em produção, automação de operações
- SmartHotel: automação reservas corporativas (Virginia/Gustavo Bergamini stakeholders)
- SmartSaving: módulo de recompra (Ernani Torquato lead dev)
- Smart Integration: projetos de integração para clientes
- CMais/C+ & Zuri: evolução das plataformas core
- 8BPay, PME Fast: produtos financeiros e PME

REGRA CRÍTICA: Toda ação consequencial (enviar email, aprovar orçamento, atualizar Azure DevOps, fechar ticket, comunicação com cliente) retorna requires_human_approval: true e NUNCA é executada automaticamente.

Responda APENAS com JSON válido:
{
  "expectativas_aplicadas": ["01 — Visão Sistêmica"],
  "executive_summary": ["bullet 1", "bullet 2", "bullet 3"],
  "assessment": "avaliação crítica",
  "recommendation": "direção recomendada com trade-offs",
  "phases": [{"phase":"nome","objective":"obj","actions":"ações","owner":"papel","kpi":"métrica","risk":"risco"}],
  "risks": [{"area":"área","level":"High|Medium|Low","description":"desc","mitigation":"mit"}],
  "decision_required": "O que decidir agora",
  "next_action": "Próximo passo concreto e imediato"
}

Para perguntas simples: {"simple": true, "text": "resposta direta"}`;

/**
 * @openapi
 * /chat/conversations:
 *   get:
 *     tags: [Chat]
 *     summary: Lista conversas do usuário (até 50, não arquivadas)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { conversations: { type: array, items: { $ref: '#/components/schemas/Conversation' } } } } } } }
 */
router.get('/chat/conversations', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.title, c.domain, c.expectativas, c.created_at, c.updated_at, COUNT(m.id) as message_count
     FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id AND m.role!='system'
     WHERE c.user_id=$1 AND c.is_archived=FALSE GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 50`,
    [req.user.id]);
  res.json({ conversations: rows });
});

/**
 * @openapi
 * /chat/conversations:
 *   post:
 *     tags: [Chat]
 *     summary: Cria nova conversa
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               domain: { type: string, example: 'Estratégia Corporativa' }
 *     responses:
 *       201: { description: Criada, content: { application/json: { schema: { type: object, properties: { conversation: { $ref: '#/components/schemas/Conversation' } } } } } }
 */
router.post('/chat/conversations', authenticate, async (req, res) => {
  const { title, domain } = req.body;
  const { rows } = await db.query(
    `INSERT INTO conversations (user_id, title, domain) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.id, title || 'Nova conversa', domain || null]);
  res.status(201).json({ conversation: rows[0] });
});

/**
 * @openapi
 * /chat/conversations/{id}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: Lista mensagens de uma conversa
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { messages: { type: array, items: { $ref: '#/components/schemas/Message' } } } } } } }
 *       404: { description: Conversa não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/chat/conversations/:id/messages', authenticate, async (req, res) => {
  const { rows: conv } = await db.query('SELECT id FROM conversations WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!conv.length) return res.status(404).json({ error: 'Conversa não encontrada' });
  const { rows } = await db.query(
    `SELECT id, role, content, parsed_response, expectativas, created_at FROM messages
     WHERE conversation_id=$1 AND role!='system' ORDER BY created_at ASC`, [req.params.id]);
  res.json({ messages: rows });
});

/**
 * @openapi
 * /chat/conversations/{id}/messages:
 *   post:
 *     tags: [Chat]
 *     summary: Envia mensagem e recebe resposta estruturada da IA (Claude)
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties: { content: { type: string } }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { message: { $ref: '#/components/schemas/Message' } } } } } }
 *       400: { description: Mensagem vazia, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Conversa não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/chat/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Mensagem vazia' });

    const { rows: conv } = await db.query('SELECT * FROM conversations WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!conv.length) return res.status(404).json({ error: 'Conversa não encontrada' });

    await db.query(`INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user',$2)`, [req.params.id, content]);

    const { rows: history } = await db.query(
      `SELECT role, content FROM messages WHERE conversation_id=$1 ORDER BY created_at ASC`, [req.params.id]);

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': credentialStore.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, system: SYSTEM_PROMPT, messages: history.map(m => ({ role: m.role, content: m.content })) })
    });
    const aiData = await aiRes.json();
    const aiText = aiData.content?.[0]?.text || '{"simple":true,"text":"Erro ao obter resposta."}';

    let parsed = null;
    let expectativas = [];
    try {
      const m = aiText.match(/\{[\s\S]*\}/);
      if (m) {
        parsed = JSON.parse(m[0]);
        if (parsed.expectativas_aplicadas?.length) {
          expectativas = parsed.expectativas_aplicadas.map(e => parseInt(e)).filter(n => n >= 1 && n <= 7);
        }
      }
    } catch (_) {}

    const { rows: [aiMsg] } = await db.query(
      `INSERT INTO messages (conversation_id, role, content, parsed_response, expectativas, tokens_used)
       VALUES ($1,'assistant',$2,$3,$4,$5) RETURNING *`,
      [req.params.id, aiText, JSON.stringify(parsed), expectativas, aiData.usage?.output_tokens || 0]);

    if (!conv[0].title || conv[0].title === 'Nova conversa') {
      await db.query(`UPDATE conversations SET title=$1, expectativas=$2 WHERE id=$3`,
        [content.substring(0, 80), expectativas, req.params.id]);
    }

    res.json({ message: { id: aiMsg.id, role: 'assistant', content: aiText, parsed_response: parsed, expectativas, created_at: aiMsg.created_at } });
  } catch (err) {
    console.error('[CHAT]', err);
    res.status(500).json({ error: 'Erro ao processar mensagem' });
  }
});

/**
 * @openapi
 * /chat/conversations/{id}:
 *   delete:
 *     tags: [Chat]
 *     summary: Arquiva uma conversa (soft delete)
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/chat/conversations/:id', authenticate, async (req, res) => {
  await db.query(`UPDATE conversations SET is_archived=TRUE WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
  res.json({ message: 'Arquivada' });
});

// ================================================================
// DASHBOARD
// ================================================================

/**
 * @openapi
 * /dashboard:
 *   get:
 *     tags: [Dashboard]
 *     summary: Pulso executivo consolidado (métricas + integrações + KPIs)
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     decisions: { type: object, properties: { total: { type: string }, pendentes: { type: string } } }
 *                     risks: { type: object, properties: { total: { type: string }, criticos: { type: string } } }
 *                     iniciativas: { type: object, properties: { total: { type: string }, ativos: { type: string } } }
 *                     conversations: { type: object, properties: { total: { type: string } } }
 *                 integrations: { type: array, items: { $ref: '#/components/schemas/IntegrationStatus' } }
 *                 ado_workstreams: { type: array, items: { $ref: '#/components/schemas/AdoWorkstreamSummary' } }
 *                 freshservice_kpis: { type: object }
 *                 work_kpis: { type: object }
 *                 okr_summary: { type: array, items: { $ref: '#/components/schemas/OkrObjective' } }
 *       500: { description: Erro ao carregar dashboard, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const [decisions, risks, iniciativas, conversations, integrationStatus, adoKPIs, fsKPIs, workKPIs] = await Promise.all([
      db.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='pendente') as pendentes FROM decisions WHERE user_id=$1`, [uid]),
      db.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE nivel IN ('critico','alto')) as criticos FROM riscos WHERE user_id=$1 AND status='ativo'`, [uid]),
      db.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='ativo') as ativos FROM iniciativas WHERE user_id=$1`, [uid]),
      db.query(`SELECT COUNT(*) as total FROM conversations WHERE user_id=$1 AND is_archived=FALSE`, [uid]),
      db.query(`SELECT integration, status, last_sync_at, items_synced, error_msg FROM integration_sync ORDER BY integration`),
      adoClient.getWorkstreamSummary(),
      fsClient.getTicketKPIs(),
      workClient.getKPIs()
    ]);

    const okrSummary = SMARTLEADER_ENABLED ? await okrClient.getOKRSummary('Q2-2026') : [];

    res.json({
      metrics: {
        decisions: decisions.rows[0],
        risks: risks.rows[0],
        iniciativas: iniciativas.rows[0],
        conversations: conversations.rows[0]
      },
      integrations: integrationStatus.rows,
      ado_workstreams: adoKPIs,
      freshservice_kpis: fsKPIs,
      work_kpis: workKPIs,
      okr_summary: okrSummary.slice(0, 5)
    });
  } catch (err) {
    console.error('[DASHBOARD]', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// ================================================================
// INTEGRATIONS
// ================================================================

// Azure DevOps
/**
 * @openapi
 * /integrations/ado/workstreams:
 *   get:
 *     tags: [Integrations — Azure DevOps]
 *     summary: Resumo por workstream (IterationPath Q2-2026)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { workstreams: { type: array, items: { $ref: '#/components/schemas/AdoWorkstreamSummary' } } } } } } }
 */
router.get('/integrations/ado/workstreams', authenticate, async (req, res) => {
  const data = await adoClient.getWorkstreamSummary();
  res.json({ workstreams: data });
});

/**
 * @openapi
 * /integrations/ado/items:
 *   get:
 *     tags: [Integrations — Azure DevOps]
 *     summary: Lista work items sincronizados (filtráveis)
 *     parameters:
 *       - { name: workstream, in: query, schema: { type: string }, example: AI-First }
 *       - { name: type, in: query, schema: { type: string }, example: Bug }
 *       - { name: state, in: query, schema: { type: string }, example: Active }
 *       - { name: limit, in: query, schema: { type: integer, default: 50 } }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { items: { type: array, items: { $ref: '#/components/schemas/AdoWorkItem' } } } } } } }
 */
router.get('/integrations/ado/items', authenticate, async (req, res) => {
  const { workstream, type, state, limit = 50 } = req.query;
  let where = [];
  let params = [];
  if (workstream) { params.push(workstream); where.push(`workstream=$${params.length}`); }
  if (type) { params.push(type); where.push(`work_item_type=$${params.length}`); }
  if (state) { params.push(state); where.push(`state=$${params.length}`); }
  params.push(parseInt(limit));
  const { rows } = await db.query(
    `SELECT ado_id, project, work_item_type, title, state, assigned_to, iteration_path, workstream, priority, story_points, changed_date
     FROM ado_work_items ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY changed_date DESC LIMIT $${params.length}`, params);
  res.json({ items: rows });
});

/**
 * @openapi
 * /integrations/ado/sync:
 *   post:
 *     tags: [Integrations — Azure DevOps]
 *     summary: Sincroniza work items dos projetos configurados (ADO_SYNC_PROJECTS)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { synced: { type: integer }, projects: { type: array, items: { type: string } } } } } } }
 *       500: { description: Erro, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/integrations/ado/sync', authenticate, async (req, res) => {
  const projects = (credentialStore.get('ADO_SYNC_PROJECTS') || 'Q2-2026').split(',').map(p => p.trim());
  try {
    let total = 0;
    for (const project of projects) {
      const synced = await adoClient.syncProject(project);
      total += synced;
    }
    res.json({ synced: total, projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Freshservice
/**
 * @openapi
 * /integrations/freshservice/tickets:
 *   get:
 *     tags: [Integrations — Freshservice]
 *     summary: Tickets recentes + KPIs
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 20 } }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tickets: { type: array, items: { $ref: '#/components/schemas/FsTicket' } }
 *                 kpis: { type: object, properties: { total: { type: integer }, open_count: { type: integer }, urgent_count: { type: integer }, overdue_count: { type: integer } } }
 */
router.get('/integrations/freshservice/tickets', authenticate, async (req, res) => {
  const { limit = 20 } = req.query;
  const tickets = await fsClient.getRecentTickets(parseInt(limit));
  const kpis = await fsClient.getTicketKPIs();
  res.json({ tickets, kpis });
});

/**
 * @openapi
 * /integrations/freshservice/sync:
 *   post:
 *     tags: [Integrations — Freshservice]
 *     summary: Sincroniza tickets abertos do Freshservice
 *     responses:
 *       200: { description: OK }
 *       500: { description: Erro, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/integrations/freshservice/sync', authenticate, async (req, res) => {
  try {
    const result = await fsClient.syncTickets();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Work/Plane TI Boards
/**
 * @openapi
 * /integrations/work/boards:
 *   get:
 *     tags: [Integrations — Work/Plane]
 *     summary: Os 4 TI Boards com totais + KPIs agregados
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { boards: { type: array, items: { type: object } }, kpis: { type: object } } } } } }
 */
router.get('/integrations/work/boards', authenticate, async (req, res) => {
  const boards = await workClient.getIssuesByBoard();
  const kpis = await workClient.getKPIs();
  res.json({ boards, kpis });
});

/**
 * @openapi
 * /integrations/work/issues:
 *   get:
 *     tags: [Integrations — Work/Plane]
 *     summary: Lista issues sincronizadas (filtráveis)
 *     parameters:
 *       - { name: board, in: query, schema: { type: string }, description: 'plane_id do board' }
 *       - { name: priority, in: query, schema: { type: string }, example: urgent }
 *       - { name: state_group, in: query, schema: { type: string }, example: started }
 *       - { name: limit, in: query, schema: { type: integer, default: 30 } }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { issues: { type: array, items: { $ref: '#/components/schemas/WorkIssue' } } } } } } }
 */
router.get('/integrations/work/issues', authenticate, async (req, res) => {
  const { board, priority, state_group, limit = 30 } = req.query;
  let where = []; let params = [];
  if (board) { params.push(board); where.push(`project_plane_id=$${params.length}`); }
  if (priority) { params.push(priority); where.push(`priority=$${params.length}`); }
  if (state_group) { params.push(state_group); where.push(`state_group=$${params.length}`); }
  params.push(parseInt(limit));
  const { rows } = await db.query(
    `SELECT i.*, p.name as board_name FROM work_issues i JOIN work_projects p ON p.plane_id=i.project_plane_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.updated_at_plane DESC NULLS LAST LIMIT $${params.length}`, params);
  res.json({ issues: rows });
});

/**
 * @openapi
 * /integrations/work/sync:
 *   post:
 *     tags: [Integrations — Work/Plane]
 *     summary: Sincroniza issues dos 4 TI Boards
 *     responses:
 *       200: { description: OK }
 *       500: { description: Erro, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/integrations/work/sync', authenticate, async (req, res) => {
  try {
    const result = await workClient.syncTIBoards();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Microsoft Graph
/**
 * @openapi
 * /integrations/graph/calendar:
 *   get:
 *     tags: [Integrations — Microsoft Graph]
 *     summary: Próximos eventos do calendário do usuário (48h)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { events: { type: array, items: { $ref: '#/components/schemas/CalendarEvent' } } } } } } }
 */
router.get('/integrations/graph/calendar', authenticate, async (req, res) => {
  const events = await graphClient.getUpcomingEvents(req.user.id, 48);
  res.json({ events });
});

/**
 * @openapi
 * /integrations/graph/email:
 *   get:
 *     tags: [Integrations — Microsoft Graph]
 *     summary: Emails recentes do usuário (48h, top 20)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { emails: { type: array, items: { $ref: '#/components/schemas/EmailDigestItem' } } } } } } }
 */
router.get('/integrations/graph/email', authenticate, async (req, res) => {
  const emails = await graphClient.getRecentEmails(req.user.id, 20);
  res.json({ emails });
});

/**
 * @openapi
 * /integrations/graph/sync:
 *   post:
 *     tags: [Integrations — Microsoft Graph]
 *     summary: Sincroniza calendário e email do usuário autenticado
 *     responses:
 *       200: { description: OK }
 *       500: { description: Erro, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/integrations/graph/sync', authenticate, async (req, res) => {
  try {
    const [cal, email] = await Promise.all([
      graphClient.syncCalendar(req.user.id),
      graphClient.syncEmail(req.user.id)
    ]);
    res.json({ calendar: cal, email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * @openapi
 * /integrations/graph/auth-url:
 *   get:
 *     tags: [Integrations — Microsoft Graph]
 *     summary: Gera a URL de autorização OAuth (MSAL) para conectar a conta Microsoft
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { url: { type: string, format: uri } } } } } }
 */
router.get('/integrations/graph/auth-url', authenticate, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id, ts: Date.now() })).toString('base64');
  const url = graphClient.getAuthUrl(state);
  res.json({ url });
});

// SmartLeader / OKRs
/**
 * @openapi
 * /integrations/okr/summary:
 *   get:
 *     tags: [Integrations — SmartLeader]
 *     summary: Resumo dos objetivos/OKRs por ciclo
 *     parameters:
 *       - { name: cycle, in: query, schema: { type: string, default: Q2-2026 } }
 *     responses:
 *       200: { description: 'OK — se a integração estiver desativada, retorna objectives vazio com disabled: true', content: { application/json: { schema: { type: object, properties: { objectives: { type: array, items: { $ref: '#/components/schemas/OkrObjective' } }, cycle: { type: string }, disabled: { type: boolean } } } } } }
 */
router.get('/integrations/okr/summary', authenticate, async (req, res) => {
  const { cycle = 'Q2-2026' } = req.query;
  if (!SMARTLEADER_ENABLED) return res.json({ objectives: [], cycle, disabled: true, message: 'Integração SmartLeader desativada' });
  const data = await okrClient.getOKRSummary(cycle);
  res.json({ objectives: data, cycle });
});

/**
 * @openapi
 * /integrations/okr/sync:
 *   post:
 *     tags: [Integrations — SmartLeader]
 *     summary: Sincroniza OKRs de um ciclo
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { cycle: { type: string, default: Q2-2026 } } }
 *     responses:
 *       200: { description: OK }
 *       500: { description: Erro, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       503: { description: Integração desativada, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/integrations/okr/sync', authenticate, async (req, res) => {
  if (!SMARTLEADER_ENABLED) return res.status(503).json({ error: 'Integração SmartLeader desativada' });
  try {
    const { cycle = 'Q2-2026' } = req.body;
    const result = await okrClient.syncOKRs(cycle);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync status
/**
 * @openapi
 * /integrations/status:
 *   get:
 *     tags: [Integrations — Geral]
 *     summary: Status de sincronização de todas as integrações
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { integrations: { type: array, items: { $ref: '#/components/schemas/IntegrationStatus' } } } } } } }
 */
router.get('/integrations/status', authenticate, async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM integration_sync ORDER BY integration`);
  res.json({ integrations: rows });
});

// Trigger all sync
/**
 * @openapi
 * /integrations/sync-all:
 *   post:
 *     tags: [Integrations — Geral]
 *     summary: Dispara sincronização de ADO, Freshservice, Work/Plane, OKR e Graph em sequência
 *     responses:
 *       200: { description: 'OK — results por integração, cada uma podendo conter { error } se falhar' }
 */
router.post('/integrations/sync-all', authenticate, async (req, res) => {
  const results = await syncRoutine.runFullSync({ graphUserId: req.user.id });
  res.json({ results });
});

// ================================================================
// DECISIONS & RISKS
// ================================================================

/**
 * @openapi
 * /decisions:
 *   get:
 *     tags: [Decisions & Risks]
 *     summary: Lista decisões do usuário
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { decisions: { type: array, items: { $ref: '#/components/schemas/Decision' } } } } } } }
 */
router.get('/decisions', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT d.*, e.titulo as expectativa_titulo FROM decisions d LEFT JOIN expectativas e ON e.id=d.expectativa_id WHERE d.user_id=$1 ORDER BY d.created_at DESC`, [req.user.id]);
  res.json({ decisions: rows });
});

/**
 * @openapi
 * /decisions:
 *   post:
 *     tags: [Decisions & Risks]
 *     summary: Cria decisão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titulo]
 *             properties:
 *               titulo: { type: string }
 *               descricao: { type: string }
 *               prioridade: { type: string, enum: [baixa, media, alta, critica], default: media }
 *               responsavel: { type: string }
 *               prazo: { type: string, format: date }
 *               expectativa_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Criada, content: { application/json: { schema: { type: object, properties: { decision: { $ref: '#/components/schemas/Decision' } } } } } }
 */
router.post('/decisions', authenticate, async (req, res) => {
  const { titulo, descricao, prioridade, responsavel, prazo, expectativa_id } = req.body;
  const { rows } = await db.query(
    `INSERT INTO decisions (user_id, titulo, descricao, prioridade, responsavel, prazo, expectativa_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.id, titulo, descricao, prioridade || 'media', responsavel, prazo || null, expectativa_id || null]);
  res.status(201).json({ decision: rows[0] });
});

/**
 * @openapi
 * /decisions/{id}:
 *   patch:
 *     tags: [Decisions & Risks]
 *     summary: Atualiza status/prioridade/responsável/prazo de uma decisão
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *               prioridade: { type: string, enum: [baixa, media, alta, critica] }
 *               responsavel: { type: string }
 *               prazo: { type: string, format: date }
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { decision: { $ref: '#/components/schemas/Decision' } } } } } }
 *       404: { description: Não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.patch('/decisions/:id', authenticate, async (req, res) => {
  const { status, prioridade, responsavel, prazo } = req.body;
  const { rows } = await db.query(
    `UPDATE decisions SET status=COALESCE($1,status), prioridade=COALESCE($2,prioridade), responsavel=COALESCE($3,responsavel), prazo=COALESCE($4,prazo) WHERE id=$5 AND user_id=$6 RETURNING *`,
    [status, prioridade, responsavel, prazo, req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ decision: rows[0] });
});

/**
 * @openapi
 * /risks:
 *   get:
 *     tags: [Decisions & Risks]
 *     summary: Lista riscos do usuário, ordenados por nível
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { risks: { type: array, items: { $ref: '#/components/schemas/Risk' } } } } } } }
 */
router.get('/risks', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, e.titulo as expectativa_titulo FROM riscos r LEFT JOIN expectativas e ON e.id=r.expectativa_id WHERE r.user_id=$1 ORDER BY CASE r.nivel WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 ELSE 4 END`, [req.user.id]);
  res.json({ risks: rows });
});

/**
 * @openapi
 * /risks:
 *   post:
 *     tags: [Decisions & Risks]
 *     summary: Cria risco
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [area, descricao]
 *             properties:
 *               area: { type: string }
 *               nivel: { type: string, enum: [baixo, medio, alto, critico], default: medio }
 *               descricao: { type: string }
 *               mitigacao: { type: string }
 *               expectativa_id: { type: string, format: uuid }
 *     responses:
 *       201: { description: Criado, content: { application/json: { schema: { type: object, properties: { risk: { $ref: '#/components/schemas/Risk' } } } } } }
 */
router.post('/risks', authenticate, async (req, res) => {
  const { area, nivel, descricao, mitigacao, expectativa_id } = req.body;
  const { rows } = await db.query(
    `INSERT INTO riscos (user_id, area, nivel, descricao, mitigacao, expectativa_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, area, nivel || 'medio', descricao, mitigacao, expectativa_id || null]);
  res.status(201).json({ risk: rows[0] });
});

// ================================================================
// EXPECTATIVAS + USERS
// ================================================================

/**
 * @openapi
 * /expectativas:
 *   get:
 *     tags: [Expectativas]
 *     summary: As 7 Expectativas de C-Level (registros fixos)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { expectativas: { type: array, items: { $ref: '#/components/schemas/Expectativa' } } } } } } }
 */
router.get('/expectativas', authenticate, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM expectativas ORDER BY numero');
  res.json({ expectativas: rows });
});

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Lista usuários (somente admin/ceo)
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { users: { type: array, items: { $ref: '#/components/schemas/User' } } } } } } }
 *       403: { description: Acesso restrito, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/users', authenticate, async (req, res) => {
  if (!['admin', 'ceo'].includes(req.user.role_name)) return res.status(403).json({ error: 'Acesso restrito' });
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.full_name, u.avatar_initials, u.is_active, u.last_login_at, r.name as role_name, r.label as role_label FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC`);
  res.json({ users: rows });
});

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Cria usuário C-Level (somente admin/ceo)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, full_name, role_name]
 *             properties:
 *               email: { type: string, format: email }
 *               full_name: { type: string }
 *               role_name: { type: string, enum: [ceo, cto, cfo, coo, cpto, cio, board, admin] }
 *               password: { type: string, format: password, description: 'Padrão Copastur@2025 se omitido' }
 *     responses:
 *       201: { description: Criado, content: { application/json: { schema: { type: object, properties: { user: { type: object, properties: { id: { type: string }, email: { type: string }, full_name: { type: string } } } } } } } }
 *       400: { description: Email já cadastrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Acesso restrito, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/users', authenticate, async (req, res) => {
  if (!['admin', 'ceo'].includes(req.user.role_name)) return res.status(403).json({ error: 'Acesso restrito' });
  try {
    const { email, full_name, role_name, password } = req.body;
    const hash = await bcrypt.hash(password || 'Copastur@2025', 12);
    const initials = full_name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, avatar_initials) VALUES ($1,$2,$3,(SELECT id FROM roles WHERE name=$4),$5) RETURNING id, email, full_name`,
      [email, hash, full_name, role_name, initials]);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// ================================================================
// ADMIN — API Keys das integrações
// ================================================================

const requireAdmin = (req, res, next) => {
  if (req.user.role_name !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao Administrador' });
  next();
};

/**
 * @openapi
 * /admin/credentials:
 *   get:
 *     tags: [Admin — API Keys]
 *     summary: Lista as API keys de todas as integrações (mascaradas)
 *     description: Nunca retorna o valor real de campos secretos — apenas os últimos 4 caracteres.
 *     responses:
 *       200: { description: OK, content: { application/json: { schema: { type: object, properties: { groups: { type: array, items: { $ref: '#/components/schemas/CredentialGroup' } } } } } } }
 *       403: { description: Acesso restrito ao Administrador, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.get('/admin/credentials', authenticate, requireAdmin, (req, res) => {
  res.json({ groups: credentialStore.listForAdmin() });
});

/**
 * @openapi
 * /admin/credentials:
 *   put:
 *     tags: [Admin — API Keys]
 *     summary: Salva/sobrescreve uma API key (criptografada com AES-256-GCM antes de persistir)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key_name, value]
 *             properties:
 *               key_name: { type: string, example: ADO_PAT, description: 'Uma das chaves conhecidas — ver GET /admin/credentials' }
 *               value: { type: string, format: password }
 *     responses:
 *       200: { description: Salva }
 *       400: { description: Chave desconhecida ou payload inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Acesso restrito ao Administrador, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.put('/admin/credentials', authenticate, requireAdmin, [
  body('key_name').isString().trim().notEmpty(),
  body('value').isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { key_name, value } = req.body;
  if (!credentialStore.getFieldDef(key_name)) return res.status(400).json({ error: 'Chave desconhecida' });

  try {
    await credentialStore.set(key_name, value, req.user.id);
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES ($1,'credential_updated','integration_credential',$2,$3,$4)`,
      [req.user.id, key_name, req.ip, JSON.stringify({ key_name })]);
    res.json({ message: 'Credencial salva' });
  } catch (err) {
    console.error('[ADMIN CREDENTIALS]', err.message);
    res.status(500).json({ error: 'Erro ao salvar credencial' });
  }
});

/**
 * @openapi
 * /admin/credentials/{key_name}:
 *   delete:
 *     tags: [Admin — API Keys]
 *     summary: Remove o override salvo no banco (volta a usar o valor do .env, se houver)
 *     parameters:
 *       - { name: key_name, in: path, required: true, schema: { type: string }, example: ADO_PAT }
 *     responses:
 *       200: { description: Removida }
 *       400: { description: Chave desconhecida, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Acesso restrito ao Administrador, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.delete('/admin/credentials/:key_name', authenticate, requireAdmin, async (req, res) => {
  if (!credentialStore.getFieldDef(req.params.key_name)) return res.status(400).json({ error: 'Chave desconhecida' });
  try {
    await credentialStore.remove(req.params.key_name);
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES ($1,'credential_removed','integration_credential',$2,$3,$4)`,
      [req.user.id, req.params.key_name, req.ip, JSON.stringify({ key_name: req.params.key_name })]);
    res.json({ message: 'Credencial removida — voltando ao valor do .env (se houver)' });
  } catch (err) {
    console.error('[ADMIN CREDENTIALS]', err.message);
    res.status(500).json({ error: 'Erro ao remover credencial' });
  }
});

/**
 * @openapi
 * /admin/credentials/test/{integration}:
 *   post:
 *     tags: [Admin — API Keys]
 *     summary: Testa a conectividade de uma integração com as credenciais atualmente ativas
 *     description: Faz uma chamada real, somente leitura, contra a API externa (DB override > .env) para validar as credenciais. Nenhum dado é escrito no sistema externo nem persistido no banco.
 *     parameters:
 *       - { name: integration, in: path, required: true, schema: { type: string }, example: azure_devops, description: 'anthropic | azure_devops | microsoft_graph | freshservice | work_plane | smartleader' }
 *     responses:
 *       200: { description: Resultado do teste, content: { application/json: { schema: { type: object, properties: { ok: { type: boolean }, message: { type: string } } } } } }
 *       400: { description: Integração desconhecida, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Acesso restrito ao Administrador, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/admin/credentials/test/:integration', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await credentialTest.testIntegration(req.params.integration);
    res.json(result);
  } catch (err) {
    if (err.message === 'Integração desconhecida') return res.status(400).json({ error: err.message });
    console.error('[ADMIN CREDENTIALS TEST]', err.message);
    res.status(500).json({ ok: false, message: 'Erro interno ao testar credencial' });
  }
});

module.exports = router;
