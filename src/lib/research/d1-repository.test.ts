import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1ResearchRepository } from "./d1-repository.ts";
import { hashCapability } from "./guest-contribution-service.ts";
import { publicationDate } from "./publication-date.ts";

// Node's runtime provides SQLite; the project's Node 20 type declarations
// predate it. Describe only the synchronous API used by this local adapter.
type Sqlite = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...values: unknown[]): unknown;
    get(...values: unknown[]): unknown;
    all(...values: unknown[]): unknown[];
  };
  close(): void;
};
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (path: string) => Sqlite;
};

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../../../migrations/0001_create_articles.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../../../migrations/0002_create_guest_invitations.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../../../migrations/0003_guest_contributor_sessions.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../../../migrations/0004_guest_acceptance_session_binding.sql", import.meta.url), "utf8"));
  // Execute the repository's real SQL and bindings, not a mock publisher.
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let values: unknown[] = [];
      const wrapped = {
        bind(...bound: unknown[]) { values = bound; return this; },
        async run() { const result = statement.run(...values) as { changes?: number }; return { meta: { changes: result.changes ?? 0 } }; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values) }; },
      };
      return wrapped;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec("BEGIN");
      try { const results=[]; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  } as unknown as D1Database;
  return { sqlite, repository: createD1ResearchRepository(db) };
}

const input = {
  title: "The difference between a contract and a protocol",
  description: "An excerpt", category: "Protocol Engineering" as const,
  tags: ["Protocols"], content: "Article body.",
};
const timestamp = "2026-09-22T11:32:03.436Z";

test("actual draft/save/publish SQL stores a date while audit fields retain timestamps", async (t) => {
  const { sqlite, repository } = setup();
  t.after(() => sqlite.close());
  t.mock.timers.enable({ apis: ["Date"], now: new Date(timestamp) });
  const draft = await repository.createDraft(input);
  assert.equal(draft.publishedAt, null);
  assert.equal(draft.createdAt, timestamp);
  const saved = await repository.updateDraft(draft.id, { description: "Updated excerpt" });
  assert.equal(saved.publishedAt, null);
  const published = await repository.publish(draft.id);
  assert.equal(published.publishedAt, "2026-09-22");
  assert.equal(published.updatedAt, timestamp);
  assert.equal(published.slug, "the-difference-between-a-contract-and-a-protocol");
  assert.equal(published.content, input.content);
  assert.deepEqual(sqlite.prepare("SELECT published_at FROM articles WHERE id = ?").get(draft.id),
    Object.assign(Object.create(null), { published_at: "2026-09-22" }));
  assert.equal((await repository.getPublishedArticles())[0].publishedAt, "2026-09-22");

  t.mock.timers.setTime(new Date("2026-09-25T00:00:00.000Z").getTime());
  await repository.updateDraft(draft.id, { title: "Edited title", slug: "must-not-change" });
  await repository.unpublish(draft.id);
  const republished = await repository.publish(draft.id);
  assert.equal(republished.publishedAt, "2026-09-22");
  assert.equal(republished.updatedAt, "2026-09-25T00:00:00.000Z");
  assert.equal(republished.slug, published.slug);
});

test("publication dates use the UTC day across offsets and calendar boundaries", () => {
  for (const [instant, expected] of [
    [timestamp, "2026-09-22"],
    ["2026-09-22T23:30:00-03:00", "2026-09-23"],
    ["2027-01-01T01:00:00+03:00", "2026-12-31"],
    ["2028-02-29T23:59:59Z", "2028-02-29"],
  ]) assert.equal(publicationDate(null, new Date(instant)), expected);
  for (const invalid of [timestamp, "2026-02-29", "2026-04-31", "2026-13-01", "", "2026-9-2"]) {
    assert.throws(() => publicationDate(invalid, new Date(timestamp)), /expected YYYY-MM-DD/);
  }
});

test("publish rejects an invalid stored date without changing the record", async (t) => {
  const { sqlite, repository } = setup();
  t.after(() => sqlite.close());
  const draft = await repository.createDraft(input);
  sqlite.prepare("UPDATE articles SET published_at = ? WHERE id = ?").run(timestamp, draft.id);
  const before = await repository.getArticleById(draft.id);
  await assert.rejects(repository.publish(draft.id), /expected YYYY-MM-DD/);
  assert.deepEqual(await repository.getArticleById(draft.id), before);
});

test("historical dates survive republishing and a targeted repair changes only publication date", async (t) => {
  const { sqlite, repository } = setup();
  t.after(() => sqlite.close());
  for (const date of ["2026-08-20", "2026-08-24", "2026-08-29"]) {
    const draft = await repository.createDraft({ ...input, slug: `historical-${date}` });
    sqlite.prepare("UPDATE articles SET published_at = ? WHERE id = ?").run(date, draft.id);
    assert.equal((await repository.publish(draft.id)).publishedAt, date);
  }
  const draft = await repository.createDraft(input);
  sqlite.prepare("UPDATE articles SET status = 'published', published_at = ? WHERE id = ?").run(timestamp, draft.id);
  const before = await repository.getArticleById(draft.id);
  assert.equal((await repository.getPublishedArticles())[0].publishedAt, timestamp);
  sqlite.prepare("UPDATE articles SET published_at = '2026-09-22' WHERE slug = ? AND published_at = ? AND status = 'published'")
    .run(draft.slug, timestamp);
  assert.deepEqual(await repository.getArticleById(draft.id), { ...before, publishedAt: "2026-09-22" });
  assert.deepEqual((await repository.getPublishedArticles()).map((article) => article.publishedAt),
    ["2026-09-22", "2026-08-29", "2026-08-24", "2026-08-20"]);
});

test("migrations and real D1 SQL make acceptance and reauthentication single-winner", async (t) => {
  const { sqlite, repository } = setup(); t.after(() => sqlite.close());
  const now = "2026-10-06T00:00:00.000Z";
  const invitationToken = "i".repeat(64);
  const invitation = await repository.createInvitation({ id:"invite", guestName:"Guest", guestEmail:"guest@example.com", capabilityHash:await hashCapability(invitationToken), createdAt:now, expiresAt:"2026-10-09T00:00:00.000Z" });
  const [first, second] = await Promise.all([
    repository.acceptInvitation(await hashCapability(invitationToken), await hashCapability("a".repeat(64)), "session-a", now, "2026-11-05T00:00:00.000Z"),
    repository.acceptInvitation(await hashCapability(invitationToken), await hashCapability("b".repeat(64)), "session-b", now, "2026-11-05T00:00:00.000Z"),
  ]);
  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM guest_contributor_sessions").get() as { count:number }).count, 1);
  assert.equal(await repository.acceptInvitation(await hashCapability(invitationToken), await hashCapability("c".repeat(64)), "session-c", now, "2026-11-05T00:00:00.000Z"), null);

  const winningToken = first ? "a".repeat(64) : "b".repeat(64);
  const saved = await repository.createContribution(await hashCapability(winningToken), "2026-10-10T00:00:00.000Z", input);
  assert.ok(saved);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM guest_contributions").get() as { count:number }).count, 1);

  const reauthToken = "r".repeat(64);
  assert.equal(await repository.createReauthenticationLink(invitation.id, await hashCapability(reauthToken), "link", now, "2026-10-07T00:00:00.000Z"), true);
  const [reauthA, reauthB] = await Promise.all([
    repository.redeemReauthenticationLink(await hashCapability(reauthToken), await hashCapability("d".repeat(64)), "session-d", now, "2026-11-05T00:00:00.000Z"),
    repository.redeemReauthenticationLink(await hashCapability(reauthToken), await hashCapability("e".repeat(64)), "session-e", now, "2026-11-05T00:00:00.000Z"),
  ]);
  assert.equal([reauthA, reauthB].filter(Boolean).length, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS count FROM guest_contributor_sessions").get() as { count:number }).count, 2);
  assert.equal((await repository.getContribution(invitation.id))?.id, saved?.id);
  assert.equal(await repository.redeemReauthenticationLink(await hashCapability(reauthToken), await hashCapability("f".repeat(64)), "session-f", now, "2026-11-05T00:00:00.000Z"), null);
  assert.equal(await repository.revokeInvitation(invitation.id, now), true);
  assert.equal(await repository.getInvitationBySessionHash(await hashCapability(winningToken), now), null);
  assert.equal(await repository.createReauthenticationLink(invitation.id, await hashCapability("q".repeat(64)), "revoked-link", now, "2026-10-07T00:00:00.000Z"), false);

  const expiredToken = "x".repeat(64);
  await repository.createInvitation({ id:"expired", guestName:"Expired", guestEmail:"expired@example.com", capabilityHash:await hashCapability(expiredToken), createdAt:now, expiresAt:"2026-10-06T00:00:00.000Z" });
  assert.equal(await repository.acceptInvitation(await hashCapability(expiredToken), await hashCapability("z".repeat(64)), "session-z", now, "2026-11-05T00:00:00.000Z"), null);
});
