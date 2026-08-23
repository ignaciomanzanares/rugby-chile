import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const ev = await c.query(`select count(*) c from arusa_cache where key like 'events:%'`);
const fresh = await c.query(`select count(*) c from arusa_cache where key like 'events:%' and updated_at > now() - interval '30 minutes'`);
console.log(new Date().toISOString().slice(11,16), 'UTC | events total:', ev.rows[0].c, '| nuevos <30min:', fresh.rows[0].c);
await c.end();
