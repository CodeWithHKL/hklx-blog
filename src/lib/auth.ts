import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const COOKIE = "hklx_admin";
const TTL = 60 * 60 * 24 * 14; // 14 days

const secret = () => process.env.SESSION_SECRET ?? "";
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const PIN_RE = /^\d{8}$/;

/**
 * Both the password and the 8-digit PIN must match. Both are always compared (no early exit),
 * and sign-in fails closed if ADMIN_PASSWORD is missing or ADMIN_PIN is not exactly 8 digits.
 */
export function checkCredentials(password: string, pin: string) {
  const wantPw = process.env.ADMIN_PASSWORD ?? "";
  const wantPin = process.env.ADMIN_PIN ?? "";
  const configured = !!wantPw && PIN_RE.test(wantPin);
  const pwOk = safeEq(password, wantPw || "\0");
  const pinOk = safeEq(pin, PIN_RE.test(wantPin) ? wantPin : "\0");
  return configured && pwOk && pinOk;
}

export function startSession(c: Context) {
  const exp = String(Math.floor(Date.now() / 1000) + TTL);
  setCookie(c, COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true, sameSite: "Lax", path: "/", maxAge: TTL,
    secure: !!process.env.VERCEL,
  });
}
export const endSession = (c: Context) => deleteCookie(c, COOKIE, { path: "/" });

export function isAdmin(c: Context) {
  if (!secret()) return false;
  const v = getCookie(c, COOKIE);
  if (!v) return false;
  const [exp, sig] = v.split(".");
  return !!sig && safeEq(sig, sign(exp)) && Number(exp) > Date.now() / 1000;
}

export async function requireAdmin(c: Context, next: Next) {
  if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  await next();
}

// Naive in-memory login throttle (per instance; fine for a single-owner blog).
const fails = new Map<string, { n: number; t: number }>();
export function throttled(ip: string) {
  const f = fails.get(ip);
  return !!f && f.n >= 5 && Date.now() - f.t < 15 * 60_000;
}
export function noteFail(ip: string) {
  const f = fails.get(ip);
  fails.set(ip, { n: (f && Date.now() - f.t < 15 * 60_000 ? f.n : 0) + 1, t: Date.now() });
}
export const clearFails = (ip: string) => fails.delete(ip);
