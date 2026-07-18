require('dotenv').config();
const adoClient = require('../integrations/azure_devops/client');

(async () => {
  const projects = (process.env.ADO_SYNC_PROJECTS || 'Q2-2026').split(',').map(p => p.trim());
  let total = 0;
  for (const project of projects) {
    try {
      const synced = await adoClient.syncProject(project);
      total += synced;
      console.log(`[sync-ado] ${project}: ${synced} itens sincronizados`);
    } catch (err) {
      console.error(`[sync-ado] ${project}:`, err.message);
    }
  }
  console.log(`[sync-ado] concluído — ${total} itens no total`);
  process.exit(0);
})();
