import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | undefined;

/** Lazy so env is loaded first; max:1-ish pool suits serverless (use Neon/Supabase pooler URL). */
export function sql() {
  return (_sql ??= postgres(process.env.DATABASE_URL!, {
    max: process.env.VERCEL ? 1 : 5,
    ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "") ? false : "require",
    prepare: false, // needed for pgbouncer/Supabase pooler
  }));
}

export type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_id: number | null;
  body_md: string;
  body_html: string;
  status: "draft" | "published";
  title_position: "bottom" | "top";
  published_at: Date | null;
  updated_at: Date;
};

export type Img = {
  id: number;
  url: string;
  alt: string;
  width: number;
  height: number;
};
