import Image from "next/image";
import Link from "next/link";
import psatMark from "@/assets/psat-mark-navbar.png";
import psatomasWordmark from "@/assets/psatomas-wordmark-navbar.png";

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
        {/* Site identity: the single canonical PSAT mark + PSATomas
            wordmark as one brand unit inside a single link to "/". The
            mark (src/assets/psat-mark-navbar.png, a transparent
            derivative of the canonical src/assets/psat-mark.png) replaced
            the earlier separate symbol/combined-mark identities — there's
            now just one graphical mark, used everywhere a graphical mark
            is needed (navbar, favicon/icons, footer), each via its own
            sized derivative. The wordmark still carries the actual name
            and stays primary. Sized at 22px, just under the wordmark's
            24px: this redesigned mark has finer nested-line detail than
            either retired asset, so it needs to sit closer to the
            wordmark's own height to stay legible, while still landing a
            hair under it by optical judgment rather than a matched
            number. Both images sit in the same link (not separate links)
            and only the wordmark carries alt text — the mark is alt="" so
            the link's accessible name is "PSATomas — Home" once, not
            announced twice. "Tomás Araújo" the person still anchors the
            homepage hero and About page. */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Image src={psatMark} alt="" priority className="h-[22px] w-auto" />
          <Image
            src={psatomasWordmark}
            alt="PSATomas — Home"
            priority
            className="h-6 w-auto"
          />
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
