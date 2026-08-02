import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// Fail-closed: sign with a real secret or don't boot. Shipping a hardcoded
// fallback in a public repo would let anyone forge session cookies, so the API
// refuses to start without JWT_SECRET set in the environment.
function requireJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error(
      "JWT_SECRET no está definido. La API no arranca sin un secreto de firma real " +
        "(no hay default). Generá uno y seteálo en el entorno, p. ej.: " +
        "JWT_SECRET=$(openssl rand -hex 32)",
    );
  }
  return s;
}
const JWT_SECRET = requireJwtSecret();

const COOKIE_NAME = "top10_token";
const IS_PROD = process.env.NODE_ENV === "production";

// The web (Vercel) and API (Render) live on different sites, so auth cookies
// must be SameSite=None+Secure in prod to travel on cross-site fetches; on
// localhost (same site, plain HTTP) that would drop the cookie, so use Lax +
// non-secure there. HttpOnly always — JS never needs to read the token.
const COOKIE_OPTS = {
  httpOnly: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  secure: IS_PROD,
  sameSite: IS_PROD ? "none" : "lax",
} as const;

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export async function authRoutes(api: FastifyInstance) {
  // POST /auth/register
  api.post("/auth/register", async (req, reply) => {
    const { email, name, password } = req.body as {
      email: string; name: string; password: string;
    };
    if (!email || !password || !name) {
      return reply.status(400).send({ error: "email, name y contraseña son requeridos" });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
    if (existing.length > 0) {
      return reply.status(409).send({ error: "Este email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: "USER",
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    const token = signToken(user.id);
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
    return reply.status(201).send({ user, token });
  });

  // POST /auth/login
  api.post("/auth/login", async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      return reply.status(400).send({ error: "email y contraseña requeridos" });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: "Email o contraseña incorrectos" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Email o contraseña incorrectos" });
    }

    const token = signToken(user.id);
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  });

  // GET /auth/me
  api.get("/auth/me", async (req, reply) => {
    const token = req.cookies?.[COOKIE_NAME] ?? (req.headers.authorization?.replace("Bearer ", "") ?? "");
    if (!token) return reply.status(401).send({ error: "No autenticado" });

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
      const [user] = await db.select({
        id: users.id, email: users.email, name: users.name, role: users.role,
      }).from(users).where(eq(users.id, payload.sub));
      if (!user) return reply.status(401).send({ error: "Usuario no encontrado" });
      return reply.send(user);
    } catch {
      return reply.status(401).send({ error: "Token inválido" });
    }
  });

  // POST /auth/logout
  api.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/", secure: IS_PROD, sameSite: IS_PROD ? "none" : "lax" });
    return reply.send({ ok: true });
  });
}

// Helper to get user from request (used in other routes)
export function getUserFromRequest(req: { cookies?: Record<string,string>; headers: { authorization?: string } }): string | null {
  const token = req.cookies?.[COOKIE_NAME] ?? (req.headers.authorization?.replace("Bearer ", "") ?? "");
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}
