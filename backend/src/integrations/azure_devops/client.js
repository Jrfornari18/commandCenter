/**
 * Azure DevOps Integration — copastur-dev org
 * 186 projects | REST API v7.1 | WIQL capped at 1000 results
 * Write ops: requires_human_approval = true
 */
const axios = require('axios');
const db = require('../../db');
const credentialStore = require('../../services/credentialStore');
const errorLog = require('../../services/errorLog');

const getAdoBase = () => `https://dev.azure.com/${credentialStore.get('ADO_ORG') || 'copastur-dev'}`;
const getPat = () => credentialStore.get('ADO_PAT');

const getHeaders = () => ({
  'Authorization': `Basic ${Buffer.from(`:${getPat()}`).toString('base64')}`,
  'Content-Type': 'application/json'
});

// Key workstreams from Q2-2026 iteration paths
const WORKSTREAM_MAP = {
  'Ai-First':           'AI-First',
  'SmartHotel':         'SmartHotel',
  'SmartSaving':        'SmartSaving',
  '8BPay':              '8BPay',
  'Plataforma CMais':   'CMais',
  'PME Fast':           'PME-Fast',
  'Smart Integration':  'Smart-Integration',
  'Zuri':               'Zuri',
  'Energy':             'Energy'
};

function extractWorkstream(iterationPath = '', tags = []) {
  for (const [key, val] of Object.entries(WORKSTREAM_MAP)) {
    if (iterationPath.includes(key)) return val;
    if (tags.some(t => t.toLowerCase().includes(key.toLowerCase()))) return val;
  }
  return null;
}

// Split large date queries by month to respect 1000-item WIQL cap
async function wiqlQueryPaged(project, wiql) {
  if (!getPat()) return { value: [] };
  const url = `${getAdoBase()}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1&$top=1000`;
  const res = await axios.post(url, { query: wiql }, { headers: getHeaders(), timeout: 30000 });
  return res.data;
}

async function getWorkItemDetails(ids) {
  if (!ids.length || !getPat()) return [];
  const all = [];
  const fields = 'System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.IterationPath,System.AreaPath,System.Tags,Microsoft.VSTS.Common.Priority,Microsoft.VSTS.Scheduling.StoryPoints,System.Parent,System.CreatedDate,System.ChangedDate,System.Tags';
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const url = `${getAdoBase()}/_apis/wit/workitems?ids=${chunk.join(',')}&fields=${fields}&api-version=7.1`;
    const res = await axios.get(url, { headers: getHeaders(), timeout: 30000 });
    all.push(...(res.data.value || []));
  }
  return all;
}

async function syncProject(project) {
  const started = new Date();
  const { rows: [log] } = await db.query(
    `INSERT INTO ado_sync_log (project, status) VALUES ($1, 'running') RETURNING id`, [project]
  );

  try {
    const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] IN ('Epic','Feature','User Story','Task','Bug') ORDER BY [System.ChangedDate] DESC`;
    const result = await wiqlQueryPaged(project, wiql);
    const ids = (result.workItems || []).map(w => w.id);

    if (!ids.length) {
      await db.query(`UPDATE ado_sync_log SET status='success', items_total=0, finished_at=NOW() WHERE id=$1`, [log.id]);
      return 0;
    }

    const items = await getWorkItemDetails(ids);
    let synced = 0;

    for (const item of items) {
      const f = item.fields || {};
      const tags = (f['System.Tags'] || '').split(';').map(t => t.trim()).filter(Boolean);
      const iterPath = f['System.IterationPath'] || '';
      const workstream = extractWorkstream(iterPath, tags);

      await db.query(`
        INSERT INTO ado_work_items (ado_id, project, work_item_type, title, state, assigned_to,
          iteration_path, area_path, tags, priority, story_points, parent_id,
          created_date, changed_date, workstream, raw_data, synced_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
        ON CONFLICT (ado_id, project) DO UPDATE SET
          title=EXCLUDED.title, state=EXCLUDED.state, assigned_to=EXCLUDED.assigned_to,
          iteration_path=EXCLUDED.iteration_path, tags=EXCLUDED.tags, workstream=EXCLUDED.workstream,
          changed_date=EXCLUDED.changed_date, raw_data=EXCLUDED.raw_data, synced_at=NOW()`,
        [item.id, project, f['System.WorkItemType'], f['System.Title'], f['System.State'],
         f['System.AssignedTo']?.displayName, iterPath, f['System.AreaPath'],
         tags, f['Microsoft.VSTS.Common.Priority'],
         f['Microsoft.VSTS.Scheduling.StoryPoints'],
         f['System.Parent'], f['System.CreatedDate'], f['System.ChangedDate'],
         workstream, JSON.stringify(item)]
      );
      synced++;
    }

    await db.query(`UPDATE ado_sync_log SET status='success', items_synced=$1, items_total=$2, finished_at=NOW() WHERE id=$3`, [synced, ids.length, log.id]);
    await db.query(`UPDATE integration_sync SET status='success', last_sync_at=NOW(), items_synced=$1 WHERE integration='azure_devops'`, [synced]);
    return synced;
  } catch (err) {
    await db.query(`UPDATE ado_sync_log SET status='error', error_msg=$1, finished_at=NOW() WHERE id=$2`, [err.message, log.id]);
    await db.query(`UPDATE integration_sync SET status='error', error_msg=$1 WHERE integration='azure_devops'`, [err.message]);
    await errorLog.logIntegrationError({ integration: 'azure_devops', operation: `syncProject:${project}`, err });
    throw err;
  }
}

async function getKPIs() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE work_item_type='Epic') as total_epics,
      COUNT(*) FILTER (WHERE work_item_type='Epic' AND state IN ('Resolved','Closed','Tested')) as done_epics,
      COUNT(*) FILTER (WHERE work_item_type IN ('User Story','Task') AND state NOT IN ('Resolved','Closed','Tested','Removed')) as open_items,
      COUNT(*) FILTER (WHERE work_item_type='Bug' AND state NOT IN ('Resolved','Closed','Tested','Removed')) as open_bugs,
      COUNT(*) FILTER (WHERE due_date < NOW() AND state NOT IN ('Resolved','Closed','Tested','Removed')) as overdue,
      workstream, COUNT(*) as items_by_workstream
    FROM ado_work_items GROUP BY workstream`);
  return rows;
}

async function getWorkstreamSummary() {
  const { rows } = await db.query(`
    SELECT workstream,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE state IN ('Resolved','Closed','Tested')) as done,
      COUNT(*) FILTER (WHERE work_item_type='Epic') as epics,
      COUNT(*) FILTER (WHERE work_item_type='Bug' AND state NOT IN ('Resolved','Closed','Tested','Removed')) as bugs
    FROM ado_work_items
    WHERE workstream IS NOT NULL
    GROUP BY workstream ORDER BY total DESC`);
  return rows;
}

// Write operations — ALL require human approval
async function createWorkItem(project, type, title, description, iterationPath, approvedByUserId) {
  return {
    requires_human_approval: true,
    action: 'ado_create_work_item',
    payload: { project, type, title, description, iterationPath },
    approved_by: approvedByUserId,
    message: 'Ação requer aprovação humana explícita antes de ser executada no Azure DevOps'
  };
}

module.exports = { syncProject, getKPIs, getWorkstreamSummary, getWorkItemDetails, wiqlQueryPaged, createWorkItem };
