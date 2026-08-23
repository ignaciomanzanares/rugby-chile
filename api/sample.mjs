import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select count(*) c, max(updated_at) last from arusa_cache where key like 'events:%'`);
console.log(new Date().toISOString().slice(11,19), 'events:', r.rows[0].c, 'último:', r.rows[0].last?.toISOString?.().slice(11,19));
await c.end();
