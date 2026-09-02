import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";

/**
 * The recurring header for each of the homepage's four domain previews
 * (About/Systems/Research/Lab) — a role eyebrow ("WHAT I BUILD") plus a
 * heading, the same voice already established on /about's own section
 * list. Shared because the four previews should read as one composition
 * with consistent rhythm, not four differently-styled blocks; their
 * *bodies* are otherwise completely different (a static paragraph, a
 * system list, an article list, an experiment list), which is what keeps
 * them from feeling like identical cards.
 */
export function SectionIntro({
  id,
  role,
  heading,
  description,
}: {
  id: string;
  role: string;
  heading: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <MonoLabel>{role}</MonoLabel>
      <h2 id={id} className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {heading}
      </h2>
      {description && <p className="max-w-xl text-muted">{description}</p>}
    </div>
  );
}

/** The "→ /path" pattern closing each preview, pointing at that domain's
 * full section. One shared style so all four read as the same gesture. */
export function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-2 font-mono text-xs tracking-[0.1em] text-foreground transition-colors hover:text-accent"
    >
      {children}
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </Link>
  );
}
