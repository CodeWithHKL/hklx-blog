ALTER TABLE posts ADD COLUMN IF NOT EXISTS title_position text NOT NULL DEFAULT 'bottom' CHECK (title_position IN ('bottom','top'));
