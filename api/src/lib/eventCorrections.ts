/**
 * Manual corrections for the minute-by-minute event feed.
 *
 * arusa.cl occasionally attributes a try/conversion/penalty to the wrong player.
 * We don't touch the scrape or its cache — instead we remap the scorer name when
 * SERVING an event, from a small hand-curated table sourced from someone who was
 * at / knows the match. Each fix is explicit and documented so it stays defendible.
 *
 * Key: `${division}:${round}:${home}:${away}` (fixture orientation). A rule matches
 * events by team + type, optionally narrowed to an exact game minute or a half;
 * the MOST SPECIFIC matching rule wins (minute > half > type-only), so a broad
 * "all conversions → X" can coexist with a per-minute override.
 */

export type CorrectionRule = {
  team: string;                 // canonical club name that actually scored
  type: "TRY" | "CONVERSION" | "PENALTY" | "DROP_GOAL";
  minute?: number;              // exact game minute (2nd-half minutes are +40)
  half?: 1 | 2;                 // or a whole half
  player: string;               // corrected scorer name
};

// Sourced from Old Reds people who know the matches — arusa had these wrong.
export const EVENT_CORRECTIONS: Record<string, CorrectionRule[]> = {
  // OR 33-42 Stade Francais (Primera, fecha 13)
  "PRIMERA:13:Old Reds:Stade Francais": [
    { team: "Old Reds", type: "TRY", minute: 56, player: "Tomás Yáñez" },        // arusa: Andrei Cherniavsky
    { team: "Old Reds", type: "PENALTY", player: "Diego Arturo Espinoza Merino" }, // arusa marcó el de 21' como Yáñez
  ],
  // OR 34-31 UC (Intermedia, fecha 10)
  "INTERMEDIA:10:Old Reds:UC": [
    { team: "Old Reds", type: "CONVERSION", player: "Gerard Martin Amar" }, // la del 3' marcaba Marchant
  ],
  // OR 42-43 Sporting RC (Intermedia, fecha 11)
  "INTERMEDIA:11:Old Reds:Sporting RC": [
    { team: "Old Reds", type: "TRY", half: 1, player: "Jose Tomas Barrena Botto" },       // los 3 tries del 1er tiempo
    { team: "Old Reds", type: "TRY", minute: 43, player: "Eduardo Santander Rodriguez" }, // 1º del 2do tiempo
    { team: "Old Reds", type: "TRY", minute: 76, player: "José Miguel Marchant Rodriguez" }, // arusa: Felipe Callejas
    { team: "Old Reds", type: "CONVERSION", player: "Gerard Martin Amar" },               // todas las conversiones
  ],
};

interface OrientedEvent {
  minute: number;
  type: string;
  playerName: string | null;
  team: "home" | "away";
  half: number;
  [k: string]: unknown;
}

/**
 * Remap scorer names for a match's oriented events. `home`/`away` are the fixture
 * team names (same orientation as the correction keys). Returns a new array; a
 * missing match key is a no-op.
 */
export function applyEventCorrections<E extends OrientedEvent>(
  division: string,
  round: number | null,
  home: string,
  away: string,
  events: E[],
): E[] {
  if (round == null) return events;
  const rules = EVENT_CORRECTIONS[`${division}:${round}:${home}:${away}`];
  if (!rules) return events;

  return events.map((e) => {
    const teamName = e.team === "home" ? home : away;
    let best: CorrectionRule | null = null;
    let bestScore = -1;
    for (const r of rules) {
      if (r.team !== teamName || r.type !== e.type) continue;
      if (r.minute != null && r.minute !== e.minute) continue;
      if (r.half != null && r.half !== e.half) continue;
      const score = (r.minute != null ? 3 : 0) + (r.half != null ? 2 : 0) + 1;
      if (score > bestScore) { best = r; bestScore = score; }
    }
    return best ? { ...e, playerName: best.player } : e;
  });
}
