import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMapResolver, mapKnowledge } from "../../lib/map/index.ts";
import { getMapContextHref } from "../map/explorer-model.ts";
import { MAP_PREVIEW_TOPICS } from "./map-preview-topics.ts";

test("homepage MAP preview presents exactly the 27 L0 domains in order", () => {
  assert.deepEqual(MAP_PREVIEW_TOPICS.map((topic) => topic.label), [
    "Foundations",
    "Computation & Execution",
    "State & Data",
    "Consensus & Ordering",
    "Networks & Infrastructure",
    "Cryptography & Proofs",
    "Storage & Availability",
    "Identity, Accounts & Authority",
    "Oracles & External Reality",
    "Economics & Mechanism Design",
    "Markets & Financial Protocols",
    "MEV & Execution Markets",
    "Intents & Coordination",
    "Governance & Institutions",
    "Scaling & Modular Systems",
    "Interoperability & Abstraction",
    "Security, Correctness & Resilience",
    "Protocol Architecture",
    "Protocol Design & Lifecycle",
    "AI & Intelligent Systems",
    "Machine Economy",
    "Autonomous Coordination",
    "Autonomous Execution",
    "Autonomous Organizations",
    "Autonomous Protocols",
    "Autonomous Economy",
    "Frontier Systems",
  ]);
});

test("homepage L0 domains agree with the MAP specification", () => {
  const spec = readFileSync(new URL("../../../docs/map-spec.md", import.meta.url), "utf8");
  const scope = spec.slice(spec.indexOf("## 5. Long-term knowledge scope"), spec.indexOf("## 6."));
  const specDomains = [...scope.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]);

  assert.deepEqual(MAP_PREVIEW_TOPICS.map((topic) => topic.label), specDomains);
});

test("homepage L0 domains agree with the MAP root taxonomy", () => {
  const resolver = createMapResolver(mapKnowledge);
  const rootTitles = resolver.getRootPlacements().map((placement) => resolver.getConcept(placement.conceptId)?.title);

  assert.deepEqual(MAP_PREVIEW_TOPICS.map((topic) => topic.label), rootTitles);
});

test("any linked homepage MAP topic targets an existing placement", () => {
  const resolver = createMapResolver(mapKnowledge);
  for (const topic of MAP_PREVIEW_TOPICS) {
    if (topic.placementId) assert.ok(resolver.getPlacement(topic.placementId), `${topic.label} → ${topic.placementId}`);
  }
});

test("targeted entry links carry placement identity in the context parameter", () => {
  assert.equal(getMapContextHref("consensus"), "/map?context=consensus");
  assert.equal(getMapContextHref("a b&c"), "/map?context=a+b%26c");
});
