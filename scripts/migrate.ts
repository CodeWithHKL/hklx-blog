import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
const dir = new URL("../db/migrations/", import.meta.url);
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".sql")) continue;
  await sql.unsafe(readFileSync(new URL(f, dir), "utf8"));
  console.log("applied", f);
}
await sql.end();
