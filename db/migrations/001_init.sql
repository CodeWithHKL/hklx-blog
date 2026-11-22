CREATE TABLE IF NOT EXISTS images (
  id         serial PRIMARY KEY,
  url        text NOT NULL,
  alt        text NOT NULL DEFAULT '',
  width      int  NOT NULL,
  height     int  NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id             serial PRIMARY KEY,
  slug           text NOT NULL UNIQUE,
  title          text NOT NULL,
  excerpt        text NOT NULL DEFAULT '',
  cover_image_id int REFERENCES images(id) ON DELETE SET NULL,
  body_md        text NOT NULL DEFAULT '',
  body_html      text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_published_idx ON posts (status, published_at DESC);
