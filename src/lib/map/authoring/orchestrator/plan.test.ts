import assert from "node:assert/strict";
import test from "node:test";
import { mapKnowledge } from "../../data.ts";
import { AUTHORED_CONTENT_CONCEPTS } from "../content-registry.ts";
import { MapAuthoringContextError } from "../context.ts";
import { orchestratorModel, registryOf } from "./fixtures.ts";
import { listDomains, nextIncompleteDomain, planDomain, renderExpectations, renderSample } from "./plan.ts";

const plan = (domainId: string, options: Parameters<typeof orchestratorModel>[0] = {}) => {
  const model = orchestratorModel(options);
  return planDomain(model, domainId, { authoredContent: registryOf(model) });
};

test("a domain plan classifies its L1 topics in sibling order", () => {
  const d1 = plan("d1");
  assert.equal(d1.title, "Domain One");
  assert.equal(d1.ordinal, "01");
  assert.deepEqual(d1.topics.map((topic) => [topic.placementId, topic.status]), [
    ["c", "deferred"],
    ["single", "eligible"],
    ["done", "authored"],
    ["t-in-d1", "deferred"],
  ]);
  assert.deepEqual(d1.authored, ["done"]);
  assert.deepEqual(d1.eligible, ["single"]);
  assert.deepEqual(d1.stops, []);
  assert.equal(d1.complete, false);
});

test("the facet rule gives authoring to the preferred placement's domain only", () => {
  const [inD1] = plan("d1").topics;
  assert.equal(inD1.facet, true);
  assert.deepEqual(inD1.carriers.map((carrier) => carrier.placementId), ["c", "c-in-d2"]);
  assert.match(inD1.reason!, /^facet rule: authoring owned by Domain Two \(preferred placement c-in-d2\)$/);
  const inD2 = plan("d2").topics.find((topic) => topic.conceptId === "c")!;
  assert.equal(inD2.status, "eligible");
  assert.equal(inD2.facet, true);
});

test("a single child layer is owned where it is carried, even when the preferred placement is a leaf elsewhere", () => {
  const inD1 = plan("d1").topics.find((topic) => topic.conceptId === "t")!;
  assert.equal(inD1.preferredPlacementId, "t-in-d1");
  assert.equal(inD1.status, "deferred");
  assert.equal(inD1.reason, "its child layer is carried by t in Domain Two");
  assert.deepEqual(plan("d2").eligible, ["c", "t"]);
});

test("several child layers without a preferred carrier stop every domain that holds the concept", () => {
  for (const domainId of ["d1", "d2", "d3"]) {
    const { stops, complete } = plan(domainId, { ambiguous: true });
    assert.deepEqual(stops.map((stop) => stop.conceptId), ["m"], domainId);
    assert.match(stops[0].reason, /ownership is unclear/);
    assert.equal(complete, false);
  }
});

test("registry inconsistencies stop the plan instead of being guessed around", () => {
  const model = orchestratorModel({ authored: ["single"] });
  const unregistered = planDomain(model, "d1", { authoredContent: registryOf(model).filter((id) => id !== "single") });
  assert.deepEqual(unregistered.stops, [{ conceptId: "single", reason: "registry inconsistency (content-not-registered)" }]);
  const missing = planDomain(orchestratorModel(), "d1", { authoredContent: [...registryOf(orchestratorModel()), "single"] });
  assert.deepEqual(missing.stops, [{ conceptId: "single", reason: "registry inconsistency (registered-without-content)" }]);
});

test("a domain is complete once every topic it owns is authored", () => {
  assert.equal(plan("d1", { authored: ["single"] }).complete, true);
  assert.equal(plan("d3").complete, true);
});

test("domains are listed in canonical order and the next incomplete one is reported, never started", () => {
  const model = orchestratorModel();
  const options = { authoredContent: registryOf(model) };
  assert.deepEqual(listDomains(model, options).map((domain) => [domain.domainId, domain.complete, domain.eligible]), [
    ["d1", false, 1],
    ["d2", false, 2],
    ["d3", true, 0],
  ]);
  assert.equal(nextIncompleteDomain(model, options)?.domainId, "d1");
  const later = orchestratorModel({ authored: ["single"] });
  assert.equal(nextIncompleteDomain(later, { authoredContent: registryOf(later) })?.domainId, "d2");
  const finished = orchestratorModel({ authored: ["single", "c", "t"] });
  assert.equal(nextIncompleteDomain(finished, { authoredContent: registryOf(finished) }), undefined);
});

test("an unknown domain fails through the inspector", () => {
  assert.throws(() => plan("nowhere"), MapAuthoringContextError);
  assert.throws(() => plan("single"), MapAuthoringContextError);
});

test("render expectations cover every placement with its exact children and the other facets' children", () => {
  assert.deepEqual(renderExpectations(orchestratorModel(), ["c", "t"]), [
    {
      conceptId: "c",
      placements: [
        { placementId: "c", children: ["a", "b"], foreignChildren: ["x", "y"] },
        { placementId: "c-in-d2", children: ["x", "y"], foreignChildren: ["a", "b"] },
      ],
    },
    {
      conceptId: "t",
      placements: [
        // Children follow sibling order (the fixture orders Victor before Uniform).
        { placementId: "t", children: ["v", "u"], foreignChildren: [] },
        // A leaf: nothing may render beneath it, and nothing of the carrier's layer either.
        { placementId: "t-in-d1", children: [], foreignChildren: ["v", "u"] },
      ],
    },
  ]);
});

test("the render sample picks one authored concept of each render shape the model has", () => {
  const model = orchestratorModel({ authored: ["single", "c", "t"] });
  assert.deepEqual(renderSample(model, ["done", "single", "c", "t"]), ["done", "c", "t"]);
  assert.deepEqual(renderSample(model, ["single"]), ["single"]);
  assert.deepEqual(renderSample(model, []), []);
});

test("on the canonical ontology, every L1 topic is classified and owned by at most one domain", () => {
  const domains = listDomains(mapKnowledge);
  assert.equal(domains.length, mapKnowledge.placements.filter((placement) => !placement.parentPlacementId).length);
  const owners = new Map<string, string[]>();
  for (const { domainId } of domains) {
    const domainPlan = planDomain(mapKnowledge, domainId);
    assert.deepEqual(domainPlan.stops, [], domainId);
    for (const topic of domainPlan.topics) {
      assert.equal(topic.status === "authored", AUTHORED_CONTENT_CONCEPTS.includes(topic.conceptId), topic.conceptId);
      if (topic.status === "eligible") owners.set(topic.conceptId, [...(owners.get(topic.conceptId) ?? []), domainId]);
      if (topic.status === "deferred") assert.ok(topic.reason, topic.conceptId);
    }
  }
  for (const [conceptId, domainIds] of owners) assert.equal(domainIds.length, 1, `${conceptId} owned by ${domainIds.join(", ")}`);
  assert.equal(nextIncompleteDomain(mapKnowledge)?.domainId, domains.find((domain) => !domain.complete)?.domainId);
});
