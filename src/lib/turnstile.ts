// Cloudflare Turnstile gate: every request must carry a signed pass cookie, earned by solving the challenge.
// Env: TURNSTILE_SITE_KEY (public), TURNSTILE_SECRET_KEY (also signs the pass cookie).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const COOKIE = "ts_pass";
const VERIFY_PATH = "/__turnstile";
const PASS_SECONDS = 60 * 60 * 12;

const sign = (secret: string, msg: string) => createHmac("sha256", secret).update(msg).digest("hex");
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/");

function hasPass(raw: string | undefined, secret: string) {
  const [exp, sig] = (raw ?? "").split(".");
  return !!exp && !!sig && Number(exp) > Date.now() / 1000 && safeEqual(sig, sign(secret, exp));
}

const challengePage = (siteKey: string, next: string, failed: boolean) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>Verifying you are human</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0a0a0a;color:#ededed;text-align:center}
p{margin:0 0 1rem}.err{color:#ff9b9b}</style></head>
<body><form method="POST" action="${VERIFY_PATH}" id="f">
<p>${failed ? '<span class="err">Verification failed, please try again.</span>' : "Checking that you are human…"}</p>
<input type="hidden" name="next" value="${esc(next)}">
<div class="cf-turnstile" data-sitekey="${esc(siteKey)}" data-callback="done"></div>
<noscript><p>JavaScript is required to continue.</p></noscript>
</form><script>function done(){document.getElementById("f").submit()}</script></body></html>`;

export const turnstile: MiddlewareHandler = async (c, next) => {
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? "";
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  // Fail closed if the keys are missing rather than silently serving the site.
  if (!siteKey || !secret) return c.text("Turnstile is not configured.", 500);
  c.header("Cache-Control", "no-store");
  const url = new URL(c.req.url);

  if (c.req.method === "POST" && url.pathname === VERIFY_PATH) {
    const form = await c.req.parseBody();
    const token = form["cf-turnstile-response"];
    const target = safeNext(form.next);
    let ok = false;
    if (typeof token === "string" && token) {
      const body = new FormData();
      body.set("secret", secret);
      body.set("response", token);
      const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
      if (ip) body.set("remoteip", ip);
      try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
        ok = res.ok && ((await res.json()) as { success?: boolean }).success === true;
      } catch {}
    }
    if (!ok) return c.html(challengePage(siteKey, target, true), 403);
    const exp = String(Math.floor(Date.now() / 1000) + PASS_SECONDS);
    setCookie(c, COOKIE, `${exp}.${sign(secret, exp)}`, { path: "/", maxAge: PASS_SECONDS, httpOnly: true, secure: !!process.env.VERCEL, sameSite: "Lax" });
    return c.redirect(target, 303);
  }

  if (hasPass(getCookie(c, COOKIE), secret)) {
    await next();
    // Gated content must never be stored by a shared cache, or the CDN would serve it to visitors who skipped the challenge.
    c.header("Cache-Control", "private, no-store");
    return;
  }
  return c.html(challengePage(siteKey, url.pathname === VERIFY_PATH ? "/" : safeNext(url.pathname + url.search), false), 403);
};
