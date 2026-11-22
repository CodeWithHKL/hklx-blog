import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Tolerates a pasted "/rest/v1/" (or any path) on the project URL.
const supabaseBase = () => new URL(process.env.SUPABASE_URL!).origin;

/** Storage adapter: local disk in dev, Supabase Storage in prod (Vercel has no persistent disk). */
export async function putFile(name: string, data: Buffer, contentType: string): Promise<string> {
  if (process.env.STORAGE === "supabase") {
    const base = supabaseBase();
    const bucket = process.env.SUPABASE_BUCKET ?? "blog-images";
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
    return `${base}/storage/v1/object/public/${bucket}/${name}`;
  }
  const dir = join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), data);
  return `/uploads/${name}`;
}

/** File names behind an image URL: the main WebP and its 800px and 1280px copies. */
export function fileNamesFor(url: string): string[] {
  const base = decodeURIComponent(url.split("/").pop() ?? "");
  return base ? [base, base.replace(/\.webp$/, "-800.webp"), base.replace(/\.webp$/, "-1280.webp")] : [];
}

/** Best-effort delete from local disk or Supabase. Returns false if anything could not be removed. */
export async function removeFiles(names: string[]): Promise<boolean> {
  if (!names.length) return true;
  try {
    if (process.env.STORAGE === "supabase") {
      const bucket = process.env.SUPABASE_BUCKET ?? "blog-images";
      const res = await fetch(`${supabaseBase()}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: names }),
      });
      return res.ok;
    }
    const dir = join(process.cwd(), "uploads");
    await Promise.all(names.map((n) => unlink(join(dir, n)).catch((e) => { if (e.code !== "ENOENT") throw e; })));
    return true;
  } catch (e) {
    console.error("removeFiles failed", e);
    return false;
  }
}
