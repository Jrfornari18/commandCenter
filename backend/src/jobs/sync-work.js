require('dotenv').config();
const workClient = require('../integrations/work_plane/client');

(async () => {
  try {
    const result = await workClient.syncTIBoards();
    console.log(`[sync-work] concluído — ${result.synced} issues sincronizadas`);
    process.exit(0);
  } catch (err) {
    console.error('[sync-work]', err.message);
    process.exit(1);
  }
})();
