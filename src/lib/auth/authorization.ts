import { getServerSession } from "next-auth";
import { getAuthOptions } from "./config.ts";
import { getAuthEnv } from "./env.ts";
import { isAuthorizedAuthor } from "./is-authorized-author.ts";

export { isAuthorizedAuthor } from "./is-authorized-author.ts";

/**
 * Authentication answers "who is this?" (see ./config.ts). This answers
 * a completely separate question: is that identity the one person
 * allowed to author Research content? A successfully authenticated
 * Google account is not automatically authorized — this is the boundary
 * where that distinction is actually enforced.
 *
 * Deliberately not coupled to ResearchAuthoringRepository, D1, or
 * anything under src/lib/research/ — this module has no import from
 * there, and no future authoring route/action should need to route its
 * authorization check through the repository. The dependency direction
 * is one-way: Research authoring code will depend on this, never the
 * reverse.
 */
export type AuthorizationResult =
  | { authenticated: false; authorized: false }
  | { authenticated: true; authorized: false; email: string | null | undefined }
  | { authenticated: true; authorized: true; email: string };

/**
 * The single entry point any future Research authoring route or Server
 * Action should call. Runs entirely server-side via next-auth's own
 * getServerSession — never trusts anything the client claims about who
 * is asking.
 */
export async function getAuthorizationResult(): Promise<AuthorizationResult> {
  const options = await getAuthOptions();
  const session = await getServerSession(options);
  if (!session?.user) return { authenticated: false, authorized: false };

  const email = session.user.email;
  const { authorEmail } = await getAuthEnv();

  if (isAuthorizedAuthor(email, authorEmail, session.emailVerified)) {
    return { authenticated: true, authorized: true, email: email as string };
  }
  return { authenticated: true, authorized: false, email };
}
