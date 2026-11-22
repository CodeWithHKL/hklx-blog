import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app.js";

// Dev-only static serving; on Vercel `public/` is served by the platform and uploads live in Supabase.
app.use("/uploads/*", serveStatic({ root: "./", onFound: (_p, c) => void c.header("Cache-Control", "public, max-age=31536000, immutable") }));
app.use("/*", serveStatic({ root: "./public", onFound: (_p, c) => void c.header("Cache-Control", "no-cache") }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`http://localhost:${port}`));
