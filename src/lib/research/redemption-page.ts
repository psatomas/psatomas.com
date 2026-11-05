const protectedHeaders = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const fragmentScript = `(() => {
  const form = document.querySelector("form");
  const status = document.querySelector("[role=status]");
  const rawToken = location.hash.length > 1 ? location.hash.slice(1) : "";
  history.replaceState(null, "", location.pathname + location.search);
  let token = "";
  try { token = decodeURIComponent(rawToken); } catch { /* invalid encoding stays invalid */ }
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) {
    status.textContent = "This link is invalid or incomplete. Ask the owner for a new link.";
    form.querySelector("button").disabled = true;
    return;
  }
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "token";
  input.value = token;
  form.append(input);
  status.textContent = "Ready to continue.";
})();`;

/** No credential is reflected in HTML, assets, or the HTTP URL. */
export function confirmationPage(label: string) {
  const nonce = crypto.randomUUID();
  const csp = `default-src 'none'; base-uri 'none'; form-action 'self'; script-src 'nonce-${nonce}'`;
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${label}</title><main><h1>${label}</h1><p>Continue only if you intended to use this link.</p><p role="status">Preparing confirmation…</p><form method="post"><button type="submit">Continue</button></form></main><script nonce="${nonce}">${fragmentScript}</script>`, {
    headers: { ...protectedHeaders, "Content-Security-Policy":csp, "Content-Type": "text/html; charset=utf-8" },
  });
}

export function isSameOriginPost(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin
    && request.headers.get("sec-fetch-site") === "same-origin";
}

export function redirectToContribution(request: Request, invalid = false) {
  return new Response(null, { status:303, headers:{ ...protectedHeaders, Location:new URL(invalid ? "/research/contribute?invalid=1" : "/research/contribute", request.url).toString() } });
}

type Redemption = (token: string) => Promise<{ ok: true; data: { sessionToken: string; sessionExpiresAt: string } } | { ok: false }>;

/** Reads bearer material only from the same-origin POST body. */
export async function redeemPost(request: Request, redeem: Redemption) {
  if (!isSameOriginPost(request)) return redirectToContribution(request, true);
  const form = await request.formData(); const token = form.get("token");
  if (typeof token !== "string") return redirectToContribution(request, true);
  const result = await redeem(token);
  if (!result.ok) return redirectToContribution(request, true);
  const response = redirectToContribution(request);
  const maxAge = Math.max(1, Math.floor((new Date(result.data.sessionExpiresAt).getTime() - Date.now()) / 1000));
  response.headers.set("Set-Cookie", `research_guest_session=${result.data.sessionToken}; Path=/research/contribute; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
