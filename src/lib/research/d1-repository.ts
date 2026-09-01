import { createMarkdownContent } from "./markdown-content";
import type {
  AdjacentArticles,
  ArticleStatus,
  DraftInput,
  ResearchArticleMetadata,
  ResearchArticleRecord,
  ResearchCategory,
} from "./domain";
import type { PublicResearchRepository, ResearchAuthoringRepository } from "./repository";

/** The literal shape of a row from the `articles` table (see
 * migrations/0001_create_articles.sql) — snake_case, tags as a JSON
 * string, exactly what D1 hands back. Mapping this onto the domain's
 * camelCase, parsed-tags shape is this file's job alone; nothing above
 * the repository ever sees a raw row. */
type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  content: string;
  reading_minutes: number;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToRecord(row: ArticleRow): ResearchArticleRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category as ResearchCategory,
    tags: JSON.parse(row.tags) as string[],
    content: row.content,
    readingMinutes: row.reading_minutes,
    status: row.status as ArticleStatus,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Only ever called on records the query already filtered to
 * status = 'published' — publishedAt is non-null there by construction
 * (publish() always sets it before status flips), so the fallback below
 * is a type-safety backstop, not a real case this models. */
function recordToMetadata(record: ResearchArticleRecord): ResearchArticleMetadata {
  return {
    slug: record.slug,
    title: record.title,
    description: record.description,
    category: record.category,
    tags: record.tags,
    readingMinutes: record.readingMinutes,
    publishedAt: record.publishedAt ?? record.createdAt,
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * D1-backed implementation of both the public read interface and the
 * eventual authoring one. Nothing outside this file — and nothing outside
 * src/lib/research/ at all — talks SQL, sees a table name, or handles a
 * D1Database directly. `db` is the global ambient D1Database type
 * (generated into cloudflare-env.d.ts once the RESEARCH_DB binding was
 * added to wrangler.jsonc), the same pattern already used for KVNamespace
 * in the Oracle cache.
 */
export function createD1ResearchRepository(
  db: D1Database,
): PublicResearchRepository & ResearchAuthoringRepository {
  async function queryPublished(): Promise<ResearchArticleRecord[]> {
    const { results } = await db
      .prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY published_at DESC")
      .all<ArticleRow>();
    return results.map(rowToRecord);
  }

  async function findBySlug(slug: string): Promise<ResearchArticleRecord | null> {
    const row = await db.prepare("SELECT * FROM articles WHERE slug = ?").bind(slug).first<ArticleRow>();
    return row ? rowToRecord(row) : null;
  }

  return {
    // ---- PublicResearchRepository ----

    async getPublishedArticles() {
      const records = await queryPublished();
      return records.map(recordToMetadata);
    },

    async getPublishedArticleBySlug(slug) {
      const row = await db
        .prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published'")
        .bind(slug)
        .first<ArticleRow>();
      if (!row) return undefined;
      const record = rowToRecord(row);
      return { ...recordToMetadata(record), Content: createMarkdownContent(record.content) };
    },

    async getAdjacentPublishedArticles(slug): Promise<AdjacentArticles> {
      const records = await queryPublished();
      const index = records.findIndex((record) => record.slug === slug);
      if (index === -1) return { newer: null, older: null };

      const metas = records.map(recordToMetadata);
      return {
        newer: index > 0 ? metas[index - 1] : null,
        older: index < metas.length - 1 ? metas[index + 1] : null,
      };
    },

    // ---- ResearchAuthoringRepository ----
    // Implemented for real (D1 has no fs-style blocker on writes) but not
    // called from anywhere public yet — see repository.ts.

    async createDraft(input: DraftInput): Promise<ResearchArticleRecord> {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const slug = slugify(input.title);

      await db
        .prepare(
          `INSERT INTO articles
             (id, slug, title, description, category, tags, content, reading_minutes, status, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?)`,
        )
        .bind(
          id,
          slug,
          input.title,
          input.description,
          input.category,
          JSON.stringify(input.tags),
          input.content,
          input.readingMinutes,
          now,
          now,
        )
        .run();

      const record = await findBySlug(slug);
      if (!record) throw new Error(`createDraft: failed to read back "${slug}" after inserting it`);
      return record;
    },

    async updateDraft(slug, input: Partial<DraftInput>): Promise<ResearchArticleRecord> {
      const existing = await findBySlug(slug);
      if (!existing) throw new Error(`updateDraft: no article with slug "${slug}"`);

      const merged: ResearchArticleRecord = { ...existing, ...input };
      const now = new Date().toISOString();

      await db
        .prepare(
          `UPDATE articles
           SET title = ?, description = ?, category = ?, tags = ?, content = ?, reading_minutes = ?, updated_at = ?
           WHERE slug = ?`,
        )
        .bind(
          merged.title,
          merged.description,
          merged.category,
          JSON.stringify(merged.tags),
          merged.content,
          merged.readingMinutes,
          now,
          slug,
        )
        .run();

      const record = await findBySlug(slug);
      if (!record) throw new Error(`updateDraft: "${slug}" disappeared during update`);
      return record;
    },

    async publish(slug): Promise<ResearchArticleRecord> {
      const now = new Date().toISOString();
      // COALESCE keeps the original publish date on a re-publish after an
      // unpublish, rather than treating every publish as "new" — only a
      // genuinely first-time publish gets `now` as its publishedAt.
      await db
        .prepare(
          "UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE slug = ?",
        )
        .bind(now, now, slug)
        .run();

      const record = await findBySlug(slug);
      if (!record) throw new Error(`publish: no article with slug "${slug}"`);
      return record;
    },

    async unpublish(slug): Promise<ResearchArticleRecord> {
      const now = new Date().toISOString();
      await db
        .prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE slug = ?")
        .bind(now, slug)
        .run();

      const record = await findBySlug(slug);
      if (!record) throw new Error(`unpublish: no article with slug "${slug}"`);
      return record;
    },

    async deleteArticle(slug): Promise<void> {
      await db.prepare("DELETE FROM articles WHERE slug = ?").bind(slug).run();
    },
  };
}
