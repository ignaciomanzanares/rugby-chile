#!/usr/bin/env node
/**
 * Live-match simulator — drives a fake match through the real Socket.IO pipeline
 * so you can watch /live and /standings update in real time without waiting for
 * a real matchday.
 *
 * Usage (from repo root or web/):  node web/scripts/demo-live.mjs
 *
 * It creates a live_matches row via the REST API, then emits the same admin
 * socket events the scorer UI uses (match:start, minute:update, event:add,
 * match:ht, match:second_half, match:finish). Every emit is persisted by the
 * server and broadcast to all connected clients.
 *
 * Cleanup: the match is left FINISHED. Re-running creates a fresh one. Pass
 * --cleanup to delete LIVE/SCHEDULED demo matches with the same teams first.
 */
import { io } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const HOME = "Old Boys";
const AWAY = "COBS";
const DIVISION = "Primera XV";
const VENUE = "Estadio Old Boys, Las Condes";
const STEP_MS = Number(process.env.DEMO_STEP_MS ?? 3000); // pace between events

const POINTS = { TRY: 5, CONVERSION: 2, PENALTY: 3, DROP_GOAL: 3, YELLOW_CARD: 0, RED_CARD: 0 };

// minute, team, type, player
const TIMELINE = [
  [5,  "home", "TRY",         "J. Pérez"],
  [6,  "home", "CONVERSION",  "M. Soto"],
  [18, "away", "PENALTY",     "F. Díaz"],
  [25, "away", "TRY",         "R. Vidal"],
  [31, "home", "TRY",         "T. Rojas"],
  [33, "home", "CONVERSION",  "M. Soto"],
  [38, "away", "YELLOW_CARD", "L. Muñoz"],
  ["HT"],
  [48, "home", "PENALTY",     "M. Soto"],
  [55, "away", "TRY",         "R. Vidal"],
  [57, "away", "CONVERSION",  "F. Díaz"],
  [63, "home", "TRY",         "J. Pérez"],
  [70, "home", "TRY",         "P. Castro"],   // 4th try -> bonus point
  [72, "home", "CONVERSION",  "M. Soto"],
  [78, "away", "PENALTY",     "F. Díaz"],
  ["FINISH"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Delete any active (SCHEDULED/LIVE/HT) demo matches with the same teams, so a
// fresh run doesn't pile up duplicates in /live. GET /live only returns active
// matches, so FINISHED demos are left untouched.
async function cleanup() {
  const res = await fetch(`${API}/api/v1/live`);
  if (!res.ok) throw new Error(`list matches failed: ${res.status} ${await res.text()}`);
  const matches = await res.json();
  const stale = matches.filter((m) => m.homeTeam === HOME && m.awayTeam === AWAY);
  for (const m of stale) {
    const del = await fetch(`${API}/api/v1/live/matches/${m.id}`, { method: "DELETE" });
    if (!del.ok) throw new Error(`delete ${m.id} failed: ${del.status} ${await del.text()}`);
    console.log(`Cleaned up ${m.status} match ${m.id}: ${HOME} vs ${AWAY}`);
  }
  if (!stale.length) console.log("Nothing to clean up.");
}

async function main() {
  if (process.argv.includes("--cleanup")) await cleanup();

  // 1. Create the match (REST, no auth required)
  const res = await fetch(`${API}/api/v1/live/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ homeTeam: HOME, awayTeam: AWAY, division: DIVISION, venue: VENUE }),
  });
  if (!res.ok) throw new Error(`create match failed: ${res.status} ${await res.text()}`);
  const match = await res.json();
  console.log(`Created match ${match.id}: ${HOME} vs ${AWAY} (${DIVISION})`);

  // 2. Connect a socket client and drive the admin events
  const socket = io(API, { transports: ["websocket"] });
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("socket connect timeout")), 8000);
  });
  console.log("Socket connected. Kick-off!\n");

  let hs = 0, as = 0;
  socket.emit("match:start", match.id);
  await sleep(STEP_MS);

  for (const ev of TIMELINE) {
    if (ev[0] === "HT") {
      socket.emit("match:ht", match.id);
      console.log(`  ── HALF TIME ──  ${HOME} ${hs}-${as} ${AWAY}\n`);
      await sleep(STEP_MS);
      socket.emit("match:second_half", match.id);
      await sleep(STEP_MS);
      continue;
    }
    if (ev[0] === "FINISH") {
      socket.emit("minute:update", { matchId: match.id, minute: 80 });
      await sleep(600);
      socket.emit("match:finish", match.id);
      console.log(`\n  ── FULL TIME ──  ${HOME} ${hs}-${as} ${AWAY}`);
      await sleep(1200);
      break;
    }
    const [minute, team, type, player] = ev;
    const points = POINTS[type] ?? 0;
    if (team === "home") hs += points; else as += points;
    socket.emit("minute:update", { matchId: match.id, minute });
    socket.emit("event:add", { matchId: match.id, team, type, minute, playerName: player, points });
    const label = type.padEnd(11);
    console.log(`  ${String(minute).padStart(2)}'  ${team === "home" ? HOME.padEnd(9) : AWAY.padEnd(9)}  ${label} ${player ?? ""}  ->  ${hs}-${as}`);
    await sleep(STEP_MS);
  }

  socket.disconnect();
  console.log("\nDone. Match left as FINISHED (visible via /api/v1/live/finished).");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
