"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

const CLUBS = [
  { value: "cobs",          label: "COBS",          logo: "/clubs/cobs.jpg" },
  { value: "old-boys",      label: "Old Boys",       logo: "/clubs/old-boys.jpg" },
  { value: "pwcc",          label: "PWCC",           logo: "/clubs/pwcc.jpg" },
  { value: "old-macks",     label: "Old Macks",      logo: "/clubs/old-macks.jpg" },
  { value: "stade-francais",label: "Stade Français", logo: "/clubs/stade-francais.jpg" },
  { value: "sporting-rc",   label: "Sporting RC",    logo: "/clubs/sporting-rc.jpg" },
  { value: "dobs",          label: "DOBS",           logo: "/clubs/dobs.jpg" },
  { value: "uc",            label: "UC",             logo: "/clubs/uc.jpg" },
  { value: "old-johns",     label: "Old Johns",      logo: "/clubs/old-johns.jpg" },
  { value: "old-reds",      label: "Old Reds",       logo: "/clubs/old-reds.jpg" },
];

function ClubPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {CLUBS.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(selected ? "" : c.value)}
            className={`flex flex-col items-center gap-1 rounded-lg p-1.5 border transition-all ${
              selected
                ? "border-red-500 bg-red-500/10 ring-1 ring-red-500/40"
                : "border-zinc-700 bg-zinc-800 hover:border-zinc-500"
            }`}
          >
            <div className="w-9 h-9 rounded-md overflow-hidden bg-white flex items-center justify-center">
              <Image src={c.logo} alt={c.label} width={36} height={36} className="object-contain" />
            </div>
            <span className={`text-[9px] font-bold leading-tight text-center truncate w-full ${selected ? "text-red-400" : "text-zinc-500"}`}>
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type Tab = "login" | "register";

function Top10Badge() {
  return (
    <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-xl ring-1 ring-amber-400/40 bg-gradient-to-br from-amber-400 via-amber-500 to-red-700 flex-shrink-0">
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white leading-none">
        <span className="text-[8px] font-black tracking-widest drop-shadow">TOP</span>
        <span className="text-xl font-black tracking-tighter drop-shadow">10</span>
        <span className="text-[6px] font-bold tracking-[0.18em] text-white/90">RUGBY</span>
      </div>
      <div className="pointer-events-none absolute inset-x-2 top-1 h-1/3 bg-white/15 blur-sm rounded-full" />
    </div>
  );
}

function LoginInner() {
  const [tab, setTab] = useState<Tab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regClub, setRegClub] = useState("");

  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") ?? "/predict";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (regPassword !== regConfirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (regPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register(regEmail, regName, regPassword);
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">

      <div className="px-4 pt-6 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">

          <div className="flex flex-col items-center gap-4 mb-8">
            <Top10Badge />
            <div className="text-center">
              <h1 className="text-2xl font-black text-white tracking-tight">Top 10 · Rugby Chile</h1>
              <p className="text-zinc-500 text-sm mt-1">Asociación Rugby de Santiago · 2026</p>
            </div>
          </div>

          <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 p-1 mb-6">
            <button
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === "login" ? "bg-red-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setTab("register"); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tab === "register" ? "bg-red-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur">

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700/50 text-sm text-red-300">
                {error}
              </div>
            )}

            {tab === "login" ? (
              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="tu@correo.cl"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm transition-colors mt-2"
                >
                  {loading ? "Iniciando sesión…" : "Iniciar sesión"}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Juan Pérez"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Club <span className="text-zinc-600 font-normal normal-case">(opcional)</span>
                  </label>
                  <ClubPicker value={regClub} onChange={setRegClub} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="tu@correo.cl"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="Repite tu contraseña"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold text-sm transition-colors"
                >
                  {loading ? "Creando cuenta…" : "Crear cuenta"}
                </button>
              </form>
            )}

          </div>

          <p className="text-center text-sm text-zinc-600 mt-5">
            {tab === "login" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button onClick={() => { setTab("register"); setError(""); }} className="text-red-400 hover:text-red-300 font-semibold transition-colors">
                  Regístrate gratis
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button onClick={() => { setTab("login"); setError(""); }} className="text-red-400 hover:text-red-300 font-semibold transition-colors">
                  Inicia sesión
                </button>
              </>
            )}
          </p>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LoginInner />
    </Suspense>
  );
}
