import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1ResearchRepository } from "./d1-repository.ts";
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
  // Execute the repository's real SQL and bindings, not a mock publisher.
  const db = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let values: unknown[] = [];
      return {
        bind(...bound: unknown[]) { values = bound; return this; },
        async run() { return statement.run(...values); },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values) }; },
      };
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
