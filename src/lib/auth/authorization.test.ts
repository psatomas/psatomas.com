import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedAuthor } from "./is-authorized-author.ts";

// isAuthorizedAuthor is pure — no session lookup, no next-auth machinery,
// no async env resolution — so the authorization boundary is tested
// directly here, independent of Google itself. The actual Google OAuth
// round-trip can only be verified manually through the real Cloudflare
// preview/runtime (see the implementation report), not faked in a unit
// test.

test("the configured author's verified email is authorized", () => {
  assert.equal(isAuthorizedAuthor("author@example.com", "author@example.com", true), true);
});

test("a different email is not authorized", () => {
  assert.equal(
    isAuthorizedAuthor("someone-else@example.com", "author@example.com", true),
    false,
  );
});

test("email comparison is case-insensitive", () => {
  assert.equal(isAuthorizedAuthor("author@example.com", "Author@Example.com", true), true);
});

test("an explicitly unverified email is never authorized, even if it matches", () => {
  assert.equal(isAuthorizedAuthor("author@example.com", "author@example.com", false), false);
});

test("a genuinely absent verified-email signal doesn't fail the check by itself", () => {
  assert.equal(
    isAuthorizedAuthor("author@example.com", "author@example.com", undefined),
    true,
  );
});

test("missing configured author email fails closed, not open", () => {
  assert.equal(isAuthorizedAuthor("author@example.com", undefined, true), false);
  assert.equal(isAuthorizedAuthor("author@example.com", "", true), false);
});

test("no authenticated email at all is not authorized", () => {
  assert.equal(isAuthorizedAuthor(null, "author@example.com", true), false);
  assert.equal(isAuthorizedAuthor(undefined, "author@example.com", true), false);
});
