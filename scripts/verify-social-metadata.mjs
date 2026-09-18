// Read-only HTTP verification against a running Next or local Worker server.
// Usage: node scripts/verify-social-metadata.mjs http://localhost:8787 /tmp/social-images
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:8787';
const output = process.argv[3];
if (output) await mkdir(output, { recursive: true });
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function metadata(html) {
  const result = { title: decode(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '') };
  for (const tag of html.matchAll(/<(?:meta|link)\b[^>]*>/g)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
    const key = attrs.property ?? attrs.name ?? (attrs.rel === 'canonical' ? 'canonical' : undefined);
    if (key === 'article:tag') {
      (result[key] ??= []).push(attrs.content);
    } else if (key) {
      assert.equal(result[key], undefined, `duplicate metadata: ${key}`);
      result[key] = attrs.content ?? attrs.href;
    }
  }
  return result;
}
const index = await fetch(`${base}/research`).then((r) => r.text());
const articles = [...new Set([...index.matchAll(/href="(\/research\/[^"?#]+)"/g)].map((m) => m[1]))].filter((p) => !p.startsWith('/research/write'));
assert.ok(articles.length, 'Local Research must contain a published article');
const paths = ['/', '/about', '/systems', '/systems/exekpro', '/systems/stakeverse', '/systems/provenance-registry',
  '/research', ...articles, '/lab', '/lab/evm', '/lab/intent-mev', '/lab/oracle'];
const required = ['title', 'description', 'canonical', 'og:title', 'og:description', 'og:url', 'og:type', 'og:site_name',
  'og:image', 'og:image:width', 'og:image:height', 'og:image:type', 'og:image:alt',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt'];
const userAgents = ['Mozilla/5.0', 'Twitterbot/1.0', 'LinkedInBot/1.0'];
const rows = [];
for (const path of paths) {
  let browserMetadata;
  for (const ua of userAgents) {
    const response = await fetch(`${base}${path}`, { headers: { 'User-Agent': ua } });
    assert.equal(response.status, 200, `${path}: page status`);
    const tags = metadata(await response.text());
    for (const key of required) assert.ok(tags[key], `${path}: missing ${key} (${ua})`);
    assert.equal(new URL(tags.canonical).href, `https://psatomas.com${path}`);
    assert.equal(tags['og:url'], tags.canonical);
    assert.equal(tags['og:site_name'], 'Tomás Araújo');
    assert.equal(tags['og:description'], tags.description);
    assert.equal(tags['twitter:description'], tags.description);
    assert.equal(tags['twitter:title'], tags['og:title']);
    assert.equal(tags.title, path === '/' ? 'Tomás Araújo — Protocol Engineer' : `${tags['og:title']} — Tomás Araújo`);
    assert.equal(tags['og:type'], path.startsWith('/research/') ? 'article' : path === '/about' ? 'profile' : 'website');
    assert.equal(tags['twitter:card'], 'summary_large_image');
    assert.equal(tags['og:image:width'], '1200');
    assert.equal(tags['og:image:height'], '630');
    assert.equal(tags['og:image:type'], 'image/png');
    const expectedImage = `https://psatomas.com${path === '/' ? '/opengraph-image' : `/og${path}`}`;
    assert.equal(tags['og:image'].split('?')[0], expectedImage);
    assert.equal(tags['twitter:image'].split('?')[0], expectedImage);
    if (browserMetadata) assert.deepEqual(tags, browserMetadata, `${path}: crawler metadata differs`);
    else browserMetadata = tags;
  }
  const imageUrl = new URL(browserMetadata['og:image']);
  const imageResponse = await fetch(`${base}${imageUrl.pathname}${imageUrl.search}`);
  assert.equal(imageResponse.status, 200, `${path}: image status`);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');
  const png = Buffer.from(await imageResponse.arrayBuffer());
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length > 1000);
  const cache = imageResponse.headers.get('cache-control');
  if (path.startsWith('/research/')) assert.equal(cache, 'no-store');
  if (output) await writeFile(`${output}/${path === '/' ? 'home' : path.slice(1).replaceAll('/', '--')}.png`, png);
  rows.push({ path, ...browserMetadata, imageBytes: png.length, cache });
  console.log(`PASS ${path}: browser + crawler + PNG (${png.length} bytes; ${cache})`);
}
for (const path of ['/og/unknown', '/og/systems/unknown', '/og/research/unknown', '/og/lab/unknown',
  '/og/lab/evm/extra', '/og/systems?title=Injected', '/og/research/%3Cscript%3E', '/og/https%3A%2F%2Fevil.test']) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 404, `${path}: invalid image route`);
}
const missingRows = [];
for (const [path, title] of [
  ['/systems/social-audit-missing', 'System not found'],
  ['/lab/social-audit-missing', 'Lab experiment not found'],
  ['/research/social-audit-missing', 'Research article not found'],
]) {
  for (const ua of userAgents) {
    const response = await fetch(`${base}${path}`, { headers: { 'User-Agent': ua } });
    assert.equal(response.status, 404, `${path}: missing content (${ua})`);
    const tags = metadata(await response.text());
    assert.equal(tags['og:image'], undefined, `${path}: inherited OG image`);
    assert.equal(tags['twitter:image'], undefined, `${path}: inherited Twitter image`);
    assert.equal(tags.canonical, undefined, `${path}: nonexistent canonical`);
    assert.equal(tags['og:url'], undefined, `${path}: nonexistent OG URL`);
    assert.equal(tags.title, `${title} — Tomás Araújo`);
    assert.equal(tags['og:title'], title);
    assert.equal(tags['twitter:title'], title);
    assert.equal(tags.description, 'The requested content is not available.');
    assert.equal(tags['og:description'], tags.description);
    assert.equal(tags['twitter:description'], tags.description);
    assert.ok(tags.robots?.includes('noindex'));
    missingRows.push({ path, userAgent: ua, status: response.status, ...tags });
  }
  const imageResponse = await fetch(`${base}/og${path}`);
  assert.equal(imageResponse.status, 404, `${path}: missing direct OG endpoint`);
  console.log(`PASS ${path}: 404 without homepage identity, images or canonical (${userAgents.length} user agents); direct OG 404`);
}
if (output) await writeFile(`${output}/missing-metadata.json`, JSON.stringify(missingRows, null, 2));
if (output) await writeFile(`${output}/metadata.json`, JSON.stringify(rows, null, 2));
console.log(`Verified ${paths.length} pages, ${paths.length * userAgents.length} valid HTML responses, ${paths.length} PNGs, 9 missing-content HTML responses, and 11 rejected image requests.`);
