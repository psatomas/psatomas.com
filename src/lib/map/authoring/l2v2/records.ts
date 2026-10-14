/**
 * MAP L2 v2: drafted records as pure data (docs/map-authoring/l2-pipeline-v2.md).
 *
 * No session writes TypeScript. A draft is a JSON staging file, validated here
 * against the record contract: exact fields, plain strings, and the block
 * shapes of validation.ts. Only the driver serializes it into data.ts and the
 * registry, every value as a JSON string literal under a fixed key, so nothing
 * a session writes can become an expression. Records are validated again
 * whenever they are rendered or compared, including those read back from batch
 * state, and the rendered source is checked as text before any tool imports
 * it. Repairs patch these values, never the source. Development tooling only.
 */
import type { MapConceptContent, MapContentBlock } from "../../types.ts";
import { contentBlockProblems, textProblems } from "../../validation.ts";
import { recordSpans, withoutRecords } from "../l2/campaign.ts";
import { contentFingerprint } from "../representation/design.ts";

/** A record as a draft stages it: `id` is derived, and nothing else is allowed. */
export type StagedRecord = { conceptId: string; definition: string; body: MapContentBlock[] };
export type StagedRecords = { run: string; records: StagedRecord[] };

type FieldType = "text" | "texts" | "stages" | "pairs" | "alternatives" | "transitions";
/** Each block kind's fields, in the order data.ts writes them (after `kind`); a trailing "?" marks an optional one. */
const BLOCK_FIELDS: Record<MapContentBlock["kind"], Record<string, FieldType | `${FieldType}?`>> = {
  paragraph: { text: "text" },
  heading: { text: "text" },
  flow: { label: "text", stages: "stages" },
  distinction: { left: "text", right: "text", further: "texts?" },
  tensions: { label: "text", pairs: "pairs" },
  terms: { terms: "texts" },
  cycle: { label: "text", steps: "texts" },
  comparison: { label: "text", dimensions: "texts", alternatives: "alternatives" },
  state: { label: "text", states: "texts", transitions: "transitions" },
};
const RECORD_FIELDS = ["conceptId", "definition", "body"];
/** A concept id, as validation.ts requires it. */
export const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Every key a rendered record may contain: the record's own and its blocks' (types.ts). */
const KEYS: ReadonlySet<string> = new Set(["id", "conceptId", "definition", "body", "kind", "name", "values", "from", "to", "when", ...Object.values(BLOCK_FIELDS).flatMap((fields) => Object.keys(fields))]);

// ---------------------------------------------------------------- validation

/** Only what JSON.parse makes of an object literal: no arrays, no prototypes, no class instances. */
const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
/** Characters a plain-text record never needs: controls, line separators and unpaired surrogates. */
const UNSUPPORTED = /[\u0000-\u001f\u007f\u2028\u2029]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

function keyProblems(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], where: string): string[] {
  const problems = Object.keys(value).filter((key) => !required.includes(key) && !optional.includes(key)).map((key) => `${where}: unexpected field ${JSON.stringify(key)}`);
  for (const key of required) if (!(key in value)) problems.push(`${where}: missing field "${key}"`);
  return problems;
}
function textValueProblems(value: unknown, where: string): string[] {
  if (typeof value !== "string") return [`${where} must be a string`];
  return [...(UNSUPPORTED.test(value) ? [`${where} contains a control or unpaired character`] : []), ...textProblems(value).map((problem) => `${where} ${problem}`)];
}
const textsProblems = (value: unknown, where: string): string[] => (Array.isArray(value) ? value.flatMap((item, index) => textValueProblems(item, `${where}[${index}]`)) : [`${where} must be an array of strings`]);

function fieldProblems(type: FieldType, value: unknown, where: string): string[] {
  switch (type) {
    case "text":
      return textValueProblems(value, where);
    case "texts":
      return textsProblems(value, where);
    case "stages":
      if (!Array.isArray(value)) return [`${where} must be an array of stages`];
      return value.flatMap((stage, index) =>
        Array.isArray(stage) ? stage.flatMap((element, at) => (Array.isArray(element) ? textsProblems(element, `${where}[${index}][${at}]`) : textValueProblems(element, `${where}[${index}][${at}]`))) : [`${where}[${index}] must be an array`],
      );
    case "pairs":
      if (!Array.isArray(value)) return [`${where} must be an array of pairs`];
      return value.flatMap((pair, index) => (Array.isArray(pair) && pair.length === 2 ? textsProblems(pair, `${where}[${index}]`) : [`${where}[${index}] must be a pair of strings`]));
    case "alternatives":
      if (!Array.isArray(value)) return [`${where} must be an array of {name, values}`];
      return value.flatMap((item, index) =>
        isPlain(item) ? [...keyProblems(item, ["name", "values"], [], `${where}[${index}]`), ...textValueProblems(item.name, `${where}[${index}].name`), ...textsProblems(item.values, `${where}[${index}].values`)] : [`${where}[${index}] must be {name, values}`],
      );
    case "transitions":
      if (!Array.isArray(value)) return [`${where} must be an array of {from, to, when}`];
      return value.flatMap((item, index) =>
        isPlain(item) ? [...keyProblems(item, ["from", "to", "when"], [], `${where}[${index}]`), ...(["from", "to", "when"] as const).flatMap((key) => textValueProblems(item[key], `${where}[${index}].${key}`))] : [`${where}[${index}] must be {from, to, when}`],
      );
  }
}

function blockProblems(block: unknown, where: string): string[] {
  if (!isPlain(block)) return [`${where} must be an object`];
  if (typeof block.kind !== "string") return [`${where}: kind must be a string`];
  const fields = Object.hasOwn(BLOCK_FIELDS, block.kind) ? BLOCK_FIELDS[block.kind as MapContentBlock["kind"]] : undefined;
  if (!fields) return [`${where}: unknown block kind ${JSON.stringify(block.kind)}`];
  const entries = Object.entries(fields).map(([key, type]) => ({ key, type: type.replace("?", "") as FieldType, optional: type.endsWith("?") }));
  const problems = keyProblems(block, ["kind", ...entries.filter((e) => !e.optional).map((e) => e.key)], entries.filter((e) => e.optional).map((e) => e.key), where);
  for (const { key, type } of entries) if (key in block) problems.push(...fieldProblems(type, block[key], `${where}.${key}`));
  // The shape rules of every block (validation.ts) apply once its values are plain data.
  return problems.length ? problems : contentBlockProblems(block as MapContentBlock).map((problem) => `${where} (${block.kind}) ${problem}`);
}

/** Problems with one staged record; [] when it is plain data within the record contract. */
export function recordProblems(record: unknown, where: string): string[] {
  if (!isPlain(record)) return [`${where} must be an object`];
  const problems = keyProblems(record, RECORD_FIELDS, [], where);
  if (typeof record.conceptId !== "string" || !IDENTIFIER.test(record.conceptId)) problems.push(`${where}: conceptId must be a concept identifier`);
  problems.push(...textValueProblems(record.definition, `${where}.definition`));
  if (typeof record.definition === "string" && !record.definition.trim()) problems.push(`${where}.definition is empty`);
  if (!Array.isArray(record.body)) problems.push(`${where}.body must be an array of blocks`);
  else record.body.forEach((block, index) => problems.push(...blockProblems(block, `${where}.body[${index}]`)));
  return problems;
}

/**
 * Problems with a draft's staging file for these concepts; [] when it holds
 * exactly one valid record per concept, stamped with this session's token,
 * and nothing that looks like a secret.
 */
export function stagedRecordsProblems(value: unknown, concepts: readonly string[], run: string, secrets: readonly string[]): string[] {
  if (!isPlain(value)) return ["the staging file must be a JSON object {run, records}"];
  const problems = keyProblems(value, ["run", "records"], [], "the staging file");
  if (value.run !== run) problems.push(`run must be "${run}" (this session's token); a stale or foreign file is never used`);
  if (!Array.isArray(value.records)) return [...problems, "records must be an array"];
  const ids = value.records.map((record) => (isPlain(record) ? record.conceptId : undefined));
  value.records.forEach((record, index) => {
    const where = `record ${index}${typeof ids[index] === "string" ? ` (${ids[index]})` : ""}`;
    if (!concepts.includes(ids[index] as string)) problems.push(`${where}: conceptId must be one of ${concepts.join(", ")}`);
    problems.push(...recordProblems(record, where));
  });
  for (const id of concepts) if (ids.filter((entry) => entry === id).length !== 1) problems.push(`${id}: exactly one record is required`);
  if (!problems.length) problems.push(...value.records.flatMap((record) => secretProblems(recordStrings(record as StagedRecord), secrets).map((problem) => `${(record as StagedRecord).conceptId}: ${problem}`)));
  return problems;
}

// ---------------------------------------------------------------- secrets

const SECRET_PATTERNS: readonly [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "an API key"],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/, "a GitHub token"],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, "an AWS access key"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/\bAIza[0-9A-Za-z_-]{35}/, "a Google API key"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, "a JSON web token"],
  [/\b[0-9a-f]{40,}\b/i, "a long hexadecimal string"],
];
/**
 * What in these texts looks like a credential, or holds the value of a local
 * secret; [] when nothing does. Messages never repeat what matched.
 */
export function secretProblems(texts: readonly string[], secrets: readonly string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const [pattern, what] of SECRET_PATTERNS) if (pattern.test(text)) found.add(`contains what looks like ${what}`);
    if (secrets.some((secret) => secret.length >= 8 && text.includes(secret))) found.add("contains the value of a local secret (.dev.vars or .env)");
  }
  return [...found];
}

// ---------------------------------------------------------------- canonical form and rendering

/** Every content string of a record, in order (never its conceptId or block kinds). */
export function recordStrings(record: StagedRecord): string[] {
  const out: string[] = [];
  mapStrings(record, (text) => (out.push(text), text));
  return out;
}
function mapStrings<T>(value: T, fn: (text: string) => string): T {
  const visit = (node: unknown): unknown => {
    if (typeof node === "string") return fn(node);
    if (Array.isArray(node)) return node.map(visit);
    if (isPlain(node)) return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, key === "kind" || key === "conceptId" ? child : visit(child)]));
    return node;
  };
  return visit(value) as T;
}

const canonicalField = (type: FieldType, value: unknown): unknown => {
  switch (type) {
    case "alternatives":
      return (value as { name: string; values: string[] }[]).map(({ name, values }) => ({ name, values: [...values] }));
    case "transitions":
      return (value as { from: string; to: string; when: string }[]).map(({ from, to, when }) => ({ from, to, when }));
    default:
      return JSON.parse(JSON.stringify(value));
  }
};
/** The content record a validated draft becomes, its keys in the order data.ts writes them. Refuses an invalid record. */
export function toContent(record: StagedRecord): MapConceptContent {
  const problems = recordProblems(record, "the record");
  if (problems.length) throw new Error(`refusing to render an invalid record: ${problems.slice(0, 3).join("; ")}`);
  const body = record.body.map((block) => {
    const out: Record<string, unknown> = { kind: block.kind };
    for (const [key, type] of Object.entries(BLOCK_FIELDS[block.kind])) {
      const value = (block as Record<string, unknown>)[key];
      if (value !== undefined) out[key] = canonicalField(type.replace("?", "") as FieldType, value);
    }
    return out as MapContentBlock;
  });
  return { id: `${record.conceptId}-content`, conceptId: record.conceptId, definition: record.definition, body };
}
/** The fingerprint v1 gives the record once data.ts holds it (contentFingerprint), computed without importing anything. */
export const recordFingerprint = (record: StagedRecord) => contentFingerprint(toContent(record));

const WIDTH = 160;
/** A value as a literal on one line: strings as JSON string literals, keys as the fixed identifiers of the contract. */
const key = (name: string) => {
  if (!KEYS.has(name)) throw new Error(`refusing to render the key ${JSON.stringify(name)}`);
  return name;
};
const inline = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
  if (!isPlain(value)) throw new Error(`refusing to render a ${typeof value} value`);
  return `{ ${Object.entries(value).map(([name, child]) => `${key(name)}: ${inline(child)}`).join(", ")} }`;
};
/** A value at `indent` after `head` (its key), on one line when it fits, else one item per line. */
function layout(value: unknown, indent: number, head = ""): string[] {
  const pad = " ".repeat(indent);
  const line = `${pad}${head}${inline(value)},`;
  if (typeof value === "string" || line.length <= WIDTH) return [line];
  if (Array.isArray(value)) return [`${pad}${head}[`, ...value.flatMap((item) => layout(item, indent + 2)), `${pad}],`];
  return [`${pad}${head}{`, ...Object.entries(value as object).flatMap(([name, child]) => layout(child, indent + 2, `${key(name)}: `)), `${pad}},`];
}
/** A content record as data.ts writes it (4-space record indentation, double quotes, trailing commas). */
export function renderRecord(content: MapConceptContent): string {
  if (!IDENTIFIER.test(content.conceptId) || content.id !== `${content.conceptId}-content`) throw new Error(`refusing to render the record id ${JSON.stringify(content.id)}`);
  const block = (b: MapContentBlock) => (b.kind === "paragraph" ? ["        {", ...Object.entries(b).flatMap(([name, child]) => layout(child, 10, `${key(name)}: `)), "        },"] : layout(b, 8));
  return ["    {", `      id: ${JSON.stringify(content.id)},`, `      conceptId: ${JSON.stringify(content.conceptId)},`, "      definition:", `        ${JSON.stringify(content.definition)},`, "      body: [", ...(content.body ?? []).flatMap(block), "      ],", "    },"].join("\n");
}

/** data.ts with these records rendered: an existing record is replaced in place, a new one appended to mapKnowledge.content. */
export function withRecords(source: string, contents: readonly MapConceptContent[]): string {
  let text = source;
  for (const content of contents) {
    const lines = text.split("\n");
    const rendered = renderRecord(content).split("\n");
    const span = recordSpans(text).get(content.conceptId);
    if (span) text = [...lines.slice(0, span.start), ...rendered, ...lines.slice(span.end + 1)].join("\n");
    else {
      const end = lines.findIndex((line, index) => line === "  ]," && lines[index + 1] === "  mechanisms: [");
      if (end < 0) throw new Error("data.ts has no end of mapKnowledge.content (the line `  ],` before `  mechanisms: [`)");
      text = [...lines.slice(0, end), ...rendered, ...lines.slice(end)].join("\n");
    }
  }
  return text;
}
/** The registry with these concepts appended to AUTHORED_CONTENT_CONCEPTS (each once). */
export function withRegistry(source: string, ids: readonly string[]): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith("export const AUTHORED_CONTENT_CONCEPTS"));
  const end = lines.findIndex((line, index) => index > start && line === "];");
  if (start < 0 || end < 0) throw new Error("the registry has no AUTHORED_CONTENT_CONCEPTS array");
  const invalid = ids.filter((id) => !IDENTIFIER.test(id));
  if (invalid.length) throw new Error(`refusing to register ${invalid.map((id) => JSON.stringify(id)).join(", ")}: not concept identifiers`);
  const missing = ids.filter((id) => !lines.slice(start, end).includes(`  "${id}",`));
  return [...lines.slice(0, end), ...missing.map((id) => `  "${id}",`), ...lines.slice(end)].join("\n");
}

// ---------------------------------------------------------------- source checks (as text, before anything imports it)

const outside = (source: string, ids: readonly string[]) => {
  const present = ids.filter((id) => recordSpans(source).has(id));
  return present.length ? withoutRecords(source, present) : source;
};
const spanText = (source: string, id: string) => {
  const span = recordSpans(source).get(id);
  return span && source.split("\n").slice(span.start, span.end + 1).join("\n");
};

/** Where a validated record stands in data.ts: rendered exactly, absent, different, or not a valid record at all. */
export function recordPlacement(data: string, record: unknown): "in-place" | "missing" | "changed" | "invalid" {
  if (recordProblems(record, "the record").length) return "invalid";
  const span = spanText(data, (record as StagedRecord).conceptId);
  return span === undefined ? "missing" : span === renderRecord(toContent(record as StagedRecord)) ? "in-place" : "changed";
}

/**
 * Why data.ts and the registry do not hold exactly the driver's rendering of
 * these records; [] when they do. A record that is no longer valid (batch
 * state edited by hand) is reported, never rendered.
 */
export function recordsInPlaceProblems(data: string, registry: string, records: readonly unknown[]): string[] {
  const problems: string[] = [];
  for (const [index, entry] of records.entries()) {
    const invalid = recordProblems(entry, `persisted record ${index}`);
    if (invalid.length) {
      problems.push(`a persisted record is not valid (never rendered): ${invalid.slice(0, 3).join("; ")}`);
      continue;
    }
    const record = entry as StagedRecord;
    const content = toContent(record);
    if (spanText(data, record.conceptId) !== renderRecord(content)) problems.push(`${record.conceptId}: data.ts does not hold the driver's rendering of its validated record`);
    if (data.split(`id: "${content.id}",`).length !== 2) problems.push(`${record.conceptId}: not exactly one record in data.ts`);
    if (registry.split("\n").filter((line) => line === `  "${record.conceptId}",`).length !== 1) problems.push(`${record.conceptId}: not registered exactly once`);
  }
  return problems;
}

/** Why a rendering changed more than these records (data.ts) and their entries (registry) since `was`; [] when it did not. */
export function renderedProblems(data: { was: string; is: string }, registry: { was: string; is: string }, records: readonly StagedRecord[]): string[] {
  const ids = records.map((record) => record.conceptId);
  const entries = new Set(ids.map((id) => `  "${id}",`));
  const strip = (text: string) => text.split("\n").filter((line) => !entries.has(line)).join("\n");
  return [
    ...(outside(data.is, ids) === outside(data.was, ids) ? [] : ["data.ts changed outside the batch's records"]),
    ...(strip(registry.is) === strip(registry.was) ? [] : ["the registry changed outside the batch's entries"]),
    ...recordsInPlaceProblems(data.is, registry.is, records),
  ];
}

// ---------------------------------------------------------------- exact repairs on values

/**
 * A record with `quote` replaced in its content strings. The quote must occur
 * exactly once across them (never in its id, conceptId or block kinds), and
 * the repaired record must still be valid and free of secrets.
 */
export function replaceOnce(record: StagedRecord, quote: string, replacement: string, secrets: readonly string[]): { record?: StagedRecord; problem?: string } {
  if (!quote) return { problem: "the quote is empty" };
  const count = recordStrings(record).reduce((sum, text) => sum + text.split(quote).length - 1, 0);
  if (count !== 1) return { problem: count === 0 ? "quote not found in the record" : `quote occurs ${count} times in the record` };
  const patched = mapStrings(record, (text) => (text.includes(quote) ? text.replace(quote, () => replacement) : text));
  const problems = [...recordProblems(patched, "the repaired record"), ...secretProblems(recordStrings(patched), secrets)];
  return problems.length ? { problem: `the repair would leave the record invalid: ${problems.slice(0, 3).join("; ")}` } : { record: patched };
}
