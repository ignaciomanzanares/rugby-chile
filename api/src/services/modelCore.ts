/**
 * Shared prediction-model core — the exact same rating fit + 1/X/2 predictor
 * used by the calibration backtest (scripts/backtest.ts) and the live
 * validation endpoint (validateModel.ts), so they can't drift apart.
 *
 * The weights in DEFAULTS mirror the production projection
 * (services/simulateSeason.ts + seasonHistory.ts); a sanity check in the
 * backtest confirms this reproduces production's per-match numbers.
 *
 * Rugby UNION scoring (not league). Parameterised so the backtest can sweep it.
 */
import { computeH2H } from "./computeH2H";
import { fetchAllResults } from "../routes/leveradeResults";
import { readCache, writeCache } from "../lib/arusaCache";

export const CLUBS = [
  "COBS", "Old Boys", "PWCC", "Old Macks", "Stade Francais",
  "Sporting RC", "DOBS", "UC", "Old Johns", "Old Reds",
];
const CURRENT_SEASON = 2026;

export interface Match { year: number; date: string; home: string; away: string; hs: number; as: number }

export interface Params {
  hfa: number; sdMargin: number; h2hWeight: number; resultBlend: number; decay: number;
  priorGames: number; priorFullHistory: number; h2hMarginCap: number; h2hFullConf: number;
  scoreWinsor: number; fitIters: number;
}
// Production values after backtest calibration. sdMargin = SCORE_SD·√2 (11.3·√2 ≈ 16).
export const DEFAULTS: Params = {
  hfa: 2.8, sdMargin: 16, h2hWeight: 0.15, resultBlend: 0.15, decay: 0.55,
  priorGames: 3, priorFullHistory: 20, h2hMarginCap: 21, h2hFullConf: 6,
  scoreWinsor: 25, fitIters: 20,
};

export interface Ratings { att: Map<string, number>; def: Map<string, number>; leagueMean: number }

// Approx league points a team earns in one match (bonus estimated from score).
export function leaguePoints(scored: number, conceded: number): number {
  const win = scored > conceded, draw = scored === conceded;
  let p = draw ? 2 : win ? 4 : 0;
  if (scored >= 25) p += 1;
  if (!draw && !win && conceded - scored <= 7) p += 1;
  return p;
}

export function buildHistory(before: Match[], year: number, p: Params) {
  const past = before.filter((m) => m.year < year);
  const tS = new Map<string, number>(), tC = new Map<string, number>(), tW = new Map<string, number>(), tG = new Map<string, number>();
  let lgW = 0, lgS = 0;
  for (const m of past) {
    const w = p.decay ** (year - m.year);
    const add = (mp: Map<string, number>, k: string, v: number) => mp.set(k, (mp.get(k) ?? 0) + v);
    add(tS, m.home, w * m.hs); add(tC, m.home, w * m.as); add(tW, m.home, w); add(tG, m.home, 1);
    add(tS, m.away, w * m.as); add(tC, m.away, w * m.hs); add(tW, m.away, w); add(tG, m.away, 1);
    lgW += 2 * w; lgS += w * (m.hs + m.as);
  }
  const teams: Record<string, { attack: number; defense: number; games: number }> = {};
  for (const t of CLUBS) { const w = tW.get(t) ?? 0; if (w > 0) teams[t] = { attack: tS.get(t)! / w, defense: tC.get(t)! / w, games: tG.get(t) ?? 0 }; }
  const histLeagueMean = lgW > 0 ? lgS / lgW : 0;

  const h2h = new Map<string, { games: number; marginAoverB: number }>();
  const byPair = new Map<string, Match[]>();
  for (const m of before) { const k = [m.home, m.away].sort().join("__"); (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(m); }
  for (const [k, ms] of byPair) {
    const [sA] = k.split("__");
    let mW = 0, mM = 0;
    for (const m of ms) {
      const w = p.decay ** (year - m.year);
      const aS = m.home === sA ? m.hs : m.as, bS = m.home === sA ? m.as : m.hs;
      const margin = Math.max(-p.h2hMarginCap, Math.min(p.h2hMarginCap, aS - bS));
      mW += w; mM += w * margin;
    }
    if (mW > 0) h2h.set(k, { games: ms.length, marginAoverB: mM / mW });
  }
  return { teams, histLeagueMean, h2h };
}

export function fitRatings(current: Match[], history: ReturnType<typeof buildHistory>, p: Params): Ratings {
  const scores = current.flatMap((m) => [m.hs, m.as]);
  const leagueMean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : (history.histLeagueMean || 28);
  const cap = (x: number) => Math.max(leagueMean - p.scoreWinsor + 1, Math.min(leagueMean + p.scoreWinsor + 1, x));

  interface G { opp: string; scored: number; conceded: number; home: boolean }
  const games = new Map<string, G[]>();
  for (const t of CLUBS) games.set(t, []);
  for (const m of current) {
    const hs = cap(m.hs), as = cap(m.as);
    games.get(m.home)?.push({ opp: m.away, scored: hs, conceded: as, home: true });
    games.get(m.away)?.push({ opp: m.home, scored: as, conceded: hs, home: false });
  }

  const scale = history.histLeagueMean > 0 ? leagueMean / history.histLeagueMean : 0;
  const priorAtt = (t: string) => { const h = history.teams[t]; return h && scale > 0 ? h.attack * scale : leagueMean; };
  const priorDef = (t: string) => { const h = history.teams[t]; return h && scale > 0 ? h.defense * scale : leagueMean; };
  const priorW = (t: string) => p.priorGames * Math.min(history.teams[t]?.games ?? 0, p.priorFullHistory) / p.priorFullHistory;

  const att = new Map<string, number>(), def = new Map<string, number>();
  for (const t of CLUBS) {
    const gl = games.get(t)!;
    att.set(t, gl.length ? gl.reduce((a, g) => a + g.scored, 0) / gl.length : leagueMean);
    def.set(t, gl.length ? gl.reduce((a, g) => a + g.conceded, 0) / gl.length : leagueMean);
  }
  for (let it = 0; it < p.fitIters; it++) {
    const nA = new Map<string, number>();
    for (const t of CLUBS) {
      const gl = games.get(t)!; let s = 0;
      for (const g of gl) s += g.scored - (def.get(g.opp)! - leagueMean) - (g.home ? p.hfa / 2 : -p.hfa / 2);
      nA.set(t, (s + priorW(t) * priorAtt(t)) / (gl.length + priorW(t)));
    }
    const nD = new Map<string, number>();
    for (const t of CLUBS) {
      const gl = games.get(t)!; let s = 0;
      for (const g of gl) s += g.conceded - (nA.get(g.opp)! - leagueMean) - (g.home ? -p.hfa / 2 : p.hfa / 2);
      nD.set(t, (s + priorW(t) * priorDef(t)) / (gl.length + priorW(t)));
    }
    for (const t of CLUBS) { att.set(t, nA.get(t)!); def.set(t, nD.get(t)!); }
  }

  if (current.length) {
    const pts = new Map<string, number>(), gp = new Map<string, number>();
    for (const m of current) {
      pts.set(m.home, (pts.get(m.home) ?? 0) + leaguePoints(m.hs, m.as));
      pts.set(m.away, (pts.get(m.away) ?? 0) + leaguePoints(m.as, m.hs));
      gp.set(m.home, (gp.get(m.home) ?? 0) + 1); gp.set(m.away, (gp.get(m.away) ?? 0) + 1);
    }
    const teamsWithGames = CLUBS.filter((t) => (gp.get(t) ?? 0) > 0);
    if (teamsWithGames.length >= 4) {
      const ppg = (t: string) => (pts.get(t) ?? 0) / Math.max(1, gp.get(t) ?? 0);
      const strength = new Map(CLUBS.map((t) => [t, att.get(t)! - def.get(t)!]));
      const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const sd = (a: number[], m: number) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
      const pv = teamsWithGames.map(ppg), sv = teamsWithGames.map((t) => strength.get(t)!);
      const mP = mean(pv), sP = sd(pv, mP), mS = mean(sv), sS = sd(sv, mS);
      for (const t of teamsWithGames) {
        const bump = p.resultBlend * (((ppg(t) - mP) / sP - (strength.get(t)! - mS) / sS) * sS);
        att.set(t, att.get(t)! + bump / 2); def.set(t, def.get(t)! - bump / 2);
      }
    }
  }
  return { att, def, leagueMean };
}

export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const pr = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - pr : pr;
}

// Predict one match → probabilities, expected scores, margin.
export function predict(home: string, away: string, r: Ratings, hist: ReturnType<typeof buildHistory>, p: Params) {
  const ratingMargin = (r.att.get(home)! - r.att.get(away)!) + (r.def.get(away)! - r.def.get(home)!);
  const pair = hist.h2h.get([home, away].sort().join("__"));
  let h2h = 0;
  if (pair && pair.games >= 3) {
    const [sA] = [home, away].sort();
    const h2hMargin = sA === home ? pair.marginAoverB : -pair.marginAoverB;
    const conf = Math.min(pair.games, p.h2hFullConf) / p.h2hFullConf;
    h2h = p.h2hWeight * conf * (h2hMargin - ratingMargin);
  }
  const eh = r.att.get(home)! + (r.def.get(away)! - r.leagueMean) + p.hfa / 2 + h2h / 2;
  const ea = r.att.get(away)! + (r.def.get(home)! - r.leagueMean) - p.hfa / 2 - h2h / 2;
  const mu = eh - ea, sd = p.sdMargin;
  const pD = normCdf((0.5 - mu) / sd) - normCdf((-0.5 - mu) / sd);
  const pA = normCdf((-0.5 - mu) / sd);
  const pH = Math.max(1e-6, 1 - pD - pA);
  return { pH, pD: Math.max(1e-6, pD), pA: Math.max(1e-6, pA), expHome: Math.max(0, eh), expAway: Math.max(0, ea), margin: mu };
}

// ── Dataset assembly (all PRIMERA matches, sorted by date) ───────────────────
// Past seasons are immutable → cached long. The current season comes fresh from
// the results feed on every call, so new results show up right away.
const PAST_KEY = "model:past-matches:v1";
let pastCache: Match[] | null = null;

async function pastMatches(): Promise<Match[]> {
  if (pastCache) return pastCache;
  const persisted = await readCache<Match[]>(PAST_KEY);
  if (persisted && persisted.length > 50) { pastCache = persisted; return persisted; }
  const seen = new Set<string>();
  const out: Match[] = [];
  for (let i = 0; i < CLUBS.length; i++) {
    for (let j = i + 1; j < CLUBS.length; j++) {
      let h;
      try { h = await computeH2H("PRIMERA", CLUBS[i], CLUBS[j]); } catch { continue; }
      for (const m of h.meetings) {
        if (m.year >= CURRENT_SEASON) continue;
        const key = `${m.year}|${m.homeTeam}|${m.awayTeam}|${m.homeScore}-${m.awayScore}`;
        if (seen.has(key)) continue; seen.add(key);
        out.push({ year: m.year, date: m.date ?? `${m.year}-06-01`, home: m.homeTeam, away: m.awayTeam, hs: m.homeScore, as: m.awayScore });
      }
    }
  }
  if (out.length > 50) { pastCache = out; void writeCache(PAST_KEY, out); }
  return out;
}

export async function assembleMatchDataset(): Promise<Match[]> {
  const past = await pastMatches();
  const current: Match[] = [];
  try {
    const results = await fetchAllResults();
    for (const m of Object.values(results)) {
      if (m.division !== "PRIMERA" || !m.finished || m.homeScore == null || m.awayScore == null) continue;
      current.push({ year: CURRENT_SEASON, date: m.datetime ? m.datetime.slice(0, 10) : `${CURRENT_SEASON}-06-01`, home: m.homeTeam, away: m.awayTeam, hs: m.homeScore, as: m.awayScore });
    }
  } catch { /* no feed */ }
  return [...past, ...current].sort((a, b) => a.date.localeCompare(b.date));
}
