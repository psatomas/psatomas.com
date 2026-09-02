import { redirect } from "next/navigation";
import { getAuthorizationResult } from "@/lib/auth/authorization";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";

/**
 * The single server-side gate for the entire /research/write subtree —
 * the list, the new-article form, and every edit page all render as
 * `children` of this layout, so there is exactly one place that decides
 * whether any of it is reachable. Nothing under this route relies on a
 * link being hidden in the UI; an unauthenticated or unauthorized request
 * is stopped here regardless of how it arrived.
 *
 * Every mutating Server Action under this route (see actions.ts) also
 * calls the same getAuthorizationResult() check independently through
 * authoring-service.ts — this layout is what keeps an unauthorized visitor
 * from ever seeing the editor UI at all, not what makes the mutations
 * themselves safe. Belt and suspenders, not redundancy: a Server Action
 * is reachable directly (it's just an HTTP endpoint under the hood), so it
 * has to re-check regardless of whether this layout ran.
 */
export default async function ResearchWriteLayout({ children }: LayoutProps<"/research/write">) {
  const result = await getAuthorizationResult();

  if (!result.authenticated) {
    redirect("/api/auth/signin?callbackUrl=/research/write");
  }

  if (!result.authorized) {
    return (
      <Container as="main" className="flex flex-1 flex-col gap-4 py-16">
        <MonoLabel className="text-dim">RESEARCH / WRITE</MonoLabel>
        <h1 className="text-2xl font-semibold text-foreground">Forbidden</h1>
        <p className="max-w-xl text-muted">
          {result.email ?? "This account"} is signed in, but isn&apos;t the configured Research
          author. Research authoring is restricted to a single account.
        </p>
      </Container>
    );
  }

  return <>{children}</>;
}
