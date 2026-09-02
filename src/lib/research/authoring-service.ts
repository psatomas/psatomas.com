import { getAuthorizationResult } from "../auth/authorization.ts";
import { SlugTakenError } from "./errors.ts";
import type { AuthorizationResult } from "../auth/authorization.ts";
import type { DraftInput, ResearchArticleRecord } from "./domain.ts";
import type { ResearchAuthoringRepository } from "./repository.ts";

/**
 * The authoring boundary: Authorization -> Research authoring operations
 * -> Research repository -> D1. This is the ONLY module in the codebase
 * that couples Research to authentication — repository.ts/d1-repository.ts
 * stay entirely auth-agnostic (see the comment on
 * ResearchAuthoringRepository), and the public read side
 * (getResearchRepository, /research, /research/[slug]) never imports
 * from here at all, so it can't accidentally start requiring a session.
 *
 * Every exported operation re-checks authorization itself rather than
 * trusting a caller to have checked already — a Server Action or page
 * that forgot the check still can't reach D1 without going through one
 * of these. The identity behind the check always comes from the current
 * request's session (via getAuthorizationResult -> next-auth's
 * getServerSession), never from anything the caller passes in — there is
 * no email or user-id parameter anywhere on this file's public surface.
 */

export type AuthoringFailureReason =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "slug-taken"
  | "validation";

export type AuthoringResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AuthoringFailureReason; message: string };

function fail<T>(reason: AuthoringFailureReason, message: string): AuthoringResult<T> {
  return { ok: false, reason, message };
}

function ok<T>(data: T): AuthoringResult<T> {
  return { ok: true, data };
}

/** Injected rather than imported directly by each method below, so this
 * whole service can be exercised in a unit test against a fake
 * repository and a fake session — see authoring-service.test.ts — without
 * a real Cloudflare context or a real Google sign-in anywhere near it. */
export type AuthoringDependencies = {
  getAuthorization: () => Promise<AuthorizationResult>;
  getRepository: () => Promise<ResearchAuthoringRepository>;
};

const liveDependencies: AuthoringDependencies = {
  getAuthorization: getAuthorizationResult,
  // Lazy/dynamic on purpose, unlike getAuthorization above: ./index.ts
  // pulls in d1-repository.ts, which imports markdown-content.tsx (JSX)
  // at module scope for the public read side. Node's plain `--test`
  // runner has no JSX transform, so a static top-level import here would
  // make authoring-service.test.ts fail to even load — despite every
  // test in that file injecting a fake repository and never touching
  // this function at all. A dynamic import defers resolution to the one
  // real call site (a Server Action under src/app/research/write/),
  // where Next.js's own bundler handles it normally.
  getRepository: async () => {
    const { getResearchAuthoringRepository } = await import("./index.ts");
    return getResearchAuthoringRepository();
  },
};

function validateDraftInput(input: Partial<DraftInput>): string | null {
  if (input.title !== undefined && input.title.trim().length === 0) {
    return "Title cannot be empty.";
  }
  if (input.content !== undefined && input.content.trim().length === 0) {
    return "Content cannot be empty.";
  }
  return null;
}

export function createAuthoringService(deps: AuthoringDependencies) {
  /** Every mutating and every read operation below calls this first —
   * the single point where "who is asking" gets resolved and checked.
   * Never skipped, never cached across calls: it re-derives the session
   * from the current request every time, same lifecycle discipline as
   * the Cloudflare bindings this layer sits in front of. */
  async function authorize(): Promise<AuthoringResult<null>> {
    const authorization = await deps.getAuthorization();
    if (!authorization.authenticated) {
      return fail("unauthenticated", "Sign in to access Research authoring.");
    }
    if (!authorization.authorized) {
      return fail("forbidden", "This Google account is not the configured Research author.");
    }
    return ok(null);
  }

  async function withAuthorization<T>(
    run: (repository: ResearchAuthoringRepository) => Promise<T>,
  ): Promise<AuthoringResult<T>> {
    const authResult = await authorize();
    if (!authResult.ok) return authResult;

    try {
      const repository = await deps.getRepository();
      return ok(await run(repository));
    } catch (error) {
      if (error instanceof SlugTakenError) {
        return fail("slug-taken", error.message);
      }
      throw error;
    }
  }

  return {
    async listArticles(): Promise<AuthoringResult<ResearchArticleRecord[]>> {
      return withAuthorization((repository) => repository.listArticles());
    },

    async getArticleForEditing(id: string): Promise<AuthoringResult<ResearchArticleRecord>> {
      return withAuthorization(async (repository) => {
        const record = await repository.getArticleById(id);
        if (!record) throw new NotFoundSignal();
        return record;
      }).catch(rethrowAsNotFound);
    },

    async createDraft(input: DraftInput): Promise<AuthoringResult<ResearchArticleRecord>> {
      const validationError = validateDraftInput(input);
      if (validationError) return fail("validation", validationError);
      return withAuthorization((repository) => repository.createDraft(input));
    },

    async updateDraft(
      id: string,
      input: Partial<DraftInput>,
    ): Promise<AuthoringResult<ResearchArticleRecord>> {
      const validationError = validateDraftInput(input);
      if (validationError) return fail("validation", validationError);
      return withAuthorization(async (repository) => {
        const existing = await repository.getArticleById(id);
        if (!existing) throw new NotFoundSignal();
        return repository.updateDraft(id, input);
      }).catch(rethrowAsNotFound);
    },

    async publish(id: string): Promise<AuthoringResult<ResearchArticleRecord>> {
      return withAuthorization(async (repository) => {
        const existing = await repository.getArticleById(id);
        if (!existing) throw new NotFoundSignal();
        return repository.publish(id);
      }).catch(rethrowAsNotFound);
    },

    async unpublish(id: string): Promise<AuthoringResult<ResearchArticleRecord>> {
      return withAuthorization(async (repository) => {
        const existing = await repository.getArticleById(id);
        if (!existing) throw new NotFoundSignal();
        return repository.unpublish(id);
      }).catch(rethrowAsNotFound);
    },

    async deleteArticle(id: string): Promise<AuthoringResult<null>> {
      return withAuthorization(async (repository) => {
        const existing = await repository.getArticleById(id);
        if (!existing) throw new NotFoundSignal();
        await repository.deleteArticle(id);
        return null;
      }).catch(rethrowAsNotFound);
    },
  };
}

/** Internal signal, never let past this file — thrown inside
 * withAuthorization's `run` callback to short-circuit to a "not-found"
 * AuthoringResult via the .catch() below, without adding a fourth code
 * path to withAuthorization itself for something only some callers need. */
class NotFoundSignal extends Error {}

function rethrowAsNotFound(error: unknown): AuthoringResult<never> {
  if (error instanceof NotFoundSignal) {
    return fail("not-found", "No article exists with that id.");
  }
  throw error;
}

/** The instance every Server Action and page in src/app/research/write/
 * actually calls — real authorization, real D1, resolved fresh per the
 * lifecycle rule in getResearchAuthoringRepository. Tests use
 * createAuthoringService directly with fakes instead of this. */
export const authoringService = createAuthoringService(liveDependencies);
