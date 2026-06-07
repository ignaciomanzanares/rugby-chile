"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, Trophy, Lock, CheckCircle, Clock, ChevronRight, Save } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Fixture = {
  id: string;
  round: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string | null;
  venue: string | null;
  status: "UPCOMING" | "LOCKED" | "COMPLETED";
  homeScoreActual: number | null;
  awayScoreActual: number | null;
  prediction: { homeScore: number; awayScore: number; pointsEarned: number | null } | null;
};

type Round = { round: number; season: number };

const POINTS_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: "¡Exacto!", color: "text-emerald-400" },
  3: { label: "Diferencia", color: "text-amber-400" },
  2: { label: "Ganador", color: "text-blue-400" },
  0: { label: "Fallido", color: "text-muted-foreground" },
};

const IMPOSSIBLE_SCORES = new Set([1, 2, 4]);

function isValidRugbyScore(n: number) {
  return n >= 0 && !IMPOSSIBLE_SCORES.has(n);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ScoreInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const num = parseInt(value, 10);
  const invalid = value !== "" && (!isNaN(num)) && !isValidRugbyScore(num);

  return (
    <input
      type="number"
      min="0"
      max="99"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-14 text-center bg-muted border rounded-lg py-2 text-lg font-bold text-foreground focus:outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
        invalid
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
          : "border-border focus:border-amber-500 focus:ring-amber-500/30"
      }`}
    />
  );
}

function FixtureCard({
  fixture,
  homeInput,
  awayInput,
  onHomeChange,
  onAwayChange,
}: {
  fixture: Fixture;
  homeInput: string;
  awayInput: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
}) {
  const isLocked = fixture.status === "LOCKED" || fixture.status === "COMPLETED";
  const pred = fixture.prediction;
  const pts = pred?.pointsEarned;

  return (
    <div className={`rounded-xl border bg-card/60 p-4 transition-all ${
      isLocked ? "border-border opacity-80" : "border-border hover:border-amber-600/50"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {fixture.status === "COMPLETED" ? (
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          ) : fixture.status === "LOCKED" ? (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span className="text-xs text-muted-foreground">{formatDate(fixture.matchDate)}</span>
        </div>
        {pts !== null && pts !== undefined && (
          <span className={`text-xs font-bold ${POINTS_LABELS[pts]?.color ?? "text-muted-foreground"}`}>
            {pts} pts · {POINTS_LABELS[pts]?.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="flex-1 text-right text-sm font-bold text-foreground">{fixture.homeTeam}</span>

        {fixture.status === "COMPLETED" && fixture.homeScoreActual !== null ? (
          <div className="flex items-center gap-1.5 text-foreground/80 font-black text-lg">
            <span>{fixture.homeScoreActual}</span>
            <span className="text-muted-foreground/70">–</span>
            <span>{fixture.awayScoreActual}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <ScoreInput value={homeInput} onChange={onHomeChange} disabled={isLocked} />
            <span className="text-muted-foreground/70 font-bold">–</span>
            <ScoreInput value={awayInput} onChange={onAwayChange} disabled={isLocked} />
          </div>
        )}

        <span className="flex-1 text-left text-sm font-bold text-foreground">{fixture.awayTeam}</span>
      </div>

      {pred && fixture.status !== "COMPLETED" && (
        <p className="text-center text-xs text-muted-foreground/70 mt-2">
          Tu predicción: {pred.homeScore} – {pred.awayScore}
        </p>
      )}
      {pred && fixture.status === "COMPLETED" && (
        <p className="text-center text-xs text-muted-foreground/70 mt-2">
          Predijiste: {pred.homeScore} – {pred.awayScore}
        </p>
      )}
      {fixture.status !== "COMPLETED" && !pred && !isLocked && (
        <p className="text-center text-xs text-amber-600/70 mt-2">Ingresa tu predicción</p>
      )}
    </div>
  );
}

export default function PredictPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [loadingFixtures, setLoadingFixtures] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?from=/predict");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/predict/rounds`)
      .then((r) => r.json())
      .then((data: Round[]) => {
        setRounds(data);
        if (data.length > 0) setSelectedRound(data[data.length - 1].round);
      })
      .catch(console.error);
  }, []);

  const loadFixtures = useCallback(async (round: number) => {
    setLoadingFixtures(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/predict/fixtures?round=${round}`, {
        credentials: "include",
      });
      const data: Fixture[] = await res.json();
      setFixtures(data);
      const initial: Record<string, { home: string; away: string }> = {};
      for (const f of data) {
        initial[f.id] = {
          home: f.prediction ? String(f.prediction.homeScore) : "",
          away: f.prediction ? String(f.prediction.awayScore) : "",
        };
      }
      setInputs(initial);
    } finally {
      setLoadingFixtures(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRound !== null) loadFixtures(selectedRound);
  }, [selectedRound, loadFixtures]);

  const handleSave = async () => {
    setScoreError("");
    const preds = fixtures
      .filter((f) => f.status === "UPCOMING")
      .map((f) => ({
        fixtureId: f.id,
        homeScore: parseInt(inputs[f.id]?.home ?? "0", 10),
        awayScore: parseInt(inputs[f.id]?.away ?? "0", 10),
      }))
      .filter((p) => !isNaN(p.homeScore) && !isNaN(p.awayScore));

    if (preds.length === 0) return;

    const bad = preds.find((p) => !isValidRugbyScore(p.homeScore) || !isValidRugbyScore(p.awayScore));
    if (bad) {
      setScoreError("Puntajes inválidos (1, 2 y 4 son imposibles en rugby)");
      return;
    }

    setSaving(true);
    try {
      await fetch(`${API_URL}/api/v1/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ predictions: preds }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (selectedRound !== null) loadFixtures(selectedRound);
    } finally {
      setSaving(false);
    }
  };

  const hasUpcoming = fixtures.some((f) => f.status === "UPCOMING");
  const totalPoints = fixtures.reduce((s, f) => s + (f.prediction?.pointsEarned ?? 0), 0);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-amber-400" />
              <h1 className="text-2xl font-black text-foreground">Predicciones</h1>
            </div>
            <p className="text-muted-foreground text-sm">Adivina los resultados y acumula puntos</p>
          </div>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-semibold text-foreground/80"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            Tabla
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
          </Link>
        </div>

        {/* Scoring guide */}
        <div className="rounded-xl border border-border bg-card/40 p-4 mb-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Puntuación</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="block text-emerald-400 font-black text-lg">5</span>
              <span className="text-muted-foreground">Marcador exacto</span>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="block text-amber-400 font-black text-lg">3</span>
              <span className="text-muted-foreground">Ganador + diff ≤3</span>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <span className="block text-blue-400 font-black text-lg">2</span>
              <span className="text-muted-foreground">Solo ganador</span>
            </div>
          </div>
        </div>

        {/* Round selector */}
        {rounds.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {rounds.map((r) => (
              <button
                key={r.round}
                onClick={() => setSelectedRound(r.round)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  selectedRound === r.round
                    ? "bg-red-600 text-white"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                }`}
              >
                Fecha {r.round}
              </button>
            ))}
          </div>
        )}

        {/* Points summary for this round */}
        {totalPoints > 0 && (
          <div className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-4 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-amber-400 font-semibold">Puntos en esta fecha</span>
            <span className="text-xl font-black text-amber-400">{totalPoints}</span>
          </div>
        )}

        {/* Fixtures */}
        {loadingFixtures ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card/40 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {fixtures.map((f) => (
              <FixtureCard
                key={f.id}
                fixture={f}
                homeInput={inputs[f.id]?.home ?? ""}
                awayInput={inputs[f.id]?.away ?? ""}
                onHomeChange={(v) => { setScoreError(""); setInputs((prev) => ({ ...prev, [f.id]: { ...prev[f.id], home: v } })); }}
                onAwayChange={(v) => { setScoreError(""); setInputs((prev) => ({ ...prev, [f.id]: { ...prev[f.id], away: v } })); }}
              />
            ))}
          </div>
        )}

        {/* Save button */}
        {hasUpcoming && (
          <div className="mt-6 sticky bottom-4">
            {scoreError && (
              <p className="text-center text-xs text-red-400 mb-2">{scoreError}</p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                saved
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
              } disabled:opacity-60`}
            >
              {saved ? (
                <><CheckCircle className="h-4 w-4" /> Predicciones guardadas</>
              ) : saving ? (
                "Guardando…"
              ) : (
                <><Save className="h-4 w-4" /> Guardar predicciones</>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
