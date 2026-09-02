import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug.ts";

test("lowercases and hyphenates a normal title", () => {
  assert.equal(slugify("Modeling the EVM"), "modeling-the-evm");
});

test("collapses runs of non-alphanumeric characters into one hyphen", () => {
  assert.equal(slugify("Intents, MEV & Scoring!!"), "intents-mev-scoring");
});

test("trims leading and trailing hyphens", () => {
  assert.equal(slugify("  -- Oracle Caches --  "), "oracle-caches");
});

test("is idempotent — slugifying an already-valid slug is a no-op", () => {
  assert.equal(slugify("already-a-slug"), "already-a-slug");
});
