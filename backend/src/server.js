require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const routes = require('./routes/index');
const adoClient = require('./integrations/azure_devops/client');
const fsClient = require('./integrations/freshservice/client');
const workClient = require('./integrations/work_plane/client');
const okrClient = require('./integrations/smartleader/client');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Rate limit atingido' } }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Limite de mensagens' } }));
app.use(express.json({ limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', routes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString(), service: 'copastur-platform-api' }));
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString(), service: 'copastur-platform-api' }));
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Erro interno' : err.message });
});

// ── Scheduled Sync Jobs ──────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  // Azure DevOps — every 4 hours
  cron.schedule(process.env.SYNC_ADO_CRON || '0 */4 * * *', async () => {
    console.log('[CRON] Syncing Azure DevOps...');
    const projects = (process.env.ADO_SYNC_PROJECTS || 'Q2-2026').split(',');
    for (const p of projects) { try { await adoClient.syncProject(p.trim()); } catch (e) { console.error('[CRON ADO]', e.message); } }
  });

  // Freshservice — every 2 hours
  cron.schedule(process.env.SYNC_FS_CRON || '0 */2 * * *', async () => {
    console.log('[CRON] Syncing Freshservice...');
    try { await fsClient.syncTickets(); } catch (e) { console.error('[CRON FS]', e.message); }
  });

  // Work/Plane — every 3 hours
  cron.schedule(process.env.SYNC_WORK_CRON || '0 */3 * * *', async () => {
    console.log('[CRON] Syncing Work/Plane TI Boards...');
    try { await workClient.syncTIBoards(); } catch (e) { console.error('[CRON WORK]', e.message); }
  });

  // SmartLeader OKRs — daily at 8am
  cron.schedule(process.env.SYNC_OKR_CRON || '0 8 * * *', async () => {
    console.log('[CRON] Syncing SmartLeader OKRs...');
    try { await okrClient.syncOKRs(); } catch (e) { console.error('[CRON OKR]', e.message); }
  });

  console.log('[CRON] Scheduled sync jobs active');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Copastur Platform API — porta ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:   http://localhost:${PORT}/health\n`);
});

module.exports = app;
