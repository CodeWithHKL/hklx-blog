import type { Img, Post } from "../lib/db.js";
import { imgTag } from "../lib/markdown.js";
import { esc, layout, siteUrl } from "./layout.js";

// All dates/times are shown in SITE_TIMEZONE so the output is identical on your PC and on a UTC server.
const tz = () => process.env.SITE_TIMEZONE || undefined;

/** "Nov 22, 2026" */
const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: tz() }) : "";

/** "Nov 22, 2026 at 4:40am" */
function fmtDateTime(d: Date | null) {
  if (!d) return "";
  const date = new Date(d);
  const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short", timeZone: tz() }).formatToParts(date);
  const part = (type: string) => t.find((p) => p.type === type)?.value ?? "";
  // Server-rendered fallback keeps the zone label (e.g. GMT+8); the browser script swaps in the visitor's local time.
  return `${fmt(date)} at ${part("hour")}:${part("minute")}${part("dayPeriod").toLowerCase()} ${part("timeZoneName")}`;
}

type Row = Pick<Post, "slug" | "title" | "excerpt" | "published_at"> & { cover?: Img | null; pinned?: boolean };

const pinIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;
const pinBadge = `<span class="pin" title="Pinned" aria-label="Pinned">${pinIcon}</span>`;

const card = (p: Row, eager = false) => `<article class="card${p.pinned ? " is-pinned" : ""}">
  ${p.pinned ? pinBadge : ""}
  <a href="/post/${esc(p.slug)}" class="card-link">
    ${p.cover ? `<div class="card-img">${imgTag(p.cover, p.cover.alt, eager)}</div>` : ""}
    <div class="card-body">
      <time class="date" data-local="date" datetime="${p.published_at ? new Date(p.published_at).toISOString() : ""}">${fmt(p.published_at)}</time>
      <h2>${esc(p.title)}</h2>
      <p>${esc(p.excerpt)}</p>
    </div>
  </a>
</article>`;

const chevron = (d: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const homeHref = (n: number) => (n === 1 ? "/" : `/?page=${n}`);

function pager(page: number, pages: number, href: (n: number) => string) {
  if (pages <= 1) return "";
  const nums = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items: string[] = [];
  list.forEach((n, i) => {
    if (i && n - list[i - 1] > 1) items.push(`<span class="pg gap" aria-hidden="true">…</span>`);
    items.push(n === page ? `<span class="pg on" aria-current="page">${n}</span>` : `<a class="pg" href="${href(n)}" aria-label="Page ${n}">${n}</a>`);
  });
  const prev = page > 1 ? `<a class="pg" href="${href(page - 1)}" rel="prev" aria-label="Previous page">${chevron("m15 18-6-6 6-6")}</a>` : `<span class="pg off" aria-hidden="true">${chevron("m15 18-6-6 6-6")}</span>`;
  const next = page < pages ? `<a class="pg" href="${href(page + 1)}" rel="next" aria-label="Next page">${chevron("m9 18 6-6-6-6")}</a>` : `<span class="pg off" aria-hidden="true">${chevron("m9 18 6-6-6-6")}</span>`;
  return `<nav class="pager" aria-label="Pagination">${prev}${items.join("")}${next}</nav>`;
}

type HomeOpts = { search?: { q: string; total: number }; featured?: Row | null; pinned?: Row[]; page?: number; pages?: number };

export function homePage(posts: Row[], opts: HomeOpts = {}) {
  const { search, featured = null, pinned = [], page = 1, pages = 1 } = opts;
  const feat = featured
    ? `<article class="card featured"><a href="/post/${esc(featured.slug)}" class="card-link">
    ${featured.cover ? `<div class="card-img">${imgTag(featured.cover, featured.cover.alt, true)}</div>` : ""}
    <div class="card-body">
      <time class="date" data-local="date" datetime="${featured.published_at ? new Date(featured.published_at).toISOString() : ""}">${fmt(featured.published_at)}</time>
      <h2>${esc(featured.title)}</h2>
      <p>${esc(featured.excerpt)}</p>
      <span class="read">Read post →</span>
    </div></a></article>`
    : "";
  const pinnedHtml = pinned.length ? `<div class="pinned-grid${pinned.length === 1 ? " single" : ""}">${pinned.map((p) => card({ ...p, pinned: true })).join("")}</div>` : "";
  const empty = !feat && !pinned.length && !posts.length;
  // Search keeps its heading (it shows the result count); the home feed leads straight with the posts.
  const head = search
    ? `<h1 class="sr-only">Search</h1><p class="result-line"><strong>${search.total} result${search.total === 1 ? "" : "s"}</strong> for “${esc(search.q)}”${pages > 1 ? ` · page ${page} of ${pages}` : ""}</p>`
    : `<h1 class="sr-only">Blog</h1>`;
  return layout(
    `<section class="wrap feed${search ? " is-search" : ""}">${head}
${feat}
${pinnedHtml}
<div class="grid">${posts.map((p, i) => card(p, !feat && i === 0)).join("")}${empty ? `<p class="muted">${search ? "Nothing matched. Try different words." : "No posts yet."}</p>` : ""}</div>
${pager(page, pages, search ? (n) => `/search?q=${encodeURIComponent(search.q)}${n > 1 ? `&page=${n}` : ""}` : homeHref)}
${pages <= 1 ? "" : `<p class="more muted">Page ${page} out of ${pages}</p>`}</section>`,
    search ? { title: `Search: ${search.q}` } : { title: page > 1 ? `Page ${page}` : undefined, path: homeHref(page) },
    search ? { q: search.q, noindex: true } : {},
  );
}

// The cover is shown up to 1024px wide, so tell the browser that (it was picking the 800px file and looking soft).
const COVER_SIZES = "(max-width: 1100px) calc(100vw - 3rem), 1024px";

// Date + title block. With a cover it is laid over the image; without one it sits above the article.
const postHead = (p: Post) =>
  `<time class="date" data-local="datetime" datetime="${p.published_at ? new Date(p.published_at).toISOString() : ""}">${fmtDateTime(p.published_at)}</time>
    <h1>${esc(p.title)}</h1>`;

export function postPage(p: Post, cover: Img | null) {
  return layout(
    `<article class="wrap post${cover ? " has-cover" : ""}">
  <a class="back" href="/">← All posts</a>
  ${
    cover
      ? `<header class="cover-hero${p.title_position === "top" ? " title-top" : ""}">
    <figure class="cover">${imgTag(cover, cover.alt, true, COVER_SIZES)}</figure>
    <div class="cover-text">${postHead(p)}</div>
  </header>`
      : postHead(p)
  }
  <div class="prose">${p.body_html}</div>
</article>`,
    { title: p.title, description: p.excerpt, image: cover?.url, path: `/post/${p.slug}`, type: "article" },
  );
}

export const notFoundPage = (message?: string) =>
  layout(`<section class="wrap nf"><h1 class="hero">${message ? "Slow down" : "404"}</h1><p class="lead">${esc(message ?? "That page doesn't exist.")}</p><a class="btn" href="/">Back home</a></section>`, { title: "Not found" }, { bare: true, noindex: true });

export function rss(posts: Pick<Post, "slug" | "title" | "excerpt" | "published_at">[]) {
  const name = process.env.SITE_NAME ?? "Hklx Blog";
  const items = posts
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${siteUrl()}/post/${esc(p.slug)}</link><guid>${siteUrl()}/post/${esc(p.slug)}</guid><pubDate>${new Date(p.published_at!).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description></item>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(name)}</title><link>${siteUrl()}/</link><description>${esc(name)}</description>${items}</channel></rss>`;
}
