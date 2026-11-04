const protectedHeaders = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

/** A self-contained page: no scripts, assets, or reflected bearer token. */
export function confirmationPage(label: string) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'self'"><title>${label}</title><main><h1>${label}</h1><p>Continue only if you intended to use this link.</p><form method="post"><button type="submit">Continue</button></form></main>`, {
    headers: { ...protectedHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export function redirectToContribution(request: Request, invalid = false) {
  return new Response(null, { status:303, headers:{ ...protectedHeaders, Location:new URL(invalid ? "/research/contribute?invalid=1" : "/research/contribute", request.url).toString() } });
}

type Redemption = () => Promise<{ ok: true; data: { sessionToken: string; sessionExpiresAt: string } } | { ok: false }>;

/** Centralizes POST-only redemption so route tests can prove GET is inert. */
export async function redeemPost(request: Request, redeem: Redemption) {
  if (!isSameOrigin(request)) return redirectToContribution(request, true);
  const result = await redeem();
  if (!result.ok) return redirectToContribution(request, true);
  const response = redirectToContribution(request);
  const maxAge = Math.max(1, Math.floor((new Date(result.data.sessionExpiresAt).getTime() - Date.now()) / 1000));
  response.headers.set("Set-Cookie", `research_guest_session=${result.data.sessionToken}; Path=/research/contribute; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
