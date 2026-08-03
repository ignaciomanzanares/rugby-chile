"use client";

import { useEffect, useState } from "react";
import { Users2, Target, Gamepad2, UserCheck, Shield, RefreshCw, ShieldPlus, ShieldMinus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminPushBroadcast } from "@/components/admin-push-broadcast";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AdminUser = { id: string; name: string | null; email: string; role: string; createdAt: string };
type Overview = {
  users: AdminUser[];
  counts: { users: number; predictions: number; predictors: number; fantasySquads: number; currentRound: number | null; live: number };
  predictionsByRound: { round: number; predictions: number; users: number }[];
};

const ROLE_LABEL: Record<string, string> = { USER: "Hincha", ADMIN: "Administrador" };

function initials(name: string | null, email: string) {
  const base = name?.trim() || email;
  return base.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const url = `${API_URL}/api/v1/admin/overview`;
    // Reintenta: en Render free el primer fetch puede fallar por cold-start. El
    // timeout debe cubrir el arranque en frío (~50s) — abortar antes mataba la
    // request justo mientras Render despertaba, y por eso quedaba en error.
    let reason = "sin respuesta";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 60000);
        const r = await fetch(url, { credentials: "include", signal: ctrl.signal });
        clearTimeout(timer);
        if (r.status === 403) {
          setError("Solo administradores");
          setLoading(false);
          return;
        }
        if (!r.ok) {
          reason = `HTTP ${r.status}`;
          throw new Error(reason);
        }
        setData((await r.json()) as Overview);
        setLoading(false);
        return;
      } catch (e) {
        reason = e instanceof Error && e.name === "AbortError" ? "timeout" : e instanceof Error ? e.message : "error de red";
        if (attempt < 2) await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
    }
    setError(`No se pudo cargar (${reason}). Prueba con Actualizar.`);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const deleteUser = async (u: AdminUser) => {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo eliminar");
      setData((d) => (d ? { ...d, users: d.users.filter((x) => x.id !== u.id) } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = async (u: AdminUser) => {
    const next = u.role === "ADMIN" ? "USER" : "ADMIN";
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/users/${u.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo cambiar el rol");
      setData((d) => (d ? { ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, role: next } : x)) } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const cards = data
    ? [
        { name: "Usuarios", value: data.counts.users, icon: Users2, color: "text-blue-400", bg: "bg-blue-400/10" },
        { name: "Con predicción", value: data.counts.predictors, icon: Target, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        { name: "Predicciones", value: data.counts.predictions, icon: UserCheck, color: "text-amber-400", bg: "bg-amber-400/10" },
        { name: "Equipos fantasy", value: data.counts.fantasySquads, icon: Gamepad2, color: "text-purple-400", bg: "bg-purple-400/10" },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide">Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Quién se registró y qué actividad hay</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted hover:bg-secondary text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-600/30 bg-red-600/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s) => (
          <div key={s.name} className="rounded-xl border border-border bg-card/50 p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.name}</p>
            </div>
          </div>
        ))}
      </div>

      <AdminPushBroadcast />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Users list */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm uppercase tracking-widest">Registrados</h2>
          </div>
          <div className="divide-y divide-border">
            {loading && !data && <div className="px-5 py-8 text-center text-sm text-muted-foreground animate-pulse">Cargando…</div>}
            {data?.users.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                  {initials(u.name, u.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{u.name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                {u.role === "ADMIN" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-600/30 flex-shrink-0">
                    <Shield className="h-3 w-3" /> {ROLE_LABEL[u.role]}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground/80 flex-shrink-0 hidden md:block tabular-nums">{fmtDate(u.createdAt)}</span>
                {me?.id === u.id ? (
                  <span className="text-[11px] text-muted-foreground/60 flex-shrink-0 hidden sm:block">(vos)</span>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setConfirmState({
                          title: u.role === "ADMIN" ? "Quitar administrador" : "Hacer administrador",
                          message:
                            u.role === "ADMIN"
                              ? `${u.name || u.email} dejará de ser administrador.`
                              : `${u.name || u.email} va a poder gestionar el sitio: usuarios, formaciones y puntuación.`,
                          confirmLabel: u.role === "ADMIN" ? "Quitar admin" : "Hacer admin",
                          onConfirm: () => toggleRole(u),
                        })
                      }
                      disabled={busyId === u.id}
                      title={u.role === "ADMIN" ? "Quitar administrador" : "Hacer administrador"}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-50 ${
                        u.role === "ADMIN"
                          ? "border border-border bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground"
                          : "bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-600/30"
                      }`}
                    >
                      {u.role === "ADMIN" ? <ShieldMinus className="h-3.5 w-3.5" /> : <ShieldPlus className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{u.role === "ADMIN" ? "Quitar admin" : "Hacer admin"}</span>
                    </button>
                    <button
                      onClick={() =>
                        setConfirmState({
                          title: "Eliminar usuario",
                          message: `Se borra la cuenta de ${u.name || u.email} y toda su actividad (predicciones, fantasy). No se puede deshacer.`,
                          confirmLabel: "Eliminar",
                          danger: true,
                          onConfirm: () => deleteUser(u),
                        })
                      }
                      disabled={busyId === u.id}
                      title="Eliminar usuario"
                      className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground/70 hover:text-red-400 hover:bg-red-600/10 transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {data && data.users.length === 0 && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin usuarios todavía.</div>}
          </div>
        </div>

        {/* Predictions by round */}
        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm uppercase tracking-widest">Predicciones por fecha</h2>
          </div>
          <div className="divide-y divide-border">
            {data?.predictionsByRound.map((r) => (
              <div key={r.round} className="px-5 py-3 flex items-center justify-between gap-3">
                <span className="text-sm text-foreground/80">Fecha {r.round}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  <span className="font-black text-foreground tabular-nums">{r.predictions}</span> pred · {r.users} {r.users === 1 ? "hincha" : "hinchas"}
                </span>
              </div>
            ))}
            {data && data.predictionsByRound.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin predicciones todavía.</div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  );
}
