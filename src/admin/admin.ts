export {};
type Img = { id: number; url: string; alt: string; width: number; height: number; used?: number };
type PostRow = { id: number; title: string; slug: string; status: string; pinned: boolean };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const title = $<HTMLInputElement>("title"), slug = $<HTMLInputElement>("slug"), statusSel = $<HTMLSelectElement>("status");
const pinned = $<HTMLInputElement>("pinned");
const titlePos = $<HTMLSelectElement>("title-pos");
const excerpt = $<HTMLTextAreaElement>("excerpt"), body = $<HTMLTextAreaElement>("body");
const preview = $("preview"), list = $("list"), editor = $("editor"), thumbs = $("images");
const panel = $("imgpanel"), coverLabel = $("cover-label");
const ipAlign = $<HTMLSelectElement>("ip-align"), ipSize = $<HTMLSelectElement>("ip-size");
const ipAlt = $<HTMLInputElement>("ip-alt"), ipCap = $<HTMLInputElement>("ip-cap");

let currentId: number | null = null;
let coverId: number | null = null;
let selected: Img | null = null;
let images: Img[] = [];
let savedTitle = ""; // title as stored in the database (not the unsaved edit)
let baseline = ""; // form state at last load/save, used to detect unsaved changes

/* ---------------- messages: toasts + confirm dialog ---------------- */

type Kind = "success" | "error" | "info";
const ICONS: Record<Kind, string> = {
  success: '<path d="M20 6 9 17l-5-5"/>',
  error: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
};
const svg = (inner: string) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const toasts = document.createElement("div");
toasts.id = "toasts";
toasts.setAttribute("aria-live", "polite");
toasts.setAttribute("role", "status");
document.body.append(toasts);

function toast(kind: Kind, message: string, ms = kind === "error" ? 6500 : 3500) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  if (kind === "error") el.setAttribute("role", "alert");
  el.innerHTML = `<span class="t-ico">${svg(ICONS[kind])}</span><span class="t-msg"></span><button type="button" class="t-x" aria-label="Dismiss">${svg('<path d="M18 6 6 18M6 6l12 12"/>')}</button>`;
  el.querySelector(".t-msg")!.textContent = message;
  const close = () => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector(".t-x")!.addEventListener("click", close);
  toasts.append(el);
  while (toasts.children.length > 4) toasts.firstElementChild!.remove();
  setTimeout(close, ms);
}

function confirmDialog(o: { title: string; message: string; confirm: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const prev = document.activeElement as HTMLElement | null;
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-m">
      <h2 id="dlg-t"></h2><p id="dlg-m"></p>
      <div class="dlg-actions"><button type="button" class="btn" data-a="no">Cancel</button><button type="button" class="btn solid ${o.danger ? "danger" : ""}" data-a="yes"></button></div></div>`;
    wrap.querySelector("#dlg-t")!.textContent = o.title;
    wrap.querySelector("#dlg-m")!.textContent = o.message;
    const yes = wrap.querySelector<HTMLButtonElement>('[data-a="yes"]')!;
    const no = wrap.querySelector<HTMLButtonElement>('[data-a="no"]')!;
    yes.textContent = o.confirm;
    const done = (v: boolean) => {
      document.removeEventListener("keydown", onKey, true);
      wrap.remove();
      prev?.focus();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); done(false); }
      else if (e.key === "Tab") {
        e.preventDefault();
        (document.activeElement === no ? yes : no).focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) done(false); });
    yes.addEventListener("click", () => done(true));
    no.addEventListener("click", () => done(false));
    document.body.append(wrap);
    (o.danger ? no : yes).focus(); // dangerous actions default to Cancel
  });
}

/* ---------------- api ---------------- */

class AuthError extends Error {}

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, init);
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 401) {
    toast("error", "Your session expired. Reloading so you can sign in again…", 8000);
    setTimeout(() => location.reload(), 2000);
    throw new AuthError("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status}).`);
  return data;
}
const json = (method: string, b: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
});
const fail = (what: string, e: unknown) => {
  if (e instanceof AuthError) return;
  toast("error", `${what}: ${(e as Error).message}`);
};

/* ---------------- unsaved-changes tracking ---------------- */

const snapshot = () =>
  JSON.stringify([title.value, slug.value, statusSel.value, pinned.checked, excerpt.value, body.value, coverId, titlePos.value]);
const isDirty = () => !editor.hidden && snapshot() !== baseline;
const discardOk = async () =>
  !isDirty() ||
  confirmDialog({ title: "Discard unsaved changes?", message: "You have changes in this post that haven't been saved. They will be lost.", confirm: "Discard changes", danger: true });
window.addEventListener("beforeunload", (e) => { if (isDirty()) e.preventDefault(); });

/* ---------------- length counters ---------------- */

function bindCounter(field: HTMLInputElement | HTMLTextAreaElement, out: HTMLElement) {
  const max = field.maxLength;
  const update = () => {
    const n = field.value.length;
    out.textContent = `${n} / ${max}`;
    out.className = "counter" + (n >= max ? " full" : n >= max * 0.85 ? " warn" : "");
  };
  field.addEventListener("input", update);
  return update;
}
const updateCounters = [bindCounter(title, $("title-count")), bindCounter(excerpt, $("excerpt-count"))];
const refreshCounters = () => updateCounters.forEach((f) => f());

/* ---------------- list + editor ---------------- */

async function loadList() {
  try {
    const rows = await api<PostRow[]>("/posts");
    list.innerHTML = "";
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No posts yet. Click “New post” to write your first one.";
      list.append(p);
    }
    for (const r of rows) {
      const b = document.createElement("button");
      b.className = r.id === currentId ? "on" : "";
      b.innerHTML = `${r.title.replace(/</g, "&lt;")}<small>${r.status}${r.pinned ? " · pinned" : ""}</small>`;
      b.onclick = () => openPost(r.id);
      list.append(b);
    }
  } catch (e) { fail("Couldn't load your posts", e); }
}

function setCover(id: number | null) {
  coverId = id;
  coverLabel.textContent = id ? `image #${id}` : "none";
}

function fill(p?: any) {
  currentId = p?.id ?? null;
  savedTitle = p?.title ?? "";
  title.value = p?.title ?? ""; slug.value = p?.slug ?? ""; statusSel.value = p?.status ?? "draft"; pinned.checked = !!p?.pinned; titlePos.value = p?.title_position ?? "bottom";
  excerpt.value = p?.excerpt ?? ""; body.value = p?.body_md ?? "";
  setCover(p?.cover_image_id ?? null);
  editor.hidden = false;
  baseline = snapshot();
  refreshCounters();
  renderPreview();
  loadList();
}
async function openPost(id: number) {
  if (id === currentId && !editor.hidden) return;
  if (!(await discardOk())) return;
  try { fill(await api("/posts/" + id)); } catch (e) { fail("Couldn't open that post", e); }
}

let t: number | undefined;
function renderPreview() {
  clearTimeout(t);
  t = window.setTimeout(async () => {
    try { preview.innerHTML = (await api("/preview", json("POST", { md: body.value }))).html; }
    catch (e) { if (!(e instanceof AuthError)) preview.innerHTML = '<p class="muted">Preview unavailable right now.</p>'; }
  }, 250);
}
body.addEventListener("input", renderPreview);

/* ---------------- images ---------------- */

const usageText = (im: Img) => (im.used ? `used in ${im.used} post${im.used === 1 ? "" : "s"}` : "not used yet");

async function loadImages() {
  try {
    images = await api<Img[]>("/images");
    thumbs.innerHTML = "";
    for (const im of images) {
      const el = document.createElement("img");
      el.src = im.url.replace(/\.webp$/, "-800.webp"); el.onerror = () => (el.src = im.url);
      el.alt = im.alt; el.title = `#${im.id} · ${im.width}×${im.height} · ${usageText(im)}`;
      el.className = selected?.id === im.id ? "on" : "";
      el.onclick = () => select(im);
      thumbs.append(el);
    }
  } catch (e) { fail("Couldn't load your images", e); }
}

function select(im: Img) {
  selected = im;
  panel.hidden = false;
  $("ip-title").textContent = `Image #${im.id}`;
  $("ip-usage").textContent = usageText(im);
  ipAlt.value = im.alt; ipCap.value = "";
  [...thumbs.children].forEach((el, i) => el.classList.toggle("on", images[i]?.id === im.id));
}

$("ip-insert").onclick = () => {
  if (!selected) return;
  const opts = [`align=${ipAlign.value}`, `size=${ipSize.value}`];
  if (ipCap.value.trim()) opts.push(`caption="${ipCap.value.trim().replace(/"/g, "'")}"`);
  const alt = ipAlt.value.replace(/[\[\]]/g, "");
  const line = `![${alt}](img:${selected.id}){${opts.join(" ")}}`;
  const s = body.selectionStart, e = body.selectionEnd;
  const before = body.value.slice(0, s), after = body.value.slice(e);
  const pre = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  body.value = before + pre + line + "\n\n" + after;
  body.focus();
  renderPreview();
  toast("success", `Image #${selected.id} inserted at the cursor.`);
};
$("ip-cover").onclick = () => {
  if (!selected) return;
  setCover(selected.id);
  toast("success", `Image #${selected.id} set as the cover. Save to apply it.`);
};
$("cover-clear").onclick = () => {
  if (coverId === null) return toast("info", "This post has no cover image.");
  setCover(null);
  toast("info", "Cover removed. Save to apply it.");
};

$("ip-delete").onclick = async () => {
  if (!selected) return;
  const im = selected;
  let usage: { id: number; title: string; cover: boolean; body: boolean }[];
  try { usage = await api(`/images/${im.id}/usage`); } catch (e) { return fail("Couldn't check where the image is used", e); }
  const where = usage.map((u) => `“${u.title}” (${u.cover && u.body ? "cover and body" : u.cover ? "cover" : "body"})`).join(", ");
  const message = usage.length
    ? `It's used in: ${where}. Those posts will lose this picture. This can't be undone.`
    : "It isn't used in any post. This can't be undone.";
  if (!(await confirmDialog({ title: `Delete image #${im.id}?`, message, confirm: "Delete image", danger: true }))) return;
  try {
    const r = await api<{ updated: number; filesRemoved: boolean }>(`/images/${im.id}`, { method: "DELETE" });
    if (coverId === im.id) {
      setCover(null);
      if (baseline) { const b = JSON.parse(baseline); b[6] = null; baseline = JSON.stringify(b); } // not an "unsaved change"
    }
    selected = null; panel.hidden = true;
    toast("success", `Image #${im.id} deleted${r.updated ? ` and removed from ${r.updated} post${r.updated === 1 ? "" : "s"}` : ""}.`);
    if (!r.filesRemoved) toast("info", "The database entry is gone, but the file couldn't be removed from storage. You can delete it there by hand.", 9000);
    renderPreview();
    loadImages(); loadList();
  } catch (e) { fail("Couldn't delete the image", e); }
};

async function upload(files: FileList | File[]) {
  for (const f of Array.from(files)) {
    if (!f.type.startsWith("image/")) { toast("error", `“${f.name}” isn't an image, so it was skipped.`); continue; }
    if (f.size > 15 * 1024 * 1024) { toast("error", `“${f.name}” is over 15 MB. Please use a smaller image.`); continue; }
    toast("info", `Uploading ${f.name}…`, 2000);
    const fd = new FormData();
    fd.append("file", f); fd.append("alt", f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    try {
      const im = await api<Img>("/images", { method: "POST", body: fd });
      await loadImages();
      select(im);
      toast("success", `Uploaded “${f.name}”. Choose align and size, then click Insert.`);
    } catch (e) { fail(`Couldn't upload “${f.name}”`, e); }
  }
}
$("upload").onclick = () => $<HTMLInputElement>("file").click();
$<HTMLInputElement>("file").onchange = (e) => {
  const input = e.target as HTMLInputElement;
  upload(input.files!).finally(() => (input.value = ""));
};
body.addEventListener("dragover", (e) => { e.preventDefault(); body.classList.add("drop"); });
body.addEventListener("dragleave", () => body.classList.remove("drop"));
body.addEventListener("drop", (e) => {
  e.preventDefault(); body.classList.remove("drop");
  if (e.dataTransfer?.files.length) upload(e.dataTransfer.files);
});

/* ---------------- save / delete / new ---------------- */

let saving = false;
$("save").onclick = async () => {
  if (saving) return;
  if (!title.value.trim()) {
    title.classList.add("invalid");
    title.focus();
    return toast("error", "Please add a title before saving.");
  }
  title.classList.remove("invalid");
  const payload = { title: title.value, slug: slug.value, status: statusSel.value, pinned: pinned.checked, title_position: titlePos.value, excerpt: excerpt.value, body_md: body.value, cover_image_id: coverId };
  const btn = $<HTMLButtonElement>("save");
  saving = true; btn.disabled = true;
  try {
    const row = await api(currentId ? "/posts/" + currentId : "/posts", json(currentId ? "PUT" : "POST", payload));
    currentId = row.id; slug.value = row.slug; savedTitle = row.title;
    baseline = snapshot();
    toast("success", row.status === "published" ? "Saved and published. It's live on the blog." : "Saved as a draft. It isn't visible to visitors yet.");
    if (row.notice) toast("info", row.notice);
    loadList();
    loadImages(); // refresh "used in N posts"
  } catch (e) {
    const m = (e as Error).message;
    if (m === "Slug already used") slug.classList.add("invalid");
    fail("Couldn't save the post", e);
  } finally { saving = false; btn.disabled = false; }
};
title.addEventListener("input", () => title.classList.remove("invalid"));
slug.addEventListener("input", () => slug.classList.remove("invalid"));

$("delete").onclick = async () => {
  if (!currentId) {
    if (!isDirty()) { editor.hidden = true; return; }
    if (await confirmDialog({ title: "Discard this draft?", message: "This post hasn't been saved yet, so it will be thrown away.", confirm: "Discard draft", danger: true })) {
      editor.hidden = true; toast("info", "Draft discarded.");
    }
    return;
  }
  const name = savedTitle.trim() || "this post";
  if (!(await confirmDialog({ title: "Delete this post?", message: `“${name}” will be permanently deleted. This can't be undone.`, confirm: "Delete post", danger: true }))) return;
  try {
    await api("/posts/" + currentId, { method: "DELETE" });
    editor.hidden = true; currentId = null; baseline = "";
    toast("success", `Deleted “${name}”.`);
    loadList();
  } catch (e) { fail("Couldn't delete the post", e); }
};

$("new").onclick = async () => {
  if (!(await discardOk())) return;
  fill();
  title.focus();
};

// Signing out always asks first; the message is stronger if there are unsaved changes.
document.querySelector<HTMLFormElement>('form[action="/admin/logout"]')?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const dirty = isDirty();
  const ok = await confirmDialog({
    title: dirty ? "Sign out without saving?" : "Sign out?",
    message: dirty
      ? "You have unsaved changes in this post. Signing out will lose them."
      : "You'll need your password to get back into the admin.",
    confirm: "Sign out",
    danger: dirty,
  });
  if (!ok) return;
  baseline = snapshot(); // don't trigger the leave-page warning
  form.submit();
});

loadList();
loadImages();
