/**
 * Azure DevOps — Relatórios executivos (quarter/projeto/epics/tags/backlog)
 * Complementa client.js (que sincroniza ado_work_items para os painéis de
 * workstream): este módulo consulta a API do ADO diretamente via WIQL para
 * montar agregações (throughput mensal, ranking de projetos, hierarquia de
 * epics, vínculo estratégia→execução por tag, backlog ativo).
 *
 * Auth e org seguem o mesmo padrão do resto da integração — credentialStore
 * (DB override > .env), nunca hardcoded. Todas as operações são leitura.
 */
const axios = require('axios');
const credentialStore = require('../../services/credentialStore');
const errorLog = require('../../services/errorLog');

const API_VERSION = '7.1';
const BATCH_SIZE = 200;
const MAX_RESULTS = 1000;
const DONE_STATES = ['Closed', 'Resolved', 'Tested'];
const DEFAULT_FIELDS = 'System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,' +
  'System.CreatedDate,System.ChangedDate,System.AreaPath,System.IterationPath,System.Tags,System.Parent,' +
  'Microsoft.VSTS.Common.Priority';

const MONITORED_PROJECTS = [
  'Smart Client', 'VEGA CC', 'Cplus APP', 'Smart Operations', 'CopasLake',
  'INFRA CLOUD_SRE_ADMOPS_N1', 'Q2-2026', 'Zuri', 'Smart Integration',
  'AIFirst', 'ERP Benner', 'Segurança da Informação e Governança',
  'Eventos por Adesão', 'IA First', 'Copastur Energy (Forge-SinergIA)', 'Sales Force'
];
const STRATEGY_TAGS = ['SmartHotel', 'SmartSaving', 'Benner', 'Energy', 'ZURI', 'API Company', '8BPay', 'Segurança', 'Niara'];

const getOrg = () => credentialStore.get('ADO_ORG') || 'copastur-dev';
const getPat = () => credentialStore.get('ADO_PAT');
const getBaseUrl = () => `https://dev.azure.com/${getOrg()}`;
const getHeaders = () => ({
  'Authorization': `Basic ${Buffer.from(`:${getPat()}`).toString('base64')}`,
  'Content-Type': 'application/json'
});

// Escapa aspas simples para uso seguro dentro de literais WIQL (previne WIQL injection
// em endpoints que aceitam filtros vindos de query string do usuário).
function escapeWiql(value) {
  return String(value).replace(/'/g, "''");
}

async function wiql(query) {
  if (!getPat()) return [];
  const url = `${getBaseUrl()}/_apis/wit/wiql?api-version=${API_VERSION}&$top=${MAX_RESULTS}`;
  try {
    const { data } = await axios.post(url, { query }, { headers: getHeaders(), timeout: 30000 });
    return (data.workItems || []).map(w => String(w.id));
  } catch (err) {
    await errorLog.logIntegrationError({ integration: 'azure_devops', operation: 'report:wiql', err });
    throw err;
  }
}

async function wiqlCount(query) {
  return (await wiql(query)).length;
}

async function fetchItems(ids, fields = null) {
  if (!ids.length || !getPat()) return [];
  const f = fields || DEFAULT_FIELDS;
  const items = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE).join(',');
    const url = `${getBaseUrl()}/_apis/wit/workitems?ids=${batch}&fields=${f}&api-version=${API_VERSION}`;
    try {
      const { data } = await axios.get(url, { headers: getHeaders(), timeout: 30000 });
      items.push(...(data.value || []));
    } catch (err) {
      await errorLog.logIntegrationError({ integration: 'azure_devops', operation: 'report:fetchItems', err });
      throw err;
    }
  }
  return items;
}

const gf = (item, key) => item?.fields?.[key];
const proj = (item) => (gf(item, 'System.AreaPath') || '').split('\\')[0];
const assignee = (item) => { const a = gf(item, 'System.AssignedTo'); return typeof a === 'object' ? (a?.displayName || 'N/A') : (a || 'N/A'); };
const isDone = (state) => DONE_STATES.includes(state);

// ─── QUARTER REPORT (global, mensal) ───
async function getQuarterReport(months) {
  const md = {};
  let totalCreated = 0, totalClosed = 0;
  for (const { label, from, to } of months) {
    const ef = to > 0 ? ` AND [System.CreatedDate] < @Today - ${to}` : '';
    const ef2 = to > 0 ? ` AND [System.ChangedDate] < @Today - ${to}` : '';
    const created = await wiqlCount(`SELECT [System.Id] FROM WorkItems WHERE [System.CreatedDate] >= @Today - ${from}${ef}`);
    const closed = await wiqlCount(`SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('Closed','Resolved','Tested') AND [System.ChangedDate] >= @Today - ${from}${ef2}`);
    md[label] = { created, closed, tp: Math.round(closed / Math.max(1, created) * 100) };
    totalCreated += created; totalClosed += closed;
  }
  return {
    totalCreated, totalClosed,
    throughput: +(totalClosed / Math.max(1, totalCreated) * 100).toFixed(1),
    monthly: md, at: new Date().toISOString()
  };
}

// ─── RANKING DE PROJETOS ───
async function getProjectBreakdown(months) {
  const results = [];
  for (const pn of MONITORED_PROJECTS) {
    const pm = {};
    let tc = 0, tl = 0;
    for (const { label, from, to } of months) {
      const pf = ` AND [System.TeamProject] = '${escapeWiql(pn)}'`;
      const ef = to > 0 ? ` AND [System.CreatedDate] < @Today - ${to}` : '';
      const ef2 = to > 0 ? ` AND [System.ChangedDate] < @Today - ${to}` : '';
      const created = await wiqlCount(`SELECT [System.Id] FROM WorkItems WHERE [System.CreatedDate] >= @Today - ${from}${ef}${pf}`);
      const closed = await wiqlCount(`SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('Closed','Resolved','Tested') AND [System.ChangedDate] >= @Today - ${from}${ef2}${pf}`);
      pm[label] = { created, closed };
      tc += created; tl += closed;
    }
    if (tc > 0 || tl > 0) {
      const monthlyClosed = Object.values(pm).map(m => m.closed);
      results.push({
        project: pn, months: pm, totalCreated: tc, totalClosed: tl,
        throughput: +(tl / Math.max(1, tc) * 100).toFixed(1), balance: tl - tc,
        trend: monthlyClosed.length >= 2 ? (monthlyClosed[monthlyClosed.length - 1] > monthlyClosed[0] ? 'up' : 'down') : 'stable'
      });
    }
  }
  return results.sort((a, b) => (b.totalCreated + b.totalClosed) - (a.totalCreated + a.totalClosed));
}

// ─── HIERARQUIA DE EPICS ───
async function getEpicsHierarchy(project = 'Q2-2026') {
  const ids = await wiql(`SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapeWiql(project)}' ORDER BY [System.WorkItemType] ASC`);
  const items = await fetchItems(ids);
  const children = {};
  items.forEach(i => { const pid = gf(i, 'System.Parent'); if (pid) (children[pid] = children[pid] || []).push(i); });
  const getDescendants = (pid) => {
    const d = [];
    (children[pid] || []).forEach(c => { d.push(c); d.push(...getDescendants(gf(c, 'System.Id'))); });
    return d;
  };

  const epics = items.filter(i => gf(i, 'System.WorkItemType') === 'Epic').map(ep => {
    const eid = gf(ep, 'System.Id');
    const desc = getDescendants(eid);
    const stateCounts = {};
    desc.forEach(d => { const s = gf(d, 'System.State') || '?'; stateCounts[s] = (stateCounts[s] || 0) + 1; });
    const done = DONE_STATES.reduce((s, st) => s + (stateCounts[st] || 0), 0);
    const removed = stateCounts['Removed'] || 0;
    const total = desc.length - removed;
    return {
      id: eid, title: gf(ep, 'System.Title'), state: gf(ep, 'System.State'),
      assignee: assignee(ep), iteration: (gf(ep, 'System.IterationPath') || '').replace(`${project}\\`, ''),
      descendants: desc.length, done, total, pending: total - done,
      completionPct: Math.round(done / Math.max(1, total) * 100), states: stateCounts
    };
  }).sort((a, b) => b.completionPct - a.completionPct || b.descendants - a.descendants);

  const totalDesc = epics.reduce((s, e) => s + e.total, 0);
  const totalDone = epics.reduce((s, e) => s + e.done, 0);
  return { project, totalItems: items.length, epics, global: { done: totalDone, total: totalDesc, pct: Math.round(totalDone / Math.max(1, totalDesc) * 100) } };
}

// ─── VÍNCULO ESTRATÉGIA → EXECUÇÃO (TAGS) ───
async function getTagLinks(tags = null) {
  const use = tags || STRATEGY_TAGS;
  const links = [];
  for (const tag of use) {
    const ids = await wiql(`SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS '${escapeWiql(tag)}' AND [System.State] <> 'Removed'`);
    if (!ids.length) continue;
    const items = await fetchItems(ids.slice(0, 500));
    const byProject = {};
    items.forEach(i => { const p = proj(i); if (p !== 'Q2-2026') (byProject[p] = byProject[p] || []).push(i); });
    Object.entries(byProject).forEach(([p, pi]) => {
      const done = pi.filter(i => isDone(gf(i, 'System.State'))).length;
      links.push({ tag, project: p, totalItems: pi.length, done, active: pi.length - done });
    });
  }
  return { total: links.reduce((s, l) => s + l.totalItems, 0), links: links.sort((a, b) => b.totalItems - a.totalItems) };
}

// ─── BACKLOG ATIVO ───
async function getBacklog(project = null, minItems = 5) {
  const pf = project ? ` AND [System.TeamProject] = '${escapeWiql(project)}'` : '';
  const ids = await wiql(`SELECT [System.Id] FROM WorkItems WHERE [System.State] NOT IN ('Closed','Removed','Canceled','Cancelado','Tested') AND [System.ChangedDate] >= @Today - 180${pf}`);
  const items = await fetchItems(ids);
  const byProject = {};
  items.forEach(i => {
    const p = proj(i); const s = gf(i, 'System.State');
    if (!byProject[p]) byProject[p] = { total: 0, new: 0, active: 0, inTest: 0, impediment: 0 };
    byProject[p].total++;
    if (s === 'New') byProject[p].new++;
    else if (s === 'Active') byProject[p].active++;
    else if (['Waiting Test', 'In Test', 'Homologação'].includes(s)) byProject[p].inTest++;
    else if (s === 'Impediment') byProject[p].impediment++;
  });
  return {
    totalActive: ids.length,
    byProject: Object.entries(byProject).filter(([, d]) => d.total >= minItems).sort((a, b) => b[1].total - a[1].total).map(([n, d]) => ({ project: n, ...d }))
  };
}

// ─── RELATÓRIO SEMANAL COMPLETO ───
async function getWeeklyReport(months) {
  const [weekCreated, weekClosed, quarter, projects, epics, tags, backlog] = await Promise.all([
    wiqlCount("SELECT [System.Id] FROM WorkItems WHERE [System.CreatedDate] >= @Today - 7"),
    wiqlCount("SELECT [System.Id] FROM WorkItems WHERE [System.State] IN ('Closed','Resolved','Tested') AND [System.ChangedDate] >= @Today - 7"),
    getQuarterReport(months), getProjectBreakdown(months),
    getEpicsHierarchy('Q2-2026'), getTagLinks(), getBacklog()
  ]);
  return {
    week: { created: weekCreated, closed: weekClosed, tp: Math.round(weekClosed / Math.max(1, weekCreated) * 100) },
    quarter, projects, epics, tagLinks: tags, backlog, at: new Date().toISOString()
  };
}

// Offsets de mês dinâmicos para o trimestre corrente (Abril/Maio/Junho — Q2-2026)
function getQuarterMonths() {
  const today = new Date();
  const apr1 = new Date(2026, 3, 1), may1 = new Date(2026, 4, 1), jun1 = new Date(2026, 5, 1);
  const msDay = 86400000;
  return [
    { label: 'Abril', from: Math.ceil((today - apr1) / msDay), to: Math.ceil((today - may1) / msDay) },
    { label: 'Maio', from: Math.ceil((today - may1) / msDay), to: Math.ceil((today - jun1) / msDay) },
    { label: 'Junho', from: Math.ceil((today - jun1) / msDay), to: 0 },
  ];
}

module.exports = {
  wiql, wiqlCount, fetchItems, gf, proj, assignee, isDone, escapeWiql,
  getQuarterReport, getProjectBreakdown, getEpicsHierarchy, getTagLinks, getBacklog, getWeeklyReport,
  getQuarterMonths, MONITORED_PROJECTS, STRATEGY_TAGS
};
