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

const router = express.Router();

// ================================================================
// AUTH
// ================================================================

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

router.get('/auth/me', authenticate, (req, res) => res.json({ user: req.user }));
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

router.get('/chat/conversations', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.title, c.domain, c.expectativas, c.created_at, c.updated_at, COUNT(m.id) as message_count
     FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id AND m.role!='system'
     WHERE c.user_id=$1 AND c.is_archived=FALSE GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 50`,
    [req.user.id]);
  res.json({ conversations: rows });
});

router.post('/chat/conversations', authenticate, async (req, res) => {
  const { title, domain } = req.body;
  const { rows } = await db.query(
    `INSERT INTO conversations (user_id, title, domain) VALUES ($1,$2,$3) RETURNING *`,
    [req.user.id, title || 'Nova conversa', domain || null]);
  res.status(201).json({ conversation: rows[0] });
});

router.get('/chat/conversations/:id/messages', authenticate, async (req, res) => {
  const { rows: conv } = await db.query('SELECT id FROM conversations WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!conv.length) return res.status(404).json({ error: 'Conversa não encontrada' });
  const { rows } = await db.query(
    `SELECT id, role, content, parsed_response, expectativas, created_at FROM messages
     WHERE conversation_id=$1 AND role!='system' ORDER BY created_at ASC`, [req.params.id]);
  res.json({ messages: rows });
});

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
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
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

router.delete('/chat/conversations/:id', authenticate, async (req, res) => {
  await db.query(`UPDATE conversations SET is_archived=TRUE WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
  res.json({ message: 'Arquivada' });
});

// ================================================================
// DASHBOARD
// ================================================================

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

    const okrSummary = await okrClient.getOKRSummary('Q2-2026');

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
router.get('/integrations/ado/workstreams', authenticate, async (req, res) => {
  const data = await adoClient.getWorkstreamSummary();
  res.json({ workstreams: data });
});

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

router.post('/integrations/ado/sync', authenticate, async (req, res) => {
  const projects = (process.env.ADO_SYNC_PROJECTS || 'Q2-2026').split(',').map(p => p.trim());
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
router.get('/integrations/freshservice/tickets', authenticate, async (req, res) => {
  const { limit = 20 } = req.query;
  const tickets = await fsClient.getRecentTickets(parseInt(limit));
  const kpis = await fsClient.getTicketKPIs();
  res.json({ tickets, kpis });
});

router.post('/integrations/freshservice/sync', authenticate, async (req, res) => {
  try {
    const result = await fsClient.syncTickets();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Work/Plane TI Boards
router.get('/integrations/work/boards', authenticate, async (req, res) => {
  const boards = await workClient.getIssuesByBoard();
  const kpis = await workClient.getKPIs();
  res.json({ boards, kpis });
});

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

router.post('/integrations/work/sync', authenticate, async (req, res) => {
  try {
    const result = await workClient.syncTIBoards();
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Microsoft Graph
router.get('/integrations/graph/calendar', authenticate, async (req, res) => {
  const events = await graphClient.getUpcomingEvents(req.user.id, 48);
  res.json({ events });
});

router.get('/integrations/graph/email', authenticate, async (req, res) => {
  const emails = await graphClient.getRecentEmails(req.user.id, 20);
  res.json({ emails });
});

router.post('/integrations/graph/sync', authenticate, async (req, res) => {
  try {
    const [cal, email] = await Promise.all([
      graphClient.syncCalendar(req.user.id),
      graphClient.syncEmail(req.user.id)
    ]);
    res.json({ calendar: cal, email });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/integrations/graph/auth-url', authenticate, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id, ts: Date.now() })).toString('base64');
  const url = graphClient.getAuthUrl(state);
  res.json({ url });
});

// SmartLeader / OKRs
router.get('/integrations/okr/summary', authenticate, async (req, res) => {
  const { cycle = 'Q2-2026' } = req.query;
  const data = await okrClient.getOKRSummary(cycle);
  res.json({ objectives: data, cycle });
});

router.post('/integrations/okr/sync', authenticate, async (req, res) => {
  try {
    const { cycle = 'Q2-2026' } = req.body;
    const result = await okrClient.syncOKRs(cycle);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync status
router.get('/integrations/status', authenticate, async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM integration_sync ORDER BY integration`);
  res.json({ integrations: rows });
});

// Trigger all sync
router.post('/integrations/sync-all', authenticate, async (req, res) => {
  const results = {};
  const syncTasks = [
    ['ado', async () => { const projs = (process.env.ADO_SYNC_PROJECTS || 'Q2-2026').split(','); let t = 0; for (const p of projs) t += await adoClient.syncProject(p.trim()); return { synced: t }; }],
    ['freshservice', async () => fsClient.syncTickets()],
    ['work_plane', async () => workClient.syncTIBoards()],
    ['okr', async () => okrClient.syncOKRs()],
    ['graph', async () => { try { return await Promise.all([graphClient.syncCalendar(req.user.id), graphClient.syncEmail(req.user.id)]); } catch(e) { return { error: e.message }; } }]
  ];
  for (const [name, fn] of syncTasks) {
    try { results[name] = await fn(); } catch (e) { results[name] = { error: e.message }; }
  }
  res.json({ results });
});

// ================================================================
// DECISIONS & RISKS
// ================================================================

router.get('/decisions', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT d.*, e.titulo as expectativa_titulo FROM decisions d LEFT JOIN expectativas e ON e.id=d.expectativa_id WHERE d.user_id=$1 ORDER BY d.created_at DESC`, [req.user.id]);
  res.json({ decisions: rows });
});

router.post('/decisions', authenticate, async (req, res) => {
  const { titulo, descricao, prioridade, responsavel, prazo, expectativa_id } = req.body;
  const { rows } = await db.query(
    `INSERT INTO decisions (user_id, titulo, descricao, prioridade, responsavel, prazo, expectativa_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.id, titulo, descricao, prioridade || 'media', responsavel, prazo || null, expectativa_id || null]);
  res.status(201).json({ decision: rows[0] });
});

router.patch('/decisions/:id', authenticate, async (req, res) => {
  const { status, prioridade, responsavel, prazo } = req.body;
  const { rows } = await db.query(
    `UPDATE decisions SET status=COALESCE($1,status), prioridade=COALESCE($2,prioridade), responsavel=COALESCE($3,responsavel), prazo=COALESCE($4,prazo) WHERE id=$5 AND user_id=$6 RETURNING *`,
    [status, prioridade, responsavel, prazo, req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ decision: rows[0] });
});

router.get('/risks', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, e.titulo as expectativa_titulo FROM riscos r LEFT JOIN expectativas e ON e.id=r.expectativa_id WHERE r.user_id=$1 ORDER BY CASE r.nivel WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 ELSE 4 END`, [req.user.id]);
  res.json({ risks: rows });
});

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

router.get('/expectativas', authenticate, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM expectativas ORDER BY numero');
  res.json({ expectativas: rows });
});

router.get('/users', authenticate, async (req, res) => {
  if (!['admin', 'ceo'].includes(req.user.role_name)) return res.status(403).json({ error: 'Acesso restrito' });
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.full_name, u.avatar_initials, u.is_active, u.last_login_at, r.name as role_name, r.label as role_label FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC`);
  res.json({ users: rows });
});

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

module.exports = router;
