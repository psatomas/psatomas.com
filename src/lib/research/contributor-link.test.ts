import assert from "node:assert/strict";
import { test } from "node:test";
import { contributorLink } from "./contributor-link.ts";

test("contributor links keep bearer credentials out of HTTP path and query", () => {
  const token = "t".repeat(64);
  for (const kind of ["accept", "reauth"] as const) {
    const url = new URL(contributorLink("https://example.test", kind, token));
    assert.equal(url.pathname, `/research/contribute/${kind}`);
    assert.equal(url.search, "");
    assert.equal(url.hash, `#${token}`);
  }
});
