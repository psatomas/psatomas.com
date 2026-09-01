#!/usr/bin/env node
/**
 * Derives D1 seed SQL from the existing .mdx source files under
 * src/content/research/ — it does not hand-copy article content into
 * SQL. The three files stay the source of truth; this script is
 * re-runnable any time they change.
 *
 * Uses @mdx-js/mdx's evaluate() to get each file's real `metadata`
 * export, exactly the way the app itself would. That's safe here
 * specifically because this script runs in plain Node (`node
 * scripts/migrate-research-to-d1.mjs`), not inside a Cloudflare Worker —
 * evaluate() relies on dynamic code generation (new Function/eval),
 * which Node has no restriction on. The equivalent call inside a
 * deployed Worker throws `EvalError: Code generation from strings
 * disallowed for this context` (confirmed directly against real
 * workerd) — which is exactly why the *runtime* rendering path
 * (src/lib/research/markdown-content.tsx) uses react-markdown instead.
 * This script and that module solve two different problems and
 * deliberately don't share a mechanism.
 *
 * Output: a generated SQL file (scripts/.generated/seed-articles.sql,
 * gitignored — it's derived, not source) with one INSERT per article.
 * Apply it with:
 *   npx wrangler d1 execute RESEARCH_DB --local --file=scripts/.generated/seed-articles.sql
 * (swap --local for --remote once a real production database exists).
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, "..", "src", "content", "research");
const OUTPUT_DIR = path.join(__dirname, ".generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "seed-articles.sql");

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return sqlString(value);
}

/** Everything in the file after the `export const metadata = {...};`
 * block — the actual Markdown/MDX prose, which is what gets stored as
 * `content`. The three real files all follow this exact shape. */
function extractBody(raw) {
  const match = raw.match(/^export const metadata\s*=\s*\{[\s\S]*?\n\};\n\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Could not find the metadata block boundary — file doesn't match the expected shape");
  }
  return match[1];
}

async function main() {
  const files = (await readdir(CONTENT_DIR)).filter((file) => file.endsWith(".mdx"));
  if (files.length === 0) {
    throw new Error(`No .mdx files found in ${CONTENT_DIR}`);
  }

  const statements = [];
  for (const file of files) {
    const raw = await readFile(path.join(CONTENT_DIR, file), "utf8");
    const { metadata } = await evaluate(raw, { ...runtime });
    const content = extractBody(raw);
    const now = new Date().toISOString();

    const id = crypto.randomUUID();
    const columns = [
      "id", "slug", "title", "description", "category", "tags",
      "content", "reading_minutes", "status", "published_at",
      "created_at", "updated_at",
    ];
    const values = [
      id,
      metadata.slug,
      metadata.title,
      metadata.description,
      metadata.category,
      JSON.stringify(metadata.tags),
      content,
      metadata.readingMinutes,
      "published",
      metadata.date, // the file's own publish date, preserved exactly
      now,
      now,
    ].map(sqlValue);

    statements.push(
      `INSERT INTO articles (${columns.join(", ")}) VALUES (${values.join(", ")});`,
    );
    console.log(`Derived: ${metadata.slug} (${metadata.title})`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, statements.join("\n") + "\n", "utf8");

  console.log(`\nWrote ${statements.length} INSERT statement(s) to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log("\nApply locally with:");
  console.log(`  npx wrangler d1 execute RESEARCH_DB --local --file=${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

await main();
