import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthoringService, type AuthoringDependencies } from "./authoring-service.ts";
import { SlugTakenError } from "./errors.ts";
import type { AuthorizationResult } from "../auth/authorization.ts";
import type { DraftInput, ResearchArticleRecord } from "./domain.ts";
import type { ResearchAuthoringRepository } from "./repository.ts";

// A fake repository, not a real D1 binding — these tests are about the
// authorization boundary and the not-found/slug-taken translation this
// service layer adds, not about SQL. The repository itself already has
// its own coverage via the real D1 adapter's runtime validation (see the
// implementation report — D1 has no local unit-test harness in this
// project, same as the rest of src/lib/research/).

const SAMPLE_INPUT: DraftInput = {
  title: "A Draft",
  description: "A description",
  category: "EVM",
  tags: [],
  content: "Some content",
};

const SAMPLE_RECORD: ResearchArticleRecord = {
  id: "article-1",
  slug: "a-draft",
  title: "A Draft",
  description: "A description",
  category: "EVM",
  tags: [],
  content: "Some content",
  readingMinutes: 1,
  status: "draft",
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function fakeRepository(overrides: Partial<ResearchAuthoringRepository> = {}): ResearchAuthoringRepository {
  return {
    listArticles: async () => [SAMPLE_RECORD],
    getArticleById: async (id) => (id === SAMPLE_RECORD.id ? SAMPLE_RECORD : null),
    createDraft: async () => SAMPLE_RECORD,
    updateDraft: async () => SAMPLE_RECORD,
    publish: async () => ({ ...SAMPLE_RECORD, status: "published", publishedAt: "2026-01-02" }),
    unpublish: async () => ({ ...SAMPLE_RECORD, status: "draft" }),
    deleteArticle: async () => {},
    ...overrides,
  };
}

function deps(
  authorization: AuthorizationResult,
  repository: ResearchAuthoringRepository = fakeRepository(),
): AuthoringDependencies {
  return {
    getAuthorization: async () => authorization,
    getRepository: async () => repository,
  };
}

const UNAUTHENTICATED: AuthorizationResult = { authenticated: false, authorized: false };
const AUTHENTICATED_NOT_AUTHOR: AuthorizationResult = {
  authenticated: true,
  authorized: false,
  email: "someone-else@example.com",
};
const AUTHORIZED_AUTHOR: AuthorizationResult = {
  authenticated: true,
  authorized: true,
  email: "author@example.com",
};

test("an unauthenticated caller is rejected before the repository is ever touched", async () => {
  let repositoryCalled = false;
  const repository = fakeRepository({
    listArticles: async () => {
      repositoryCalled = true;
      return [];
    },
  });
  const service = createAuthoringService(deps(UNAUTHENTICATED, repository));

  const result = await service.listArticles();

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unauthenticated");
  assert.equal(repositoryCalled, false);
});

test("an authenticated but unauthorized caller is rejected, distinctly from unauthenticated", async () => {
  const service = createAuthoringService(deps(AUTHENTICATED_NOT_AUTHOR));

  const result = await service.listArticles();

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "forbidden");
});

test("the authorized author can list articles", async () => {
  const service = createAuthoringService(deps(AUTHORIZED_AUTHOR));

  const result = await service.listArticles();

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.data, [SAMPLE_RECORD]);
});

test("the authorized author can create a draft", async () => {
  const service = createAuthoringService(deps(AUTHORIZED_AUTHOR));

  const result = await service.createDraft(SAMPLE_INPUT);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.status, "draft");
});

test("creating a draft with an empty title is rejected before authorization is even checked", async () => {
  let authorizationChecked = false;
  const d = deps(AUTHORIZED_AUTHOR);
  const service = createAuthoringService({
    ...d,
    getAuthorization: async () => {
      authorizationChecked = true;
      return AUTHORIZED_AUTHOR;
    },
  });

  const result = await service.createDraft({ ...SAMPLE_INPUT, title: "   " });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "validation");
  assert.equal(authorizationChecked, false);
});

test("a slug collision surfaces as a distinct, actionable reason", async () => {
  const repository = fakeRepository({
    createDraft: async () => {
      throw new SlugTakenError("a-draft");
    },
  });
  const service = createAuthoringService(deps(AUTHORIZED_AUTHOR, repository));

  const result = await service.createDraft(SAMPLE_INPUT);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "slug-taken");
    assert.match(result.message, /a-draft/);
  }
});

test("editing a nonexistent article returns not-found rather than throwing", async () => {
  const service = createAuthoringService(deps(AUTHORIZED_AUTHOR));

  const result = await service.getArticleForEditing("does-not-exist");

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not-found");
});

test("an unauthorized caller gets 'forbidden', not 'not-found', for a real article", async () => {
  // Authorization must be checked before existence — an unauthorized
  // caller should never learn whether a given id exists at all.
  const service = createAuthoringService(deps(AUTHENTICATED_NOT_AUTHOR));

  const result = await service.getArticleForEditing(SAMPLE_RECORD.id);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "forbidden");
});

test("publish, unpublish, and delete all require authorization", async () => {
  const service = createAuthoringService(deps(UNAUTHENTICATED));

  for (const call of [
    () => service.publish(SAMPLE_RECORD.id),
    () => service.unpublish(SAMPLE_RECORD.id),
    () => service.deleteArticle(SAMPLE_RECORD.id),
  ]) {
    const result = await call();
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unauthenticated");
  }
});

test("the authorized author can publish an existing article", async () => {
  const service = createAuthoringService(deps(AUTHORIZED_AUTHOR));

  const result = await service.publish(SAMPLE_RECORD.id);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.status, "published");
});
