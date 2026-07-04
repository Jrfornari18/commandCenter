/**
 * Work (Plane self-hosted) Integration — TI Boards
 * Base: https://work.cnext.app/api/plane/v1/workspaces/copastur
 * Auth: X-API-Key header
 * Known TI Boards (confirmed via live API):
 *   - Portfólio de Soluções de TI:  6b3ee0f0-eab1-49d4-a853-ef112b41bdab (573 issues)
 *   - Backlog PMO de TI 2026:        10d50cea-a195-41ee-8648-241ecb2e3101 (306 issues)
 *   - Portfólio PMO de TI 2026:      c327a196-ef24-497c-bd18-a914daa989cb (76 issues)
 *   - Onboarding Técnico TI:         ec5a12bd-db20-4a0f-adf8-63a143a80a75 (1 issue)
 *
 * Quirks:
 * - /members/ returns flat list, not paginated envelope
 * - create_issue with non-member assignee returns 200 but drops assignee (check _assignee_warning)
 * - Pagination: next_page_results + next_cursor (URL-encoded)
 */
const axios = require('axios');
const db = require('../db');

const BASE_URL = process.env.WORK_API_URL || 'https://work.cnext.app/api/plane/v1/workspaces/copastur';
const TOKEN = process.env.WORK_TOKEN;

const TI_BOARDS = {
  '6b3ee0f0-eab1-49d4-a853-ef112b41bdab': 'Portfólio de Soluções de TI',
  '10d50cea-a195-41ee-8648-241ecb2e3101': 'Backlog PMO de TI 2026',
  'c327a196-ef24-497c-bd18-a914daa989cb': 'Portfólio PMO de TI 2026',
  'ec5a12bd-db20-4a0f-adf8-63a143a80a75': 'Onboarding Técnico TI'
};

function getHeaders() {
  return TOKEN ? { 'X-API-Key': TOKEN, 'Content-Type': 'application/json' } : null;
}

async function paginatedFetch(url, params = {}) {
  const headers = getHeaders();
  if (!headers) return [];
  const results = [];
  let cursor = null;

  do {
    const p = { per_page: 100, ...params };
    if (cursor) p.cursor = cursor;
    const res = await axios.get(url, { headers, params: p, timeout: 20000 });
    const data = res.data;
    // Handle both envelope and flat list
    const items = Array.isArray(data) ? data : (data.results || []);
    results.push(...items);
    cursor = data.next_page_results ? encodeURIComponent(data.next_cursor) : null;
  } while (cursor);

  return results;
}

async function syncTIBoards() {
  const headers = getHeaders();
  if (!headers) return { synced: 0, mock: true };

  let totalSynced = 0;

  for (const [projectId, projectName] of Object.entries(TI_BOARDS)) {
    // Upsert project
    await db.query(`
      INSERT INTO work_projects (plane_id, name, is_ti_board, synced_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (plane_id) DO UPDATE SET name=EXCLUDED.name, synced_at=NOW()`,
      [projectId, projectName]
    );

    // Fetch issues with state expansion
    const issues = await paginatedFetch(`${BASE_URL}/projects/${projectId}/issues/`, { expand: 'state' });

    for (const issue of issues) {
      await db.query(`
        INSERT INTO work_issues (plane_id, project_plane_id, sequence_id, title, state, state_group,
          priority, due_date, start_date, estimate, created_at_plane, updated_at_plane, raw_data, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
        ON CONFLICT (plane_id) DO UPDATE SET
          title=EXCLUDED.title, state=EXCLUDED.state, state_group=EXCLUDED.state_group,
          priority=EXCLUDED.priority, updated_at_plane=EXCLUDED.updated_at_plane,
          raw_data=EXCLUDED.raw_data, synced_at=NOW()`,
        [issue.id, projectId, issue.sequence_id, issue.name || issue.title,
         issue.state_detail?.name || issue.state,
         issue.state_detail?.group || null,
         issue.priority, issue.due_date, issue.start_date,
         issue.estimate, issue.created_at, issue.updated_at,
         JSON.stringify(issue)]
      );
      totalSynced++;
    }
  }

  await db.query(`UPDATE integration_sync SET status='success', last_sync_at=NOW(), items_synced=$1 WHERE integration='work_plane'`, [totalSynced]);
  return { synced: totalSynced };
}

async function getKPIs() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) as total_issues,
      COUNT(*) FILTER (WHERE state_group='completed') as completed,
      COUNT(*) FILTER (WHERE state_group='started') as in_progress,
      COUNT(*) FILTER (WHERE state_group IN ('backlog','unstarted')) as backlog,
      COUNT(*) FILTER (WHERE priority='urgent') as urgent,
      COUNT(*) FILTER (WHERE priority='high') as high_priority,
      COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND state_group NOT IN ('completed','cancelled')) as overdue
    FROM work_issues`);
  return rows[0];
}

async function getIssuesByBoard() {
  const { rows } = await db.query(`
    SELECT p.name as board_name, p.plane_id,
      COUNT(i.id) as total,
      COUNT(i.id) FILTER (WHERE i.state_group='completed') as completed,
      COUNT(i.id) FILTER (WHERE i.state_group='started') as in_progress
    FROM work_projects p
    LEFT JOIN work_issues i ON i.project_plane_id = p.plane_id
    WHERE p.is_ti_board = TRUE
    GROUP BY p.plane_id, p.name ORDER BY total DESC`);
  return rows;
}

// Write ops — require human approval
async function createIssue(projectId, title, description, priority, assigneeId, approvedByUserId) {
  return {
    requires_human_approval: true,
    action: 'work_create_issue',
    payload: { projectId, projectName: TI_BOARDS[projectId], title, description, priority },
    warning: assigneeId ? 'Verify assignee is a project member — Plane silently drops non-member assignees' : null,
    approved_by: approvedByUserId,
    message: 'Criação de issue requer aprovação humana explícita antes de ser enviada ao Work/Plane'
  };
}

module.exports = { syncTIBoards, getKPIs, getIssuesByBoard, createIssue, TI_BOARDS };
