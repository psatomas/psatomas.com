import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { GoogleProfile } from "next-auth/providers/google";
import { getAuthEnv } from "./env.ts";

/**
 * Auth.js (next-auth v4) configuration. This file only answers "who is
 * this?" — a single Google identity, nothing more. It has no idea a
 * Research repository or a D1 database exists; see ./authorization.ts
 * for the separate, deliberately independent check of *whether* that
 * identity is allowed to author anything.
 *
 * Built lazily via an async factory rather than exported as a module-
 * scope constant — see ./env.ts for why: the secrets it needs aren't
 * reliably available from `process.env` in this project's actual
 * runtime, only from `getCloudflareContext()`, which is only reachable
 * inside a request's async context.
 *
 * Deliberately minimal:
 * - No database adapter. Sessions are JWTs — there's nothing to persist,
 *   so there's no users/accounts/sessions table, and no reason to add
 *   one just to represent the one person this app will ever authorize.
 * - No custom sign-in/sign-out/error pages — next-auth's own default
 *   pages are used as-is, which are already the smallest possible
 *   "initiate Google login" / "confirm sign-out" UI this needs.
 * - One provider, one scope. `openid email profile` is the standard OIDC
 *   identity scope — no Drive, Gmail, Calendar, or any other Google API
 *   access is ever requested, and none of that scope is needed for what
 *   this app does with the identity (compare an email, nothing else).
 */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  const { authSecret, googleId, googleSecret } = await getAuthEnv();

  return {
    providers: [
      GoogleProvider({
        clientId: googleId,
        clientSecret: googleSecret,
        authorization: { params: { scope: "openid email profile" } },
      }),
    ],
    session: {
      strategy: "jwt",
    },
    secret: authSecret,
    callbacks: {
      // Carry only what the authorization check in ./authorization.ts
      // actually needs — the email, and whether Google itself verified
      // it — from the OAuth profile into the token, and from the token
      // into the session server code reads. No profile data beyond that
      // is stored anywhere.
      async jwt({ token, profile }) {
        const googleProfile = profile as GoogleProfile | undefined;
        if (googleProfile) {
          token.email = googleProfile.email;
          token.emailVerified = googleProfile.email_verified;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.email = token.email;
        }
        session.emailVerified = token.emailVerified;
        return session;
      },
    },
  };
}
