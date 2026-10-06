import { publicationDate } from "./publication-date.ts";
import { estimateReadingMinutes } from "./reading-time.ts";
import { slugify } from "./slug.ts";
import { SlugTakenError } from "./errors.ts";
import type {
  AdjacentArticles,
  ArticleStatus,
  DraftInput,
  ResearchArticleMetadata,
  ResearchArticleRecord,
  ResearchCategory,
  GuestInvitation,
  NewGuestInvitation,
} from "./domain";
import type { GuestInvitationRepository, PublicResearchRepository, ResearchAuthoringRepository } from "./repository";

export { SlugTakenError } from "./errors.ts";

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

type InvitationRow = {
  id: string; guest_name: string; guest_email: string; state: string;
  created_at: string; expires_at: string; submitted_at: string | null; revoked_at: string | null;
  article_id: string | null;
};

function rowToInvitation(row: InvitationRow): GuestInvitation {
  return { id: row.id, guestName: row.guest_name, guestEmail: row.guest_email,
    state: row.state as GuestInvitation["state"], createdAt: row.created_at, expiresAt: row.expires_at,
    submittedAt: row.submitted_at, revokedAt: row.revoked_at, articleId: row.article_id };
}

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
): PublicResearchRepository & ResearchAuthoringRepository & GuestInvitationRepository {
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

  async function findById(id: string): Promise<ResearchArticleRecord | null> {
    const row = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first<ArticleRow>();
    return row ? rowToRecord(row) : null;
  }

  async function findInvitationByHash(capabilityHash: string): Promise<GuestInvitation | null> {
    const row = await db.prepare(`SELECT i.*, c.article_id FROM guest_invitations i
      LEFT JOIN guest_contributions c ON c.invitation_id = i.id WHERE i.capability_hash = ?`)
      .bind(capabilityHash).first<InvitationRow>();
    return row ? rowToInvitation(row) : null;
  }

  /** Resolves the slug a write should actually use: the author's override
   * if given (still run through slugify — an override is a preference for
   * *which* words, not a bypass of URL-safety), otherwise derived from the
   * title. Throws SlugTakenError if another article already holds it.
   * `excludingId` lets updateDraft check uniqueness against every row
   * except the one being updated, so saving a draft under its own
   * unchanged slug never trips over itself. */
  async function resolveUniqueSlug(candidate: string, excludingId?: string): Promise<string> {
    const slug = slugify(candidate);
    const existing = await findBySlug(slug);
    if (existing && existing.id !== excludingId) throw new SlugTakenError(slug);
    return slug;
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
      // Load JSX only for body rendering; authoring and metadata remain
      // directly testable with Node's TypeScript runner.
      const { createMarkdownContent } = await import("./markdown-content");
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
    // Auth-agnostic on purpose — see ./authoring-service.ts for the layer
    // that checks RESEARCH_AUTHOR_EMAIL before any of these run. Nothing
    // here knows a session exists.

    async listArticles(): Promise<ResearchArticleRecord[]> {
      const { results } = await db
        .prepare("SELECT * FROM articles ORDER BY updated_at DESC")
        .all<ArticleRow>();
      return results.map(rowToRecord);
    },

    async getArticleById(id: string): Promise<ResearchArticleRecord | null> {
      return findById(id);
    },

    async createDraft(input: DraftInput): Promise<ResearchArticleRecord> {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const slug = await resolveUniqueSlug(input.slug ?? input.title);
      const readingMinutes = estimateReadingMinutes(input.content);

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
          readingMinutes,
          now,
          now,
        )
        .run();

      const record = await findById(id);
      if (!record) throw new Error(`createDraft: failed to read back "${id}" after inserting it`);
      return record;
    },

    async updateDraft(id, input: Partial<DraftInput>): Promise<ResearchArticleRecord> {
      const existing = await findById(id);
      if (!existing) throw new Error(`updateDraft: no article with id "${id}"`);

      // A published article's slug is its live public URL — silently
      // changing it would break that URL for anyone who already has it.
      // The editor UI disables the slug field once published as a first
      // line of defense, but that's a client-side nicety, not the actual
      // guard: this is. A requested slug change on an already-published
      // article is intentionally ignored rather than erroring, since it's
      // never the author's actual goal (unpublish first to rename).
      const slug =
        existing.status === "draft" && input.slug !== undefined && slugify(input.slug) !== existing.slug
          ? await resolveUniqueSlug(input.slug, id)
          : existing.slug;
      const merged: ResearchArticleRecord = { ...existing, ...input, slug };
      const now = new Date().toISOString();

      await db
        .prepare(
          `UPDATE articles
           SET slug = ?, title = ?, description = ?, category = ?, tags = ?, content = ?, reading_minutes = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          merged.slug,
          merged.title,
          merged.description,
          merged.category,
          JSON.stringify(merged.tags),
          merged.content,
          estimateReadingMinutes(merged.content),
          now,
          id,
        )
        .run();

      const record = await findById(id);
      if (!record) throw new Error(`updateDraft: "${id}" disappeared during update`);
      return record;
    },

    async publish(id): Promise<ResearchArticleRecord> {
      const now = new Date().toISOString();
      const existing = await findById(id);
      if (!existing) throw new Error(`publish: no article with id "${id}"`);
      const publishedAt = publicationDate(existing.publishedAt, new Date(now));
      // COALESCE keeps the original publish date on a re-publish after an
      // unpublish, rather than treating every publish as "new" — only a
      // genuinely first-time publish gets the UTC calendar date as its publishedAt.
      await db
        .prepare(
          "UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?",
        )
        .bind(publishedAt, now, id)
        .run();

      const record = await findById(id);
      if (!record) throw new Error(`publish: no article with id "${id}"`);
      return record;
    },

    async unpublish(id): Promise<ResearchArticleRecord> {
      const now = new Date().toISOString();
      await db
        .prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ?")
        .bind(now, id)
        .run();

      const record = await findById(id);
      if (!record) throw new Error(`unpublish: no article with id "${id}"`);
      return record;
    },

    async deleteArticle(id): Promise<void> {
      await db.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
    },

    // ---- GuestInvitationRepository ----
    async createInvitation(input) {
      await db.prepare(`INSERT INTO guest_invitations
        (id, guest_name, guest_email, capability_hash, state, created_at, expires_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?)`)
        .bind(input.id, input.guestName, input.guestEmail, input.capabilityHash, input.createdAt, input.expiresAt).run();
      const invitation = await findInvitationByHash(input.capabilityHash);
      if (!invitation) throw new Error("createInvitation: read-back failed");
      return invitation;
    },
    async listInvitations() {
      const { results } = await db.prepare(`SELECT i.*, c.article_id FROM guest_invitations i
        LEFT JOIN guest_contributions c ON c.invitation_id = i.id ORDER BY i.created_at DESC`).all<InvitationRow>();
      return results.map(rowToInvitation);
    },
    async revokeInvitation(id, revokedAt) {
      const result = await db.prepare("UPDATE guest_invitations SET state = 'revoked', revoked_at = ? WHERE id = ? AND state = 'active'")
        .bind(revokedAt, id).run();
      return result.meta.changes === 1;
    },
    async getInvitationByCapabilityHash(capabilityHash) { return findInvitationByHash(capabilityHash); },
    async getContribution(invitationId) {
      const row = await db.prepare(`SELECT a.* FROM articles a JOIN guest_contributions c ON c.article_id = a.id
        WHERE c.invitation_id = ?`).bind(invitationId).first<ArticleRow>();
      return row ? rowToRecord(row) : null;
    },
    async createContribution(invitationId, input) {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const slug = await resolveUniqueSlug(input.slug ?? input.title);
      // D1 batch is transactional: the unique invitation_id constraint and
      // active-state conditional insert make concurrent creation yield one article.
      const articleStatement = db.prepare(`INSERT INTO articles (id, slug, title, description, category, tags, content, reading_minutes, status, published_at, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?
        WHERE EXISTS (SELECT 1 FROM guest_invitations WHERE id = ? AND state = 'active' AND expires_at > ?)`)
        .bind(id, slug, input.title, input.description, input.category, JSON.stringify(input.tags), input.content, estimateReadingMinutes(input.content), now, now, invitationId, now);
      const linkStatement = db.prepare(`INSERT INTO guest_contributions (invitation_id, article_id)
        SELECT id, ? FROM guest_invitations WHERE id = ? AND state = 'active' AND expires_at > ?`)
        .bind(id, invitationId, now);
      try { await db.batch([articleStatement, linkStatement]); } catch { return null; }
      const contribution = await this.getContribution(invitationId);
      return contribution;
    },
    async updateContribution(invitationId, input) {
      const invitation = await db.prepare("SELECT state, expires_at FROM guest_invitations WHERE id = ?").bind(invitationId).first<{state:string; expires_at:string}>();
      if (!invitation || invitation.state !== "active" || invitation.expires_at <= new Date().toISOString()) return null;
      const contribution = await this.getContribution(invitationId);
      if (!contribution) return null;
      return this.updateDraft(contribution.id, input);
    },
    async submitContribution(invitationId, submittedAt) {
      const result = await db.prepare(`UPDATE guest_invitations SET state = 'submitted', submitted_at = ?
        WHERE id = ? AND state = 'active' AND expires_at > ? AND EXISTS
        (SELECT 1 FROM guest_contributions WHERE invitation_id = guest_invitations.id)`)
        .bind(submittedAt, invitationId, submittedAt).run();
      return result.meta.changes === 1;
    },
  };
}
