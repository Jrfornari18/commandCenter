require('dotenv').config();
const fsClient = require('../integrations/freshservice/client');

(async () => {
  try {
    const result = await fsClient.syncTickets();
    console.log(`[sync-freshservice] concluído — ${result.synced} tickets sincronizados`);
    process.exit(0);
  } catch (err) {
    console.error('[sync-freshservice]', err.message);
    process.exit(1);
  }
})();
