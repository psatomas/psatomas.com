import Link from "next/link";

// Primary IA: About (who I am) / Systems (what I build) / Research (how I
// think) / Lab (what I explore). GitHub deliberately isn't here — it's
// external professional proof, not one of the site's own sections, and it
// already has an equal-weight home in the footer alongside LinkedIn, X,
// and email (see src/app/layout.tsx). Never add a sign-in/write/author/CMS
// link here — /research/write is intentionally reachable only by typing
// its URL, not by navigation.
const navItems: Array<{ label: string; href: string }> = [
  { label: "ABOUT", href: "/about" },
  { label: "SYSTEMS", href: "/systems" },
  { label: "RESEARCH", href: "/research" },
  { label: "LAB", href: "/lab" },
];

export function Nav() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.14em] text-foreground hover:text-accent transition-colors"
        >
          TOMÁS ARAÚJO
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-8">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="font-mono text-xs tracking-[0.14em] text-muted hover:text-accent transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
