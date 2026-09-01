import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AuthEnv = {
  authSecret: string | undefined;
  googleId: string;
  googleSecret: string;
  authorEmail: string | undefined;
};

/**
 * Confirmed empirically under `next dev`, against this project's actual
 * OpenNext/Cloudflare setup, before writing the rest of this module:
 * .dev.vars-sourced secrets (AUTH_SECRET, AUTH_GOOGLE_ID,
 * AUTH_GOOGLE_SECRET, RESEARCH_AUTHOR_EMAIL) are NOT exposed via
 * `process.env` — only specific OpenNext-managed vars (like NEXTJS_ENV)
 * flow through there. They ARE reachable via `getCloudflareContext().env`
 * — the exact same binding-access pattern already proven for the Oracle
 * KV cache and the Research D1 database, just not previously known to
 * apply to plain secrets too, not only bindings.
 *
 * next-auth's classic pattern reads `process.env.X` in a module-scope
 * options object; doing that here would silently construct a Google
 * provider with an empty clientId/clientSecret and an empty session
 * secret. This lazy, request-time resolver is the fix — the same
 * adaptation this codebase already makes everywhere else it needs
 * Cloudflare-sourced configuration, not a workaround specific to auth.
 */
export async function getAuthEnv(): Promise<AuthEnv> {
  let env: Record<string, string | undefined> = {};
  try {
    const ctx = await getCloudflareContext({ async: true });
    env = ctx.env as unknown as Record<string, string | undefined>;
  } catch {
    // No Cloudflare context reachable at all (e.g. a build-time static
    // analysis pass with no request in flight) — fall through to
    // process.env rather than throwing. Neither source has real values
    // in that case, but the caller still gets a well-formed result.
  }

  return {
    authSecret: env.AUTH_SECRET ?? process.env.AUTH_SECRET,
    googleId: env.AUTH_GOOGLE_ID ?? process.env.AUTH_GOOGLE_ID ?? "",
    googleSecret: env.AUTH_GOOGLE_SECRET ?? process.env.AUTH_GOOGLE_SECRET ?? "",
    authorEmail: env.RESEARCH_AUTHOR_EMAIL ?? process.env.RESEARCH_AUTHOR_EMAIL,
  };
}
