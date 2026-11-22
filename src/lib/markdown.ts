import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { sql, type Img } from "./db.js";

/**
 * Image directive:  ![alt](img:42){align=left size=md caption="Nice view"}
 *   align: left | right | center | full   (default center)
 *   size : sm | md | lg | wide | full     (default lg)
 * Consecutive directive lines become a responsive gallery.
 */
const DIRECTIVE = /^!\[([^\]]*)\]\(img:(\d+)\)(?:\{([^}]*)\})?\s*$/;

const ALIGN = ["left", "right", "center", "full"];
const SIZE = ["sm", "md", "lg", "wide", "full"];

function parseOpts(s = "") {
  const o: Record<string, string> = {};
  for (const m of s.matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)) o[m[1]] = m[2] ?? m[3];
  return o;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function imgTag(img: Img, alt: string, eager = false, sizes = "(max-width: 800px) 100vw, 800px") {
  const small = img.url.replace(/\.webp$/, "-800.webp");
  const mid = img.url.replace(/\.webp$/, "-1280.webp");
  const candidates = [`${esc(small)} 800w`, ...(img.width > 1280 ? [`${esc(mid)} 1280w`] : []), `${esc(img.url)} ${img.width}w`];
  const srcset = img.width > 800 ? ` srcset="${candidates.join(", ")}" sizes="${esc(sizes)}"` : "";
  const priority = eager ? ' fetchpriority="high"' : ""; // eager = above the fold: fetch it first
  return `<img src="${esc(img.url)}"${srcset} alt="${esc(alt)}" width="${img.width}" height="${img.height}" loading="${eager ? "eager" : "lazy"}" decoding="async"${priority}>`;
}

export async function renderMarkdown(md: string): Promise<string> {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const ids = new Set<number>();
  for (const l of lines) {
    const m = DIRECTIVE.exec(l.trim());
    if (m) ids.add(Number(m[2]));
  }
  const imgs = new Map<number, Img>();
  if (ids.size) {
    const rows = await sql()<Img[]>`SELECT id, url, alt, width, height FROM images WHERE id IN ${sql()([...ids])}`;
    for (const r of rows) imgs.set(r.id, r);
  }

  const out: string[] = [];
  let group: string[] = [];
  const flush = () => {
    if (!group.length) return;
    out.push("", group.length > 1 ? `<div class="gallery">${group.join("")}</div>` : group[0], "");
    group = [];
  };
  for (const line of lines) {
    const m = DIRECTIVE.exec(line.trim());
    const img = m && imgs.get(Number(m[2]));
    if (m && img) {
      const o = parseOpts(m[3]);
      const align = ALIGN.includes(o.align) ? o.align : "center";
      const size = SIZE.includes(o.size) ? o.size : "lg";
      const cap = o.caption ? `<figcaption>${esc(o.caption)}</figcaption>` : "";
      group.push(`<figure class="img img-${align} img-${size}">${imgTag(img, m[1] || img.alt)}${cap}</figure>`);
    } else if (m) {
      flush(); // the image was deleted: drop the line instead of showing a broken picture
    } else {
      flush();
      out.push(line);
    }
  }
  flush();

  const html = await marked.parse(out.join("\n"), { gfm: true, breaks: false });
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", "h1", "h2", "del", "details", "summary"],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "srcset", "sizes", "alt", "width", "height", "loading", "decoding"],
      figure: ["class"],
      div: ["class"],
      code: ["class"],
      th: ["align"], td: ["align"],
    },
    allowedClasses: {
      figure: [/^img(-[a-z]+)?$/],
      div: ["gallery"],
      code: [/^language-[\w-]+$/],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: (tag, attribs) => ({
        tagName: tag,
        attribs: /^https?:/.test(attribs.href ?? "") ? { ...attribs, rel: "noopener noreferrer" } : attribs,
      }),
    },
  });
}

export function slugify(s: string, max = 80) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, max).replace(/-+$/, "") || "post";
}
