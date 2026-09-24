import assert from "node:assert/strict";
import test from "node:test";
import { createMapResolver, mapKnowledge } from "../../lib/map/index.ts";
import { getMapContextHref } from "../map/explorer-model.ts";
import { MAP_PREVIEW_TOPICS } from "./map-preview-topics.ts";

test("every linked homepage MAP topic targets an existing placement", () => {
  const resolver = createMapResolver(mapKnowledge);
  const linked = MAP_PREVIEW_TOPICS.filter((topic) => topic.placementId);

  assert.ok(linked.length > 0);
  for (const topic of linked) {
    assert.ok(resolver.getPlacement(topic.placementId!), `${topic.label} → ${topic.placementId}`);
  }
});

test("targeted entry links carry placement identity in the context parameter", () => {
  assert.equal(getMapContextHref("consensus"), "/map?context=consensus");
  assert.equal(getMapContextHref("a b&c"), "/map?context=a+b%26c");
});
