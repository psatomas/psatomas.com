// MAP browser regression: `npm run test:map:browser`.
//
//   --base-url=<url>   test a running server (default: `next start` on the existing build)
//   --only=<a,b>       run only the named sections
//   --verbose          print every passing check, not only failures
//
// Prerequisites on a fresh checkout: `npm ci`, `npm run db:migrate:local`,
// `npm run build`, and a browser (see launchBrowser in harness.mts).
import { coverageSections } from "./coverage.mts";
import { launchBrowser, startServer, type Section } from "./harness.mts";
import { interactionSections } from "./interaction.mts";

const sections: Section[] = [...interactionSections, ...coverageSections];
const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const verbose = process.argv.includes("--verbose");
const only = option("only")?.split(",");
const unknown = only?.filter((name) => !sections.some((section) => section.name === name)) ?? [];
if (unknown.length) {
  console.error(`Unknown section(s): ${unknown.join(", ")}. Sections: ${sections.map((section) => section.name).join(", ")}`);
  process.exit(2);
}

const server = (option("base-url") ?? process.env.MAP_BASE_URL) ? null : await startServer();
const base = (option("base-url") ?? process.env.MAP_BASE_URL ?? server!.base).replace(/\/$/, "");
const browser = await launchBrowser();
let checks = 0;
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) failures.push(message);
  if (!ok || verbose) console.log(`${ok ? "PASS" : "FAIL"}  ${message}`);
};

console.log(`MAP browser regression against ${base} in ${browser.browserType().name()} ${browser.version()}`);
try {
  for (const section of sections.filter((section) => !only || only.includes(section.name))) {
    const [before, failedBefore] = [checks, failures.length];
    await section.run({ browser, base, check });
    console.log(`${failures.length === failedBefore ? "ok  " : "FAIL"}  ${section.name}: ${section.title} (${checks - before} checks, ${failures.length - failedBefore} failures)`);
  }
} finally {
  await browser.close();
  server?.stop();
}
console.log(`\n${checks} checks, ${failures.length} failures`);
console.log(failures.length ? `${failures.length} FAILURE(S)` : "ALL CHECKS PASSED");
process.exit(failures.length ? 1 : 0);
