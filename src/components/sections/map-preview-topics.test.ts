import assert from "node:assert/strict";
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
