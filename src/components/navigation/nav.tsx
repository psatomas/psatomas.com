"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Primary IA: Home / About (who I am) / MAP (the knowledge environment) /
// Research (how I think) / Lab (what I explore) / Systems (what I build).
// GitHub deliberately isn't here — it's external professional proof, not one
// of the site's own sections, and it already has an equal-weight home in the
// footer alongside LinkedIn, X, and email (see src/app/layout.tsx). Never add
// a sign-in/write/author/CMS link here — /research/write is intentionally
// reachable only by typing its URL, not by navigation.
const navItems: Array<{ label: string; href: string }> = [
  { label: "HOME", href: "/" },
  { label: "ABOUT", href: "/about" },
  { label: "MAP", href: "/map" },
  { label: "RESEARCH", href: "/research" },
  { label: "LAB", href: "/lab" },
  { label: "SYSTEMS", href: "/systems" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    // sticky (not fixed): the header stays in normal document flow —
    // it keeps occupying its own space at the top of the flex-col body
    // (see layout.tsx), so nothing needs compensating top padding — and
    // only pins to the viewport once scrolling would otherwise carry it
    // past y=0. z-10 is deliberately small: nothing else on the site
    // uses z-index or creates a positioned/stacking-context element at
    // the page level, so this only needs to be a genuine, explicit
    // "above normal document flow" layer, not a value competing with
    // some other overlay system. bg-background (not bg-surface): the
    // header was transparent before, which was invisible as long as it
    // never overlapped scrolling content; sticky now puts page content
    // directly behind it, so it needs an opaque backdrop to stay
    // readable — the plain page-background token is the correct one
    // semantically (this is navigation chrome, not an identity/context
    // surface) and visually (identical color to the page itself, so
    // there's no visible seam at scroll position 0).
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl px-6 py-5">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:ml-auto sm:gap-8">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              aria-label={item.href === "/" ? "Home" : undefined}
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
