export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Changes on every server start/deploy, so browsers never keep a stale style.css or admin.js.
const BUILD = Date.now().toString(36);
const site = () => process.env.SITE_NAME ?? "Hklx Blog";
export const siteUrl = () => (process.env.SITE_URL ?? "").replace(/\/$/, "");

// Runs before paint: sets data-theme from localStorage / system preference (same scheme as hklx).
const themeInit = `(function(){try{var p=localStorage.theme||"system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.dataset.theme=d?"dark":"light";e.dataset.pref=p}catch(e){}})()`;

const themeToggle = `(function(){var q="(prefers-color-scheme: dark)",e=document.documentElement;function ap(p){var d=p==="dark"||(p==="system"&&matchMedia(q).matches);e.dataset.theme=d?"dark":"light";e.dataset.pref=p}
matchMedia(q).addEventListener("change",function(){if(e.dataset.pref==="system")ap("system")});
document.querySelectorAll("[data-set-theme]").forEach(function(b){b.addEventListener("click",function(){var p=b.dataset.setTheme;try{p==="system"?localStorage.removeItem("theme"):localStorage.setItem("theme",p)}catch(x){}
if(!document.startViewTransition){ap(p);return}
var r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
var t=document.startViewTransition(function(){ap(p)});
t.ready.then(function(){e.animate({clipPath:["circle(0px at "+x+"px "+y+"px)","circle("+R+"px at "+x+"px "+y+"px)"]},{duration:600,easing:"ease-in-out",pseudoElement:"::view-transition-new(root)"})}).catch(function(){})})})})()`;

// Custom clear "x": empties the box, and if we're not already on the plain main page, jumps back to it.
const searchClear = `(function(){var i=document.querySelector(".search input"),b=document.querySelector(".search .clear");if(!i||!b)return;b.addEventListener("click",function(){i.value="";if(location.pathname!=="/"||location.search){location.assign("/")}else{i.focus()}})})()`;

// Shows every <time data-local> in the visitor's own timezone. The server-rendered text (site timezone)
// stays as the fallback for crawlers and for browsers with scripts off.
const localTime = `(function(){var tz="";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}
document.querySelectorAll("time[data-local]").forEach(function(t){var d=new Date(t.getAttribute("datetime"));if(isNaN(d))return;
var s=d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
if(t.getAttribute("data-local")==="datetime"){var p=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",hour12:true}).formatToParts(d),g=function(k){for(var i=0;i<p.length;i++)if(p[i].type===k)return p[i].value;return""};s+=" at "+g("hour")+":"+g("minute")+g("dayPeriod").toLowerCase()}
t.textContent=s;if(tz)t.title="Shown in your local time ("+tz+")"})})()`;

const svg = (inner: string) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const icons = {
  system: svg('<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'),
  dark: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
};
const toggle = `<div class="theme" role="group" aria-label="Theme">${(["system", "light", "dark"] as const)
  .map((k) => `<button type="button" data-set-theme="${k}" aria-label="${k} theme" title="${k[0].toUpperCase() + k.slice(1)} theme">${icons[k]}</button>`)
  .join("")}</div>`;

export type Meta = { title?: string; description?: string; image?: string; path?: string; type?: string };

export function layout(body: string, m: Meta = {}, opts: { script?: string; noindex?: boolean; q?: string; bare?: boolean } = {}) {
  const title = m.title ? `${m.title} · ${site()}` : site();
  const desc = m.description ?? "Thoughts, notes and write-ups.";
  const url = m.path ? siteUrl() + m.path : "";
  return `<!doctype html>
<html lang="en" data-theme="light" data-pref="system">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${opts.noindex ? '<meta name="robots" content="noindex">' : ""}
${url ? `<link rel="canonical" href="${esc(url)}">` : ""}
<meta property="og:title" content="${esc(m.title ?? site())}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${m.type ?? "website"}">
${m.image ? `<meta property="og:image" content="${esc(m.image.startsWith("http") ? m.image : siteUrl() + m.image)}">` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site())}" href="/rss.xml">
<script>${themeInit}</script>
<link rel="preload" href="/fonts/google-sans-flex-400-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/barlow-600-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css?v=${BUILD}">
</head>
<body${opts.bare ? ' class="bare"' : ""}>
<div class="doodle-bg" aria-hidden="true"></div>
${opts.bare ? "" : `<header class="nav">
  <a class="brand" href="/">${esc(site())}</a>
  <form class="search" role="search" action="/search" method="get">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="search" name="q" placeholder="Search posts" aria-label="Search posts" value="${esc(opts.q)}" autocomplete="off">
    <button class="clear" type="button" aria-label="Clear search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
  </form>
  ${toggle}
</header>`}
<main>${body}</main>
<footer class="foot"><span>© ${new Date().getFullYear()} ${esc(site())}</span></footer>
<script>${themeToggle};${searchClear};${localTime}</script>
${opts.script ? `<script src="${opts.script}?v=${BUILD}" defer></script>` : ""}
</body>
</html>`;
}
