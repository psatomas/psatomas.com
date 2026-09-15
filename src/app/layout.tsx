import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/navigation/nav";
import { siteConfig, socialLinks } from "@/lib/site";
import psatMark from "@/assets/psat-mark-footer.png";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />

        {children}

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-8 font-mono text-xs tracking-[0.08em] text-dim sm:flex-row sm:justify-between">
            {/* The one other PSAT touchpoint besides the navbar unit — the
                single canonical mark (src/assets/psat-mark-footer.png, a
                transparent derivative of src/assets/psat-mark.png, which
                replaced the retired separate symbol/combined-mark
                identities), sized to actually read as a mark rather than
                a decorative icon (h-4 was illegible at this level of
                detail; h-9 was re-verified against the new mark's own
                geometry — its nested-line detail is clean and legible at
                this size), dimmed just enough to stay secondary to the
                copyright/links it sits beside. Decorative only (empty
                alt); the copyright text next to it isn't a link. */}
            <div className="flex items-center gap-3">
              <Image src={psatMark} alt="" className="h-9 w-auto opacity-75" />
              <p>© {new Date().getFullYear()} TOMÁS ARAÚJO</p>
            </div>
            <nav className="flex gap-6">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="hover:text-accent transition-colors"
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    link.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
