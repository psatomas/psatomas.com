import { SlugTakenError } from "./errors.ts";
import type { DraftInput, GuestInvitation, ResearchArticleRecord } from "./domain.ts";
import type { GuestInvitationRepository } from "./repository.ts";

export type GuestFailure = "invalid" | "closed" | "validation" | "slug-taken";
export type GuestResult<T> = { ok: true; data: T } | { ok: false; reason: GuestFailure; message: string };
const fail = <T>(reason: GuestFailure, message: string): GuestResult<T> => ({ ok: false, reason, message });
const ok = <T>(data: T): GuestResult<T> => ({ ok: true, data });

export type GuestContributionDependencies = { getRepository: () => Promise<GuestInvitationRepository>; now?: () => Date };

export async function hashCapability(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validate(input: Partial<DraftInput>) {
  if (input.title !== undefined && !input.title.trim()) return "Title cannot be empty.";
  if (input.content !== undefined && !input.content.trim()) return "Content cannot be empty.";
  return null;
}

/** A capability service intentionally has no list/publish/delete surface. */
export function createGuestContributionService(deps: GuestContributionDependencies) {
  const now = () => (deps.now ?? (() => new Date()))();
  async function invitation(token: string): Promise<GuestResult<GuestInvitation>> {
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return fail("invalid", "This contribution link is invalid.");
    const record = await (await deps.getRepository()).getInvitationByCapabilityHash(await hashCapability(token));
    if (!record) return fail("invalid", "This contribution link is invalid.");
    if (record.state !== "active" || record.expiresAt <= now().toISOString()) return fail("closed", "This contribution link is no longer active.");
    return ok(record);
  }
  async function active(token: string) { return invitation(token); }
  return {
    validate: active,
    async getContribution(token: string): Promise<GuestResult<ResearchArticleRecord | null>> {
      const auth = await active(token); if (!auth.ok) return auth;
      return ok(await (await deps.getRepository()).getContribution(auth.data.id));
    },
    async getContributionForDisplay(token: string): Promise<GuestResult<{ article: ResearchArticleRecord | null; submitted: boolean }>> {
      if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return fail("invalid", "This contribution link is invalid.");
      const record = await (await deps.getRepository()).getInvitationByCapabilityHash(await hashCapability(token));
      if (!record || record.state === "revoked" || record.expiresAt <= now().toISOString()) return fail("closed", "This contribution link is no longer active.");
      return ok({ article: await (await deps.getRepository()).getContribution(record.id), submitted: record.state === "submitted" });
    },
    async save(token: string, input: DraftInput): Promise<GuestResult<ResearchArticleRecord>> {
      const error = validate(input); if (error) return fail("validation", error);
      const auth = await active(token); if (!auth.ok) return auth;
      const repository = await deps.getRepository();
      try {
        const existing = await repository.getContribution(auth.data.id);
        const record = existing
          ? await repository.updateContribution(auth.data.id, input)
          : await repository.createContribution(auth.data.id, input);
        return record ? ok(record) : fail("closed", "This contribution is no longer available for editing.");
      } catch (error) {
        if (error instanceof SlugTakenError) return fail("slug-taken", error.message);
        throw error;
      }
    },
    async submit(token: string): Promise<GuestResult<null>> {
      const auth = await active(token); if (!auth.ok) return auth;
      const repository = await deps.getRepository();
      if (!await repository.getContribution(auth.data.id)) return fail("validation", "Save a contribution before submitting it.");
      return (await repository.submitContribution(auth.data.id, now().toISOString()))
        ? ok(null) : fail("closed", "This contribution is no longer available for editing.");
    },
  };
}

const liveDependencies: GuestContributionDependencies = {
  getRepository: async () => (await import("./index.ts")).getGuestInvitationRepository(),
};
export const guestContributionService = createGuestContributionService(liveDependencies);
