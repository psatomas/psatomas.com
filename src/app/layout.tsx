import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Container } from "@/components/ui/container";
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
  title: "Tomás Araújo — Protocol Engineer",
  description: "Personal website, technical portfolio, and blog.",
};

const socialLinks = [
  { label: "GitHub", href: "https://github.com/psatomas" },
  { label: "LinkedIn", href: "https://linkedin.com/in/psatomas" },
  { label: "X", href: "https://x.com/psatomas" },
  { label: "Email", href: "mailto:psatomas@gmail.com" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border">
          <Container className="flex items-center justify-between py-4">
            <Link
              href="/"
              className="font-semibold tracking-tight hover:text-accent transition-colors"
            >
              psatomas
            </Link>
            <nav>
              <Link
                href="/projects"
                className="text-sm text-muted hover:text-accent transition-colors"
              >
                Projects
              </Link>
            </nav>
          </Container>
        </header>

        {children}

        <footer className="border-t border-border">
          <Container className="flex flex-col items-center gap-3 py-8 text-sm text-muted sm:flex-row sm:justify-between">
            <p>&copy; {new Date().getFullYear()} Tomás Araújo</p>
            <nav className="flex gap-4">
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
          </Container>
        </footer>
      </body>
    </html>
  );
}
