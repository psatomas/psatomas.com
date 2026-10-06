import { getAuthorizationResult, type AuthorizationResult } from "../auth/authorization.ts";
import { hashCapability } from "./guest-contribution-service.ts";
import type { GuestInvitation } from "./domain.ts";
import type { GuestInvitationRepository } from "./repository.ts";

export type InvitationFailure = "unauthenticated" | "forbidden" | "validation" | "not-found";
export type InvitationResult<T> = { ok: true; data: T } | { ok: false; reason: InvitationFailure; message: string };
type Deps = { getAuthorization: () => Promise<AuthorizationResult>; getRepository: () => Promise<GuestInvitationRepository>; now?: () => Date; random?: () => string };
const failure = <T>(reason: InvitationFailure, message: string): InvitationResult<T> => ({ ok:false, reason, message });
export function createInvitationService(deps: Deps) {
  const now = () => (deps.now ?? (() => new Date()))();
  async function repository(): Promise<InvitationResult<GuestInvitationRepository>> {
    const auth = await deps.getAuthorization();
    if (!auth.authenticated) return failure("unauthenticated", "Sign in to manage guest invitations.");
    if (!auth.authorized) return failure("forbidden", "Only the configured Research author can manage invitations.");
    return {ok:true,data:await deps.getRepository()};
  }
  return {
    async create(guestName: string, guestEmail: string): Promise<InvitationResult<GuestInvitation & { urlToken: string }>> {
      if (!guestName.trim() || !/^\S+@\S+\.\S+$/.test(guestEmail)) return failure("validation", "Provide a guest name and valid email.");
      const access = await repository(); if (!access.ok) return access;
      const secret = deps.random?.() ?? crypto.getRandomValues(new Uint8Array(32)).reduce((s,b) => s + b.toString(16).padStart(2,"0"), "");
      const created = now();
      const invitation = await access.data.createInvitation({ id: crypto.randomUUID(), guestName: guestName.trim(), guestEmail: guestEmail.trim(), capabilityHash: await hashCapability(secret), createdAt: created.toISOString(), expiresAt: new Date(created.getTime() + 72 * 3600_000).toISOString() });
      return {ok:true,data:{...invitation,urlToken:secret}};
    },
    async list(): Promise<InvitationResult<GuestInvitation[]>> { const access=await repository(); return access.ok ? {ok:true,data:await access.data.listInvitations()} : access; },
    async revoke(id: string): Promise<InvitationResult<null>> { const access=await repository(); if(!access.ok)return access; return await access.data.revokeInvitation(id, now().toISOString()) ? {ok:true,data:null} : failure("not-found", "Invitation is not active."); },
  };
}
export const invitationService = createInvitationService({ getAuthorization: getAuthorizationResult, getRepository: async () => (await import("./index.ts")).getGuestInvitationRepository() });
