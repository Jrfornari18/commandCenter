require('dotenv').config();
const db = require('../db');
const graphClient = require('../integrations/microsoft_graph/client');

(async () => {
  try {
    const { rows } = await db.query('SELECT user_id FROM graph_tokens');
    let synced = 0;
    for (const { user_id } of rows) {
      try {
        const [cal, email] = await Promise.all([
          graphClient.syncCalendar(user_id),
          graphClient.syncEmail(user_id)
        ]);
        console.log(`[sync-graph] user ${user_id}: ${cal.synced} eventos, ${email.synced} emails`);
        synced++;
      } catch (err) {
        console.error(`[sync-graph] user ${user_id}:`, err.message);
      }
    }
    console.log(`[sync-graph] concluído — ${synced}/${rows.length} usuários sincronizados`);
    process.exit(0);
  } catch (err) {
    console.error('[sync-graph]', err.message);
    process.exit(1);
  }
})();
