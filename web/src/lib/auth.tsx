"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "top10_token";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  createdAt?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage no disponible */
  }
}

// Inyecta "Authorization: Bearer <token>" en toda llamada a la API. Clave para
// la PWA de iOS: ahí la cookie cross-site (API en onrender.com, web en
// vercel.app) no viaja ni persiste, así que la sesión se apoya en el token de
// localStorage. En navegador normal la cookie sigue funcionando igual.
function installAuthFetch() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __top10AuthFetch?: boolean };
  if (w.__top10AuthFetch) return;
  w.__top10AuthFetch = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url && url.startsWith(API_URL)) {
        const token = getToken();
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
          init = { ...init, headers };
        }
      }
    } catch {
      /* no romper el fetch por el patch */
    }
    return orig(input, init);
  };
}
installAuthFetch();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: "include" });
      if (res.ok) setUser(await res.json());
      else {
        setUser(null);
        if (res.status === 401) setToken(null); // token vencido/ inválido
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al iniciar sesión");
    if (data.token) setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, name: string, password: string) => {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, name, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al crear cuenta");
    if (data.token) setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
