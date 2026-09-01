import { NextResponse } from "next/server";
import { getAuthorizationResult } from "@/lib/auth/authorization";

/**
 * Proves the authentication + authorization foundation works end to
 * end — it is not the Research editor, has no UI beyond a one-line JSON
 * body, and is not linked from any navigation. A real authoring route
 * later does exactly this same three-way check itself; this route only
 * exists to validate that the check is correct before anything is built
 * on top of it.
 *
 * A Route Handler, not a page, specifically so the three required
 * outcomes map onto real, unambiguous HTTP semantics (a redirect, a 403,
 * a 200) using stable Next.js APIs — no experimental `forbidden()` /
 * `authInterrupts` flag needed for a throwaway verification route.
 */
export async function GET(request: Request) {
  const result = await getAuthorizationResult();

  if (!result.authenticated) {
    return NextResponse.redirect(new URL("/api/auth/signin", request.url));
  }

  if (!result.authorized) {
    return NextResponse.json(
      { error: "Forbidden — authenticated, but not the configured Research author." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, email: result.email });
}
