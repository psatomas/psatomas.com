import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateReadingMinutes } from "./reading-time.ts";

test("empty content still reads as 1 minute, never 0", () => {
  assert.equal(estimateReadingMinutes(""), 1);
});

test("a short paragraph rounds up to 1 minute", () => {
  assert.equal(estimateReadingMinutes("a ".repeat(50)), 1);
});

test("400 words rounds up to 2 minutes", () => {
  assert.equal(estimateReadingMinutes("word ".repeat(400)), 2);
});

test("exactly 200 words is 1 minute, not 2", () => {
  assert.equal(estimateReadingMinutes("word ".repeat(200)), 1);
});
