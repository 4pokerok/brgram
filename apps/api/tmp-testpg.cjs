const { Client } = require('pg');
(async () => {
  const client = new Client({
    connectionString: 'postgresql://brgram:brgram@localhost:5432/brgram',
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    statement_timeout: 3000,
  });
  console.log('start');
  try {
    await client.connect();
    console.log('connected');
    const res = await client.query('select now() as now');
    console.log('ok', res.rows[0]);
  } catch (e) {
    console.error('db error', e);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
})();
