import { SlugTakenError } from "./errors.ts";
import type { DraftInput, GuestInvitation, ResearchArticleRecord } from "./domain.ts";
import type { GuestInvitationRepository } from "./repository.ts";

export type GuestFailure = "invalid" | "closed" | "validation" | "slug-taken";
export type GuestResult<T> = { ok: true; data: T } | { ok: false; reason: GuestFailure; message: string };
type EstablishedSession = { invitation: GuestInvitation; sessionToken: string; sessionExpiresAt: string };
const fail = <T>(reason: GuestFailure, message: string): GuestResult<T> => ({ ok:false, reason, message });
const ok = <T>(data: T): GuestResult<T> => ({ ok:true, data });
export const CONTRIBUTOR_SESSION_MS = 30 * 24 * 3600_000;

export type GuestContributionDependencies = { getRepository: () => Promise<GuestInvitationRepository>; now?: () => Date; random?: () => string };

export async function hashCapability(secret: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2,"0")).join("");
}
export function newCapability() { return crypto.getRandomValues(new Uint8Array(32)).reduce((s,b) => s + b.toString(16).padStart(2,"0"), ""); }
function validToken(token: string) { return /^[A-Za-z0-9_-]{40,}$/.test(token); }
function validate(input: Partial<DraftInput>) { if(input.title !== undefined && !input.title.trim()) return "Title cannot be empty."; if(input.content !== undefined && !input.content.trim()) return "Content cannot be empty."; return null; }

/** Guest operations authenticate exclusively with a revocable editor session. */
export function createGuestContributionService(deps: GuestContributionDependencies) {
  const now = () => (deps.now ?? (() => new Date()))();
  const secret = () => deps.random?.() ?? newCapability();
  async function session(token: string): Promise<GuestResult<GuestInvitation>> {
    if (!validToken(token)) return fail("invalid", "Your contributor session is invalid.");
    const invitation = await (await deps.getRepository()).getInvitationBySessionHash(await hashCapability(token), now().toISOString());
    return invitation ? ok(invitation) : fail("closed", "Your contributor session is no longer active.");
  }
  async function establish(redeem: (hash:string, sessionHash:string, sessionId:string, created:string, expires:string)=>Promise<GuestInvitation|null>, token:string): Promise<GuestResult<EstablishedSession>> {
    if (!validToken(token)) return fail<EstablishedSession>("invalid", "This link is invalid.");
    const created = now(); const sessionToken = secret(); const expiresAt = new Date(created.getTime() + CONTRIBUTOR_SESSION_MS).toISOString();
    const invitation = await redeem(await hashCapability(token), await hashCapability(sessionToken), crypto.randomUUID(), created.toISOString(), expiresAt);
    return invitation ? ok({ invitation, sessionToken, sessionExpiresAt: expiresAt }) : fail("closed", "This link is no longer active.");
  }
  return {
    async accept(token:string) { const repo=await deps.getRepository(); return establish((...args)=>repo.acceptInvitation(...args), token); },
    async reauthenticate(token:string) { const repo=await deps.getRepository(); return establish((...args)=>repo.redeemReauthenticationLink(...args), token); },
    async getContributionForDisplay(token:string): Promise<GuestResult<{article:ResearchArticleRecord|null;submitted:boolean}>> { const auth=await session(token); if(!auth.ok)return auth; return ok({article:await (await deps.getRepository()).getContribution(auth.data.id),submitted:auth.data.state === "submitted"}); },
    async save(token:string,input:DraftInput): Promise<GuestResult<ResearchArticleRecord>> { const error=validate(input); if(error)return fail("validation",error); const auth=await session(token); if(!auth.ok)return auth; if(auth.data.state !== "active")return fail("closed","This contribution is no longer available for editing."); const repo=await deps.getRepository(); const tokenHash=await hashCapability(token); const at=now().toISOString(); try { const existing=await repo.getContribution(auth.data.id); const record=existing ? await repo.updateContribution(tokenHash,at,input) : await repo.createContribution(tokenHash,at,input); return record?ok(record):fail("closed","This contribution is no longer available for editing."); } catch(error) { if(error instanceof SlugTakenError)return fail("slug-taken",error.message); throw error; } },
    async submit(token:string): Promise<GuestResult<null>> { const auth=await session(token); if(!auth.ok)return auth; if(auth.data.state !== "active")return fail("closed","This contribution is no longer available for editing."); const repo=await deps.getRepository(); if(!await repo.getContribution(auth.data.id))return fail("validation","Save a contribution before submitting it."); return await repo.submitContribution(await hashCapability(token),now().toISOString()) ? ok(null) : fail("closed","This contribution is no longer available for editing."); },
  };
}
const liveDependencies: GuestContributionDependencies = { getRepository: async () => (await import("./index.ts")).getGuestInvitationRepository() };
export const guestContributionService = createGuestContributionService(liveDependencies);
