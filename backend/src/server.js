require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');

const routes = require('./routes/index');
const swaggerSpec = require('./docs/swaggerDef');
const { SMARTLEADER_ENABLED } = require('./config/integrationFlags');
const credentialStore = require('./services/credentialStore');
const syncRoutine = require('./services/syncRoutine');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Rate limit atingido' } }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Limite de mensagens' } }));
app.use(express.json({ limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api', routes);
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString(), service: 'copastur-platform-api' }));
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Copastur AI Command Center — API Docs'
}));
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
    try { await syncRoutine.syncADO(); } catch (e) { console.error('[CRON ADO]', e.message); }
  });

  // Freshservice — every 2 hours
  cron.schedule(process.env.SYNC_FS_CRON || '0 */2 * * *', async () => {
    console.log('[CRON] Syncing Freshservice...');
    try { await syncRoutine.syncFreshservice(); } catch (e) { console.error('[CRON FS]', e.message); }
  });

  // Work/Plane — every 15 minutes (board precisa refletir mudanças perto de tempo real)
  cron.schedule(process.env.SYNC_WORK_CRON || '*/15 * * * *', async () => {
    console.log('[CRON] Syncing Work/Plane TI Boards...');
    try { await syncRoutine.syncWorkPlane(); } catch (e) { console.error('[CRON WORK]', e.message); }
  });

  // Microsoft Graph — every 30 min, para todos os usuários com conta conectada
  cron.schedule(process.env.SYNC_GRAPH_CRON || '*/30 * * * *', async () => {
    console.log('[CRON] Syncing Microsoft Graph...');
    try {
      const { users_synced } = await syncRoutine.syncGraphAllUsers();
      console.log(`[CRON] Microsoft Graph — ${users_synced} usuário(s) sincronizado(s)`);
    } catch (e) { console.error('[CRON GRAPH]', e.message); }
  });

  // SmartLeader OKRs — daily at 8am (desativado — ver integrationFlags.js)
  if (SMARTLEADER_ENABLED) {
    cron.schedule(process.env.SYNC_OKR_CRON || '0 8 * * *', async () => {
      console.log('[CRON] Syncing SmartLeader OKRs...');
      try { await syncRoutine.syncOKR(); } catch (e) { console.error('[CRON OKR]', e.message); }
    });
  }

  console.log('[CRON] Scheduled sync jobs active — ADO, Freshservice, Work/Plane, Microsoft Graph' + (SMARTLEADER_ENABLED ? ', SmartLeader OKRs' : ''));
}

const PORT = process.env.PORT || 3001;
credentialStore.loadAll()
  .catch(err => console.error('[CredentialStore] Falha ao carregar credenciais do banco:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Copastur Platform API — porta ${PORT}`);
      console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health:   http://localhost:${PORT}/health\n`);
    });
  });

module.exports = app;
