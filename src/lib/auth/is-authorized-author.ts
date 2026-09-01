/**
 * The one comparison the entire authorization boundary reduces to.
 * Deliberately dependency-free and synchronous — no next-auth import, no
 * Cloudflare context lookup — so this is directly unit-testable under
 * Node's plain test runner with no OAuth or async env-resolution
 * involved. `configuredEmail` is passed in rather than read from
 * `process.env` internally for exactly that reason: reading it here
 * would require the async, Cloudflare-context-aware lookup this
 * project's actual runtime needs (see ./env.ts), which would make this
 * function neither pure nor synchronous. The caller resolves the
 * configured email once and passes it in.
 */
export function isAuthorizedAuthor(
  email: string | null | undefined,
  configuredEmail: string | null | undefined,
  emailVerified?: boolean,
): boolean {
  // Fail closed: an unset configured author email is a configuration
  // error, not "anyone is the author." Nobody is authorized until this
  // is explicitly set server-side.
  if (!configuredEmail) return false;
  if (!email) return false;

  // Google's OIDC profile exposes email_verified; when that signal is
  // present and false, never authorize on it — an authorization check
  // shouldn't trust an email Google itself hasn't confirmed. Only an
  // explicit `false` fails the check; a genuinely absent signal
  // (`undefined`) doesn't, since Google's own callback always provides
  // this for a real sign-in and there's nothing more specific to
  // distrust in that case.
  if (emailVerified === false) return false;

  return email.trim().toLowerCase() === configuredEmail.trim().toLowerCase();
}
