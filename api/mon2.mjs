import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const ev = await c.query(`select count(*) c from arusa_cache where key like 'events:%'`);
const recent = await c.query(`select
  (select count(*) from arusa_cache where key like 'events:%' and updated_at > now()-interval '35 min') ev35,
  (select max(updated_at) from arusa_cache where key like 'tries:%') trmax,
  (select max(updated_at) from arusa_cache where key like 'score:%') scmax`);
const r=recent.rows[0];
console.log(new Date().toISOString().slice(11,16),'UTC | events:',ev.rows[0].c,'| nuevos<35m:',r.ev35,'| tries últ:',r.trmax?.toISOString?.().slice(5,16),'| score últ:',r.scmax?.toISOString?.().slice(5,16));
await c.end();
