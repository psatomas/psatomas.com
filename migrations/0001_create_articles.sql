-- Research's article store. One table — no separate categories/tags
-- tables, no revisions, no author table. This site has one author and,
-- for now, one content type; normalizing further would be solving a
-- problem this project doesn't have yet.
--
-- tags is stored as a JSON array in a TEXT column, not a join table —
-- D1/SQLite has no native array type, and a tags table would only earn
-- its place once there's a real "browse by tag" feature to justify the
-- join. The repository layer is where that JSON gets encoded/decoded;
-- nothing above the repository ever sees a raw JSON string.
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL,
  reading_minutes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  -- NULL until the article is published for the first time.
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- The only two query shapes the public site actually has: "give me every
-- published article, newest first" (the index and adjacency lookups) and
-- "give me the one published article at this slug" (the article page).
-- `slug` already has an implicit unique index from the UNIQUE constraint
-- above; this second index is for the status+ordering query specifically.
CREATE INDEX idx_articles_status_published_at ON articles (status, published_at DESC);
