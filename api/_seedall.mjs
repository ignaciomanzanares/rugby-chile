import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();
try {
  await c.query("begin");
  // total de temporada por jugador (round 0)
  const season = await c.query("select arusa_id, club_slug, player_name, points_earned from fantasy_gameweek_scores where division='primera' and round=0");
  // los que YA tienen fechas 1-3 sembradas a mano (los 16 de GOATS) → no tocar
  const seeded = await c.query("select distinct arusa_id from fantasy_gameweek_scores where division='primera' and round in (1,2,3)");
  const skip = new Set(seeded.rows.map(r => r.arusa_id));
  // variaciones deterministas por jugador para que cada fecha se vea distinta
  const MULTS = [[0.8,1.0,1.2],[1.15,0.9,0.95],[0.9,1.2,0.9],[1.05,0.95,1.0],[1.2,0.85,0.95]];
  let n = 0;
  for (const p of season.rows) {
    if (skip.has(p.arusa_id)) continue;
    const base = Math.max(0, Math.round(p.points_earned / 10)); // ~ por partido (temporada ~10 fechas)
    const m = MULTS[Number(String(p.arusa_id).slice(-1)) % MULTS.length];
    for (let r = 1; r <= 3; r++) {
      const pts = Math.max(0, Math.round(base * m[r-1]));
      await c.query(
        `insert into fantasy_gameweek_scores (division, round, arusa_id, club_slug, player_name, played, was_sub, points_earned)
         values ('primera',$1,$2,$3,$4,true,false,$5)`,
        [r, p.arusa_id, p.club_slug, p.player_name, pts]
      );
    }
    n++;
  }
  await c.query("commit");
  console.log(`Sembradas fechas 1-3 para ${n} jugadores extra (los 16 de GOATS quedaron intactos).`);
} catch (e) { await c.query("rollback"); console.error("ROLLBACK", e.message); process.exit(1); }
finally { c.release(); await pool.end(); }
