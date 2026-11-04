import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmationPage, redeemPost } from "./redemption-page.ts";

test("token-bearing GET confirmation is inert, no-store, and referrer-safe", async () => {
  const response = confirmationPage("Accept contributor invitation");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(await response.text(), /form method="post"/);
});

test("only same-origin POST redeems and redirects without the credential", async () => {
  let calls = 0;
  const redeem = async () => { calls++; return { ok:true as const, data:{ sessionToken:"s".repeat(64), sessionExpiresAt:"2026-11-01T00:00:00.000Z" } }; };
  const denied = await redeemPost(new Request("https://example.test/research/contribute/accept/secret", { method:"POST", headers:{ origin:"https://attacker.test" } }), redeem);
  assert.equal(calls, 0); assert.match(denied.headers.get("location") ?? "", /invalid=1/);
  const accepted = await redeemPost(new Request("https://example.test/research/contribute/accept/secret", { method:"POST", headers:{ origin:"https://example.test" } }), redeem);
  assert.equal(calls, 1); assert.equal(accepted.headers.get("location"), "https://example.test/research/contribute");
  assert.match(accepted.headers.get("set-cookie") ?? "", /HttpOnly/); assert.match(accepted.headers.get("set-cookie") ?? "", /SameSite=Lax/);
});
