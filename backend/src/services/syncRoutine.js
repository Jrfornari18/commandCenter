/**
 * Rotina central de sincronização das integrações — única implementação
 * de "como sincronizar cada sistema", reutilizada tanto pelos cron jobs
 * agendados (server.js) quanto pelo endpoint manual
 * POST /api/integrations/sync-all (routes/index.js).
 *
 * Microsoft Graph é a exceção: usa OAuth por usuário (graph_tokens), então
 * não há uma única "credencial da integração" — por isso syncGraphAllUsers()
 * varre todos os usuários que já conectaram a conta Microsoft.
 */
const db = require('../db');
const adoClient = require('../integrations/azure_devops/client');
const adoReportService = require('../integrations/azure_devops/reportService');
const fsClient = require('../integrations/freshservice/client');
const workClient = require('../integrations/work_plane/client');
const okrClient = require('../integrations/smartleader/client');
const graphClient = require('../integrations/microsoft_graph/client');
const credentialStore = require('./credentialStore');
const errorLog = require('./errorLog');
const { SMARTLEADER_ENABLED } = require('../config/integrationFlags');

async function syncADO() {
  const projects = (credentialStore.get('ADO_SYNC_PROJECTS') || 'Q2-2026').split(',').map(p => p.trim()).filter(Boolean);
  let total = 0;
  for (const project of projects) total += await adoClient.syncProject(project);
  return { synced: total, projects: projects.length };
}

/**
 * Recalcula o relatório executivo semanal (quarter/projetos/epics/tags/backlog)
 * via WIQL ao vivo e salva um snapshot em devops_snapshots (+ métricas por
 * projeto/epic). Separado de syncADO/runFullSync porque é bem mais caro
 * (dezenas de queries WIQL) — roda no próprio cron semanal ou por clique manual.
 */
async function syncADOReport() {
  try {
    const months = adoReportService.getQuarterMonths();
    const report = await adoReportService.getWeeklyReport(months);

    const { rows: [snapshot] } = await db.query(
      `INSERT INTO devops_snapshots (report_type, report_data, quarter, generated_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      ['weekly', JSON.stringify(report), 'Q2-2026']
    );
    const snapshotId = snapshot.id;

    for (const proj of report.projects) {
      for (const [period, data] of Object.entries(proj.months)) {
        await db.query(
          `INSERT INTO devops_project_metrics (project_name, period_label, created_count, closed_count, throughput, balance, snapshot_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [proj.project, period, data.created, data.closed, proj.throughput, proj.balance, snapshotId]
        );
      }
    }

    for (const epic of report.epics.epics) {
      await db.query(
        `INSERT INTO devops_epic_progress (epic_id, epic_title, project, iteration, total_items, done_items, pending_items, completion_pct, states_json, snapshot_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [epic.id, epic.title, report.epics.project, epic.iteration, epic.total, epic.done, epic.pending, epic.completionPct, JSON.stringify(epic.states), snapshotId]
      );
    }

    return { snapshotId, week: report.week, quarter: report.quarter };
  } catch (err) {
    await errorLog.logIntegrationError({ integration: 'azure_devops', operation: 'report:sync', err });
    throw err;
  }
}

async function syncFreshservice() {
  return fsClient.syncTickets();
}

async function syncWorkPlane() {
  return workClient.syncTIBoards();
}

async function syncOKR() {
  if (!SMARTLEADER_ENABLED) return { disabled: true };
  return okrClient.syncOKRs();
}

async function syncGraphForUser(userId) {
  const [calendar, email] = await Promise.all([graphClient.syncCalendar(userId), graphClient.syncEmail(userId)]);
  return { calendar, email };
}

async function syncGraphAllUsers() {
  const { rows } = await db.query('SELECT user_id FROM graph_tokens');
  const results = [];
  for (const { user_id } of rows) {
    try { results.push({ user_id, ...(await syncGraphForUser(user_id)) }); }
    catch (e) { results.push({ user_id, error: e.message }); }
  }
  return { users_synced: results.length, results };
}

/**
 * Dispara ADO, Freshservice, Work/Plane, OKR e Graph em sequência.
 * Cada tarefa é isolada — uma falha não interrompe as demais.
 * @param {{ graphUserId?: string }} opts graphUserId sincroniza Graph só para
 *   esse usuário (clique manual no painel); se omitido, sincroniza Graph
 *   para todos os usuários com token salvo (uso pelo cron em background).
 */
async function runFullSync({ graphUserId } = {}) {
  const results = {};
  const tasks = [
    ['ado', syncADO],
    ['freshservice', syncFreshservice],
    ['work_plane', syncWorkPlane],
    ['okr', syncOKR],
    ['graph', () => (graphUserId ? syncGraphForUser(graphUserId) : syncGraphAllUsers())]
  ];
  for (const [name, fn] of tasks) {
    try { results[name] = await fn(); }
    catch (e) { results[name] = { error: e.message }; }
  }
  return results;
}

module.exports = { syncADO, syncADOReport, syncFreshservice, syncWorkPlane, syncOKR, syncGraphForUser, syncGraphAllUsers, runFullSync };
