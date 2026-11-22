import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import postgres from "postgres";

// Images uploaded before the 1280px size existed need that file, or the browser may pick a missing URL.
// Local storage only (Supabase starts with fresh uploads). Safe to run more than once.
const sql = postgres(process.env.DATABASE_URL!);
const rows = await sql<{ id: number; url: string; width: number }[]>`SELECT id, url, width FROM images WHERE width > 1280`;
let made = 0;
for (const r of rows) {
  if (!r.url.startsWith("/uploads/")) { console.log("skip (not local):", r.url); continue; }
  const main = join(process.cwd(), r.url);
  const mid = main.replace(/\.webp$/, "-1280.webp");
  if (existsSync(mid)) continue;
  await sharp(main).resize({ width: 1280 }).webp({ quality: 80 }).toFile(mid);
  made++;
  console.log("created", mid);
}
console.log(`done, ${made} created`);
await sql.end();
