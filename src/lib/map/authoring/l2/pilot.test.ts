import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import { pilotSlice } from "./campaign.ts";

test("the pilot is the five ownership groups and 22 concepts the L2 analysis chose", () => {
  const { groups } = JSON.parse(readFileSync(new URL("./pilot.json", import.meta.url), "utf8")) as { groups: string[] };
  const slice = pilotSlice(mapKnowledge, groups);
  assert.equal(slice.groups.length, 5);
  assert.equal(slice.groups.flatMap((group) => group.concepts).length, 22);
  assert.deepEqual(slice.groups.map((group) => group.concepts.length), [5, 5, 6, 3, 3]);
});
