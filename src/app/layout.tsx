import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/navigation/nav";
import { siteConfig } from "@/lib/site";
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

const socialLinks = [
  { label: "GITHUB", href: "https://github.com/psatomas" },
  { label: "LINKEDIN", href: "https://linkedin.com/in/psatomas" },
  { label: "X", href: "https://x.com/psatomas" },
  { label: "EMAIL", href: "mailto:psatomas@gmail.com" },
];

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
            <p>© {new Date().getFullYear()} TOMÁS ARAÚJO</p>
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
