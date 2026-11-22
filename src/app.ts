import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import type { OutputInfo } from "sharp";
import { turnstile } from "./lib/turnstile.js";
import { sql, type Img, type Post } from "./lib/db.js";
import { checkCredentials, clearFails, endSession, isAdmin, noteFail, requireAdmin, startSession, throttled } from "./lib/auth.js";
import { EXCERPT_MAX, SLUG_MAX, TITLE_MAX } from "./lib/limits.js";
import { renderMarkdown, slugify } from "./lib/markdown.js";
import { fileNamesFor, putFile, removeFiles } from "./lib/storage.js";
import { adminPage, loginPage } from "./views/admin.js";
import { homePage, notFoundPage, postPage, rss } from "./views/public.js";

export const app = new Hono();
app.use("*", turnstile);

const CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=600";
const html = (c: any, body: string, status = 200) => {
  c.header("Cache-Control", CACHE);
  return c.html(body, status);
};

/* ---------- public ---------- */
const PER_PAGE = 12; // posts per page in the grid (featured + pinned are extra, page 1 only)
const toRow = (r: any) => ({
  slug: r.slug, title: r.title, excerpt: r.excerpt, published_at: r.published_at, pinned: !!r.pinned,
  cover: r.img_id ? ({ id: r.img_id, url: r.url, alt: r.alt, width: r.width, height: r.height } as Img) : null,
});
app.get("/", async (c) => {
  const COLS = sql()`p.id, p.slug, p.title, p.excerpt, p.published_at, p.pinned, i.id AS img_id, i.url, i.alt, i.width, i.height`;
  const FROM = sql()`FROM posts p LEFT JOIN images i ON i.id = p.cover_image_id`;
  const [featured] = await sql()`SELECT ${COLS} ${FROM} WHERE p.status = 'published' ORDER BY p.published_at DESC LIMIT 1`;
  const pinned = featured
    ? await sql()`SELECT ${COLS} ${FROM} WHERE p.status = 'published' AND p.pinned AND p.id <> ${featured.id} ORDER BY p.published_at DESC LIMIT 4`
    : [];
  // Featured + pinned live on page 1 only; everything else is paginated.
  const skip: number[] = [featured?.id, ...pinned.map((p) => p.id)].filter(Boolean);
  const [{ n }] = await sql()`SELECT count(*)::int AS n FROM posts p WHERE p.status = 'published' AND p.id <> ALL(${skip}::int[])`;
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const req = Number.parseInt(c.req.query("page") ?? "1", 10);
  const page = Number.isFinite(req) ? Math.min(Math.max(req, 1), pages) : 1;
  if (c.req.query("page") !== undefined && String(page) !== c.req.query("page")) return c.redirect(page === 1 ? "/" : `/?page=${page}`);
  const rows = await sql()`SELECT ${COLS} ${FROM} WHERE p.status = 'published' AND p.id <> ALL(${skip}::int[])
    ORDER BY p.published_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`;
  return html(c, homePage(rows.map(toRow), {
    page, pages,
    featured: page === 1 && featured ? toRow(featured) : null,
    pinned: page === 1 ? pinned.map(toRow) : [],
  }));
});

// Search scans post text, so cap how often one visitor can run it (per server instance; add Vercel rate limiting too).
const searchHits = new Map<string, { n: number; t: number }>();
function searchLimited(ip: string) {
  const now = Date.now();
  const h = searchHits.get(ip);
  if (!h || now - h.t > 60_000) { searchHits.set(ip, { n: 1, t: now }); return false; }
  h.n++;
  if (searchHits.size > 5000) searchHits.clear(); // never grow without bound
  return h.n > 40;
}

app.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  if (!q) return c.redirect("/");
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (searchLimited(ip)) {
    c.header("Retry-After", "60");
    c.header("Cache-Control", "no-store");
    return c.html(notFoundPage("Too many searches. Please wait a minute and try again."), 429);
  }
  // Same query = same public result, so the CDN may keep it briefly.
  c.header("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=120");
  const like = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
  const match = sql()`p.status = 'published' AND (p.title ILIKE ${like} OR p.excerpt ILIKE ${like} OR p.body_md ILIKE ${like})`;
  const [{ n }] = await sql()`SELECT count(*)::int AS n FROM posts p WHERE ${match}`;
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const req = Number.parseInt(c.req.query("page") ?? "1", 10);
  const page = Number.isFinite(req) ? Math.min(Math.max(req, 1), pages) : 1;
  const rows = await sql()`
    SELECT p.slug, p.title, p.excerpt, p.published_at, p.pinned,
           i.id AS img_id, i.url, i.alt, i.width, i.height
    FROM posts p LEFT JOIN images i ON i.id = p.cover_image_id
    WHERE ${match}
    ORDER BY (p.title ILIKE ${like}) DESC, p.published_at DESC, p.id DESC
    LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`;
  return c.html(homePage(rows.map(toRow), { search: { q, total: n }, page, pages }));
});

app.get("/post/:slug", async (c) => {
  const [p] = await sql()<Post[]>`SELECT * FROM posts WHERE slug = ${c.req.param("slug")} AND status = 'published'`;
  if (!p) return c.html(notFoundPage(), 404);
  const [cover] = p.cover_image_id ? await sql()<Img[]>`SELECT * FROM images WHERE id = ${p.cover_image_id}` : [];
  return html(c, postPage(p, cover ?? null));
});

app.get("/rss.xml", async (c) => {
  const rows = await sql()`SELECT slug, title, excerpt, published_at FROM posts WHERE status='published' ORDER BY published_at DESC LIMIT 50`;
  c.header("Cache-Control", CACHE);
  c.header("Content-Type", "application/rss+xml; charset=utf-8");
  return c.body(rss(rows as any));
});

/* ---------- admin pages ---------- */
app.get("/admin", (c) => {
  c.header("Cache-Control", "no-store");
  return c.html(isAdmin(c) ? adminPage() : loginPage());
});
app.post("/admin/login", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? "local";
  if (throttled(ip)) return c.html(loginPage("Too many attempts. Try again later."), 429);
  const form = await c.req.parseBody();
  if (!checkCredentials(String(form.password ?? ""), String(form.pin ?? "").trim())) {
    noteFail(ip);
    return c.html(loginPage("Wrong password or PIN."), 401); // never reveal which one was wrong
  }
  clearFails(ip);
  startSession(c);
  return c.redirect("/admin");
});
app.post("/admin/logout", (c) => {
  endSession(c);
  return c.redirect("/admin");
});

/* ---------- admin API ---------- */
const api = new Hono();
api.use("*", requireAdmin);
api.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

api.get("/posts", async (c) =>
  c.json(await sql()`SELECT id, slug, title, status, pinned, published_at, updated_at FROM posts ORDER BY updated_at DESC`),
);
api.get("/posts/:id", async (c) => {
  const [p] = await sql()`SELECT * FROM posts WHERE id = ${Number(c.req.param("id"))}`;
  return p ? c.json(p) : c.json({ error: "not found" }, 404);
});

async function savePost(id: number | null, b: any) {
  const title = String(b.title ?? "").trim();
  if (!title) return { error: "Title required", status: 400 as const };
  if (title.length > TITLE_MAX) return { error: `Title is too long (${title.length}/${TITLE_MAX} characters). Please shorten it.`, status: 400 as const };
  const excerpt = String(b.excerpt ?? "").trim();
  if (excerpt.length > EXCERPT_MAX) return { error: `Excerpt is too long (${excerpt.length}/${EXCERPT_MAX} characters). Please shorten it.`, status: 400 as const };
  const fullSlug = slugify(String(b.slug || title), 1000);
  const slug = slugify(fullSlug, SLUG_MAX);
  const notice = fullSlug.length > SLUG_MAX ? `The URL was shortened to ${SLUG_MAX} characters.` : undefined;
  const md = String(b.body_md ?? "");
  const body_html = await renderMarkdown(md);
  const status = b.status === "published" ? "published" : "draft";
  const cover = b.cover_image_id ? Number(b.cover_image_id) : null;
  const pinned = !!b.pinned;
  const titlePos = b.title_position === "top" ? "top" : "bottom"; // where the title sits on the cover (desktop)
  try {
    const [row] = id
      ? await sql()`UPDATE posts SET slug=${slug}, title=${title}, excerpt=${excerpt}, cover_image_id=${cover},
          body_md=${md}, body_html=${body_html}, status=${status}, pinned=${pinned}, title_position=${titlePos}, updated_at=now(),
          published_at = CASE WHEN ${status} = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
          WHERE id=${id} RETURNING *`
      : await sql()`INSERT INTO posts (slug, title, excerpt, cover_image_id, body_md, body_html, status, pinned, title_position, published_at)
          VALUES (${slug}, ${title}, ${excerpt}, ${cover}, ${md}, ${body_html}, ${status}, ${pinned}, ${titlePos},
                  ${status === "published" ? new Date() : null}) RETURNING *`;
    return row ? { row: { ...row, notice } } : { error: "not found", status: 404 as const };
  } catch (e: any) {
    if (e.code === "23505") return { error: "Slug already used", status: 409 as const };
    throw e;
  }
}

api.post("/posts", async (c) => {
  const r = await savePost(null, await c.req.json());
  return "row" in r ? c.json(r.row) : c.json({ error: r.error }, r.status);
});
api.put("/posts/:id", async (c) => {
  const r = await savePost(Number(c.req.param("id")), await c.req.json());
  return "row" in r ? c.json(r.row) : c.json({ error: r.error }, r.status);
});
api.delete("/posts/:id", async (c) => {
  await sql()`DELETE FROM posts WHERE id = ${Number(c.req.param("id"))}`;
  return c.json({ ok: true });
});

api.post("/preview", async (c) => c.json({ html: await renderMarkdown(String((await c.req.json()).md ?? "")) }));

const usedIn = (id: number) => `img:${id}([^0-9]|$)`; // matches "img:7" in Markdown but not "img:70"

api.get("/images", async (c) =>
  c.json(await sql()`
    SELECT i.id, i.url, i.alt, i.width, i.height,
      (SELECT count(*)::int FROM posts p WHERE p.cover_image_id = i.id OR p.body_md ~ ('img:' || i.id || '([^0-9]|$)')) AS used
    FROM images i ORDER BY i.id DESC LIMIT 200`),
);

// Which posts use this image (as cover and/or in the body)? Used by the delete confirmation.
api.get("/images/:id/usage", async (c) => {
  const id = Number(c.req.param("id"));
  return c.json(await sql()`
    SELECT id, title, (cover_image_id = ${id}) AS cover, (body_md ~ ${usedIn(id)}) AS body
    FROM posts WHERE cover_image_id = ${id} OR body_md ~ ${usedIn(id)} ORDER BY updated_at DESC`);
});

api.delete("/images/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [img] = await sql()`SELECT url FROM images WHERE id = ${id}`;
  if (!img) return c.json({ error: "That image no longer exists." }, 404);
  const affected = await sql()`SELECT id, body_md FROM posts WHERE body_md ~ ${usedIn(id)}`;
  await sql()`DELETE FROM images WHERE id = ${id}`; // posts using it as cover are set to "no cover" by the foreign key
  for (const p of affected) {
    await sql()`UPDATE posts SET body_html = ${await renderMarkdown(p.body_md)} WHERE id = ${p.id}`;
  }
  const filesRemoved = await removeFiles(fileNamesFor(img.url));
  return c.json({ ok: true, updated: affected.length, filesRemoved });
});
api.post("/images", async (c) => {
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) return c.json({ error: "file required" }, 400);
  if (file.size > 15 * 1024 * 1024) return c.json({ error: "max 15MB" }, 413);
  const { default: sharp } = await import("sharp"); // heavy native module: only loaded when someone uploads
  const input = Buffer.from(await file.arrayBuffer());
  let main: { data: Buffer; info: OutputInfo };
  try {
    main = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch {
    return c.json({ error: "not a valid image" }, 400);
  }
  const base = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const url = await putFile(`${base}.webp`, main.data, "image/webp");
  if (main.info.width > 800) {
    const small = await sharp(main.data).resize({ width: 800 }).webp({ quality: 80 }).toBuffer();
    await putFile(`${base}-800.webp`, small, "image/webp");
  }
  if (main.info.width > 1280) {
    const mid = await sharp(main.data).resize({ width: 1280 }).webp({ quality: 80 }).toBuffer();
    await putFile(`${base}-1280.webp`, mid, "image/webp");
  }
  const alt = String(form.alt ?? "").slice(0, 200);
  const [row] = await sql()`INSERT INTO images (url, alt, width, height) VALUES (${url}, ${alt}, ${main.info.width}, ${main.info.height}) RETURNING id, url, alt, width, height`;
  return c.json(row);
});

app.route("/api", api);
app.notFound((c) => c.html(notFoundPage(), 404));
app.onError((e, c) => {
  console.error(e);
  return c.text("Server error", 500);
});
