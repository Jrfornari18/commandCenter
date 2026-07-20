const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected idle client error', err.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] ${Date.now() - start}ms | ${text.substring(0, 80).replace(/\s+/g, ' ')}`);
    }
    return res;
  } catch (err) {
    console.error('[DB ERROR]', err.message, '\nQuery:', text.substring(0, 200));
    throw err;
  }
};

module.exports = { query, pool };
