import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { getAuthOptions } from "@/lib/auth/config";

/**
 * The library's own standard catch-all — this single handler serves
 * sign-in, the Google OAuth callback, sign-out, and session/CSRF
 * endpoints (/api/auth/signin, /api/auth/callback/google,
 * /api/auth/signout, /api/auth/session, ...). None of that is
 * hand-implemented here; next-auth owns the OAuth protocol handling
 * entirely.
 *
 * Options are resolved fresh per request (the 3-arg `NextAuth(req, ctx,
 * options)` form, rather than the classic `NextAuth(options)` singleton
 * handler) because the options themselves depend on an async
 * getCloudflareContext() lookup — see src/lib/auth/config.ts and env.ts
 * for why a module-scope `process.env`-based options object doesn't
 * reliably work in this project's actual runtime.
 */
type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function handler(req: NextRequest, context: RouteContext) {
  const options = await getAuthOptions();
  return NextAuth(req, context, options);
}

export { handler as GET, handler as POST };
