/**
 * SmartLeader / OKR Integration
 * Aligned to 7 Expectativas de C-Level Copastur
 */
const axios = require('axios');
const db = require('../db');

const BASE_URL = process.env.SMARTLEADER_API_URL;
const API_KEY = process.env.SMARTLEADER_API_KEY;

function getHeaders() {
  return API_KEY ? { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } : null;
}

async function fetchOKRs(cycle = 'Q2-2026') {
  const headers = getHeaders();
  if (!headers) return getMockOKRs(cycle);
  try {
    const res = await axios.get(`${BASE_URL}/objectives`, { headers, params: { cycle }, timeout: 15000 });
    return res.data.objectives || res.data || [];
  } catch (err) {
    console.warn('[SmartLeader] API unavailable, using mock data:', err.message);
    return getMockOKRs(cycle);
  }
}

async function syncOKRs(cycle = 'Q2-2026') {
  const objectives = await fetchOKRs(cycle);
  let synced = 0;

  for (const obj of objectives) {
    const { rows: [inserted] } = await db.query(`
      INSERT INTO okr_objectives (sl_id, title, description, owner, cycle, status,
        progress, target_value, current_value, raw_data, synced_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (sl_id) DO UPDATE SET
        progress=EXCLUDED.progress, current_value=EXCLUDED.current_value,
        status=EXCLUDED.status, synced_at=NOW()
      RETURNING id`,
      [obj.id || String(synced + 1), obj.title, obj.description, obj.owner, cycle,
       obj.status || 'active', obj.progress || 0, obj.target, obj.current, JSON.stringify(obj)]
    );

    for (const kr of obj.key_results || []) {
      await db.query(`
        INSERT INTO okr_key_results (objective_id, sl_id, title, metric_unit, baseline, target, current_value, progress, owner, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (sl_id) DO UPDATE SET
          current_value=EXCLUDED.current_value, progress=EXCLUDED.progress, status=EXCLUDED.status`,
        [inserted.id, kr.id || `${obj.id}-kr-${Math.random()}`, kr.title, kr.metric_unit,
         kr.baseline, kr.target, kr.current, kr.progress || 0, kr.owner, kr.status]
      );
    }
    synced++;
  }

  await db.query(`UPDATE integration_sync SET status='success', last_sync_at=NOW(), items_synced=$1 WHERE integration='smartleader'`, [synced]);
  return { synced };
}

async function getOKRSummary(cycle = 'Q2-2026') {
  const { rows } = await db.query(`
    SELECT o.*, COUNT(kr.id) as kr_count,
      AVG(kr.progress) as avg_kr_progress
    FROM okr_objectives o
    LEFT JOIN okr_key_results kr ON kr.objective_id = o.id
    WHERE o.cycle = $1
    GROUP BY o.id ORDER BY o.progress DESC`, [cycle]);
  return rows;
}

function getMockOKRs(cycle) {
  return [
    {
      id: 'obj-1', title: '[MOCK] Transformação AI-First — 40% operações automatizadas', owner: 'João Fornari Jr',
      status: 'on_track', progress: 62, target: 100, current: 62,
      key_results: [
        { id: 'kr-1', title: 'Agentes AI em produção', metric_unit: 'count', baseline: 0, target: 5, current: 3, progress: 60 },
        { id: 'kr-2', title: 'Redução custo operacional via AI', metric_unit: 'percent', baseline: 0, target: 20, current: 12, progress: 60 }
      ]
    },
    {
      id: 'obj-2', title: '[MOCK] SmartHotel — automação de 100% das reservas corporativas', owner: 'Virginia Bergamini',
      status: 'at_risk', progress: 35, target: 100, current: 35,
      key_results: [
        { id: 'kr-3', title: 'Hotéis integrados via API', metric_unit: 'count', baseline: 0, target: 200, current: 70, progress: 35 }
      ]
    },
    {
      id: 'obj-3', title: '[MOCK] SmartSaving — recompra automática ativa', owner: 'Ernani Torquato',
      status: 'behind', progress: 20, target: 100, current: 20,
      key_results: [
        { id: 'kr-4', title: 'Módulo de recompra em produção', metric_unit: 'boolean', baseline: 0, target: 1, current: 0, progress: 20 }
      ]
    }
  ];
}

module.exports = { syncOKRs, getOKRSummary };
