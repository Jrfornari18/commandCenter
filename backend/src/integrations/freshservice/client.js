/**
 * Freshservice Integration — Copastur ITSM
 * Domain: copastur.freshservice.com
 * Auth: API Key (Basic auth — key:X)
 * Write ops: requires_human_approval = true
 */
const axios = require('axios');
const db = require('../../db');

const DOMAIN = process.env.FRESHSERVICE_DOMAIN || 'copastur.freshservice.com';
const API_KEY = process.env.FRESHSERVICE_API_KEY;
const BASE_URL = `https://${DOMAIN}/api/v2`;

function getHeaders() {
  if (!API_KEY) return null;
  const token = Buffer.from(`${API_KEY}:X`).toString('base64');
  return { Authorization: `Basic ${token}`, 'Content-Type': 'application/json' };
}

const PRIORITY_MAP = { 1: 'urgent', 2: 'high', 3: 'medium', 4: 'low' };
const STATUS_MAP = { 2: 'open', 3: 'pending', 4: 'resolved', 5: 'closed' };

async function fetchTickets(filter = 'open', page = 1) {
  const headers = getHeaders();
  if (!headers) return getMockTickets();
  try {
    const res = await axios.get(`${BASE_URL}/tickets`, {
      headers,
      params: { filter, page, per_page: 50, include: 'requester,responder,stats' },
      timeout: 15000
    });
    return res.data.tickets || [];
  } catch (err) {
    console.error('[Freshservice]', err.message);
    return getMockTickets();
  }
}

async function syncTickets() {
  const tickets = await fetchTickets('open');
  let synced = 0;

  for (const t of tickets) {
    await db.query(`
      INSERT INTO fs_tickets (fs_id, subject, status, priority, type,
        requester_email, category, tags, created_at_fs, updated_at_fs, due_by, synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (fs_id) DO UPDATE SET
        status=EXCLUDED.status, priority=EXCLUDED.priority,
        updated_at_fs=EXCLUDED.updated_at_fs, synced_at=NOW()`,
      [t.id, t.subject,
       STATUS_MAP[t.status] || 'open',
       PRIORITY_MAP[t.priority] || 'medium',
       t.type, t.requester?.email,
       t.category, t.tags || [],
       t.created_at, t.updated_at, t.due_by]
    );
    synced++;
  }

  await db.query(`UPDATE integration_sync SET status='success', last_sync_at=NOW(), items_synced=$1 WHERE integration='freshservice'`, [synced]);
  return { synced };
}

async function getTicketKPIs() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status='open') as open_count,
      COUNT(*) FILTER (WHERE status='pending') as pending_count,
      COUNT(*) FILTER (WHERE priority='urgent') as urgent_count,
      COUNT(*) FILTER (WHERE priority='high') as high_count,
      COUNT(*) FILTER (WHERE due_by < NOW() AND status NOT IN ('resolved','closed')) as overdue_count
    FROM fs_tickets`);
  return rows[0];
}

async function getRecentTickets(limit = 20) {
  const { rows } = await db.query(`
    SELECT * FROM fs_tickets ORDER BY created_at_fs DESC LIMIT $1`, [limit]);
  return rows;
}

// Write op — requires approval
async function updateTicketStatus(fsId, newStatus, approvedByUserId) {
  return {
    requires_human_approval: true,
    action: 'freshservice_update_ticket',
    payload: { fs_ticket_id: fsId, new_status: newStatus },
    approved_by: approvedByUserId,
    message: 'Atualização de ticket requer aprovação humana antes de ser enviada ao Freshservice'
  };
}

function getMockTickets() {
  return [
    { id: 1001, subject: '[MOCK] VPN inacessível - Executivos', status: 2, priority: 1, type: 'Incident', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['VPN', 'urgente'] },
    { id: 1002, subject: '[MOCK] Acesso ERP bloqueado - Financeiro', status: 2, priority: 2, type: 'Incident', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['ERP'] },
    { id: 1003, subject: '[MOCK] Configuração ambiente SmartSaving', status: 3, priority: 3, type: 'Service Request', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), tags: ['SmartSaving'] }
  ];
}

module.exports = { syncTickets, getTicketKPIs, getRecentTickets, updateTicketStatus };
